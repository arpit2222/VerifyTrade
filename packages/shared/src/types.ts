// ---------------------------------------------------------------------------
// Core domain types shared between contracts (TypeChain) and the frontend
// ---------------------------------------------------------------------------

export type Address = `0x${string}`;
export type Hash = `0x${string}`;
export type Bytes = `0x${string}`;

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

export enum OrderStatus {
  Pending = 0,
  Committed = 1,
  Executed = 2,
  Cancelled = 3,
  Failed = 4,
}

export enum OrderSide {
  Buy = 0,
  Sell = 1,
}

export interface TradeOrder {
  id: Hash;
  trader: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  maxSlippageBps: number;   // basis points, e.g. 50 = 0.5%
  deadline: number;         // unix timestamp
  side: OrderSide;
  status: OrderStatus;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Proof
// ---------------------------------------------------------------------------

export interface TradeProof {
  tradeHash: Hash;
  orderId: Hash;
  trader: Address;
  executionPrice: bigint;
  executionTimestamp: number;
  executionBlock: number;
  proofSignature: Bytes;
  storageRef: Bytes;         // 0G Storage content hash
  verifierAddress: Address;
}

export interface ProofVerificationResult {
  valid: boolean;
  orderId: Hash;
  trader: Address;
  proof: TradeProof | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Price feed
// ---------------------------------------------------------------------------

export interface PriceFeedEntry {
  token: Address;
  priceUsd: bigint;         // 8 decimals (Chainlink convention)
  confidence: number;       // 0–10000 bps representing confidence %
  timestamp: number;
  source: "0g-ai" | "chainlink" | "fallback";
}

// ---------------------------------------------------------------------------
// On-chain events (mirrored from contract ABIs)
// ---------------------------------------------------------------------------

export interface OrderSubmittedEvent {
  orderId: Hash;
  trader: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  blockNumber: number;
  txHash: Hash;
}

export interface OrderExecutedEvent {
  orderId: Hash;
  trader: Address;
  amountIn: bigint;
  amountOut: bigint;
  executionPrice: bigint;
  proofHash: Hash;
  blockNumber: number;
  txHash: Hash;
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  connected: boolean;
  balance: bigint;
}
