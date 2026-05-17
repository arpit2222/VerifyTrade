/**
 * Contract interaction abstraction layer.
 *
 * Provides typed wrappers around ethers.js contract calls so the rest of the
 * application never has to deal with raw ABI encoding, BigInt conversions, or
 * transaction waiting directly.
 *
 * All functions that write state return the transaction receipt.
 * All read functions return decoded, JS-friendly values.
 */

import { ethers, type Provider, type Signer, type ContractTransactionReceipt } from "ethers";
import type {
  Trade,
  ExecutionProof,
  MevStats,
  ContractAddresses,
  TradeSubmitRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Minimal ABIs — only the functions we call from the API layer.
// TypeChain types live in contracts/typechain-types/ and are used in tests;
// the frontend uses these minimal ABIs to avoid a build-time dependency on
// the contracts workspace.
// ---------------------------------------------------------------------------

// Plain string[] — no `as const` so ethers.Interface accepts them without type gymnastics
const VERIFIABLE_TRADE_EXECUTOR_ABI: string[] = [
  "function submitTrade(address trader, string encryptedOrder, uint256 inputAmount, string tokenIn, string tokenOut, uint256 maxSlippagePercent) external returns (uint256 tradeId)",
  "function recordTradeResult(uint256 tradeId, uint256 outputAmount, string attestationHash, uint256 actualSlippagePercent, string executionDetails) external returns (bool)",
  "function getTrade(uint256 tradeId) external view returns (tuple(uint256 tradeId, address trader, string encryptedOrder, uint256 inputAmount, uint256 outputAmount, string tokenIn, string tokenOut, uint256 maxSlippagePercent, uint256 actualSlippagePercent, string attestationHash, uint256 timestamp, bool isExecuted, bool isFair, string executionDetails))",
  "function getTrades(uint256[] tradeIds) external view returns (tuple(uint256 tradeId, address trader, string encryptedOrder, uint256 inputAmount, uint256 outputAmount, string tokenIn, string tokenOut, uint256 maxSlippagePercent, uint256 actualSlippagePercent, string attestationHash, uint256 timestamp, bool isExecuted, bool isFair, string executionDetails)[])",
  "function getTradeHistory(address trader) external view returns (uint256[])",
  "function verifyAttestation(uint256 tradeId, string expectedHash) external view returns (bool)",
  "function totalTradesSubmitted() external view returns (uint256)",
  "function totalTradesExecuted() external view returns (uint256)",
  "function nextTradeId() external view returns (uint256)",
  "event TradeSubmitted(uint256 indexed tradeId, address indexed trader, string tokenIn, string tokenOut, uint256 inputAmount, uint256 maxSlippagePercent, uint256 timestamp)",
  "event TradeExecuted(uint256 indexed tradeId, address indexed trader, uint256 outputAmount, uint256 actualSlippagePercent, bool isFair, string attestationHash, uint256 timestamp)",
];

const FAIRNESS_PROOF_ABI: string[] = [
  "function recordProof(uint256 tradeId, string teeMeasurement, uint256 expectedSlippagePercent, uint256 actualSlippagePercent, string executorAddress) external returns (uint256 proofId)",
  "function getProof(uint256 proofId) external view returns (tuple(uint256 proofId, uint256 tradeId, string teeMeasurement, uint256 expectedSlippagePercent, uint256 actualSlippagePercent, bool slippageWithinLimit, uint256 timestamp, string executorAddress))",
  "function isTradeFair(uint256 proofId) external view returns (bool)",
  "function getProofsByTrade(uint256 tradeId) external view returns (uint256[])",
  "function getTeeAttestation(uint256 proofId) external view returns (string)",
  "function globalFairnessRatioBps() external view returns (uint256)",
  "function totalProofsRecorded() external view returns (uint256)",
  "function totalFairProofs() external view returns (uint256)",
  "event ProofRecorded(uint256 indexed proofId, uint256 indexed tradeId, bool slippageWithinLimit, uint256 actualSlippagePercent, uint256 timestamp)",
];

const MEV_REGISTRY_ABI: string[] = [
  "function recordMevCheck(uint256 tradeId, address trader, bool mevDetected, uint256 mevAmount, uint256 protectionSavings, string protectionMethod) external returns (uint256 checkId)",
  "function getMevEvent(uint256 checkId) external view returns (tuple(uint256 checkId, uint256 tradeId, address trader, bool mevDetected, uint256 mevAmount, uint256 protectionSavings, uint256 timestamp, string protectionMethod))",
  "function getMevEventByTrade(uint256 tradeId) external view returns (tuple(uint256 checkId, uint256 tradeId, address trader, bool mevDetected, uint256 mevAmount, uint256 protectionSavings, uint256 timestamp, string protectionMethod))",
  "function getMevHistoryByTrader(address trader) external view returns (uint256[])",
  "function getTotalMevSavings(address trader) external view returns (uint256)",
  "function getMevStats() external view returns (uint256 checks, uint256 detections, uint256 savingsUsd6, uint256 detectionRate)",
  "function wasMevDetected(uint256 tradeId) external view returns (bool)",
  "function totalChecks() external view returns (uint256)",
  "function totalMevDetections() external view returns (uint256)",
  "function totalGlobalSavingsUsd6() external view returns (uint256)",
  "event MevCheckRecorded(uint256 indexed checkId, uint256 indexed tradeId, address indexed trader, bool mevDetected, uint256 protectionSavings, string protectionMethod, uint256 timestamp)",
];

// ---------------------------------------------------------------------------
// Contract address resolution
// ---------------------------------------------------------------------------

/** Chain identifier — "arbitrum" (default) or "0g" */
export type ChainTarget = "arbitrum" | "0g";

/**
 * Get contract addresses for a specific chain.
 * Defaults to Arbitrum Sepolia. Pass "0g" to get 0G Galileo addresses.
 */
export function getContractAddresses(chain: ChainTarget = "arbitrum"): ContractAddresses {
  if (chain === "0g") {
    return {
      verifiableTradeExecutor: process.env.NEXT_PUBLIC_ZG_VERIFIABLE_TRADE_EXECUTOR_ADDRESS ?? "0xaEAD54C9251D14113f9d71Fee95183751a6F8bd1",
      fairnessProof:           process.env.NEXT_PUBLIC_ZG_FAIRNESS_PROOF_ADDRESS            ?? "0x1B1aB51446fCEcBFF632FFCec769C55504E50a02",
      mevRegistry:             process.env.NEXT_PUBLIC_ZG_MEV_REGISTRY_ADDRESS              ?? "0xdaa0675bf1592FE3A0a822b0194bA2b9e9BFfB92",
      verifyTrade:             process.env.NEXT_PUBLIC_ZG_VERIFY_TRADE_ADDRESS              ?? "0x08d3c771E9f1C527f9a6798148953F1C898Ee1a5",
    };
  }
  return {
    verifiableTradeExecutor: process.env.NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS ?? "",
    fairnessProof:           process.env.NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS            ?? "",
    mevRegistry:             process.env.NEXT_PUBLIC_MEV_REGISTRY_ADDRESS              ?? "",
    verifyTrade:             process.env.NEXT_PUBLIC_VERIFY_TRADE_ADDRESS              ?? "",
  };
}

export function areContractsDeployed(): boolean {
  const addrs = getContractAddresses();
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  return (
    !!addrs.verifiableTradeExecutor &&
    addrs.verifiableTradeExecutor !== zeroAddr &&
    !!addrs.fairnessProof &&
    addrs.fairnessProof !== zeroAddr &&
    !!addrs.mevRegistry &&
    addrs.mevRegistry !== zeroAddr
  );
}

// ---------------------------------------------------------------------------
// Contract factory
// ---------------------------------------------------------------------------

export interface ContractInstances {
  vte: ethers.Contract;
  fp:  ethers.Contract;
  mr:  ethers.Contract;
}

/**
 * Create typed contract instances bound to a provider or signer.
 * Pass a Signer for write operations, a Provider for reads.
 */
export function initializeContracts(signerOrProvider: Signer | Provider): ContractInstances {
  const addrs = getContractAddresses();

  return {
    vte: new ethers.Contract(addrs.verifiableTradeExecutor, VERIFIABLE_TRADE_EXECUTOR_ABI, signerOrProvider),
    fp:  new ethers.Contract(addrs.fairnessProof,           FAIRNESS_PROOF_ABI,            signerOrProvider),
    mr:  new ethers.Contract(addrs.mevRegistry,             MEV_REGISTRY_ABI,              signerOrProvider),
  };
}

// ---------------------------------------------------------------------------
// Server-side provider (used by API routes)
// ---------------------------------------------------------------------------

let _provider:   ethers.JsonRpcProvider | null = null;
let _zgProvider: ethers.JsonRpcProvider | null = null;

export function getProvider(chain: ChainTarget = "arbitrum"): ethers.JsonRpcProvider {
  if (chain === "0g") {
    if (!_zgProvider) {
      const rpcUrl = process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
      _zgProvider  = new ethers.JsonRpcProvider(rpcUrl);
    }
    return _zgProvider;
  }
  if (!_provider) {
    // Fall back to the public Arbitrum Sepolia RPC if no custom key is configured.
    // The public endpoint is rate-limited but sufficient for read operations.
    const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL
                ?? "https://sepolia-rollup.arbitrum.io/rpc";
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

export function getExecutorSigner(chain: ChainTarget = "arbitrum"): ethers.Wallet {
  // On testnet all three keys are typically the same wallet
  const privateKey = process.env.EXECUTOR_PRIVATE_KEY
                  ?? process.env.PRIVATE_KEY
                  ?? process.env.ZEROG_PRIVATE_KEY;
  if (!privateKey) throw new Error("EXECUTOR_PRIVATE_KEY not configured");
  return new ethers.Wallet(privateKey, getProvider(chain));
}

/** Get a provider and address tuple for the active chain — used by the execute route. */
export function getActiveChain(): { chain: ChainTarget; rpc: string; explorerBase: string } {
  const useZG = process.env.ACTIVE_CHAIN === "0g";
  return useZG
    ? { chain: "0g", rpc: process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai", explorerBase: "https://chainscan-galileo.0g.ai" }
    : { chain: "arbitrum", rpc: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "", explorerBase: "https://sepolia.arbiscan.io" };
}

// ---------------------------------------------------------------------------
// VerifiableTradeExecutor write operations
// ---------------------------------------------------------------------------

/**
 * Submit a trade to VerifiableTradeExecutor.
 * The encrypted order CID must already be uploaded to 0G Storage before calling.
 *
 * @param signer     Wallet that will sign the transaction (the trader or relayer).
 * @param orderData  Trade parameters.
 * @param orderCID   0G Storage CID of the encrypted order.
 * @returns          { tradeId, txHash, receipt }
 */
export async function submitTrade(
  signer:      Signer,
  orderData:   TradeSubmitRequest,
  orderCID:    string,
  traderAddr:  string   // the actual user wallet — fixes the identity bug
): Promise<{ tradeId: string; txHash: string; receipt: ContractTransactionReceipt }> {
  const { vte } = initializeContracts(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = vte as any;

  // Convert percent to contract's × 100 representation (0.5% → 50)
  const maxSlippageBps = BigInt(Math.round(orderData.maxSlippage * 100));

  const tx = await c.submitTrade(
    traderAddr,              // ← actual user, not executor
    orderCID,
    BigInt(orderData.inputAmount),
    orderData.tokenIn,
    orderData.tokenOut,
    maxSlippageBps
  );

  const receipt = await tx.wait() as ContractTransactionReceipt;

  // Parse tradeId from the TradeSubmitted event
  const iface  = new ethers.Interface(VERIFIABLE_TRADE_EXECUTOR_ABI);
  let tradeId  = "0";

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "TradeSubmitted") {
        tradeId = parsed.args[0].toString();
        break;
      }
    } catch { /* skip non-matching logs */ }
  }

  return { tradeId, txHash: receipt.hash, receipt };
}

/**
 * Record the result of an off-chain execution on-chain.
 *
 * @param signer              Authorized executor wallet.
 * @param tradeId             Target trade.
 * @param outputAmount        Actual tokens received (base units).
 * @param attestationHash     Hash of the TEE / 0G-AI attestation.
 * @param actualSlippagePct   Actual slippage × 100 (e.g. 30 = 0.30%).
 * @param executionDetails    JSON metadata string.
 */
export async function recordTradeResult(
  signer:            Signer,
  tradeId:           string,
  outputAmount:      string,
  attestationHash:   string,
  actualSlippagePct: number,
  executionDetails:  string
): Promise<{ txHash: string; receipt: ContractTransactionReceipt }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vte } = initializeContracts(signer) as any;

  const tx = await vte.recordTradeResult(
    BigInt(tradeId),
    BigInt(outputAmount),
    attestationHash,
    BigInt(Math.round(actualSlippagePct * 100)),
    executionDetails
  );

  const receipt = await tx.wait() as ContractTransactionReceipt;
  return { txHash: receipt.hash, receipt };
}

// ---------------------------------------------------------------------------
// VerifiableTradeExecutor read operations
// ---------------------------------------------------------------------------

/**
 * Fetch a single trade from the contract.
 */
export async function getTrade(
  provider: Provider,
  tradeId:  string
): Promise<Trade> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vte } = initializeContracts(provider) as any;
  const raw = await vte.getTrade(BigInt(tradeId));
  return decodeTradeStruct(raw);
}

/**
 * Fetch multiple trades in a single RPC call.
 */
export async function getTrades(
  provider:  Provider,
  tradeIds:  string[]
): Promise<Trade[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vte } = initializeContracts(provider) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raws = await vte.getTrades(tradeIds.map(BigInt)) as any[];
  return raws.map(decodeTradeStruct);
}

/**
 * Get all trade IDs for a specific trader address.
 */
export async function getTradeHistory(
  provider: Provider,
  trader:   string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vte } = initializeContracts(provider) as any;
  const ids = await vte.getTradeHistory(trader) as bigint[];
  return ids.map(String);
}

/**
 * Verify that a recorded attestation matches the expected hash.
 */
export async function verifyAttestation(
  provider:     Provider,
  tradeId:      string,
  expectedHash: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { vte } = initializeContracts(provider) as any;
  return vte.verifyAttestation(BigInt(tradeId), expectedHash) as Promise<boolean>;
}

// ---------------------------------------------------------------------------
// FairnessProof write operations
// ---------------------------------------------------------------------------

/**
 * Record a TEE execution proof on-chain.
 *
 * @param signer              Authorized prover wallet.
 * @param tradeId             Trade this proof belongs to.
 * @param teeMeasurement      Raw TEE attestation string.
 * @param expectedSlippage    Trader's slippage limit × 100.
 * @param actualSlippage      Actual slippage × 100.
 * @param executorId          String ID of the TEE enclave or bot.
 * @returns                   { proofId, txHash }
 */
export async function recordProof(
  signer:           Signer,
  tradeId:          string,
  teeMeasurement:   string,
  expectedSlippage: number,
  actualSlippage:   number,
  executorId:       string
): Promise<{ proofId: string; txHash: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fp } = initializeContracts(signer) as any;

  const tx = await fp.recordProof(
    BigInt(tradeId),
    teeMeasurement,
    BigInt(Math.round(expectedSlippage * 100)),
    BigInt(Math.round(actualSlippage * 100)),
    executorId
  );

  const receipt = await tx.wait() as ContractTransactionReceipt;

  const iface = new ethers.Interface(FAIRNESS_PROOF_ABI);
  let proofId = "0";

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "ProofRecorded") {
        proofId = parsed.args[0].toString();
        break;
      }
    } catch { /* skip */ }
  }

  return { proofId, txHash: receipt.hash };
}

// ---------------------------------------------------------------------------
// FairnessProof read operations
// ---------------------------------------------------------------------------

export async function getProof(
  provider: Provider,
  proofId:  string
): Promise<ExecutionProof> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fp } = initializeContracts(provider) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fp.getProof(BigInt(proofId)) as any;
  return {
    proofId:                 raw.proofId.toString(),
    tradeId:                 raw.tradeId.toString(),
    teeMeasurement:          raw.teeMeasurement as string,
    expectedSlippagePercent: raw.expectedSlippagePercent.toString(),
    actualSlippagePercent:   raw.actualSlippagePercent.toString(),
    slippageWithinLimit:     raw.slippageWithinLimit as boolean,
    timestamp:               Number(raw.timestamp),
    executorAddress:         raw.executorAddress as string,
  };
}

export async function getGlobalFairnessRatio(provider: Provider): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fp } = initializeContracts(provider) as any;
  const bps = await fp.globalFairnessRatioBps() as bigint;
  return Number(bps) / 100; // Convert bps to percentage
}

// ---------------------------------------------------------------------------
// MevRegistry write operations
// ---------------------------------------------------------------------------

export async function recordMevCheck(
  signer:            Signer,
  tradeId:           string,
  trader:            string,
  mevDetected:       boolean,
  mevAmountUsd6:     string,
  savingsUsd6:       string,
  protectionMethod:  string
): Promise<{ checkId: string; txHash: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { mr } = initializeContracts(signer) as any;

  const tx = await mr.recordMevCheck(
    BigInt(tradeId),
    trader,
    mevDetected,
    BigInt(mevAmountUsd6),
    BigInt(savingsUsd6),
    protectionMethod
  );

  const receipt = await tx.wait() as ContractTransactionReceipt;

  const iface  = new ethers.Interface(MEV_REGISTRY_ABI);
  let checkId  = "0";

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "MevCheckRecorded") {
        checkId = parsed.args[0].toString();
        break;
      }
    } catch { /* skip */ }
  }

  return { checkId, txHash: receipt.hash };
}

// ---------------------------------------------------------------------------
// MevRegistry read operations
// ---------------------------------------------------------------------------

/**
 * Fetch global MEV statistics from the registry.
 */
export async function getMevStats(provider: Provider): Promise<MevStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { mr } = initializeContracts(provider) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await mr.getMevStats() as any;

  const checks      = BigInt(raw.checks ?? raw[0]);
  const detections  = BigInt(raw.detections ?? raw[1]);
  const savingsUsd6 = BigInt(raw.savingsUsd6 ?? raw[2]);
  const rateBps     = BigInt(raw.detectionRate ?? raw[3]);

  const safeCount   = Number(checks - detections);
  const savingsUsd  = (Number(savingsUsd6) / 1_000_000).toFixed(2);
  const ratePct     = Number(rateBps) / 100;

  return {
    totalChecks:        checks.toString(),
    totalDetections:    detections.toString(),
    totalSavingsUsd6:   savingsUsd6.toString(),
    detectionRateBps:   rateBps.toString(),
    totalTradesSafe:    safeCount,
    totalMevSavingsUsd: savingsUsd,
    detectionRatePct:   ratePct,
  };
}

// ---------------------------------------------------------------------------
// Struct decoder helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeTradeStruct(raw: any): Trade {
  const isExecuted = raw.isExecuted as boolean;
  let status: Trade["status"] = "committed";
  if (isExecuted)                  status = "executed";
  if (!isExecuted && !raw.trader)  status = "pending";

  return {
    tradeId:               raw.tradeId.toString() as string,
    trader:                raw.trader as `0x${string}`,
    encryptedOrder:        raw.encryptedOrder as string,
    inputAmount:           raw.inputAmount.toString() as string,
    outputAmount:          raw.outputAmount.toString() as string,
    tokenIn:               raw.tokenIn as string,
    tokenOut:              raw.tokenOut as string,
    maxSlippagePercent:    raw.maxSlippagePercent.toString() as string,
    actualSlippagePercent: raw.actualSlippagePercent.toString() as string,
    attestationHash:       raw.attestationHash as string,
    timestamp:             Number(raw.timestamp),
    isExecuted,
    isFair:                raw.isFair as boolean,
    executionDetails:      raw.executionDetails as string,
    status,
  };
}
