/**
 * TypeScript interfaces mirroring the Solidity structs and events in:
 *   - VerifiableTradeExecutor.sol
 *   - FairnessProof.sol
 *   - MevRegistry.sol
 *
 * Import in frontend and tests:
 *   import type { Trade, ExecutionProof, MevEvent } from "@typechain/IVerifyTrade"
 *   -- or directly --
 *   import type { Trade } from "contracts/src/interfaces/IVerifyTrade"
 */

// =============================================================================
// VerifiableTradeExecutor
// =============================================================================

/**
 * Mirrors the Trade struct in VerifiableTradeExecutor.sol.
 * All bigint fields correspond to Solidity uint256.
 */
export interface Trade {
  tradeId: bigint;
  trader: string;              // checksummed hex address
  encryptedOrder: string;      // IPFS / 0G Storage CID
  inputAmount: bigint;
  outputAmount: bigint;
  tokenIn: string;
  tokenOut: string;
  /** Slippage × 100, e.g. 50 = 0.5% */
  maxSlippagePercent: bigint;
  actualSlippagePercent: bigint;
  attestationHash: string;
  timestamp: bigint;           // unix seconds
  isExecuted: boolean;
  isFair: boolean;
  executionDetails: string;
}

/** Arguments for VerifiableTradeExecutor.submitTrade() */
export interface SubmitTradeArgs {
  encryptedOrder: string;
  inputAmount: bigint;
  tokenIn: string;
  tokenOut: string;
  maxSlippagePercent: bigint;
}

/** Arguments for VerifiableTradeExecutor.recordTradeResult() */
export interface RecordTradeResultArgs {
  tradeId: bigint;
  outputAmount: bigint;
  attestationHash: string;
  actualSlippagePercent: bigint;
  executionDetails: string;
}

/** TradeSubmitted event shape */
export interface TradeSubmittedEvent {
  tradeId: bigint;
  trader: string;
  tokenIn: string;
  tokenOut: string;
  inputAmount: bigint;
  maxSlippagePercent: bigint;
  timestamp: bigint;
}

/** TradeExecuted event shape */
export interface TradeExecutedEvent {
  tradeId: bigint;
  trader: string;
  outputAmount: bigint;
  actualSlippagePercent: bigint;
  isFair: boolean;
  attestationHash: string;
  timestamp: bigint;
}

// =============================================================================
// FairnessProof
// =============================================================================

/**
 * Mirrors the ExecutionProof struct in FairnessProof.sol.
 */
export interface ExecutionProof {
  proofId: bigint;
  tradeId: bigint;
  teeMeasurement: string;       // raw TEE attestation / 0G-AI signature
  expectedSlippagePercent: bigint;
  actualSlippagePercent: bigint;
  slippageWithinLimit: boolean;
  timestamp: bigint;
  executorAddress: string;      // TEE enclave or bot identifier string
}

/** Arguments for FairnessProof.recordProof() */
export interface RecordProofArgs {
  tradeId: bigint;
  teeMeasurement: string;
  expectedSlippagePercent: bigint;
  actualSlippagePercent: bigint;
  executorAddress: string;
}

/** ProofRecorded event shape */
export interface ProofRecordedEvent {
  proofId: bigint;
  tradeId: bigint;
  slippageWithinLimit: boolean;
  actualSlippagePercent: bigint;
  timestamp: bigint;
}

// =============================================================================
// MevRegistry
// =============================================================================

/**
 * Mirrors the MevEvent struct in MevRegistry.sol.
 * mevAmount and protectionSavings are USD × 1e6 (micro-dollars).
 */
export interface MevEvent {
  checkId: bigint;
  tradeId: bigint;
  trader: string;
  mevDetected: boolean;
  /** Estimated extractable value in USD × 1e6 */
  mevAmount: bigint;
  /** Value saved by protection in USD × 1e6 */
  protectionSavings: bigint;
  timestamp: bigint;
  protectionMethod: string;
}

/** Arguments for MevRegistry.recordMevCheck() */
export interface RecordMevCheckArgs {
  tradeId: bigint;
  trader: string;
  mevDetected: boolean;
  mevAmount: bigint;
  protectionSavings: bigint;
  protectionMethod: string;
}

/** MevCheckRecorded event shape */
export interface MevCheckRecordedEvent {
  checkId: bigint;
  tradeId: bigint;
  trader: string;
  mevDetected: boolean;
  protectionSavings: bigint;
  protectionMethod: string;
  timestamp: bigint;
}

/** Return type of MevRegistry.getMevStats() */
export interface MevStats {
  checks: bigint;
  detections: bigint;
  savingsUsd6: bigint;
  /** Detection rate in basis points (detections / checks × 10000) */
  detectionRate: bigint;
}

// =============================================================================
// Shared / utility
// =============================================================================

/** Deployment addresses for all three contracts on a given network. */
export interface VerifyTradeDeployment {
  chainId: number;
  verifiableTradeExecutor: string;
  fairnessProof: string;
  mevRegistry: string;
  verifyTrade: string;
  deployedAt: string;   // ISO 8601 timestamp
  blockNumber: number;
}

/**
 * Helper: convert a Solidity slippage value (× 100) to a display percentage.
 * e.g. 50n → "0.50%"
 */
export function formatSlippage(slippageBigInt: bigint): string {
  const bps = Number(slippageBigInt);
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Helper: convert USD micro-dollars (× 1e6) to a display string.
 * e.g. 1_500_000n → "$1.50"
 */
export function formatUsd6(usd6: bigint): string {
  const cents = Number(usd6);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 1_000_000);
}
