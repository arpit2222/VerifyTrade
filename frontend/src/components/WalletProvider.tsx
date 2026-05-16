"use client";

import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { wagmiConfig, WALLETCONNECT_PROJECT_ID, SUPPORTED_CHAINS } from "@/lib/wagmi-config";

// ---------------------------------------------------------------------------
// Initialise Web3Modal (AppKit) once at module level.
// This registers the modal globally — the <w3m-button> web component and
// the useWeb3Modal() hook both rely on this singleton.
// ---------------------------------------------------------------------------
createWeb3Modal({
  wagmiConfig,
  projectId: WALLETCONNECT_PROJECT_ID,
  enableAnalytics: false,
  enableOnramp:    false,
  themeMode:       "dark",
  themeVariables:  {
    "--w3m-accent":           "#3b82f6",   // blue-500
    "--w3m-border-radius-master": "8px",
  },
  featuredWalletIds: [
    // MetaMask
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    // Coinbase
    "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  ],
});

// ---------------------------------------------------------------------------
// A fresh QueryClient per session — not shared across renders so
// server/client hydration boundaries stay clean
// ---------------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry:     2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WalletProviderProps {
  children:    ReactNode;
  /** Cookie string from the server request (for SSR-safe hydration) */
  cookie?:     string | null;
}

// ---------------------------------------------------------------------------
// Provider tree
// ---------------------------------------------------------------------------

export function WalletProvider({ children, cookie }: WalletProviderProps) {
  const queryClient    = getQueryClient();
  const initialState   = cookieToInitialState(wagmiConfig, cookie);

  // Prevent hydration mismatch from wallet-connection state
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Render children always — wallet-dependent UI should use mounted guard */}
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
