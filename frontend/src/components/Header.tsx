"use client";

import Link from "next/link";
import Image from "next/image";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { AlertTriangle, ChevronDown, ExternalLink, Shield, Wifi } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { shortenAddress, formatChainName, DEFAULT_CHAIN } from "@/lib/wagmi-config";

export function Header() {
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const { open }                 = useWeb3Modal();
  const { switchChain }          = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== DEFAULT_CHAIN.id;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <Link href="/trade" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 group-hover:bg-blue-500 transition-colors">
            <Shield className="h-4 w-4 text-white" aria-hidden />
          </div>
          <span className="font-bold text-zinc-100 text-lg tracking-tight hidden sm:block">
            Verify<span className="text-blue-400">Trade</span>
          </span>
        </Link>

        {/* ── Nav ──────────────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main">
          <NavLink href="/trade">Trade</NavLink>
          <NavLink href="/verify">Verify</NavLink>
          <NavLink href="/dashboard">Dashboard</NavLink>
        </nav>

        {/* ── Wallet area ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2">

          {/* Wrong network warning */}
          {isWrongNetwork && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => switchChain({ chainId: DEFAULT_CHAIN.id })}
              leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}
              aria-label="Switch to Arbitrum Sepolia"
            >
              <span className="hidden sm:inline">Wrong network — click to switch</span>
              <span className="sm:hidden">Switch network</span>
            </Button>
          )}

          {/* Network badge */}
          {isConnected && !isWrongNetwork && (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400"
              aria-label={`Connected to ${formatChainName(chainId)}`}
            >
              <Wifi className="h-3 w-3 text-green-400" aria-hidden />
              {formatChainName(chainId)}
            </div>
          )}

          {/* Connect / account button */}
          {isConnected && address ? (
            <button
              onClick={() => open({ view: "Account" })}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
              aria-label="Open wallet menu"
            >
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shrink-0" aria-hidden />
              <span className="font-mono">{shortenAddress(address)}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
            </button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => open()}
              aria-label="Connect wallet"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
    >
      {children}
    </Link>
  );
}
