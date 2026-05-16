"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import {
  ArrowRight, BarChart2, Clock, Shield,
  Bot, Network, TrendingUp,
} from "lucide-react";
import { Header }          from "@/components/Header";
import { MevStats }        from "@/components/MevStats";
import { ZeroGStatus }     from "@/components/ZeroGStatus";
import { AgentCard }       from "@/components/AgentCard";
import { LivePrices }      from "@/components/LivePrices";
import { Button }          from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useGetTrade }     from "@/hooks/useTrade";
import { getTxUrl }        from "@/lib/wagmi-config";
import { truncateMiddle }  from "@/lib/utils";

// ---------------------------------------------------------------------------
// Recent trades — from session storage
// ---------------------------------------------------------------------------

const MAX_RECENT_TRADES = 20;

function useRecentTradeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem("vt_recent_trades");
    const all = raw ? (JSON.parse(raw) as string[]) : [];
    // Return most recent first, capped to avoid memory issues
    return all.slice(-MAX_RECENT_TRADES).reverse();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { open }        = useWeb3Modal();
  const recentIds       = useRecentTradeIds();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page heading ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-400" aria-hidden />
            Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Platform-wide MEV protection stats, 0G network status, and your recent trades
          </p>
        </div>

        {/* ── Stats + recent trades ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          <div className="lg:col-span-1">
            <MevStats />
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-400" aria-hidden />
                  Recent Trades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isConnected ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <Shield className="h-10 w-10 text-zinc-700" aria-hidden />
                    <p className="text-sm text-zinc-500">
                      Connect your wallet to see your trade history
                    </p>
                    <Button variant="primary" size="sm" onClick={() => open()}>
                      Connect Wallet
                    </Button>
                  </div>
                ) : recentIds.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <Clock className="h-10 w-10 text-zinc-700" aria-hidden />
                    <p className="text-sm text-zinc-500">No recent trades in this session</p>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/trade">Place your first order</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {recentIds.map((id) => (
                      <RecentTradeRow key={id} tradeId={id} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 0G Network Intelligence ───────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-100">0G Network Intelligence</h2>
            <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5 ml-1">
              Live
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ZeroGStatus />
            <AgentCard />
            <LivePrices />
          </div>
        </div>

        {/* ── Nav tiles ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NavTile
            href="/trade"
            icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
            title="Place Order"
            desc="Submit a new MEV-protected trade"
            primary
          />
          <NavTile
            href="/verify"
            icon={<Shield className="h-5 w-5 text-green-400" />}
            title="Verify Proof"
            desc="Inspect any trade's fairness attestation"
          />
          <NavTile
            href="/agent"
            icon={<Bot className="h-5 w-5 text-purple-400" />}
            title="Agent Details"
            desc="View the ERC-7857 on-chain executor agent"
          />
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent trade row
// ---------------------------------------------------------------------------

function RecentTradeRow({ tradeId }: { tradeId: string }) {
  const { data, isLoading } = useGetTrade(tradeId);

  if (isLoading) {
    return (
      <div className="py-3 flex items-center gap-4">
        <div className="h-4 w-16 rounded bg-zinc-800 animate-pulse" />
        <div className="h-4 flex-1 rounded bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const statusColor =
    data.status === "executed" && data.isFair ? "text-green-400" :
    data.status === "executed"                ? "text-red-400"   :
    data.status === "committed"               ? "text-blue-400"  :
    "text-zinc-400";

  return (
    <div className="py-3 flex items-center gap-4">
      <div className="text-xs font-mono text-zinc-400 shrink-0 w-16">#{data.tradeId}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">
          {data.tokenIn} → {data.tokenOut}
        </p>
        <p className="text-xs text-zinc-500 truncate">
          {truncateMiddle(data.trader, 6, 4)}
        </p>
      </div>
      <span className={`text-xs font-medium shrink-0 ${statusColor}`}>
        {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
        {data.status === "executed" && (data.isFair ? " — Fair" : " — Unfair")}
      </span>
      <Link
        href={`/verify?id=${data.tradeId}`}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label={`Verify trade ${data.tradeId}`}
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav tile
// ---------------------------------------------------------------------------

function NavTile({
  href, icon, title, desc, primary = false,
}: {
  href:     string;
  icon:     React.ReactNode;
  title:    string;
  desc:     string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border p-5 flex items-start gap-3 transition-colors ${
        primary
          ? "border-blue-900 bg-blue-950/30 hover:bg-blue-950/50"
          : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60"
      }`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-100 group-hover:text-white transition-colors">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 mt-0.5 transition-colors shrink-0" />
    </Link>
  );
}
