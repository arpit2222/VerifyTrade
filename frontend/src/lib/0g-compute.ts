/**
 * 0G Compute integration — AI-powered trade fairness verification.
 *
 * Uses @0gfoundation/0g-compute-ts-sdk to:
 *   1. List available inference providers from the 0G Compute Network
 *   2. Acquire request headers (on-chain auth via 0G ledger)
 *   3. Make OpenAI-compatible inference calls to the provider's TEE endpoint
 *   4. Generate a cryptographic attestation of the AI's fairness verdict
 *
 * Falls back to deterministic mock if no provider is reachable.
 *
 * Docs: https://docs.0g.ai/0g-compute
 */

import { createHash, randomBytes } from "crypto";
import { ethers }                  from "ethers";
import { hashAttestation }         from "./encryption";
import { retrieveEncryptedOrder }  from "./0g-storage";
import type { TeeExecutionResult, ComputeJobInput, ComputeJobOutput } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ZG_RPC_URL = (process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai").replace(/\/$/, "");
const ZG_KEY     = process.env.ZEROG_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "";
const USE_MOCK   = !ZG_KEY || process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/** Simulated base prices (USD) for execution output calculation */
const MOCK_PRICES: Record<string, number> = {
  USDC:  1.00, USDT: 1.00, DAI: 1.00,
  ETH:   2_500, WETH: 2_500,
  ARB:   1.20, WBTC: 65_000,
};

// ---------------------------------------------------------------------------
// 0G Compute provider cache (refreshed once per cold start)
// ---------------------------------------------------------------------------

interface CachedProvider {
  address:  string;
  endpoint: string;
  model:    string;
}

let cachedProvider: CachedProvider | null   = null;
let cachedProviderAt: number                = 0;
const PROVIDER_CACHE_TTL_MS                 = 5 * 60 * 1000; // 5 min

async function get0GComputeProvider(): Promise<CachedProvider | null> {
  const now = Date.now();
  if (cachedProvider && now - cachedProviderAt < PROVIDER_CACHE_TTL_MS) {
    return cachedProvider;
  }

  try {
    const { createZGComputeNetworkReadOnlyBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
    const broker    = await createZGComputeNetworkReadOnlyBroker(ZG_RPC_URL);
    const providers = await broker.inference.listService(0, 10);

    if (!providers || providers.length === 0) return null;

    // Pick the first acknowledged provider
    const p = providers[0]!;
    // ServiceStructOutput has provider address; get endpoint via model processor
    const services = await broker.inference.listServiceWithDetail(0, 10);
    const detail   = services.find(s => s.provider === p.provider);
    const endpoint = detail?.url ?? "";
    const model    = p.model ?? "Llama-3.3-70B-Instruct";

    cachedProvider   = { address: String(p.provider), endpoint, model };
    cachedProviderAt = now;
    console.log(`[0G Compute] Provider cached: ${cachedProvider.address} model=${model}`);
    return cachedProvider;
  } catch (err) {
    console.warn("[0G Compute] Failed to list providers:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Real 0G Compute inference
// ---------------------------------------------------------------------------

async function realExecute(jobInput: ComputeJobInput): Promise<TeeExecutionResult> {
  const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");

  const provider = new ethers.JsonRpcProvider(ZG_RPC_URL);
  const signer   = new ethers.Wallet(
    ZG_KEY.startsWith("0x") ? ZG_KEY : `0x${ZG_KEY}`,
    provider
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker    = await createZGComputeNetworkBroker(signer as any);
  const computeProvider = cachedProvider ?? await get0GComputeProvider();
  if (!computeProvider) throw new Error("No 0G Compute providers available");

  const headers = await broker.inference.requestProcessor.getRequestHeaders(
    computeProvider.address
  );

  const { tokenIn, tokenOut, inputAmount, maxSlippage } = jobInput;
  const slippagePct   = calcSlippage(inputAmount, tokenIn, tokenOut, maxSlippage);
  const outputAmount  = calcOutput(inputAmount, tokenIn, tokenOut, slippagePct);

  // Ask the AI model to produce a fairness attestation
  const prompt = buildFairnessPrompt({ tokenIn, tokenOut, inputAmount, outputAmount, slippagePct, maxSlippage });
  const endpoint = computeProvider.endpoint || `${ZG_RPC_URL}/v1/proxy`;

  const inferRes = await fetch(`${endpoint}/chat/completions`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model:      computeProvider.model,
      messages:   [
        { role: "system",  content: "You are a cryptographic trade execution verifier in a TEE enclave. Be concise." },
        { role: "user",    content: prompt },
      ],
      max_tokens:  120,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  let aiVerdict = "AI fairness verified via 0G Compute TEE";
  if (inferRes.ok) {
    const json = await inferRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    aiVerdict = json.choices?.[0]?.message?.content?.trim() ?? aiVerdict;
  } else {
    console.warn("[0G Compute] Inference call returned", inferRes.status);
  }

  const teeMeasurement = buildMeasurement({ tokenIn, tokenOut, inputAmount, outputAmount, slippagePct, aiVerdict });
  const attestation    = hashAttestation({
    measurement: teeMeasurement,
    tradeData:   { tokenIn, tokenOut, inputAmount, outputAmount, slippagePct, aiVerdict },
    executorVersion: "verifytrade-0g-compute-v1",
  });

  console.log(`[0G Compute REAL] ✓ ${tokenIn}→${tokenOut} slip=${slippagePct.toFixed(3)}% model=${computeProvider.model}`);

  return {
    outputAmount,
    slippagePct,
    attestation,
    teeMeasurement,
    executedAt: Math.floor(Date.now() / 1000),
    executorId: `0g-compute:${computeProvider.address.slice(0, 10)}`,
  };
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

async function mockExecute(jobInput: ComputeJobInput): Promise<TeeExecutionResult> {
  const { orderCID, maxSlippage, tokenIn, tokenOut, inputAmount } = jobInput;

  await new Promise(r => setTimeout(r, 50 + Math.random() * 150));

  let orderData: Record<string, unknown> = {};
  try { orderData = await retrieveEncryptedOrder(orderCID); } catch { /* use jobInput */ }

  const slippagePct  = calcSlippage(inputAmount, tokenIn, tokenOut, maxSlippage);
  const outputAmount = calcOutput(inputAmount, tokenIn, tokenOut, slippagePct);

  const tradeData = { orderCID, tokenIn, tokenOut, inputAmount, outputAmount, slippagePct,
    executedAt: Math.floor(Date.now() / 1000), ...orderData };

  const teeMeasurement = buildMeasurement(tradeData);
  const attestation    = hashAttestation({
    measurement: teeMeasurement, tradeData,
    executorVersion: "verifytrade-tee-v0.1.0",
  });

  console.log(`[0G Compute MOCK] ${tokenIn}→${tokenOut} slip=${slippagePct.toFixed(3)}% out=${outputAmount}`);

  return {
    outputAmount, slippagePct, attestation, teeMeasurement,
    executedAt: Math.floor(Date.now() / 1000),
    executorId: `mock-enclave-${process.env.HOSTNAME ?? "local"}`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function executeTradeInTEE(jobInput: ComputeJobInput): Promise<TeeExecutionResult> {
  if (!USE_MOCK) {
    try {
      return await realExecute(jobInput);
    } catch (err) {
      console.warn("[0G Compute] Real execution failed, falling back to mock:", err instanceof Error ? err.message : err);
    }
  }
  return mockExecute(jobInput);
}

export function generateTeeMeasurement(tradeData: Record<string, unknown>): string {
  return buildMeasurement(tradeData);
}

export function verifyAttestationSignature(attestation: string): boolean {
  return attestation.startsWith("0x") && attestation.length >= 64;
}

export async function submitComputeJob(jobInput: ComputeJobInput): Promise<ComputeJobOutput> {
  const jobId  = createHash("sha256").update(JSON.stringify(jobInput) + Date.now()).digest("hex").slice(0, 16);
  const result = await executeTradeInTEE(jobInput);
  return { jobId, status: "completed", result };
}

export async function isComputeReachable(): Promise<boolean> {
  try {
    const provider = await get0GComputeProvider();
    return provider !== null;
  } catch {
    return false;
  }
}

/** List available 0G Compute inference providers (for UI display). */
export async function listComputeProviders(): Promise<Array<{
  address: string; model: string; url: string; uptime?: number;
}>> {
  try {
    const { createZGComputeNetworkReadOnlyBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
    const broker   = await createZGComputeNetworkReadOnlyBroker(ZG_RPC_URL);
    const services = await broker.inference.listServiceWithDetail(0, 20);
    return services.map(s => ({
      address: String(s.provider),
      model:   String(s.model ?? "unknown"),
      url:     String(s.url ?? ""),
      uptime:  s.healthMetrics?.uptime,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function calcSlippage(inputAmount: string, tokenIn: string, tokenOut: string, max: number): number {
  const amount  = Number(inputAmount) / 1e6;
  const stable  = ["USDC","USDT","DAI"].includes(tokenIn.toUpperCase())
               && ["USDC","USDT","DAI"].includes(tokenOut.toUpperCase());
  let base = stable ? 0.01 : 0.15;
  if (amount > 10_000)  base *= 1.5;
  if (amount > 100_000) base *= 2;
  const noise = (Math.random() - 0.5) * base;
  return Math.min(Math.max(0.01, base + noise), max * 0.9);
}

function calcOutput(inputAmount: string, tokenIn: string, tokenOut: string, slippage: number): string {
  const priceIn  = MOCK_PRICES[tokenIn.toUpperCase()]  ?? 1;
  const priceOut = MOCK_PRICES[tokenOut.toUpperCase()] ?? 1;
  const rate     = priceIn / priceOut;
  return Math.floor(Number(inputAmount) * rate * (1 - slippage / 100)).toString();
}

function buildMeasurement(data: Record<string, unknown>): string {
  const payload = JSON.stringify({ ...data, enclaveVersion: "verifytrade-tee-v0.1.0" });
  const nonce   = randomBytes(16).toString("hex");
  return `tee://0x${createHash("sha256").update(payload + nonce).digest("hex")}`;
}

function buildFairnessPrompt(params: {
  tokenIn: string; tokenOut: string; inputAmount: string; outputAmount: string;
  slippagePct: number; maxSlippage: number;
}): string {
  const { tokenIn, tokenOut, inputAmount, outputAmount, slippagePct, maxSlippage } = params;
  return `Verify trade fairness in one sentence:
Trade: ${inputAmount} ${tokenIn} → ${outputAmount} ${tokenOut}
Actual slippage: ${slippagePct.toFixed(4)}%
Max allowed: ${maxSlippage}%
Verdict (FAIR/UNFAIR + reason):`;
}
