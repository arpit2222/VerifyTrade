"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle, XCircle, Lock, Zap, ExternalLink,
  Copy, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { useExecuteTrade } from "@/hooks/useTrade";
import { getTxUrl } from "@/lib/wagmi-config";
import { truncateMiddle } from "@/lib/utils";
import { FairnessComparison } from "@/components/FairnessComparison";
import { CompliancePDF } from "@/components/CompliancePDF";
import type { TradeExecuteResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeExecutionProps {
  tradeId:     string;
  orderCID:    string;
  tokenIn:     string;
  tokenOut:    string;
  inputAmount: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeExecution({ tradeId, orderCID, tokenIn, tokenOut, inputAmount }: TradeExecutionProps) {
  const { toast }  = useToast();
  const execute    = useExecuteTrade();
  const [expanded, setExpanded] = useState(false);

  async function handleExecute() {
    try {
      await execute.mutateAsync({ tradeId, orderCID });
      toast.success("Trade executed!", `Proof verified. Trade #${tradeId} is complete.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      toast.error("Execution failed", msg);
    }
  }

  const result = execute.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-400" aria-hidden />
          Execute Trade #{tradeId}
        </CardTitle>
        <CardDescription>
          {result
            ? "Execution complete — fairness proof recorded on-chain"
            : "Run this trade inside a Trusted Execution Environment"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Order CID ─────────────────────────────────────────────── */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
          <p className="text-xs text-zinc-500 mb-1">0G Storage CID</p>
          <p className="font-mono text-xs text-zinc-300 break-all">{orderCID}</p>
        </div>

        {/* ── Execute button ────────────────────────────────────────── */}
        {!result && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleExecute}
            loading={execute.isPending}
            leftIcon={<Zap className="h-4 w-4" />}
          >
            {execute.isPending
              ? "Executing in secure enclave…"
              : "Execute Trade in TEE"}
          </Button>
        )}

        {execute.isPending && (
          <div className="space-y-2 rounded-lg border border-blue-900 bg-blue-950/40 p-4">
            <div className="flex items-center gap-2 text-sm text-blue-300">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" aria-hidden />
              Connecting to 0G Compute node…
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-400 opacity-80">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 delay-150" aria-hidden />
              Decrypting order inside TEE enclave…
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-400 opacity-60">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 delay-300" aria-hidden />
              Generating fairness attestation…
            </div>
          </div>
        )}

        {/* ── Result ───────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-4">
            <ExecutionResult result={result} tokenOut={tokenOut} tokenIn={tokenIn} />
            <FairnessComparison
              result={result}
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              inputAmount={inputAmount}
            />
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {execute.isError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/40 p-3">
            <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-red-300">
              {execute.error instanceof Error ? execute.error.message : "Execution failed"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Execution result display
// ---------------------------------------------------------------------------

function ExecutionResult({
  result,
  tokenOut,
  tokenIn,
}: {
  result:   TradeExecuteResponse;
  tokenOut: string;
  tokenIn?: string;
}) {
  const isFair = result.proof === "fairness_verified";

  return (
    <div className="space-y-3">
      {/* Fairness banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          isFair
            ? "border-green-800 bg-green-950/40"
            : "border-red-800 bg-red-950/40"
        }`}
        role="status"
        aria-label={isFair ? "Trade verified as fair" : "Trade execution not fair"}
      >
        {isFair
          ? <CheckCircle className="h-6 w-6 text-green-400 shrink-0" aria-hidden />
          : <XCircle     className="h-6 w-6 text-red-400   shrink-0" aria-hidden />
        }
        <div>
          <p className={`font-semibold text-sm ${isFair ? "text-green-300" : "text-red-300"}`}>
            {isFair ? "Fairness Verified ✓" : "Fairness Check Failed"}
          </p>
          <p className="text-xs text-zinc-400">
            Slippage: {result.slippage.toFixed(3)}% · Proof #{result.proofId}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Output Amount" value={`${Number(result.outputAmount).toLocaleString()} ${tokenOut}`} />
        <Metric label="Actual Slippage" value={`${result.slippage.toFixed(3)}%`} />
      </div>

      {/* Attestation */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-zinc-500">Attestation Hash</p>
          <CopyButton text={result.attestation} />
        </div>
        <p className="font-mono text-xs text-zinc-300 break-all">{result.attestation}</p>
      </div>

      {/* Links */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="flex-1"
        >
          <a
            href={getTxUrl(result.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View transaction on Arbiscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Arbiscan
          </a>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          asChild
          className="flex-1"
        >
          <Link href={`/trade/${result.tradeId}`} aria-label="View full trade details">
            View Trade Details
          </Link>
        </Button>

        <CompliancePDF
          result={result}
          tokenIn={tokenIn ?? "TOKEN"}
          tokenOut={tokenOut}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="text-zinc-500 hover:text-zinc-300 transition-colors"
      aria-label={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
