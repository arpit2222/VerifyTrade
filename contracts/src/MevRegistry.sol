// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MevRegistry
 * @notice Immutable on-chain audit log of MEV (Maximal Extractable Value) checks
 *         performed during trade execution.
 *
 * @dev Each trade passes through an MEV-detection step in the off-chain executor.
 *      If MEV is detected (e.g. sandwich attack, front-run), the executor rejects
 *      or delays the trade and records the protection event here.
 *
 *      This registry allows:
 *        - Traders to prove they were protected from MEV
 *        - Protocols to compute aggregate MEV savings
 *        - Researchers to analyze MEV patterns over time
 *
 *      The contract does NOT handle funds; all amounts are informational.
 */
contract MevRegistry is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /**
     * @notice A single MEV check result tied to one trade.
     * @param checkId            Auto-incremented unique identifier.
     * @param tradeId            Corresponding trade ID from VerifiableTradeExecutor.
     * @param trader             Trader address (for indexed lookup).
     * @param mevDetected        True if an MEV threat was identified.
     * @param mevAmount          Estimated value at risk from MEV (in USD × 1e6, 0 if none).
     * @param protectionSavings  Actual value saved by the protection mechanism (USD × 1e6).
     * @param timestamp          Block timestamp of the check.
     * @param protectionMethod   String describing the method used (e.g. "commit-reveal", "flashbots").
     */
    struct MevEvent {
        uint256 checkId;
        uint256 tradeId;
        address trader;
        bool mevDetected;
        uint256 mevAmount;
        uint256 protectionSavings;
        uint256 timestamp;
        string protectionMethod;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _nextCheckId;

    /// @dev checkId → MevEvent.
    mapping(uint256 => MevEvent) private _events;

    /// @dev trader → list of checkIds.
    mapping(address => uint256[]) private _traderEvents;

    /// @dev tradeId → checkId (one check per trade; overwritten if rechecked).
    mapping(uint256 => uint256) private _tradeCheck;

    /// @dev Addresses allowed to call recordMevCheck().
    mapping(address => bool) public authorizedRecorders;

    // Global statistics
    uint256 public totalChecks;
    uint256 public totalMevDetections;
    uint256 public totalGlobalSavingsUsd6;   // USD × 1e6 across all traders

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted each time a MEV check result is recorded.
    event MevCheckRecorded(
        uint256 indexed checkId,
        uint256 indexed tradeId,
        address indexed trader,
        bool mevDetected,
        uint256 protectionSavings,
        string protectionMethod,
        uint256 timestamp
    );

    /// @notice Emitted when a recorder's authorization changes.
    event RecorderUpdated(address indexed recorder, bool authorized);

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    error EventNotFound(uint256 checkId);
    error NoMevHistoryForTrader(address trader);
    error NoCheckForTrade(uint256 tradeId);
    error EmptyProtectionMethod();
    error UnauthorizedRecorder(address caller);
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {
        _nextCheckId = 1;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyRecorder() {
        if (!authorizedRecorders[msg.sender]) {
            revert UnauthorizedRecorder(msg.sender);
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Core write function
    // -------------------------------------------------------------------------

    /**
     * @notice Record the result of an MEV check for a trade.
     *
     * @dev `mevAmount` and `protectionSavings` are denominated in USD × 1e6
     *      (micro-dollars) for precision without floating point. For example,
     *      $1.50 of savings is represented as 1_500_000.
     *
     * @param tradeId            Trade that was checked.
     * @param trader             Trader who submitted the trade.
     * @param mevDetected        Whether MEV was present.
     * @param mevAmount          Estimated extractable value (USD × 1e6; 0 if none detected).
     * @param protectionSavings  Amount the trader was saved (USD × 1e6).
     * @param protectionMethod   Human-readable description of the protection used.
     * @return checkId           Unique identifier for this MEV check.
     */
    function recordMevCheck(
        uint256 tradeId,
        address trader,
        bool mevDetected,
        uint256 mevAmount,
        uint256 protectionSavings,
        string calldata protectionMethod
    ) external nonReentrant onlyRecorder returns (uint256 checkId) {
        if (bytes(protectionMethod).length == 0) revert EmptyProtectionMethod();
        if (trader == address(0)) revert ZeroAddress();

        checkId = _nextCheckId++;

        _events[checkId] = MevEvent({
            checkId:            checkId,
            tradeId:            tradeId,
            trader:             trader,
            mevDetected:        mevDetected,
            mevAmount:          mevAmount,
            protectionSavings:  protectionSavings,
            timestamp:          block.timestamp,
            protectionMethod:   protectionMethod
        });

        _traderEvents[trader].push(checkId);
        _tradeCheck[tradeId] = checkId;

        totalChecks++;
        if (mevDetected) totalMevDetections++;
        totalGlobalSavingsUsd6 += protectionSavings;

        emit MevCheckRecorded(
            checkId,
            tradeId,
            trader,
            mevDetected,
            protectionSavings,
            protectionMethod,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // Read-only
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieve a specific MEV event by checkId.
     * @param checkId The event identifier.
     * @return mevEvent The full MevEvent struct.
     */
    function getMevEvent(uint256 checkId) external view returns (MevEvent memory mevEvent) {
        if (_events[checkId].timestamp == 0) revert EventNotFound(checkId);
        return _events[checkId];
    }

    /**
     * @notice Get the MEV check associated with a specific trade.
     * @param tradeId The trade to look up.
     * @return mevEvent The MevEvent recorded for that trade.
     */
    function getMevEventByTrade(uint256 tradeId) external view returns (MevEvent memory mevEvent) {
        uint256 checkId = _tradeCheck[tradeId];
        if (checkId == 0) revert NoCheckForTrade(tradeId);
        return _events[checkId];
    }

    /**
     * @notice Get all MEV check IDs for a trader.
     * @param trader The trader address.
     * @return checkIds Array of checkIds in submission order.
     */
    function getMevHistoryByTrader(address trader) external view returns (uint256[] memory checkIds) {
        if (_traderEvents[trader].length == 0) revert NoMevHistoryForTrader(trader);
        return _traderEvents[trader];
    }

    /**
     * @notice Compute total MEV protection savings for a specific trader.
     * @param trader The trader address.
     * @return totalSavingsUsd6 Sum of protectionSavings across all their trades (USD × 1e6).
     */
    function getTotalMevSavings(address trader) external view returns (uint256 totalSavingsUsd6) {
        uint256[] storage ids = _traderEvents[trader];
        for (uint256 i = 0; i < ids.length; i++) {
            totalSavingsUsd6 += _events[ids[i]].protectionSavings;
        }
    }

    /**
     * @notice Global MEV statistics across all traders and trades.
     * @return checks        Total number of MEV checks performed.
     * @return detections    Total number of MEV threats detected.
     * @return savingsUsd6   Cumulative value protected across all trades (USD × 1e6).
     * @return detectionRate Detection rate in basis points (detections / checks × 10000).
     */
    function getMevStats() external view returns (
        uint256 checks,
        uint256 detections,
        uint256 savingsUsd6,
        uint256 detectionRate
    ) {
        checks       = totalChecks;
        detections   = totalMevDetections;
        savingsUsd6  = totalGlobalSavingsUsd6;
        detectionRate = checks == 0 ? 0 : (detections * 10_000) / checks;
    }

    /**
     * @notice Check whether MEV was detected for a specific trade.
     * @param tradeId The trade to check.
     * @return detected True if MEV was found for this trade.
     */
    function wasMevDetected(uint256 tradeId) external view returns (bool detected) {
        uint256 checkId = _tradeCheck[tradeId];
        if (checkId == 0) revert NoCheckForTrade(tradeId);
        return _events[checkId].mevDetected;
    }

    /**
     * @notice Returns the next checkId to be assigned.
     */
    function nextCheckId() external view returns (uint256) {
        return _nextCheckId;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Grant or revoke recorder privileges.
     * @param recorder   Address to update.
     * @param authorized True to grant, false to revoke.
     */
    function setRecorder(address recorder, bool authorized) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        authorizedRecorders[recorder] = authorized;
        emit RecorderUpdated(recorder, authorized);
    }
}
