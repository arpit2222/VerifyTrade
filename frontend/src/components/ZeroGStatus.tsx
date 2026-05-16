"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api-client";
import {
  Database, Cpu, Grid, Bot, ExternalLink, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useHealth() {
  return useQuery({
    queryKey:        ["health"],
    queryFn:         getHealth,
    refetchInterval: 30_000,
    staleTime:       25_000,
    retry:           1,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ZeroGStatus() {
  const { data, isLoading, isFetching, refetch } = useHealth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zg = (data as any)?.zeroG;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm">0G Network Status</CardTitle>
            <CardDescription className="mt-0.5 text-xs">Live integration health</CardDescription>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
            aria-label="Refresh 0G status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            <StatusRow
              icon={<Database className="h-3.5 w-3.5" />}
              label="0G Storage"
              ok={zg?.storage?.reachable ?? false}
              sub={zg?.storage?.mock ? "mock" : "Galileo testnet"}
              href="https://storagescan-galileo.0g.ai"
            />
            <StatusRow
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="0G Compute"
              ok={zg?.compute?.reachable ?? false}
              sub={zg?.compute?.providerCount
                ? `${zg.compute.providerCount} provider${zg.compute.providerCount !== 1 ? "s" : ""}`
                : "AI inference"}
              href="https://compute-marketplace.0g.ai"
            />
            <StatusRow
              icon={<Grid className="h-3.5 w-3.5" />}
              label="0G KV Store"
              ok={zg?.kv?.reachable ?? false}
              sub={zg?.kv?.mock ? "mock index" : "trade index"}
            />
            <StatusRow
              icon={<Bot className="h-3.5 w-3.5" />}
              label="Agentic ID"
              ok={zg?.agenticId?.alive ?? false}
              sub={zg?.agenticId?.alive
                ? `Token #${zg.agenticId.tokenId}`
                : "ERC-7857"}
              href={zg?.agenticId?.explorer}
            />

            {/* Chain info */}
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>0G Galileo Chain ID</span>
                <span className="font-mono text-zinc-400">16602</span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
                <span>Arbitrum Sepolia</span>
                <span className={`font-medium ${data?.rpcConnected ? "text-green-400" : "text-red-400"}`}>
                  {data?.rpcConnected ? `Block #${data.blockNumber?.toLocaleString()}` : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatusRow({
  icon, label, ok, sub, href,
}: {
  icon:  React.ReactNode;
  label: string;
  ok:    boolean;
  sub:   string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2 hover:bg-zinc-800/50 transition-colors">
      <span className={ok ? "text-blue-400" : "text-zinc-600"}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`h-2 w-2 rounded-full ${ok ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-zinc-600"}`} />
        {href && <ExternalLink className="h-3 w-3 text-zinc-600" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} explorer`}>
        {inner}
      </a>
    );
  }
  return inner;
}
