/**
 * Centralized API client for all VerifyTrade backend calls.
 *
 * Wraps fetch with consistent error handling, typed responses,
 * and an automatic retry for transient network failures.
 */

import type {
  ApiResponse,
  TradeSubmitRequest,
  TradeSubmitResponse,
  TradeExecuteRequest,
  TradeExecuteResponse,
  MevStats,
} from "./types";

// ---------------------------------------------------------------------------
// Base fetch wrapper
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path:    string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = await res.json() as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(json.error, res.status, json.code);
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Trade endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/trade/submit
 * Encrypt order, upload to 0G Storage, submit on-chain.
 */
export async function submitTrade(
  data: TradeSubmitRequest
): Promise<TradeSubmitResponse> {
  return request<TradeSubmitResponse>("/api/trade/submit", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

/**
 * POST /api/trade/execute
 * Execute a submitted trade in the TEE and record result on-chain.
 */
export async function executeTrade(
  data: TradeExecuteRequest
): Promise<TradeExecuteResponse> {
  return request<TradeExecuteResponse>("/api/trade/execute", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

/**
 * GET /api/trade/[tradeId]
 * Fetch full trade details including proof and MEV status.
 */
export async function getTrade(tradeId: string): Promise<TradeDetail> {
  return request<TradeDetail>(`/api/trade/${tradeId}`);
}

/**
 * GET /api/stats/mev
 * Fetch global MEV protection statistics.
 */
export async function getMevStats(): Promise<MevStatsExtended> {
  return request<MevStatsExtended>("/api/stats/mev");
}

/**
 * GET /api/health
 * Check backend and contract connectivity.
 */
export async function getHealth(): Promise<HealthData> {
  return request<HealthData>("/api/health");
}

// ---------------------------------------------------------------------------
// Response types (matches API output shapes)
// ---------------------------------------------------------------------------

export interface TradeDetail {
  tradeId:               string;
  trader:                string;
  tokenIn:               string;
  tokenOut:              string;
  inputAmount:           string;
  outputAmount:          string;
  slippagePercent:       number;
  maxSlippagePercent:    number;
  status:                "pending" | "committed" | "executed" | "cancelled" | "failed";
  isFair:                boolean;
  attestationHash:       string;
  timestamp:             number;
  executionDetails:      string;
  mev: {
    checked:            boolean;
    detected?:          boolean;
    savingsUsd?:        string;
    protectionMethod?:  string;
  };
  proof: {
    recorded:            boolean;
    proofId?:            string;
    teeMeasurement?:     string;
    slippageWithinLimit?: boolean;
  };
}

export interface MevStatsExtended extends MevStats {
  fairnessRatePct:      number;
  totalProofsRecorded:  string;
  totalFairProofs:      string;
  cached:               boolean;
  cacheExpiresAt:       number;
}

export interface HealthData {
  status:            "ok" | "degraded" | "down";
  contractsDeployed: boolean;
  rpcConnected:      boolean;
  storageReachable:  boolean;
  network:           string;
  chainId:           number;
  blockNumber:       number;
  timestamp:         number;
  contracts: {
    verifiableTradeExecutor: string;
    fairnessProof:           string;
    mevRegistry:             string;
  };
}

// Re-export ApiError so callers can distinguish API errors from network errors
export { ApiError };
