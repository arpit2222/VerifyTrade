"use client";

import Link from "next/link";
import {
  CheckCircle, XCircle, Clock, Shield, ExternalLink,
  AlertTriangle, RefreshCw, Copy, Check
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useGetTrade, formatSlippage } from "@/hooks/useTrade";
import { getTxUrl } from "@/lib/wagmi-config";
import { truncateMiddle, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeStatusProps {
  tradeId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeStatus({ tradeId }: TradeStatusProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetTrade(tradeId);

  if (isLoading) return <TradeStatusSkeleton />;

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden />
          <div>
            <p className="font-medium text-zinc-200">Failed to load trade</p>
            <p className="text-sm text-zinc-500 mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const statusConfig = getStatusConfig(data.status, data.isFair);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className={statusConfig.iconClass} aria-hidden>
              <statusConfig.Icon className="h-5 w-5" />
            </span>
            Trade #{data.tradeId}
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} isFair={data.isFair} />
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
              aria-label="Refresh trade status"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Core metrics ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <MetricRow label="Token In"     value={data.tokenIn} />
          <MetricRow label="Token Out"    value={data.tokenOut} />
          <MetricRow
            label="Input Amount"
            value={formatRawAmount(data.inputAmount, data.tokenIn)}
          />
          <MetricRow
            label="Output Amount"
            value={data.status === "executed" && data.outputAmount
              ? formatRawAmount(data.outputAmount, data.tokenOut)
              : "—"}
          />
          <MetricRow
            label="Max Slippage"
            value={`${data.maxSlippagePercent}%`}
          />
          <MetricRow
            label="Actual Slippage"
            value={data.status === "executed" ? `${data.slippagePercent.toFixed(3)}%` : "—"}
          />
          <MetricRow label="Submitted"  value={formatDate(data.timestamp)} />
          <MetricRow label="Trader"     value={truncateMiddle(data.trader, 6, 4)} mono />
        </div>

        {/* ── Fairness proof ───────────────────────────────────────── */}
        {data.proof.recorded && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400 shrink-0" aria-hidden />
              <p className="text-sm font-medium text-zinc-200">Fairness Proof</p>
              {data.proof.slippageWithinLimit !== undefined && (
                <span className={`ml-auto text-xs font-medium ${data.proof.slippageWithinLimit ? "text-green-400" : "text-red-400"}`}>
                  {data.proof.slippageWithinLimit ? "VERIFIED" : "FAILED"}
                </span>
              )}
            </div>
            {data.proof.proofId && (
              <p className="text-xs text-zinc-500">Proof ID: {data.proof.proofId}</p>
            )}
            {data.proof.teeMeasurement && (
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs text-zinc-400 truncate">{data.proof.teeMeasurement}</p>
                <CopyButton text={data.proof.teeMeasurement} />
              </div>
            )}
          </div>
        )}

        {/* ── Attestation hash ─────────────────────────────────────── */}
        {data.attestationHash && data.status === "executed" && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-zinc-500">Attestation Hash</p>
              <CopyButton text={data.attestationHash} />
            </div>
            <p className="font-mono text-xs text-zinc-300 break-all">{data.attestationHash}</p>
          </div>
        )}

        {/* ── MEV protection ───────────────────────────────────────── */}
        {data.mev.checked && (
          <div className={`rounded-lg border p-3 ${
            data.mev.detected
              ? "border-yellow-800 bg-yellow-950/30"
              : "border-green-900 bg-green-950/20"
          }`}>
            <div className="flex items-center gap-2 text-sm">
              {data.mev.detected
                ? <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" aria-hidden />
                : <CheckCircle   className="h-4 w-4 text-green-400  shrink-0" aria-hidden />
              }
              <span className={data.mev.detected ? "text-yellow-300" : "text-green-300"}>
                {data.mev.detected
                  ? `MEV detected — $${data.mev.savingsUsd ?? "0"} protected via ${data.mev.protectionMethod}`
                  : "No MEV detected — trade passed mempool screening"
                }
              </span>
            </div>
          </div>
        )}

        {/* ── Arbiscan link ────────────────────────────────────────── */}
        {data.attestationHash && data.status === "executed" && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a
              href={getTxUrl(data.attestationHash)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on Arbiscan"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on Arbiscan
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusConfig(status: string, isFair: boolean) {
  switch (status) {
    case "executed":
      return isFair
        ? { Icon: CheckCircle, iconClass: "text-green-400" }
        : { Icon: XCircle,     iconClass: "text-red-400"   };
    case "cancelled":
      return { Icon: XCircle,     iconClass: "text-red-400"    };
    case "failed":
      return { Icon: AlertTriangle, iconClass: "text-yellow-400" };
    default:
      return { Icon: Clock,       iconClass: "text-zinc-400"  };
  }
}

function StatusBadge({ status, isFair }: { status: string; isFair: boolean }) {
  let cls = "bg-zinc-800 text-zinc-400";
  let label = status.charAt(0).toUpperCase() + status.slice(1);

  if (status === "executed") {
    cls   = isFair ? "bg-green-900/60 text-green-400" : "bg-red-900/60 text-red-400";
    label = isFair ? "Executed — Fair" : "Executed — Unfair";
  } else if (status === "committed") {
    cls   = "bg-blue-900/60 text-blue-400";
  }

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`} aria-label={`Trade status: ${label}`}>
      {label}
    </span>
  );
}

function MetricRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-zinc-200 truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function formatRawAmount(raw: string, token: string): string {
  if (!raw || raw === "0") return `0 ${token}`;
  const stableTokens = ["USDC", "USDT", "DAI"];
  const decimals     = stableTokens.includes(token.toUpperCase()) ? 6 : 18;
  const n            = Number(BigInt(raw)) / 10 ** decimals;
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${token}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="text-zinc-500 hover:text-zinc-300 shrink-0" aria-label="Copy">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function TradeStatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 rounded bg-zinc-800 animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
