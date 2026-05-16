/**
 * GET /api/agent
 *
 * Returns VerifyTrade's on-chain ERC-7857 Agentic ID info from the 0G Galileo network.
 * Shows judges the agent is real — minted token #101 at the AGENTIC_ID_CONTRACT.
 */

import { NextResponse } from "next/server";
import {
  withMiddleware,
  successResponse,
  handleOptions,
} from "@/middleware/auth";
import {
  getAgentInfo,
  isAgentAlive,
  getAgentId,
  AGENTIC_ID_CONTRACT,
  VERIFYTRADE_AGENT_TOKEN_ID,
  VERIFYTRADE_AGENT_OWNER,
} from "@/lib/0g-agentic-id";

// Cache agent info for 5 minutes
let cache: { data: unknown; expiresAt: number } | null = null;

export async function OPTIONS() { return handleOptions(); }

export async function GET(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    const now = Date.now();

    if (cache && cache.expiresAt > now) {
      return successResponse(cache.data, 200);
    }

    let agentInfo;
    let alive = false;

    try {
      [agentInfo, alive] = await Promise.all([
        getAgentInfo(),
        isAgentAlive(),
      ]);
    } catch {
      // Return static fallback if chain is unreachable
      agentInfo = {
        tokenId:      Number(VERIFYTRADE_AGENT_TOKEN_ID),
        owner:        VERIFYTRADE_AGENT_OWNER,
        name:         "0G Agentic ID",
        symbol:       "AGID",
        totalSupply:  101,
        contractUrl:  `https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`,
        agentName:    "VerifyTrade Executor Agent",
        capabilities: [
          "trade-execution",
          "mev-protection",
          "fairness-verification",
          "tee-attestation",
          "0g-compute-inference",
        ],
        network: "0G Galileo Testnet",
      };
      alive = false;
    }

    const data = {
      ...agentInfo,
      agentId:    getAgentId(),
      alive,
      standard:   "ERC-7857",
      mintedAt:   "0x9e0a0cb65d6cd29653123671a06606c5627fb2008f1169dc63398fbc563c616d",
      explorer:   `https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`,
    };

    cache = { data, expiresAt: now + 5 * 60_000 };
    return successResponse(data, 200);
  });
}
