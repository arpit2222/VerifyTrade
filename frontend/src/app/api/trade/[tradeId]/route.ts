/**
 * GET /api/trade/[tradeId]
 *
 * Fetch the full details of a specific trade, including:
 *   - On-chain trade record from VerifiableTradeExecutor
 *   - Fairness proof status from FairnessProof
 *   - MEV detection event from MevRegistry
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "tradeId":      "1",
 *       "trader":       "0x...",
 *       "tokenIn":      "USDC",
 *       "tokenOut":     "ETH",
 *       "inputAmount":  "1000000",
 *       "outputAmount": "395000000000000000",
 *       "slippage":     0.25,
 *       "status":       "executed",
 *       "isFair":       true,
 *       "attestation":  "0x...",
 *       "txHash":       "0x...",
 *       "mev": { ... }
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import {
  withMiddleware,
  successResponse,
  errorResponse,
  parseTradeId,
  handleOptions,
} from "@/middleware/auth";
import {
  getTrade,
  getProvider,
  initializeContracts,
  areContractsDeployed,
} from "@/lib/contracts";
import { ethers } from "ethers";

interface TradeDetailResponse {
  tradeId:               string;
  trader:                string;
  tokenIn:               string;
  tokenOut:              string;
  inputAmount:           string;
  outputAmount:          string;
  slippagePercent:       number;
  maxSlippagePercent:    number;
  status:                string;
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
    recorded:           boolean;
    proofId?:           string;
    teeMeasurement?:    string;
    slippageWithinLimit?: boolean;
  };
}

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req:     Request,
  context: { params: { tradeId: string } }
): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    // ── 1. Parse & validate tradeId ──────────────────────────────────────────
    const tradeId = parseTradeId(context.params.tradeId);

    // ── 2. Check contracts deployed ──────────────────────────────────────────
    if (!areContractsDeployed()) {
      return errorResponse("Contracts not deployed", "CONTRACT_ERROR", 503);
    }

    const provider  = getProvider();

    // ── 3. Fetch core trade record ───────────────────────────────────────────
    let trade;
    try {
      trade = await getTrade(provider, tradeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("TradeNotFound")) {
        return errorResponse(`Trade ${tradeId} not found`, "NOT_FOUND", 404);
      }
      return errorResponse(`Failed to fetch trade: ${msg}`, "CONTRACT_ERROR", 502);
    }

    // ── 4. Fetch fairness proof (non-blocking, best-effort) ──────────────────
    let proof: TradeDetailResponse["proof"] = { recorded: false };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { fp } = initializeContracts(provider) as any;
      const proofIds = await fp.getProofsByTrade(BigInt(tradeId)) as bigint[];

      if (proofIds.length > 0) {
        const latestId = proofIds[proofIds.length - 1]!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await fp.getProof(latestId) as any;
        proof = {
          recorded:            true,
          proofId:             latestId.toString(),
          teeMeasurement:      raw.teeMeasurement as string,
          slippageWithinLimit: raw.slippageWithinLimit as boolean,
        };
      }
    } catch {
      // Proof not recorded yet — normal for pending trades
    }

    // ── 5. Fetch MEV check (non-blocking, best-effort) ───────────────────────
    let mev: TradeDetailResponse["mev"] = { checked: false };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { mr } = initializeContracts(provider) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mevEvent = await mr.getMevEventByTrade(BigInt(tradeId)) as any;
      const savingsUsd = (Number(mevEvent.protectionSavings) / 1_000_000).toFixed(4);

      mev = {
        checked:          true,
        detected:         mevEvent.mevDetected as boolean,
        savingsUsd,
        protectionMethod: mevEvent.protectionMethod as string,
      };
    } catch {
      // MEV check not recorded yet
    }

    // ── 6. Assemble response ─────────────────────────────────────────────────
    const response: TradeDetailResponse = {
      tradeId:            trade.tradeId,
      trader:             trade.trader,
      tokenIn:            trade.tokenIn,
      tokenOut:           trade.tokenOut,
      inputAmount:        trade.inputAmount,
      outputAmount:       trade.outputAmount,
      slippagePercent:    Number(trade.actualSlippagePercent) / 100,
      maxSlippagePercent: Number(trade.maxSlippagePercent) / 100,
      status:             trade.status,
      isFair:             trade.isFair,
      attestationHash:    trade.attestationHash,
      timestamp:          trade.timestamp,
      executionDetails:   trade.executionDetails,
      mev,
      proof,
    };

    return successResponse(response);
  });
}
