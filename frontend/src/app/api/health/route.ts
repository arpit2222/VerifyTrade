/**
 * GET /api/health
 *
 * Lightweight status check used by:
 *   - Frontend startup banner
 *   - CI smoke tests after deployment
 *   - Uptime monitors
 *
 * Does NOT make contract calls — just checks config and network reachability.
 */

import { NextResponse } from "next/server";
import { ethers }       from "ethers";
import {
  withMiddleware,
  successResponse,
  errorResponse,
  handleOptions,
} from "@/middleware/auth";
import { getContractAddresses, areContractsDeployed } from "@/lib/contracts";
import { isStorageReachable }                         from "@/lib/0g-storage";
import { isComputeReachable }                         from "@/lib/0g-compute";
import type { HealthStatus }                          from "@/lib/types";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: Request) {
  return withMiddleware(req, async () => {
    const rpcUrl    = process.env.ARBITRUM_SEPOLIA_RPC_URL;
    const addresses = getContractAddresses();
    const chainId   = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 421614);

    let rpcConnected  = false;
    let blockNumber   = 0;
    let network       = "unknown";

    // Check RPC connectivity — 3-second timeout
    if (rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const [net, block] = await Promise.all([
          Promise.race([
            provider.getNetwork(),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
          ]),
          Promise.race([
            provider.getBlockNumber(),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
          ]),
        ]);

        rpcConnected = true;
        network      = (net as ethers.Network)?.name ?? "arbitrum-sepolia";
        blockNumber  = (block as number) ?? 0;
      } catch {
        // RPC unreachable — report degraded but don't throw
      }
    }

    // Check 0G Storage — non-blocking
    const storageReachable = await isStorageReachable().catch(() => false);

    const contractsDeployed = areContractsDeployed();
    const allHealthy = rpcConnected && contractsDeployed && storageReachable;

    const status: HealthStatus = {
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
    };

    // Return 200 even when degraded so load balancers don't rotate the pod
    // (the status field itself signals the issue)
    return successResponse(status, 200);
  });
}
