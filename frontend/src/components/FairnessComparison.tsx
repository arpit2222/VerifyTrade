"use client";

import { Shield, AlertTriangle, TrendingDown, ArrowRight } from "lucide-react";
import type { TradeExecuteResponse } from "@/lib/types";

interface FairnessComparisonProps {
  result:   TradeExecuteResponse;
  tokenIn:  string;
  tokenOut: string;
  inputAmount: string;
}

export function FairnessComparison({ result, tokenIn, tokenOut, inputAmount }: FairnessComparisonProps) {
  const cf = result.counterfactual;
  if (!cf) return null;

  const actualPct      = result.slippage;
  const withoutPct     = cf.estimatedSlippage;
  const savingsPct     = cf.savingsPercent;
  const mevImpact      = cf.mevImpact;

  // Derive approximate token amounts for display
  const inputNum = Number(inputAmount) / 1e6;
  const worstOutput  = inputNum * (1 - withoutPct / 100);
  const actualOutput = inputNum * (1 - actualPct  / 100);
  const savedTokens  = actualOutput - worstOutput;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" aria-hidden />
          TEE Protection Impact
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Counterfactual analysis — what would have happened without VerifyTrade
        </p>
      </div>

      {/* Split screen */}
      <div className="grid grid-cols-2 divide-x divide-zinc-800">
        {/* Left: Without VerifyTrade */}
        <div className="p-4 bg-red-950/20">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" aria-hidden />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Without VerifyTrade
            </span>
          </div>

          <div className="space-y-2.5">
            <SlipRow
              label="Est. slippage"
              value={`${withoutPct.toFixed(3)}%`}
              bad
            />
            <SlipRow
              label="MEV exposure"
              value={`+${mevImpact.toFixed(3)}%`}
              bad
            />
            <SlipRow
              label={`Est. ${tokenIn} output`}
              value={`≈ ${worstOutput.toFixed(2)}`}
              bad
            />
            <div className="pt-1.5 border-t border-red-900/40">
              <div className="flex items-center gap-1 text-xs text-red-300">
                <TrendingDown className="h-3 w-3" aria-hidden />
                Public mempool — sandwich risk
              </div>
            </div>
          </div>
        </div>

        {/* Right: With VerifyTrade */}
        <div className="p-4 bg-green-950/20">
          <div className="flex items-center gap-1.5 mb-3">
            <Shield className="h-3.5 w-3.5 text-green-400" aria-hidden />
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
              With VerifyTrade
            </span>
          </div>

          <div className="space-y-2.5">
            <SlipRow
              label="Actual slippage"
              value={`${actualPct.toFixed(3)}%`}
              good
            />
            <SlipRow
              label="MEV blocked"
              value="0.000%"
              good
            />
            <SlipRow
              label={`Actual ${tokenIn} output`}
              value={`≈ ${actualOutput.toFixed(2)}`}
              good
            />
            <div className="pt-1.5 border-t border-green-900/40">
              <div className="flex items-center gap-1 text-xs text-green-300">
                <Shield className="h-3 w-3" aria-hidden />
                TEE encrypted — zero front-running
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Savings banner */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-blue-950/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" aria-hidden />
          <span className="text-xs text-zinc-400">
            You saved <strong className="text-blue-300">≈ {savedTokens.toFixed(4)} {tokenIn}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-400 font-semibold">
          <ArrowRight className="h-3 w-3" aria-hidden />
          {savingsPct.toFixed(1)}% better execution
        </div>
      </div>
    </div>
  );
}

function SlipRow({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?:  boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span
        className={`text-xs font-mono font-semibold ${
          good ? "text-green-300" : bad ? "text-red-300" : "text-zinc-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
