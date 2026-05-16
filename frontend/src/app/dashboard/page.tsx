"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import {
  ArrowRight, BarChart2, Clock, ExternalLink, Shield,
} from "lucide-react";
import { Header } from "@/components/Header";
import { MevStats } from "@/components/MevStats";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useGetTrade } from "@/hooks/useTrade";
import { getTxUrl } from "@/lib/wagmi-config";
import { truncateMiddle } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Recent trades — driven by local session storage to avoid a dedicated API
// ---------------------------------------------------------------------------

function useRecentTradeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem("vt_recent_trades");
    return raw ? (JSON.parse(raw) as string[]) : [];
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
            Platform-wide MEV protection stats and your recent trades
          </p>
        </div>

        {/* ── Stats + recent trades ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* MEV stats — spans 1 column */}
          <div className="lg:col-span-1">
            <MevStats />
          </div>

          {/* Recent trades — spans 2 columns */}
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

        {/* ── Quick action ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-blue-900 bg-blue-950/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-zinc-100">Ready to trade?</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              Place a new order with MEV protection and fairness proofs.
            </p>
          </div>
          <Button variant="primary" size="md" asChild>
            <Link href="/trade" className="flex items-center gap-1.5">
              Open Trade <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
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
    data.status === "executed"                 ? "text-red-400"   :
    data.status === "committed"                ? "text-blue-400"  :
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
        href={`/trade/${data.tradeId}`}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label={`View trade ${data.tradeId}`}
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
