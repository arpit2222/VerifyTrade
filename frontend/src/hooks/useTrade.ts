"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  submitTrade,
  executeTrade,
  getTrade,
  getMevStats,
} from "@/lib/api-client";
import type {
  TradeSubmitRequest,
  TradeExecuteRequest,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Query keys — centralised to enable targeted cache invalidation
// ---------------------------------------------------------------------------
export const queryKeys = {
  trade:    (id: string)  => ["trade",    id]   as const,
  mevStats: ()            => ["mevStats"]       as const,
  health:   ()            => ["health"]          as const,
} as const;

// ---------------------------------------------------------------------------
// useSubmitTrade
// ---------------------------------------------------------------------------

/**
 * Mutation hook for submitting a new trade.
 *
 * Usage:
 *   const { mutate, isPending, isSuccess, data, error } = useSubmitTrade();
 *   mutate({ inputAmount: "1000000", tokenIn: "USDC", tokenOut: "ETH", maxSlippage: 0.5 });
 */
export function useSubmitTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TradeSubmitRequest) => submitTrade(data),
    onSuccess: (result) => {
      // Pre-populate the trade cache so the detail page loads instantly
      queryClient.invalidateQueries({ queryKey: queryKeys.mevStats() });
      if (process.env.NODE_ENV !== "production") {
        console.log("[useSubmitTrade] success — tradeId:", result.tradeId);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useExecuteTrade
// ---------------------------------------------------------------------------

/**
 * Mutation hook for executing a submitted trade in the TEE.
 *
 * Usage:
 *   const { mutate, isPending, data, error } = useExecuteTrade();
 *   mutate({ tradeId: "1", orderCID: "Qm..." });
 */
export function useExecuteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TradeExecuteRequest) => executeTrade(data),
    onSuccess: (result) => {
      // Invalidate the specific trade so TradeStatus re-fetches
      queryClient.invalidateQueries({ queryKey: queryKeys.trade(result.tradeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mevStats() });
    },
  });
}

// ---------------------------------------------------------------------------
// useGetTrade
// ---------------------------------------------------------------------------

/**
 * Query hook for fetching full trade details.
 * Auto-refetches every 15s while trade is pending/committed.
 *
 * Usage:
 *   const { data, isLoading, error } = useGetTrade("1");
 */
export function useGetTrade(tradeId: string | null | undefined) {
  return useQuery({
    queryKey:    queryKeys.trade(tradeId ?? ""),
    queryFn:     () => getTrade(tradeId!),
    enabled:     !!tradeId,
    // Refetch while the trade is still pending
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 15_000;
      return data.status === "executed" ? false : 10_000;
    },
    staleTime: 5_000,
    retry:     2,
  });
}

// ---------------------------------------------------------------------------
// useMevStats
// ---------------------------------------------------------------------------

/**
 * Query hook for global MEV statistics.
 * Auto-refreshes every 10 seconds.
 *
 * Usage:
 *   const { data, isLoading } = useMevStats();
 */
export function useMevStats() {
  return useQuery({
    queryKey:        queryKeys.mevStats(),
    queryFn:         getMevStats,
    refetchInterval: 10_000,
    staleTime:       8_000,
    retry:           1,
  });
}

// ---------------------------------------------------------------------------
// Formatting helpers exported alongside hooks for co-location
// ---------------------------------------------------------------------------

export function formatTokenAmount(
  raw:      string,
  decimals: number = 6,
  symbol:   string = ""
): string {
  if (!raw || raw === "0") return symbol ? `0 ${symbol}` : "0";
  const n = Number(BigInt(raw)) / 10 ** decimals;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatSlippage(bps: string | number): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

export function formatUsd(usd6: string): string {
  const cents = Number(usd6);
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
  }).format(cents / 1_000_000);
}
