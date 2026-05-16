"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TradeExecuteResponse } from "@/lib/types";
import type { TradeDetail } from "@/lib/api-client";

interface CompliancePDFProps {
  result:  TradeExecuteResponse;
  trade?:  TradeDetail;
  tokenIn: string;
  tokenOut: string;
}

export function CompliancePDF({ result, trade, tokenIn, tokenOut }: CompliancePDFProps) {
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      // Lazy-load jsPDF to avoid SSR issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsPDFModule = await import("jspdf") as any;
      const JsPDF = jsPDFModule.jsPDF ?? jsPDFModule.default;
      const doc = new JsPDF({ unit: "mm", format: "a4" });

      const now      = new Date();
      const dateStr  = now.toISOString().split("T")[0] ?? now.toDateString();
      const timeStr  = now.toUTCString();
      const isFair   = result.proof === "fairness_verified";
      const cf       = result.counterfactual;

      // ── Fonts / colors ────────────────────────────────────────────────
      const BLUE  = [37, 99, 235]  as [number, number, number];
      const GREEN = [22, 163, 74]  as [number, number, number];
      const RED   = [220, 38, 38]  as [number, number, number];
      const GRAY  = [82, 82, 82]   as [number, number, number];
      const BLACK = [24, 24, 27]   as [number, number, number];

      // ── Header ────────────────────────────────────────────────────────
      doc.setFillColor(...BLUE);
      doc.rect(0, 0, 210, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("VerifyTrade", 14, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Cryptographic Trade Execution Report", 14, 19);
      doc.text(`Generated: ${timeStr}`, 14, 24);

      // ── Trade ID badge ────────────────────────────────────────────────
      doc.setFillColor(255, 255, 255);
      doc.setTextColor(...BLACK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Trade #${result.tradeId}`, 160, 16, { align: "right" });

      // ── Verdict banner ────────────────────────────────────────────────
      const verdictColor = isFair ? GREEN : RED;
      doc.setFillColor(...verdictColor);
      doc.rect(0, 28, 210, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(
        isFair ? "✓  FAIRNESS VERIFIED — EXECUTION COMPLIANT" : "✗  FAIRNESS CHECK FAILED",
        105, 37, { align: "center" }
      );

      // ── Section helper ────────────────────────────────────────────────
      let y = 52;
      function section(title: string) {
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 4, 182, 7, "F");
        doc.setTextColor(...BLUE);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 16, y + 0.5);
        y += 8;
      }

      function row(label: string, value: string, valueColor?: [number, number, number]) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(label, 16, y);
        doc.setTextColor(...(valueColor ?? BLACK));
        doc.setFont("helvetica", "bold");
        doc.text(value, 100, y);
        y += 5.5;
      }

      // ── Trade Details ─────────────────────────────────────────────────
      section("Trade Details");
      row("Trade ID",      `#${result.tradeId}`);
      row("Token Pair",    `${tokenIn} → ${tokenOut}`);
      row("Date",          dateStr);
      row("Status",        isFair ? "Compliant" : "Non-compliant", isFair ? GREEN : RED);
      y += 2;

      // ── Execution Metrics ─────────────────────────────────────────────
      section("Execution Metrics");
      row("Output Amount",        result.outputAmount + " " + tokenOut);
      row("Actual Slippage",      `${result.slippage.toFixed(4)}%`);
      if (trade?.maxSlippagePercent != null) {
        row("Max Allowed Slippage", `${trade.maxSlippagePercent.toFixed(4)}%`);
      }
      row("Proof ID",             `#${result.proofId}`);
      row("Fairness Result",      isFair ? "Within limit" : "Exceeded limit", isFair ? GREEN : RED);
      y += 2;

      // ── Counterfactual Analysis ───────────────────────────────────────
      if (cf) {
        section("Counterfactual Analysis (TEE Protection Impact)");
        row("Est. slippage without TEE",  `${cf.estimatedSlippage.toFixed(4)}%`, RED);
        row("Actual slippage with TEE",   `${result.slippage.toFixed(4)}%`,      GREEN);
        row("MEV impact prevented",       `${cf.mevImpact.toFixed(4)}%`);
        row("Execution quality improved", `${cf.savingsPercent.toFixed(1)}%`);
        y += 2;
      }

      // ── Cryptographic Proof ───────────────────────────────────────────
      section("Cryptographic Attestation");
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Attestation Hash:", 16, y);
      y += 4;
      doc.setTextColor(...BLACK);
      doc.setFont("courier", "normal");
      doc.setFontSize(6.5);
      // Wrap long hash
      const hashLines = doc.splitTextToSize(result.attestation, 178);
      doc.text(hashLines, 16, y);
      y += hashLines.length * 4 + 2;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      row("On-chain TX",      result.txHash.slice(0, 42) + "...");
      y += 2;

      // ── 0G Storage provenance ─────────────────────────────────────────
      const teeMeasurement = trade?.proof?.teeMeasurement;
      if (teeMeasurement) {
        section("0G Compute TEE Measurement");
        doc.setTextColor(...GRAY);
        doc.setFontSize(7);
        doc.setFont("courier", "normal");
        const measLines = doc.splitTextToSize(teeMeasurement, 178);
        doc.text(measLines, 16, y);
        y += measLines.length * 4 + 4;
      }

      // ── Footer ────────────────────────────────────────────────────────
      doc.setFillColor(...BLUE);
      doc.rect(0, 282, 210, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("VerifyTrade — Fair DeFi Execution Platform", 14, 289);
      doc.text("Powered by 0G Storage + 0G Compute + Arbitrum", 14, 293);
      doc.text("This document contains cryptographic proof of fair execution.", 196, 289, { align: "right" });
      doc.text(`Generated at block height — ${dateStr}`, 196, 293, { align: "right" });

      doc.save(`verifytrade-compliance-trade${result.tradeId}-${dateStr}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generate}
      loading={generating}
      leftIcon={<FileDown className="h-3.5 w-3.5" />}
      aria-label="Download compliance PDF"
    >
      {generating ? "Generating…" : "Compliance PDF"}
    </Button>
  );
}
