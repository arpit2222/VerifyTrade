"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, RefreshCw, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface PriceData {
  prices:    Record<string, number>;
  source:    string;
  fetchedAt: number;
  tokens:    string[];
}

function useLivePrices() {
  return useQuery<PriceData>({
    queryKey:        ["prices"],
    queryFn:         () => fetch("/api/prices").then(r => r.json()).then(j => j.data),
    refetchInterval: 60_000,
    staleTime:       55_000,
    retry:           1,
  });
}

const TOKEN_CONFIG: Record<string, { symbol: string; color: string; decimals: number }> = {
  ETH:  { symbol: "ETH",  color: "text-blue-400",   decimals: 0 },
  WBTC: { symbol: "WBTC", color: "text-orange-400",  decimals: 0 },
  ARB:  { symbol: "ARB",  color: "text-sky-400",     decimals: 2 },
  USDC: { symbol: "USDC", color: "text-green-400",   decimals: 2 },
  USDT: { symbol: "USDT", color: "text-emerald-400", decimals: 2 },
};

const DISPLAY_TOKENS = ["ETH", "WBTC", "ARB", "USDC", "USDT"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LivePrices() {
  const { data, isLoading, isFetching, refetch } = useLivePrices();

  const isLive = data?.source === "0g-compute";
  const age    = data ? Math.floor((Date.now() / 1000) - data.fetchedAt) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              Live Prices
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {isLive ? "via 0G Compute AI" : "fallback prices"}
              {age !== null && ` · ${age}s ago`}
            </CardDescription>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
            aria-label="Refresh prices"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {DISPLAY_TOKENS.map(token => {
              const price  = data?.prices?.[token];
              const config = TOKEN_CONFIG[token];
              if (!config) return null;
              return (
                <PriceRow
                  key={token}
                  token={config.symbol}
                  price={price ?? null}
                  color={config.color}
                  decimals={config.decimals}
                />
              );
            })}

            {isLive && (
              <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-1.5 text-xs text-zinc-500">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Prices fetched from 0G Compute inference network
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function PriceRow({
  token, price, color, decimals,
}: {
  token:    string;
  price:    number | null;
  color:    string;
  decimals: number;
}) {
  const formatted = price != null
    ? price.toLocaleString("en-US", {
        style:                 "currency",
        currency:              "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "—";

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color.replace("text-", "bg-")}`} />
        <span className="text-sm font-medium text-zinc-200">{token}</span>
      </div>
      <span className={`text-sm font-mono font-medium ${price != null ? color : "text-zinc-600"}`}>
        {formatted}
      </span>
    </div>
  );
}
