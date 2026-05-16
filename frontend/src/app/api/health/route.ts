/**
 * GET /api/health
 *
 * Comprehensive status check showing all 0G integrations:
 *   - Arbitrum Sepolia RPC + contracts
 *   - 0G Storage (Galileo testnet via real SDK)
 *   - 0G Compute (AI inference provider availability)
 *   - 0G KV Store (trade index layer)
 */

import { NextResponse } from "next/server";

export const maxDuration = 20;

// Cache health result for 15 seconds to avoid hammering external services
let healthCache: { data: unknown; expiresAt: number } | null = null;
const HEALTH_CACHE_TTL = 15_000;

import { ethers }       from "ethers";
import {
  withMiddleware,
  successResponse,
  handleOptions,
} from "@/middleware/auth";
import { getContractAddresses, areContractsDeployed } from "@/lib/contracts";
import { isStorageReachable, isMockMode }              from "@/lib/0g-storage";
import { isComputeReachable, listComputeProviders }    from "@/lib/0g-compute";
import { isKvReachable, isKvMockMode }                 from "@/lib/0g-kv";
import {
  isAgentAlive,
  AGENTIC_ID_CONTRACT,
  VERIFYTRADE_AGENT_TOKEN_ID,
}                                                      from "@/lib/0g-agentic-id";

export async function OPTIONS() { return handleOptions(); }

export async function GET(req: Request) {
  return withMiddleware(req, async () => {
    // Serve from cache if fresh
    if (healthCache && Date.now() < healthCache.expiresAt) {
      return successResponse(healthCache.data);
    }

    const rpcUrl    = process.env.ARBITRUM_SEPOLIA_RPC_URL;
    const addresses = getContractAddresses();
    const chainId   = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 421614);

    let rpcConnected = false;
    let blockNumber  = 0;
    let network      = "unknown";

    if (rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const [net, block] = await Promise.all([
          Promise.race([provider.getNetwork(),     new Promise<null>((_, r) => setTimeout(() => r(new Error("timeout")), 3000))]),
          Promise.race([provider.getBlockNumber(), new Promise<null>((_, r) => setTimeout(() => r(new Error("timeout")), 3000))]),
        ]);
        rpcConnected = true;
        network      = (net as ethers.Network)?.name ?? "arbitrum-sepolia";
        blockNumber  = (block as number) ?? 0;
      } catch { /* degraded */ }
    }

    // All 0G checks in parallel — each has its own timeout
    const [storageReachable, computeReachable, kvReachable, computeProviders, agentAlive] = await Promise.all([
      isStorageReachable().catch(() => false),
      isComputeReachable().catch(() => false),
      isKvReachable().catch(() => false),
      listComputeProviders().catch(() => []),
      isAgentAlive().catch(() => false),
    ]);

    const contractsDeployed = areContractsDeployed();
    const allHealthy        = rpcConnected && contractsDeployed;

    const responseData = {
      status:            allHealthy ? "ok" : rpcConnected ? "degraded" : "down",
      contractsDeployed,
      rpcConnected,
      storageReachable,
      network:           rpcConnected ? network : (process.env.NEXT_PUBLIC_CHAIN_NAME ?? "arbitrum-sepolia"),
      chainId,
      blockNumber,
      timestamp:         Math.floor(Date.now() / 1000),
      contracts: {
        verifiableTradeExecutor: addresses.verifiableTradeExecutor,
        fairnessProof:           addresses.fairnessProof,
        mevRegistry:             addresses.mevRegistry,
      },
      // 0G integration status — shown in demo/health UI
      zeroG: {
        storage: {
          reachable:   storageReachable,
          mock:        isMockMode(),
          indexerRpc:  process.env.ZEROG_INDEXER_RPC ? "configured" : "not set",
          explorer:    "https://storagescan-galileo.0g.ai",
        },
        compute: {
          reachable:       computeReachable,
          providerCount:   computeProviders.length,
          providers:       computeProviders.slice(0, 3).map(p => ({
            address: p.address.slice(0, 10) + "…",
            model:   p.model,
            uptime:  p.uptime,
          })),
          marketplace:     "https://compute-marketplace.0g.ai",
        },
        kv: {
          reachable: kvReachable,
          mock:      isKvMockMode(),
          purpose:   "trade index by trader address",
        },
        agenticId: {
          alive:       agentAlive,
          contract:    AGENTIC_ID_CONTRACT,
          tokenId:     Number(VERIFYTRADE_AGENT_TOKEN_ID),
          standard:    "ERC-7857",
          capabilities: ["trade-execution", "mev-protection", "fairness-verification", "tee-attestation"],
          explorer:    `https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`,
        },
        chain: {
          galileoRpc:    process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
          chainId:       16602,
          explorer:      "https://chainscan-galileo.0g.ai",
          walletFunded:  !!process.env.ZEROG_PRIVATE_KEY,
        },
      },
    };

    // Store in cache
    healthCache = { data: responseData, expiresAt: Date.now() + HEALTH_CACHE_TTL };

    return successResponse(responseData, 200);
  });
}
