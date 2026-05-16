/**
 * GET /api/stats/mev
 *
 * Returns global MEV statistics from the MevRegistry contract,
 * augmented with fairness ratio from FairnessProof.
 *
 * Results are cached for 30 seconds (configurable) to avoid hammering the RPC.
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "totalTradesSafe":     38,
 *       "totalMevSavingsUsd":  "142.50",
 *       "detectionRatePct":    15.2,
 *       "totalChecks":         "42",
 *       "totalDetections":     "4",
 *       "fairnessRatePct":     96.5,
 *       "totalProofsRecorded": "40",
 *       "totalFairProofs":     "38"
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import {
  withMiddleware,
  successResponse,
  errorResponse,
  handleOptions,
} from "@/middleware/auth";
import {
  getMevStats,
  getProvider,
  getGlobalFairnessRatio,
  initializeContracts,
  areContractsDeployed,
} from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Simple in-process cache (resets on each cold start / deploy)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

let statsCache: CacheEntry<MevStatsResponse> | null = null;
const CACHE_TTL_MS = 30_000;  // 30 seconds

interface MevStatsResponse {
  totalChecks:          string;
  totalDetections:      string;
  totalSavingsUsd6:     string;
  detectionRateBps:     string;
  // Human-readable derived values
  totalTradesSafe:      number;
  totalMevSavingsUsd:   string;
  detectionRatePct:     number;
  // Fairness proof stats
  fairnessRatePct:      number;
  totalProofsRecorded:  string;
  totalFairProofs:      string;
  // Metadata
  cached:               boolean;
  cacheExpiresAt:       number;
}

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    // ── 1. Return cached result if still valid ───────────────────────────────
    const now = Date.now();
    if (statsCache && statsCache.expiresAt > now) {
      return successResponse(
        { ...statsCache.data, cached: true },
        200,
        { cached: true, timestamp: Math.floor(now / 1000) }
      );
    }

    // ── 2. Check contracts deployed ──────────────────────────────────────────
    if (!areContractsDeployed()) {
      // Return zeroed stats rather than erroring — better UX for initial setup
      return successResponse(buildEmptyStats(), 200);
    }

    const provider = getProvider();

    // ── 3. Fetch MEV stats from MevRegistry ──────────────────────────────────
    let mevStats;
    try {
      mevStats = await getMevStats(provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch MEV stats";
      return errorResponse(msg, "CONTRACT_ERROR", 502);
    }

    // ── 4. Fetch fairness ratio from FairnessProof ───────────────────────────
    let fairnessRatePct   = 0;
    let totalProofs       = "0";
    let totalFairProofs   = "0";

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { fp }      = initializeContracts(provider) as any;
      fairnessRatePct   = await getGlobalFairnessRatio(provider);
      totalProofs       = ((await fp.totalProofsRecorded()) as bigint).toString();
      totalFairProofs   = ((await fp.totalFairProofs()) as bigint).toString();
    } catch {
      // Non-fatal — FairnessProof may not have data yet
    }

    // ── 5. Assemble response ─────────────────────────────────────────────────
    const expiresAt = now + CACHE_TTL_MS;

    const response: MevStatsResponse = {
      totalChecks:         mevStats.totalChecks,
      totalDetections:     mevStats.totalDetections,
      totalSavingsUsd6:    mevStats.totalSavingsUsd6,
      detectionRateBps:    mevStats.detectionRateBps,
      totalTradesSafe:     mevStats.totalTradesSafe,
      totalMevSavingsUsd:  mevStats.totalMevSavingsUsd,
      detectionRatePct:    mevStats.detectionRatePct,
      fairnessRatePct,
      totalProofsRecorded: totalProofs,
      totalFairProofs,
      cached:              false,
      cacheExpiresAt:      Math.floor(expiresAt / 1000),
    };

    // Store in cache
    statsCache = { data: response, expiresAt };

    return successResponse(response, 200, { cached: false, timestamp: Math.floor(Date.now() / 1000) });
  });
}

function buildEmptyStats(): MevStatsResponse {
  return {
    totalChecks:         "0",
    totalDetections:     "0",
    totalSavingsUsd6:    "0",
    detectionRateBps:    "0",
    totalTradesSafe:     0,
    totalMevSavingsUsd:  "0.00",
    detectionRatePct:    0,
    fairnessRatePct:     0,
    totalProofsRecorded: "0",
    totalFairProofs:     "0",
    cached:              false,
    cacheExpiresAt:      Math.floor((Date.now() + CACHE_TTL_MS) / 1000),
  };
}
