/**
 * POST /api/trade/submit
 *
 * Encrypts the order, uploads to 0G Storage, submits on-chain with
 * the real trader address so Arbiscan shows the user's wallet — not the executor.
 *
 * Required body fields:
 *   inputAmount  string  — base units (e.g. 1 USDC = "1000000")
 *   tokenIn      string  — "USDC"
 *   tokenOut     string  — "WETH"
 *   maxSlippage  number  — percent (0.5 = 0.5%)
 *   trader       string  — user's wallet address (from connected wallet)
 */

import { NextResponse } from "next/server";

export const maxDuration = 30;
import {
  withMiddleware, successResponse, errorResponse, parseBody,
  requireFields, requirePositive, parseSlippage, sanitizeString,
  ValidationError, handleOptions,
} from "@/middleware/auth";
import { uploadEncryptedOrder }  from "@/lib/0g-storage";
import { appendTradeId }         from "@/lib/0g-kv";
import { authorizeTrader }       from "@/lib/0g-agentic-id";
import { submitTrade, getExecutorSigner, areContractsDeployed }       from "@/lib/contracts";
import type { TradeSubmitRequest, TradeSubmitResponse }                from "@/lib/types";

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: Request): Promise<NextResponse> {
  return withMiddleware(req, async () => {
    // ── 1. Parse & validate ──────────────────────────────────────────────────
    const body = await parseBody(req);
    if (!body) throw new ValidationError("Request body must be valid JSON");

    requireFields(body, ["inputAmount", "tokenIn", "tokenOut", "maxSlippage", "trader"]);

    const inputAmount = requirePositive(body.inputAmount, "inputAmount");
    const tokenIn     = sanitizeString(body.tokenIn,  20).toUpperCase();
    const tokenOut    = sanitizeString(body.tokenOut, 20).toUpperCase();
    const maxSlippage = parseSlippage(body.maxSlippage);
    const trader      = sanitizeString(body.trader, 42);

    if (tokenIn === tokenOut) throw new ValidationError("tokenIn and tokenOut must differ", ["tokenIn", "tokenOut"]);
    if (!tokenIn || !tokenOut) throw new ValidationError("Token symbols must not be empty", ["tokenIn", "tokenOut"]);
    if (!trader.startsWith("0x") || trader.length !== 42) {
      throw new ValidationError("trader must be a valid 0x Ethereum address", ["trader"]);
    }

    if (!areContractsDeployed()) {
      return errorResponse("Contracts not deployed — run `npm run deploy:testnet`", "CONTRACT_ERROR", 503);
    }

    // ── 2. Build order object (encrypted before hitting the wire) ────────────
    const orderData = {
      inputAmount,
      tokenIn,
      tokenOut,
      maxSlippage,
      trader,
      submittedAt: Math.floor(Date.now() / 1000),
      version:     "2",
    };

    // ── 3. Encrypt & upload to 0G Storage ───────────────────────────────────
    let orderCID:    string;
    let explorerUrl: string;
    let storageReal: boolean;

    try {
      const upload  = await uploadEncryptedOrder(orderData as Record<string, unknown>);
      orderCID    = upload.cid;
      explorerUrl = upload.explorerUrl;
      storageReal = upload.isReal;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Storage upload failed";
      return errorResponse(msg, "STORAGE_ERROR", 502);
    }

    // ── 4. Submit on-chain — passing real trader address ────────────────────
    let tradeId: string;
    let txHash:  string;

    try {
      const signer  = getExecutorSigner();
      const request: TradeSubmitRequest = { inputAmount, tokenIn, tokenOut, maxSlippage, trader: trader as `0x${string}` };
      const result  = await submitTrade(signer, request, orderCID, trader);
      tradeId = result.tradeId;
      txHash  = result.txHash;
    } catch (err) {
      const raw   = err instanceof Error ? err.message : String(err);
      const clean = raw.includes("reason=") ? raw.split("reason=")[1]?.split(",")[0]?.trim() ?? raw : raw;
      return errorResponse(`Contract call failed: ${clean}`, "CONTRACT_ERROR", 502);
    }

    // ── 5. Index trade in 0G KV store + authorize agent (both non-blocking) ──
    appendTradeId(trader, tradeId).catch(e =>
      console.warn("[submit] KV indexing failed (non-fatal):", e instanceof Error ? e.message : e)
    );
    authorizeTrader(trader).catch(e =>
      console.warn("[submit] Agent authorization failed (non-fatal):", e instanceof Error ? e.message : e)
    );

    // ── 6. Respond with storage provenance info ──────────────────────────────
    const response: TradeSubmitResponse & {
      storage: { cid: string; real: boolean; explorerUrl: string; network: string };
    } = {
      tradeId,
      orderCID,
      txHash:    txHash as `0x${string}`,
      timestamp: Math.floor(Date.now() / 1000),
      storage: {
        cid:         orderCID,
        real:        storageReal,
        explorerUrl,
        network:     storageReal ? "0G Galileo Testnet" : "mock",
      },
    };

    return successResponse(response, 201);
  });
}
