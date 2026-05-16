/**
 * GET /api/prices
 *
 * Returns live token prices fetched via 0G Compute AI inference.
 * Cached 60s server-side. Falls back to hardcoded prices if 0G Compute
 * is not reachable (e.g. no private key configured).
 */

import { NextResponse } from "next/server";
import {
  withMiddleware,
  successResponse,
  handleOptions,
} from "@/middleware/auth";
import { fetchLivePrices } from "@/lib/0g-compute";

const TOKENS = ["ETH", "WBTC", "WETH", "ARB", "USDC", "USDT", "DAI"];

// Module-level cache (resets on cold start)
let priceCache: { prices: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000;

export async function OPTIONS() { return handleOptions(); }

export async function GET(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    const now = Date.now();

    if (priceCache && now - priceCache.fetchedAt < CACHE_TTL) {
      return successResponse({
        prices:    priceCache.prices,
        source:    "cache",
        fetchedAt: Math.floor(priceCache.fetchedAt / 1000),
        tokens:    TOKENS,
      }, 200);
    }

    const prices = await fetchLivePrices(TOKENS);
    const source = Object.keys(prices).length > 5 ? "0g-compute" : "fallback";

    priceCache = { prices, fetchedAt: now };

    return successResponse({
      prices,
      source,
      fetchedAt: Math.floor(now / 1000),
      tokens:    TOKENS,
    }, 200);
  });
}
