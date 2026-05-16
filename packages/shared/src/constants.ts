import type { Address } from "./types";

// ---------------------------------------------------------------------------
// Chain IDs
// ---------------------------------------------------------------------------

export const CHAIN_IDS = {
  ARBITRUM_SEPOLIA: 421614,
  HARDHAT: 31337,
  ZEROG_NEWTON: 16600,
} as const;

// ---------------------------------------------------------------------------
// Contract addresses (populated after deployment)
// Update these after running: npm run deploy:testnet
// ---------------------------------------------------------------------------

export const CONTRACT_ADDRESSES: Record<number, {
  verifyTrade: Address;
  tradeVerifier: Address;
  priceOracle: Address;
}> = {
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: {
    verifyTrade:   "0x0000000000000000000000000000000000000000",
    tradeVerifier: "0x0000000000000000000000000000000000000000",
    priceOracle:   "0x0000000000000000000000000000000000000000",
  },
  [CHAIN_IDS.HARDHAT]: {
    verifyTrade:   "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    tradeVerifier: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    priceOracle:   "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  },
};

// ---------------------------------------------------------------------------
// Well-known tokens on Arbitrum Sepolia
// ---------------------------------------------------------------------------

export const TOKENS: Record<string, Address> = {
  WETH:  "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
  USDC:  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  ARB:   "0x912CE59144191C1204E64559FE8253a0e49E6548",
};

// ---------------------------------------------------------------------------
// Trading limits
// ---------------------------------------------------------------------------

export const MAX_SLIPPAGE_BPS = 1000;  // 10% absolute maximum
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5% default
export const ORDER_DEADLINE_BUFFER_SECONDS = 1800; // 30 min default deadline

// ---------------------------------------------------------------------------
// 0G Network
// ---------------------------------------------------------------------------

export const ZEROG_CONFIG = {
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  storageNode: "https://storage-testnet.0g.ai",
  chainId: CHAIN_IDS.ZEROG_NEWTON,
} as const;
