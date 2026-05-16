// =============================================================================
// VerifyTrade — Shared TypeScript types (frontend + API layer)
// =============================================================================

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type HexString  = `0x${string}`;
export type Address    = `0x${string}`;
export type ChainId    = number;

// ---------------------------------------------------------------------------
// Trade domain
// ---------------------------------------------------------------------------

export type TradeStatus = "pending" | "committed" | "executed" | "cancelled" | "failed";

/**
 * Canonical trade object used throughout the API and frontend.
 * Mirrors the Trade struct from VerifiableTradeExecutor.sol but with
 * JS-friendly types (string for bigint, number for timestamps).
 */
export interface Trade {
  tradeId:               string;
  trader:                Address;
  encryptedOrder:        string;   // IPFS / 0G Storage CID
  inputAmount:           string;   // wei / base unit string
  outputAmount:          string;
  tokenIn:               string;
  tokenOut:              string;
  /** Slippage × 100 — stored as string to preserve contract precision */
  maxSlippagePercent:    string;
  actualSlippagePercent: string;
  attestationHash:       string;
  timestamp:             number;
  isExecuted:            boolean;
  isFair:                boolean;
  executionDetails:      string;
  status:                TradeStatus;
}

/** Data required to submit a new trade */
export interface TradeSubmitRequest {
  inputAmount:  string;    // e.g. "1000000" (USDC, 6 decimals)
  tokenIn:      string;    // e.g. "USDC"
  tokenOut:     string;    // e.g. "ETH"
  maxSlippage:  number;    // e.g. 0.5 (percent)
  trader:       Address;   // connected wallet — required for on-chain identity
}

export interface TradeSubmitResponse {
  tradeId:   string;
  orderCID:  string;
  txHash:    HexString;
  timestamp: number;
}

/** Data required to trigger off-chain execution */
export interface TradeExecuteRequest {
  tradeId:  string;
  orderCID: string;
}

export interface TradeExecuteResponse {
  tradeId:      string;
  outputAmount: string;
  slippage:     number;
  attestation:  string;
  proofId:      string;
  proof:        "fairness_verified" | "fairness_failed";
  txHash:       HexString;
  /** Counterfactual: what slippage would have been without TEE/VerifyTrade */
  counterfactual?: {
    estimatedSlippage: number;
    mevImpact:         number;
    savingsPercent:    number;
  };
}

// ---------------------------------------------------------------------------
// Execution proof
// ---------------------------------------------------------------------------

export interface ExecutionProof {
  proofId:                 string;
  tradeId:                 string;
  teeMeasurement:          string;
  expectedSlippagePercent: string;
  actualSlippagePercent:   string;
  slippageWithinLimit:     boolean;
  timestamp:               number;
  executorAddress:         string;
}

// ---------------------------------------------------------------------------
// MEV registry
// ---------------------------------------------------------------------------

export interface MevEvent {
  checkId:            string;
  tradeId:            string;
  trader:             Address;
  mevDetected:        boolean;
  mevAmount:          string;   // USD × 1e6 as string
  protectionSavings:  string;
  timestamp:          number;
  protectionMethod:   string;
}

/** Global MEV statistics from MevRegistry.getMevStats() */
export interface MevStats {
  totalChecks:         string;
  totalDetections:     string;
  totalSavingsUsd6:    string;
  detectionRateBps:    string;
  // Computed for API consumers
  totalTradesSafe:     number;
  totalMevSavingsUsd:  string;   // Human-readable USD string
  detectionRatePct:    number;   // 0–100
}

// ---------------------------------------------------------------------------
// 0G Storage / Compute
// ---------------------------------------------------------------------------

export interface StorageUploadResult {
  cid:       string;
  size:      number;
  timestamp: number;
}

export interface TeeExecutionResult {
  outputAmount:   string;         // base units
  slippagePct:    number;         // 0–100
  attestation:    string;         // raw TEE measurement
  teeMeasurement: string;         // hashed measurement for on-chain storage
  executedAt:     number;         // unix timestamp
  executorId:     string;
}

// ---------------------------------------------------------------------------
// 0G Compute job
// ---------------------------------------------------------------------------

export interface ComputeJobInput {
  orderCID:    string;
  maxSlippage: number;
  tokenIn:     string;
  tokenOut:    string;
  inputAmount: string;
}

export interface ComputeJobOutput {
  jobId:         string;
  status:        "running" | "completed" | "failed";
  result?:       TeeExecutionResult;
  error?:        string;
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data:    T;
  meta?: {
    timestamp?:  number;
    requestId?:  string;
    cached?:     boolean;
  };
}

export interface ApiError {
  success:  false;
  error:    string;
  code:     ApiErrorCode;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONTRACT_ERROR"
  | "STORAGE_ERROR"
  | "COMPUTE_ERROR"
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status:             "ok" | "degraded" | "down";
  contractsDeployed:  boolean;
  rpcConnected:       boolean;
  storageReachable:   boolean;
  network:            string;
  chainId:            number;
  blockNumber:        number;
  timestamp:          number;
  contracts: {
    verifiableTradeExecutor: string;
    fairnessProof:           string;
    mevRegistry:             string;
  };
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  iv:         string;   // hex-encoded 16-byte IV
  ciphertext: string;   // hex-encoded ciphertext
  authTag:    string;   // hex-encoded GCM auth tag (16 bytes)
  algorithm:  "aes-256-gcm";
}

export interface KeyPair {
  publicKey:  string;
  privateKey: string;
}

// ---------------------------------------------------------------------------
// Contract initialization
// ---------------------------------------------------------------------------

export interface ContractAddresses {
  verifiableTradeExecutor: string;
  fairnessProof:           string;
  mevRegistry:             string;
  verifyTrade:             string;
}
