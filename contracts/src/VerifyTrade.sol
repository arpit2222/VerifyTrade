// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title VerifyTrade
 * @notice Fair DeFi trading with cryptographic proof of execution
 *
 * Flow:
 *   1. Trader calls submitOrder()  — order committed on-chain
 *   2. Off-chain executor fills the order, gets 0G AI price validation
 *   3. Executor calls executeOrder() with proof signature
 *   4. Contract verifies proof, transfers tokens, emits TradeProof event
 *   5. Anyone can verify the proof via verifyProof()
 */
contract VerifyTrade is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum OrderStatus {
        Pending,
        Committed,
        Executed,
        Cancelled,
        Failed
    }

    struct Order {
        bytes32 id;
        address trader;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint16 maxSlippageBps;
        uint256 deadline;
        OrderStatus status;
        uint256 createdAt;
    }

    struct TradeProof {
        bytes32 tradeHash;
        bytes32 orderId;
        address trader;
        uint256 executionPrice;   // 18-decimal fixed point
        uint256 executionTimestamp;
        bytes proofSignature;     // EIP-712 signature from 0G AI validator
        bytes32 storageRef;       // 0G Storage content hash
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @dev orderId → Order
    mapping(bytes32 => Order) public orders;

    /// @dev orderId → TradeProof
    mapping(bytes32 => TradeProof) public proofs;

    /// @dev trader → list of their order IDs
    mapping(address => bytes32[]) public traderOrders;

    /// @dev authorized executors (off-chain bots)
    mapping(address => bool) public authorizedExecutors;

    /// @dev 0G AI validator address — signs execution proofs
    address public proofValidator;

    uint256 public totalOrdersSubmitted;
    uint256 public totalOrdersExecuted;

    uint16 public constant MAX_SLIPPAGE_BPS = 1000; // 10%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OrderSubmitted(
        bytes32 indexed orderId,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    );

    event OrderExecuted(
        bytes32 indexed orderId,
        address indexed trader,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionPrice,
        bytes32 proofHash
    );

    event OrderCancelled(bytes32 indexed orderId, address indexed trader);

    event ProofVerified(bytes32 indexed orderId, bool valid);

    event ExecutorUpdated(address indexed executor, bool authorized);

    event ValidatorUpdated(address indexed oldValidator, address indexed newValidator);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OrderNotFound(bytes32 orderId);
    error OrderAlreadyFinal(bytes32 orderId);
    error OrderExpired(bytes32 orderId);
    error SlippageTooHigh(uint16 requested, uint16 max);
    error InvalidProof(bytes32 orderId);
    error UnauthorizedExecutor(address caller);
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error ZeroAmount();
    error InvalidDeadline();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _proofValidator) Ownable(msg.sender) {
        require(_proofValidator != address(0), "Invalid validator");
        proofValidator = _proofValidator;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyExecutor() {
        if (!authorizedExecutors[msg.sender]) {
            revert UnauthorizedExecutor(msg.sender);
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Trader actions
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a trade order. Tokens are pulled from the trader here.
     * @param tokenIn  Token the trader is selling
     * @param tokenOut Token the trader wants to buy
     * @param amountIn Exact amount of tokenIn to spend
     * @param minAmountOut Minimum tokenOut to receive (slippage protection)
     * @param maxSlippageBps Additional slippage tolerance in basis points
     * @param deadline Unix timestamp after which the order expires
     * @return orderId Unique identifier for this order
     */
    function submitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint16 maxSlippageBps,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (bytes32 orderId) {
        if (amountIn == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (maxSlippageBps > MAX_SLIPPAGE_BPS) {
            revert SlippageTooHigh(maxSlippageBps, MAX_SLIPPAGE_BPS);
        }

        orderId = keccak256(
            abi.encodePacked(msg.sender, tokenIn, tokenOut, amountIn, block.number, totalOrdersSubmitted)
        );

        orders[orderId] = Order({
            id: orderId,
            trader: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            maxSlippageBps: maxSlippageBps,
            deadline: deadline,
            status: OrderStatus.Committed,
            createdAt: block.timestamp
        });

        traderOrders[msg.sender].push(orderId);
        totalOrdersSubmitted++;

        // Pull tokens from trader into this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        emit OrderSubmitted(orderId, msg.sender, tokenIn, tokenOut, amountIn, minAmountOut);
    }

    /**
     * @notice Cancel a pending order and refund tokenIn.
     */
    function cancelOrder(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.trader == address(0)) revert OrderNotFound(orderId);
        if (order.trader != msg.sender && !authorizedExecutors[msg.sender]) {
            revert UnauthorizedExecutor(msg.sender);
        }
        if (order.status != OrderStatus.Committed && order.status != OrderStatus.Pending) {
            revert OrderAlreadyFinal(orderId);
        }

        order.status = OrderStatus.Cancelled;

        IERC20(order.tokenIn).safeTransfer(order.trader, order.amountIn);

        emit OrderCancelled(orderId, order.trader);
    }

    // -------------------------------------------------------------------------
    // Executor actions
    // -------------------------------------------------------------------------

    /**
     * @notice Execute an order with a cryptographic proof of fair execution.
     * @param orderId      Target order
     * @param amountOut    Actual output amount delivered to trader
     * @param executionPrice Execution price (18 decimals)
     * @param storageRef   0G Storage hash of the full execution audit log
     * @param proofSig     EIP-712 signature from the 0G AI proof validator
     */
    function executeOrder(
        bytes32 orderId,
        uint256 amountOut,
        uint256 executionPrice,
        bytes32 storageRef,
        bytes calldata proofSig
    ) external nonReentrant onlyExecutor whenNotPaused {
        Order storage order = orders[orderId];
        if (order.trader == address(0)) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Committed) revert OrderAlreadyFinal(orderId);
        if (block.timestamp > order.deadline) revert OrderExpired(orderId);
        if (amountOut < order.minAmountOut) {
            revert InsufficientOutput(amountOut, order.minAmountOut);
        }

        // Build and verify the proof
        bytes32 tradeHash = _buildTradeHash(orderId, order, amountOut, executionPrice);
        if (!_verifyProofSignature(tradeHash, proofSig)) {
            revert InvalidProof(orderId);
        }

        // Store proof for public verification
        proofs[orderId] = TradeProof({
            tradeHash: tradeHash,
            orderId: orderId,
            trader: order.trader,
            executionPrice: executionPrice,
            executionTimestamp: block.timestamp,
            proofSignature: proofSig,
            storageRef: storageRef
        });

        order.status = OrderStatus.Executed;
        totalOrdersExecuted++;

        // Deliver tokenOut to trader (executor must have pre-approved this contract)
        IERC20(order.tokenOut).safeTransferFrom(msg.sender, order.trader, amountOut);

        // Release tokenIn to executor
        IERC20(order.tokenIn).safeTransfer(msg.sender, order.amountIn);

        emit OrderExecuted(orderId, order.trader, order.amountIn, amountOut, executionPrice, tradeHash);
    }

    // -------------------------------------------------------------------------
    // Public verification
    // -------------------------------------------------------------------------

    /**
     * @notice Verify that a stored proof is authentic.
     * @return valid True if the proof signature matches the recorded trade hash
     */
    function verifyProof(bytes32 orderId) external view returns (bool valid) {
        TradeProof storage proof = proofs[orderId];
        if (proof.tradeHash == bytes32(0)) return false;
        return _verifyProofSignature(proof.tradeHash, proof.proofSignature);
    }

    /**
     * @notice Fetch a trader's full order history.
     */
    function getTraderOrders(address trader) external view returns (bytes32[] memory) {
        return traderOrders[trader];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _buildTradeHash(
        bytes32 orderId,
        Order storage order,
        uint256 amountOut,
        uint256 executionPrice
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                orderId,
                order.trader,
                order.tokenIn,
                order.tokenOut,
                order.amountIn,
                amountOut,
                executionPrice,
                block.timestamp,
                block.number
            )
        );
    }

    function _verifyProofSignature(bytes32 tradeHash, bytes memory sig) internal view returns (bool) {
        if (sig.length != 65) return false;

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", tradeHash)
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;

        address recovered = ecrecover(ethSignedHash, v, r, s);
        return recovered != address(0) && recovered == proofValidator;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setExecutor(address executor, bool authorized) external onlyOwner {
        authorizedExecutors[executor] = authorized;
        emit ExecutorUpdated(executor, authorized);
    }

    function setProofValidator(address newValidator) external onlyOwner {
        require(newValidator != address(0), "Invalid validator");
        emit ValidatorUpdated(proofValidator, newValidator);
        proofValidator = newValidator;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdrawal — only callable when paused
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner whenPaused {
        IERC20(token).safeTransfer(to, amount);
    }
}
