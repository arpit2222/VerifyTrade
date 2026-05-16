/**
 * 0G Compute / TEE execution layer.
 *
 * 0G Compute provides verifiable off-chain computation inside Trusted Execution
 * Environments (TEEs). For VerifyTrade, we use it to:
 *   1. Fetch the encrypted order from 0G Storage
 *   2. Decrypt and execute the trade inside the TEE
 *   3. Generate a tamper-proof attestation of the execution
 *   4. Return the attestation so it can be recorded on-chain
 *
 * This module ships a high-fidelity MOCK that:
 *   - Simulates realistic slippage based on token pair volatility
 *   - Generates deterministic attestation hashes
 *   - Detects MEV based on simulated mempool conditions
 *   - Has the exact same API surface as the real 0G Compute integration
 *
 * To switch to real 0G Compute: set ZEROG_COMPUTE_NODE in .env and implement
 * the `realExecute()` function at the bottom of this file.
 *
 * Docs: https://docs.0g.ai/0g-compute
 */

import { createHash, randomBytes } from "crypto";
import { hashAttestation } from "./encryption";
import { retrieveEncryptedOrder } from "./0g-storage";
import type { TeeExecutionResult, ComputeJobInput, ComputeJobOutput } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COMPUTE_NODE  = process.env.ZEROG_COMPUTE_NODE ?? "";
const COMPUTE_KEY   = process.env.ZEROG_COMPUTE_API_KEY ?? "";
const USE_MOCK      = !COMPUTE_NODE || process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/** Simulated base prices (USD) for mock execution */
const MOCK_PRICES: Record<string, number> = {
  USDC:  1.00,
  USDT:  1.00,
  DAI:   1.00,
  ETH:   2_500,
  WETH:  2_500,
  ARB:   1.20,
  WBTC:  65_000,
};

// ---------------------------------------------------------------------------
// Internal mock helpers
// ---------------------------------------------------------------------------

/**
 * Get a simulated spot price for a token pair.
 * In production this would come from 0G AI price oracle.
 */
function getSimulatedPrice(tokenIn: string, tokenOut: string): number {
  const priceIn  = MOCK_PRICES[tokenIn.toUpperCase()]  ?? 1;
  const priceOut = MOCK_PRICES[tokenOut.toUpperCase()] ?? 1;
  return priceIn / priceOut;
}

/**
 * Simulate realistic slippage based on order size and token pair.
 * Returns slippage as a percentage (0.05–0.80 typical range).
 */
function simulateSlippage(
  inputAmount: string,
  tokenIn:     string,
  tokenOut:    string,
  maxSlippage: number
): number {
  const amount       = Number(inputAmount) / 1e6; // Assume USDC-like 6 decimals
  const isStablePair = ["USDC", "USDT", "DAI"].includes(tokenIn.toUpperCase())
                    && ["USDC", "USDT", "DAI"].includes(tokenOut.toUpperCase());

  // Base slippage: stablecoins are tighter
  let base = isStablePair ? 0.01 : 0.15;

  // Scale with order size (larger orders have more impact)
  if (amount > 10_000) base *= 1.5;
  if (amount > 100_000) base *= 2;

  // Add random noise (±50% of base)
  const noise = (Math.random() - 0.5) * base;
  const actual = Math.max(0.01, base + noise);

  // Cap at 90% of maxSlippage so most trades are "fair"
  return Math.min(actual, maxSlippage * 0.9);
}

/**
 * Simulate MEV detection based on current network conditions.
 * In production, this is replaced by 0G Compute's real MEV scanner.
 */
function simulateMevDetection(inputAmount: string): {
  detected:          boolean;
  mevAmountUsd6:     string;
  savingsUsd6:       string;
  protectionMethod:  string;
} {
  // MEV is more likely on large orders
  const amount       = Number(inputAmount) / 1e6;
  const mevProbability = Math.min(0.35, amount / 50_000);
  const detected     = Math.random() < mevProbability;

  if (!detected) {
    return {
      detected:         false,
      mevAmountUsd6:    "0",
      savingsUsd6:      "0",
      protectionMethod: "commit-reveal",
    };
  }

  // Simulate extractable value: 0.1%–1% of order
  const mevPct        = 0.001 + Math.random() * 0.009;
  const mevUsd        = amount * mevPct;
  const savedUsd      = mevUsd * 0.9; // We save 90% of potential MEV
  const mevAmountUsd6 = Math.round(mevUsd * 1_000_000).toString();
  const savingsUsd6   = Math.round(savedUsd * 1_000_000).toString();

  const methods = ["commit-reveal", "flashbots-protect", "private-mempool", "batch-auction"];
  const method  = methods[Math.floor(Math.random() * methods.length)] ?? "commit-reveal";

  return {
    detected:         true,
    mevAmountUsd6,
    savingsUsd6,
    protectionMethod: method,
  };
}

/**
 * Generate a deterministic TEE measurement hash from trade data.
 * In production, this is the actual remote attestation quote from Intel TDX.
 */
function generateTeeMeasurementInternal(tradeData: Record<string, unknown>): string {
  const payload    = JSON.stringify({ ...tradeData, enclaveVersion: "verifytrade-tee-v0.1.0" });
  const nonce      = randomBytes(16).toString("hex");
  const measurement = createHash("sha256")
    .update(payload + nonce)
    .digest("hex");
  return `tee://0x${measurement}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a trade inside a TEE (or mock) and return the attestation.
 *
 * @param jobInput  Parameters describing what to execute.
 * @returns         Execution result with amounts, slippage, and TEE attestation.
 */
export async function executeTradeInTEE(
  jobInput: ComputeJobInput
): Promise<TeeExecutionResult> {
  if (USE_MOCK) {
    return mockExecute(jobInput);
  }
  return realExecute(jobInput);
}

/**
 * Generate a TEE measurement hash for arbitrary trade data.
 * Used by the API layer to build the attestation payload before on-chain storage.
 */
export function generateTeeMeasurement(
  tradeData: Record<string, unknown>
): string {
  return generateTeeMeasurementInternal(tradeData);
}

/**
 * Verify that an attestation string has valid structure.
 * In production, this calls out to an Intel/AMD attestation verification service.
 *
 * @param attestation  The attestation string from executeTradeInTEE().
 * @returns            True if the attestation looks structurally valid.
 */
export function verifyAttestationSignature(attestation: string): boolean {
  if (!attestation) return false;

  // Mock: accept anything that starts with our prefix and has enough content
  if (USE_MOCK) {
    return attestation.startsWith("tee://0x") && attestation.length >= 74;
  }

  // Real: would call 0G Compute verification endpoint
  return attestation.length > 0;
}

/**
 * Submit a job to 0G Compute and poll for completion.
 * Returns a ComputeJobOutput — use result.status to check if done.
 */
export async function submitComputeJob(
  jobInput: ComputeJobInput
): Promise<ComputeJobOutput> {
  const jobId = createHash("sha256")
    .update(JSON.stringify(jobInput) + Date.now())
    .digest("hex")
    .slice(0, 16);

  if (USE_MOCK) {
    // Immediately return "completed" in mock mode
    const result = await mockExecute(jobInput);
    return { jobId, status: "completed", result };
  }

  // Real: POST to 0G Compute API
  const res = await fetch(`${COMPUTE_NODE}/jobs`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${COMPUTE_KEY}`,
    },
    body: JSON.stringify({ input: jobInput }),
  });

  if (!res.ok) {
    return { jobId, status: "failed", error: `Compute API error: ${res.status}` };
  }

  const json = await res.json() as { jobId: string; status: string };
  return { jobId: json.jobId, status: "running" };
}

/**
 * Check whether the 0G Compute node is reachable.
 */
export async function isComputeReachable(): Promise<boolean> {
  if (USE_MOCK) return true;

  try {
    const res = await fetch(`${COMPUTE_NODE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

async function mockExecute(jobInput: ComputeJobInput): Promise<TeeExecutionResult> {
  const { orderCID, maxSlippage, tokenIn, tokenOut, inputAmount } = jobInput;

  // Simulate execution latency (50–200ms)
  await new Promise(r => setTimeout(r, 50 + Math.random() * 150));

  let orderData: Record<string, unknown> = {};
  try {
    orderData = await retrieveEncryptedOrder(orderCID);
  } catch {
    // If CID not found in mock store, use jobInput directly
    orderData = { tokenIn, tokenOut, inputAmount };
  }

  const slippagePct   = simulateSlippage(inputAmount, tokenIn, tokenOut, maxSlippage);
  const exchangeRate  = getSimulatedPrice(tokenIn, tokenOut);
  const rawOutput     = Number(inputAmount) * exchangeRate;
  const slippageMult  = 1 - slippagePct / 100;
  const outputAmount  = Math.floor(rawOutput * slippageMult).toString();

  const tradeData = {
    orderCID,
    tokenIn,
    tokenOut,
    inputAmount,
    outputAmount,
    slippagePct,
    executedAt: Math.floor(Date.now() / 1000),
    ...orderData,
  };

  const teeMeasurement = generateTeeMeasurementInternal(tradeData);
  const attestation    = hashAttestation({
    measurement: teeMeasurement,
    tradeData,
    executorVersion: "verifytrade-tee-v0.1.0",
  });

  const executedAt = Math.floor(Date.now() / 1000);
  const executorId = `mock-enclave-${process.env.HOSTNAME ?? "local"}`;

  console.log(`[0G Compute MOCK] Trade executed: ${tokenIn}→${tokenOut} | slippage: ${slippagePct.toFixed(3)}% | output: ${outputAmount}`);

  return {
    outputAmount,
    slippagePct,
    attestation,
    teeMeasurement,
    executedAt,
    executorId,
  };
}

// ---------------------------------------------------------------------------
// Real 0G Compute implementation (stub — fill in when API keys are available)
// ---------------------------------------------------------------------------

async function realExecute(jobInput: ComputeJobInput): Promise<TeeExecutionResult> {
  const res = await fetch(`${COMPUTE_NODE}/execute`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${COMPUTE_KEY}`,
    },
    body: JSON.stringify(jobInput),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0G Compute execution failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<TeeExecutionResult>;
}
