// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VerifiableTradeExecutor
 * @notice Records DeFi trade submissions and their verified execution results.
 *
 * @dev Off-chain flow:
 *   1. Trader calls submitTrade()          — creates an on-chain record
 *   2. Off-chain executor fills the order  — possibly inside a TEE
 *   3. Executor calls recordTradeResult()  — anchors result + attestation hash
 *   4. Anyone calls verifyAttestation()    — confirms execution integrity
 *
 * The contract does NOT move tokens; it is a verifiable ledger of execution.
 * Token settlement is handled by VerifyTrade.sol or an external DEX adapter.
 */
contract VerifiableTradeExecutor is Ownable, ReentrancyGuard, Pausable {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /**
     * @notice Full trade record stored on-chain.
     * @param tradeId              Auto-incremented unique identifier.
     * @param trader               Address that submitted the trade.
     * @param encryptedOrder       IPFS / 0G Storage hash of the encrypted order details.
     * @param inputAmount          Amount of tokenIn provided (in tokenIn's native decimals).
     * @param outputAmount         Amount of tokenOut received (filled after execution).
     * @param tokenIn              Symbol or address string of the input token.
     * @param tokenOut             Symbol or address string of the output token.
     * @param maxSlippagePercent   Maximum tolerated slippage, scaled by 1e2 (50 = 0.5%).
     * @param actualSlippagePercent Actual slippage experienced, scaled by 1e2.
     * @param attestationHash      Hash of the TEE / 0G-AI execution attestation.
     * @param timestamp            Block timestamp when the trade was submitted.
     * @param isExecuted           True once recordTradeResult() has been called.
     * @param isFair               True if actualSlippage <= maxSlippage.
     * @param executionDetails     Human-readable or JSON string with execution metadata.
     */
    struct Trade {
        uint256 tradeId;
        address trader;
        string encryptedOrder;
        uint256 inputAmount;
        uint256 outputAmount;
        string tokenIn;
        string tokenOut;
        uint256 maxSlippagePercent;
        uint256 actualSlippagePercent;
        string attestationHash;
        uint256 timestamp;
        bool isExecuted;
        bool isFair;
        string executionDetails;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @dev Auto-incrementing counter; tradeId starts at 1.
    uint256 private _nextTradeId;

    /// @dev tradeId → Trade record.
    mapping(uint256 => Trade) private _trades;

    /// @dev trader → list of their tradeIds.
    mapping(address => uint256[]) private _traderHistory;

    /// @dev Addresses permitted to call recordTradeResult().
    mapping(address => bool) public authorizedExecutors;

    /// @dev Total trades submitted (informational counter).
    uint256 public totalTradesSubmitted;

    /// @dev Total trades executed (informational counter).
    uint256 public totalTradesExecuted;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new trade is submitted.
    event TradeSubmitted(
        uint256 indexed tradeId,
        address indexed trader,
        string tokenIn,
        string tokenOut,
        uint256 inputAmount,
        uint256 maxSlippagePercent,
        uint256 timestamp
    );

    /// @notice Emitted when a trade result is recorded by an executor.
    event TradeExecuted(
        uint256 indexed tradeId,
        address indexed trader,
        uint256 outputAmount,
        uint256 actualSlippagePercent,
        bool isFair,
        string attestationHash,
        uint256 timestamp
    );

    /// @notice Emitted when an executor's authorization changes.
    event ExecutorUpdated(address indexed executor, bool authorized);

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    error ZeroInputAmount();
    error EmptyTokenSymbol();
    error EmptyOrderHash();
    error TradeNotFound(uint256 tradeId);
    error TradeAlreadyExecuted(uint256 tradeId);
    error UnauthorizedExecutor(address caller);
    error AttestationMismatch(uint256 tradeId);
    error InvalidSlippage(uint256 provided, uint256 max);
    error ZeroAddress();

    /// @dev Slippage is scaled by 100 so 10000 = 100.00%.
    uint256 public constant MAX_SLIPPAGE_SCALE = 10_000;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {
        _nextTradeId = 1; // Reserve 0 as "not found" sentinel
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
    // Trader-facing
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a trade for off-chain execution.
     *
     * @dev The caller must supply an encrypted order hash (IPFS / 0G Storage CID)
     *      so the full order details can be fetched and verified off-chain without
     *      exposing them on-chain before execution.
     *
     * @param encryptedOrder   IPFS / 0G Storage content hash of the encrypted order.
     * @param inputAmount      Amount of tokenIn the trader is providing.
     * @param tokenIn          Symbol or address of the input token (e.g. "USDC").
     * @param tokenOut         Symbol or address of the output token (e.g. "WETH").
     * @param maxSlippagePercent  Max acceptable slippage × 100 (e.g. 50 = 0.5%).
     * @return tradeId         Unique identifier for this trade.
     */
    /**
     * @notice Submit a trade on behalf of a specific trader address.
     *
     * @dev The `trader` parameter is the actual end-user's wallet.
     *      The caller (msg.sender) must be an authorized executor/relayer.
     *      This separates relayer gas from user identity, enabling
     *      meta-transaction and institutional compliance flows.
     *
     * @param trader           The end-user's wallet address (for audit trail).
     * @param encryptedOrder   0G Storage CID of the AES-256-GCM encrypted order.
     * @param inputAmount      Amount of tokenIn the trader is providing.
     * @param tokenIn          Symbol of the input token (e.g. "USDC").
     * @param tokenOut         Symbol of the output token (e.g. "WETH").
     * @param maxSlippagePercent  Max acceptable slippage × 100 (50 = 0.5%).
     * @return tradeId         Unique identifier for this trade.
     */
    function submitTrade(
        address trader,
        string calldata encryptedOrder,
        uint256 inputAmount,
        string calldata tokenIn,
        string calldata tokenOut,
        uint256 maxSlippagePercent
    ) external nonReentrant whenNotPaused returns (uint256 tradeId) {
        if (trader == address(0)) revert ZeroAddress();
        if (inputAmount == 0) revert ZeroInputAmount();
        if (bytes(encryptedOrder).length == 0) revert EmptyOrderHash();
        if (bytes(encryptedOrder).length > 256) revert EmptyOrderHash(); // guard unbounded storage
        if (bytes(tokenIn).length == 0 || bytes(tokenOut).length == 0) revert EmptyTokenSymbol();
        if (maxSlippagePercent > MAX_SLIPPAGE_SCALE) {
            revert InvalidSlippage(maxSlippagePercent, MAX_SLIPPAGE_SCALE);
        }

        tradeId = _nextTradeId++;

        _trades[tradeId] = Trade({
            tradeId:              tradeId,
            trader:               trader,
            encryptedOrder:       encryptedOrder,
            inputAmount:          inputAmount,
            outputAmount:         0,
            tokenIn:              tokenIn,
            tokenOut:             tokenOut,
            maxSlippagePercent:   maxSlippagePercent,
            actualSlippagePercent: 0,
            attestationHash:      "",
            timestamp:            block.timestamp,
            isExecuted:           false,
            isFair:               false,
            executionDetails:     ""
        });

        _traderHistory[trader].push(tradeId);
        totalTradesSubmitted++;

        emit TradeSubmitted(
            tradeId,
            trader,
            tokenIn,
            tokenOut,
            inputAmount,
            maxSlippagePercent,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // Executor-facing
    // -------------------------------------------------------------------------

    /**
     * @notice Record the result of an executed trade.
     *
     * @dev Only callable by authorized executors. The attestationHash is the
     *      keccak256 or TEE-attestation hash that proves execution happened
     *      inside a trusted environment at the stated price.
     *
     * @param tradeId             Target trade.
     * @param outputAmount        Actual amount of tokenOut received.
     * @param attestationHash     Hash of the TEE / 0G-AI proof attestation.
     * @param actualSlippagePercent Actual slippage experienced × 100.
     * @param executionDetails    JSON or human-readable metadata about execution.
     * @return success            True if the result was recorded.
     */
    function recordTradeResult(
        uint256 tradeId,
        uint256 outputAmount,
        string calldata attestationHash,
        uint256 actualSlippagePercent,
        string calldata executionDetails
    ) external nonReentrant onlyExecutor whenNotPaused returns (bool success) {
        Trade storage trade = _trades[tradeId];

        if (trade.trader == address(0)) revert TradeNotFound(tradeId);
        if (trade.isExecuted) revert TradeAlreadyExecuted(tradeId);
        if (bytes(attestationHash).length == 0) revert EmptyOrderHash();

        bool fair = actualSlippagePercent <= trade.maxSlippagePercent;

        trade.outputAmount           = outputAmount;
        trade.attestationHash        = attestationHash;
        trade.actualSlippagePercent  = actualSlippagePercent;
        trade.executionDetails       = executionDetails;
        trade.isExecuted             = true;
        trade.isFair                 = fair;

        totalTradesExecuted++;

        emit TradeExecuted(
            tradeId,
            trade.trader,
            outputAmount,
            actualSlippagePercent,
            fair,
            attestationHash,
            block.timestamp
        );

        return true;
    }

    // -------------------------------------------------------------------------
    // Read-only
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieve full details for a specific trade.
     * @param tradeId Trade identifier.
     * @return trade The Trade struct.
     */
    function getTrade(uint256 tradeId) external view returns (Trade memory trade) {
        if (_trades[tradeId].trader == address(0)) revert TradeNotFound(tradeId);
        return _trades[tradeId];
    }

    /**
     * @notice Verify that the stored attestation matches an expected hash.
     *
     * @dev Compares keccak256 of the stored attestation string against
     *      keccak256 of the expected string, avoiding calldata byte-by-byte
     *      comparison gas costs.
     *
     * @param tradeId      Trade to check.
     * @param expectedHash The expected attestation hash string.
     * @return matches     True if stored attestation equals expectedHash.
     */
    function verifyAttestation(
        uint256 tradeId,
        string calldata expectedHash
    ) external view returns (bool matches) {
        Trade storage trade = _trades[tradeId];
        if (trade.trader == address(0)) revert TradeNotFound(tradeId);
        return keccak256(bytes(trade.attestationHash)) == keccak256(bytes(expectedHash));
    }

    /**
     * @notice Get all tradeIds submitted by a given trader.
     * @param trader The trader's address.
     * @return tradeIds Array of trade identifiers.
     */
    function getTradeHistory(address trader) external view returns (uint256[] memory tradeIds) {
        return _traderHistory[trader];
    }

    /**
     * @notice Batch-fetch multiple trades in one call (saves frontend RPC calls).
     * @param tradeIds Array of trade IDs to fetch.
     * @return trades  Array of Trade structs in the same order.
     */
    function getTrades(uint256[] calldata tradeIds) external view returns (Trade[] memory trades) {
        trades = new Trade[](tradeIds.length);
        for (uint256 i = 0; i < tradeIds.length; i++) {
            if (_trades[tradeIds[i]].trader == address(0)) revert TradeNotFound(tradeIds[i]);
            trades[i] = _trades[tradeIds[i]];
        }
    }

    /**
     * @notice Next tradeId that will be assigned (useful for frontend polling).
     */
    function nextTradeId() external view returns (uint256) {
        return _nextTradeId;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Grant or revoke executor privileges.
     * @param executor  Address to update.
     * @param authorized True to grant, false to revoke.
     */
    function setExecutor(address executor, bool authorized) external onlyOwner {
        if (executor == address(0)) revert ZeroAddress();
        authorizedExecutors[executor] = authorized;
        emit ExecutorUpdated(executor, authorized);
    }

    /// @notice Pause all state-changing functions.
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause the contract.
    function unpause() external onlyOwner { _unpause(); }
}
