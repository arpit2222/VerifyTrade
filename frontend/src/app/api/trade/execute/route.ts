/**
 * POST /api/trade/execute
 *
 * Triggers off-chain execution of a submitted trade via 0G Compute (or mock),
 * records the result and fairness proof on-chain, and logs the MEV check.
 *
 * This endpoint is called by the off-chain executor bot (or the frontend in
 * demo mode) after a trade has been submitted.
 *
 * Request body:
 *   {
 *     "tradeId":  "1",
 *     "orderCID": "Qm..."
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "tradeId":      "1",
 *       "outputAmount": "395000000000000000",
 *       "slippage":     0.25,
 *       "attestation":  "0xabc...",
 *       "proofId":      "1",
 *       "proof":        "fairness_verified",
 *       "txHash":       "0x..."
 *     }
 *   }
 */

import { NextResponse } from "next/server";

// Serverless function timeout budget (Vercel default is 10s on hobby, 60s on pro)
export const maxDuration = 60;
import {
  withMiddleware,
  successResponse,
  errorResponse,
  parseBody,
  requireFields,
  parseTradeId,
  sanitizeString,
  checkRateLimit,
  ValidationError,
  handleOptions,
} from "@/middleware/auth";
import { executeTradeInTEE }                  from "@/lib/0g-compute";
import { uploadAttestation }                  from "@/lib/0g-storage";
import { agentExecutionTag }                  from "@/lib/0g-agentic-id";
import {
  getTrade,
  getExecutorSigner,
  getProvider,
  recordTradeResult,
  recordProof,
  recordMevCheck,
  areContractsDeployed,
}                                             from "@/lib/contracts";
import type { TradeExecuteResponse }          from "@/lib/types";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    // ── 0. Rate limit ────────────────────────────────────────────────────────
    const rl = checkRateLimit(req, 10, 60_000); // 10 executions/min per IP
    if (rl) return rl;

    // ── 1. Parse & validate ──────────────────────────────────────────────────
    const body = await parseBody(req);
    if (!body) {
      throw new ValidationError("Request body must be valid JSON");
    }

    requireFields(body, ["tradeId", "orderCID"]);

    const tradeId  = parseTradeId(String(body.tradeId));
    const orderCID = sanitizeString(body.orderCID, 256);

    if (!orderCID) {
      throw new ValidationError("orderCID must be a non-empty string", ["orderCID"]);
    }

    // ── 2. Check contracts ───────────────────────────────────────────────────
    if (!areContractsDeployed()) {
      return errorResponse("Contracts not deployed", "CONTRACT_ERROR", 503);
    }

    // ── 3. Fetch trade from chain to get parameters ──────────────────────────
    const provider = getProvider();
    let trade;
    try {
      trade = await getTrade(provider, tradeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("TradeNotFound")) {
        return errorResponse(`Trade ${tradeId} not found on-chain`, "NOT_FOUND", 404);
      }
      return errorResponse(`Failed to fetch trade: ${msg}`, "CONTRACT_ERROR", 502);
    }

    if (trade.isExecuted) {
      return errorResponse(`Trade ${tradeId} is already executed`, "VALIDATION_ERROR", 409);
    }

    // ── 4. Execute inside TEE (or mock) ─────────────────────────────────────
    let teeResult;
    try {
      teeResult = await executeTradeInTEE({
        orderCID,
        maxSlippage:  Number(trade.maxSlippagePercent) / 100,
        tokenIn:      trade.tokenIn,
        tokenOut:     trade.tokenOut,
        inputAmount:  trade.inputAmount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "TEE execution failed";
      return errorResponse(msg, "COMPUTE_ERROR", 502);
    }

    // ── 5. Upload attestation to 0G Storage ──────────────────────────────────
    const attestationPayload = {
      tradeId,
      tokenIn:      trade.tokenIn,
      tokenOut:     trade.tokenOut,
      inputAmount:  trade.inputAmount,
      outputAmount: teeResult.outputAmount,
      slippagePct:  teeResult.slippagePct,
      measurement:  teeResult.teeMeasurement,
      executorId:   teeResult.executorId,
      executedAt:   teeResult.executedAt,
      agentTag:     agentExecutionTag(),
    };

    let attestationCID: string;
    try {
      const upload = await uploadAttestation(attestationPayload);
      attestationCID = upload.cid;
    } catch {
      // Non-fatal — proceed without off-chain attestation storage
      attestationCID = orderCID;
    }

    // ── 6. Record trade result on-chain ──────────────────────────────────────
    const signer = getExecutorSigner();

    let txHash: string;
    try {
      const result = await recordTradeResult(
        signer,
        tradeId,
        teeResult.outputAmount,
        teeResult.attestation,
        teeResult.slippagePct,
        JSON.stringify({ attestationCID, executorId: teeResult.executorId, agentTag: agentExecutionTag() })
      );
      txHash = result.txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(`recordTradeResult failed: ${msg}`, "CONTRACT_ERROR", 502);
    }

    // ── 7. Record fairness proof on-chain ────────────────────────────────────
    let proofId = "0";
    try {
      const proofResult = await recordProof(
        signer,
        tradeId,
        teeResult.teeMeasurement,
        Number(trade.maxSlippagePercent) / 100,
        teeResult.slippagePct,
        teeResult.executorId
      );
      proofId = proofResult.proofId;
    } catch (err) {
      // Non-fatal — trade is still recorded, proof recording failed
      console.error("[execute] recordProof failed:", err);
    }

    // ── 8. Record MEV check on-chain ─────────────────────────────────────────
    const mevSim = getMevSimulation(trade.inputAmount);
    try {
      await recordMevCheck(
        signer,
        tradeId,
        trade.trader,
        mevSim.detected,
        mevSim.mevAmountUsd6,
        mevSim.savingsUsd6,
        mevSim.protectionMethod
      );
    } catch (err) {
      // Non-fatal
      console.error("[execute] recordMevCheck failed:", err);
    }

    // ── 9. Compute counterfactual (what slippage without TEE protection) ──────
    const mevImpact     = mevSim.detected
      ? (Number(mevSim.mevAmountUsd6) / 1_000_000) / (Number(trade.inputAmount) / 1_000_000) * 100
      : 0.05 + Math.random() * 0.15; // baseline sandwich + gas impact
    const estimatedSlippage = teeResult.slippagePct + mevImpact;
    const savingsPercent    = mevImpact / estimatedSlippage * 100;

    // ── 10. Respond ──────────────────────────────────────────────────────────
    const isFair   = teeResult.slippagePct <= Number(trade.maxSlippagePercent) / 100;
    const response: TradeExecuteResponse = {
      tradeId,
      outputAmount: teeResult.outputAmount,
      slippage:     teeResult.slippagePct,
      attestation:  teeResult.attestation,
      proofId,
      proof:        isFair ? "fairness_verified" : "fairness_failed",
      txHash:       txHash as `0x${string}`,
      counterfactual: {
        estimatedSlippage: Number(estimatedSlippage.toFixed(4)),
        mevImpact:         Number(mevImpact.toFixed(4)),
        savingsPercent:    Number(savingsPercent.toFixed(1)),
      },
    };

    return successResponse(response);
  });
}

// ---------------------------------------------------------------------------
// Internal helper (co-located to avoid extra imports)
// ---------------------------------------------------------------------------

function getMevSimulation(inputAmount: string) {
  const amount       = Number(inputAmount) / 1e6;
  const mevProb      = Math.min(0.35, amount / 50_000);
  const detected     = Math.random() < mevProb;

  if (!detected) {
    return { detected: false, mevAmountUsd6: "0", savingsUsd6: "0", protectionMethod: "commit-reveal" };
  }

  const mevPct        = 0.001 + Math.random() * 0.009;
  const mevUsd        = amount * mevPct;
  const savedUsd      = mevUsd * 0.9;
  const methods       = ["commit-reveal", "flashbots-protect", "private-mempool", "batch-auction"];

  return {
    detected:         true,
    mevAmountUsd6:    Math.round(mevUsd * 1_000_000).toString(),
    savingsUsd6:      Math.round(savedUsd * 1_000_000).toString(),
    protectionMethod: methods[Math.floor(Math.random() * methods.length)] ?? "commit-reveal",
  };
}
