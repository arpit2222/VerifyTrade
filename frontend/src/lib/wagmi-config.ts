"use client";

import { cookieStorage, createStorage, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config";

// ---------------------------------------------------------------------------
// WalletConnect project ID — required for Web3Modal / AppKit
// Get yours at: https://cloud.walletconnect.com
// ---------------------------------------------------------------------------
const _wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!_wcId || _wcId === "YOUR_PROJECT_ID") {
  if (typeof window !== "undefined") {
    console.warn("[VerifyTrade] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — wallet connection will fail. Get a project ID at https://cloud.walletconnect.com");
  }
}
export const WALLETCONNECT_PROJECT_ID = _wcId ?? "00000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Network configuration
// ---------------------------------------------------------------------------
export const SUPPORTED_CHAINS = [arbitrumSepolia] as const;
export const DEFAULT_CHAIN    = arbitrumSepolia;

// ---------------------------------------------------------------------------
// App metadata shown inside the wallet modal
// ---------------------------------------------------------------------------
const metadata = {
  name:        "VerifyTrade",
  description: "Fair DeFi trading with cryptographic proofs",
  url:         typeof window !== "undefined" ? window.location.origin : "https://verifytrade.xyz",
  icons:       ["/verifyTrade-logo.svg"],
};

// ---------------------------------------------------------------------------
// wagmi config (shared with Web3Modal)
// Uses cookie storage so connection persists across page reloads (SSR-safe)
// ---------------------------------------------------------------------------
export const wagmiConfig = defaultWagmiConfig({
  chains:   SUPPORTED_CHAINS,
  projectId: WALLETCONNECT_PROJECT_ID,
  metadata,
  ssr:       true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage:   createStorage({ storage: cookieStorage }) as any,
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ??
      "https://sepolia-rollup.arbitrum.io/rpc"
    ),
  },
});

// ---------------------------------------------------------------------------
// Block explorer helpers
// ---------------------------------------------------------------------------
export function getTxUrl(hash: string): string {
  return `https://sepolia.arbiscan.io/tx/${hash}`;
}

export function getAddressUrl(address: string): string {
  return `https://sepolia.arbiscan.io/address/${address}`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatChainName(chainId: number | undefined): string {
  if (chainId === arbitrumSepolia.id) return "Arbitrum Sepolia";
  return chainId ? `Chain ${chainId}` : "Unknown";
}
