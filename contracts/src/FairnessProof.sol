// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FairnessProof
 * @notice Records and verifies TEE (Trusted Execution Environment) attestations
 *         that prove a trade was executed fairly at the agreed-upon price.
 *
 * @dev A "proof" in this context is an attestation measurement produced by a TEE
 *      or 0G AI validator after verifying that:
 *        (a) the execution price matched the committed price
 *        (b) slippage did not exceed the trader's stated limit
 *        (c) no front-running occurred between commit and execution
 *
 *      This contract acts as an immutable public audit log. It does NOT move funds.
 *
 * Integration:
 *   After VerifiableTradeExecutor.recordTradeResult() is called, the off-chain
 *   TEE executor calls recordProof() with the raw measurement string.
 *   Frontends use getProof() / isTradeFair() to display verification badges.
 */
contract FairnessProof is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /**
     * @notice Immutable proof record tied to a trade.
     * @param proofId                 Auto-incremented unique identifier.
     * @param tradeId                 Corresponding trade in VerifiableTradeExecutor.
     * @param teeMeasurement          Raw TEE attestation hash / measurement string.
     * @param expectedSlippagePercent Slippage limit the trader accepted (× 100).
     * @param actualSlippagePercent   Slippage that actually occurred (× 100).
     * @param slippageWithinLimit     True if actual <= expected.
     * @param timestamp               Block timestamp of proof recording.
     * @param executorAddress         String representation of the executor/TEE enclave.
     */
    struct ExecutionProof {
        uint256 proofId;
        uint256 tradeId;
        string teeMeasurement;
        uint256 expectedSlippagePercent;
        uint256 actualSlippagePercent;
        bool slippageWithinLimit;
        uint256 timestamp;
        string executorAddress;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _nextProofId;

    /// @dev proofId → ExecutionProof.
    mapping(uint256 => ExecutionProof) private _proofs;

    /// @dev tradeId → list of proofIds (a trade may have multiple attempts).
    mapping(uint256 => uint256[]) private _tradeProofs;

    /// @dev Addresses allowed to call recordProof().
    mapping(address => bool) public authorizedProvers;

    uint256 public totalProofsRecorded;
    uint256 public totalFairProofs;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new proof is recorded.
    event ProofRecorded(
        uint256 indexed proofId,
        uint256 indexed tradeId,
        bool slippageWithinLimit,
        uint256 actualSlippagePercent,
        uint256 timestamp
    );

    /// @notice Emitted when a prover's authorization changes.
    event ProverUpdated(address indexed prover, bool authorized);

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    error ProofNotFound(uint256 proofId);
    error TradeHasNoProofs(uint256 tradeId);
    error EmptyTeeMeasurement();
    error EmptyExecutorAddress();
    error UnauthorizedProver(address caller);
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {
        _nextProofId = 1;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyProver() {
        if (!authorizedProvers[msg.sender]) {
            revert UnauthorizedProver(msg.sender);
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Core write functions
    // -------------------------------------------------------------------------

    /**
     * @notice Record a TEE execution proof for a trade.
     *
     * @dev `teeMeasurement` is the raw attestation produced by the TEE enclave
     *      (e.g. a Base64-encoded Intel TDX quote or 0G AI validator signature).
     *      Storing it on-chain makes the proof permanently auditable.
     *
     * @param tradeId                 Corresponding trade ID from VerifiableTradeExecutor.
     * @param teeMeasurement          Raw attestation string from the TEE / 0G-AI validator.
     * @param expectedSlippagePercent Slippage limit the trader set (× 100).
     * @param actualSlippagePercent   Slippage that occurred during execution (× 100).
     * @param executorAddress         String identifier of the executing TEE enclave or bot.
     * @return proofId                Unique identifier for this proof.
     */
    function recordProof(
        uint256 tradeId,
        string calldata teeMeasurement,
        uint256 expectedSlippagePercent,
        uint256 actualSlippagePercent,
        string calldata executorAddress
    ) external nonReentrant onlyProver returns (uint256 proofId) {
        if (bytes(teeMeasurement).length == 0) revert EmptyTeeMeasurement();
        if (bytes(executorAddress).length == 0) revert EmptyExecutorAddress();

        bool withinLimit = actualSlippagePercent <= expectedSlippagePercent;
        proofId = _nextProofId++;

        _proofs[proofId] = ExecutionProof({
            proofId:                 proofId,
            tradeId:                 tradeId,
            teeMeasurement:          teeMeasurement,
            expectedSlippagePercent: expectedSlippagePercent,
            actualSlippagePercent:   actualSlippagePercent,
            slippageWithinLimit:     withinLimit,
            timestamp:               block.timestamp,
            executorAddress:         executorAddress
        });

        _tradeProofs[tradeId].push(proofId);
        totalProofsRecorded++;
        if (withinLimit) totalFairProofs++;

        emit ProofRecorded(
            proofId,
            tradeId,
            withinLimit,
            actualSlippagePercent,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // Read-only
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieve a proof record by its ID.
     * @param proofId The proof identifier.
     * @return proof  The full ExecutionProof struct.
     */
    function getProof(uint256 proofId) external view returns (ExecutionProof memory proof) {
        if (_proofs[proofId].timestamp == 0) revert ProofNotFound(proofId);
        return _proofs[proofId];
    }

    /**
     * @notice Check whether a specific proof attests to fair execution.
     * @param proofId The proof identifier.
     * @return fair   True if actual slippage was within the expected limit.
     */
    function isTradeFair(uint256 proofId) external view returns (bool fair) {
        if (_proofs[proofId].timestamp == 0) revert ProofNotFound(proofId);
        return _proofs[proofId].slippageWithinLimit;
    }

    /**
     * @notice Get all proofIds associated with a trade.
     *
     * @dev A trade can have multiple proofs if, for example, the first
     *      execution attempt failed and was retried.
     *
     * @param tradeId The trade to look up.
     * @return proofIds Array of proof identifiers for that trade.
     */
    function getProofsByTrade(uint256 tradeId) external view returns (uint256[] memory proofIds) {
        if (_tradeProofs[tradeId].length == 0) revert TradeHasNoProofs(tradeId);
        return _tradeProofs[tradeId];
    }

    /**
     * @notice Get the raw TEE measurement string for a proof.
     *
     * @dev Use this to feed the attestation into a verifier SDK off-chain
     *      (e.g. Intel SGX / TDX verification libraries).
     *
     * @param proofId          The proof identifier.
     * @return teeMeasurement  Raw attestation string.
     */
    function getTeeAttestation(uint256 proofId) external view returns (string memory teeMeasurement) {
        if (_proofs[proofId].timestamp == 0) revert ProofNotFound(proofId);
        return _proofs[proofId].teeMeasurement;
    }

    /**
     * @notice Return the most recent proof for a trade.
     * @param tradeId Trade to look up.
     * @return proof  The latest ExecutionProof for that trade.
     */
    function getLatestProofForTrade(uint256 tradeId) external view returns (ExecutionProof memory proof) {
        uint256[] storage ids = _tradeProofs[tradeId];
        if (ids.length == 0) revert TradeHasNoProofs(tradeId);
        return _proofs[ids[ids.length - 1]];
    }

    /**
     * @notice Fairness ratio across all recorded proofs (scaled × 1e4).
     * @return ratio Fair proofs / total proofs × 10000 (basis points).
     */
    function globalFairnessRatioBps() external view returns (uint256 ratio) {
        if (totalProofsRecorded == 0) return 0;
        return (totalFairProofs * 10_000) / totalProofsRecorded;
    }

    /**
     * @notice Returns the next proofId to be assigned.
     */
    function nextProofId() external view returns (uint256) {
        return _nextProofId;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Grant or revoke prover privileges.
     * @param prover     Address to update.
     * @param authorized True to grant, false to revoke.
     */
    function setProver(address prover, bool authorized) external onlyOwner {
        if (prover == address(0)) revert ZeroAddress();
        authorizedProvers[prover] = authorized;
        emit ProverUpdated(prover, authorized);
    }
}
