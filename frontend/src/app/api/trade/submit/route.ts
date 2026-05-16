/**
 * POST /api/trade/submit
 *
 * Accepts a trade request, encrypts the order, uploads it to 0G Storage,
 * and records it on-chain via VerifiableTradeExecutor.submitTrade().
 *
 * Request body:
 *   {
 *     "inputAmount":  "1000000",   // base units (e.g. 1 USDC = 1_000_000)
 *     "tokenIn":      "USDC",
 *     "tokenOut":     "ETH",
 *     "maxSlippage":  0.5          // percent (0.5 = 0.5%)
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "tradeId":   "1",
 *       "orderCID":  "Qm...",
 *       "txHash":    "0x...",
 *       "timestamp": 1234567890
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import {
  withMiddleware,
  successResponse,
  errorResponse,
  parseBody,
  requireFields,
  requirePositive,
  parseSlippage,
  sanitizeString,
  ValidationError,
  handleOptions,
} from "@/middleware/auth";
import { uploadEncryptedOrder }                             from "@/lib/0g-storage";
import { submitTrade, getExecutorSigner, areContractsDeployed } from "@/lib/contracts";
import type { TradeSubmitRequest, TradeSubmitResponse }    from "@/lib/types";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    // ── 1. Parse body ────────────────────────────────────────────────────────
    const body = await parseBody(req);
    if (!body) {
      throw new ValidationError("Request body must be valid JSON with Content-Type: application/json");
    }

    // ── 2. Validate inputs ───────────────────────────────────────────────────
    requireFields(body, ["inputAmount", "tokenIn", "tokenOut", "maxSlippage"]);

    const inputAmount  = requirePositive(body.inputAmount, "inputAmount");
    const tokenIn      = sanitizeString(body.tokenIn, 20).toUpperCase();
    const tokenOut     = sanitizeString(body.tokenOut, 20).toUpperCase();
    const maxSlippage  = parseSlippage(body.maxSlippage);

    if (tokenIn === tokenOut) {
      throw new ValidationError("tokenIn and tokenOut must be different", ["tokenIn", "tokenOut"]);
    }
    if (!tokenIn || !tokenOut) {
      throw new ValidationError("Token symbols must be non-empty strings", ["tokenIn", "tokenOut"]);
    }

    // ── 3. Check contracts deployed ──────────────────────────────────────────
    if (!areContractsDeployed()) {
      return errorResponse(
        "Contracts not deployed. Run `npm run deploy:testnet` and update .env.",
        "CONTRACT_ERROR",
        503
      );
    }

    // ── 4. Build order object ────────────────────────────────────────────────
    const orderData = {
      inputAmount,
      tokenIn,
      tokenOut,
      maxSlippage,
      submittedAt: Math.floor(Date.now() / 1000),
      version:     "1",
    };

    // ── 5. Encrypt & upload to 0G Storage ───────────────────────────────────
    let orderCID: string;
    try {
      const upload = await uploadEncryptedOrder(orderData as unknown as Record<string, unknown>);
      orderCID = upload.cid;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Storage upload failed";
      return errorResponse(msg, "STORAGE_ERROR", 502);
    }

    // ── 6. Submit on-chain ───────────────────────────────────────────────────
    let tradeId: string;
    let txHash:  string;

    try {
      const signer  = getExecutorSigner();
      const request: TradeSubmitRequest = { inputAmount, tokenIn, tokenOut, maxSlippage };
      const result  = await submitTrade(signer, request, orderCID);

      tradeId = result.tradeId;
      txHash  = result.txHash;
    } catch (err) {
      // Surface useful messages from ethers (insufficient funds, reverts, etc.)
      const raw   = err instanceof Error ? err.message : String(err);
      const clean = raw.includes("reason=") ? raw.split("reason=")[1]?.split(",")[0]?.trim() ?? raw : raw;
      return errorResponse(`Contract call failed: ${clean}`, "CONTRACT_ERROR", 502);
    }

    // ── 7. Respond ───────────────────────────────────────────────────────────
    const response: TradeSubmitResponse = {
      tradeId,
      orderCID,
      txHash: txHash as `0x${string}`,
      timestamp: Math.floor(Date.now() / 1000),
    };

    return successResponse(response, 201);
  });
}
