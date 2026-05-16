"use client";

import { useState } from "react";
import { Header }      from "@/components/Header";
import { TradeForm }   from "@/components/TradeForm";
import { TradeExecution } from "@/components/TradeExecution";
import { MevStats }    from "@/components/MevStats";
import { LivePrices }  from "@/components/LivePrices";

interface PendingTrade {
  tradeId:     string;
  orderCID:    string;
  txHash:      string;
  tokenIn:     string;
  tokenOut:    string;
  inputAmount: string;
}

export default function TradePage() {
  const [pending, setPending] = useState<PendingTrade | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 py-10 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
          Fair DeFi Trading
        </h1>
        <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-zinc-400 leading-relaxed">
          Orders are AES-256 encrypted, stored on{" "}
          <span className="text-blue-400 font-medium">0G Storage</span>, and
          executed inside a{" "}
          <span className="text-blue-400 font-medium">
            Trusted Execution Environment
          </span>{" "}
          — with cryptographic fairness proofs on Arbitrum.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
          {[
            "AES-256 Encrypted",
            "0G Storage",
            "TEE Execution",
            "MEV Protected",
            "On-Chain Proofs",
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left column — trade form + execution */}
          <div className="lg:col-span-2 space-y-6">
            <TradeForm onSubmitSuccess={setPending} />

            {pending && (
              <TradeExecution
                tradeId={pending.tradeId}
                orderCID={pending.orderCID}
                tokenIn={pending.tokenIn}
                tokenOut={pending.tokenOut}
                inputAmount={pending.inputAmount}
              />
            )}
          </div>

          {/* Right column — live prices, MEV stats + how it works */}
          <div className="space-y-6">
            <LivePrices />
            <MevStats />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <p className="text-sm font-semibold text-zinc-300">How it works</p>
              {[
                {
                  step: "1",
                  title: "Encrypt & Store",
                  desc: "Your order is AES-256 encrypted and uploaded to 0G Storage.",
                },
                {
                  step: "2",
                  title: "TEE Execution",
                  desc: "A 0G Compute node executes your order inside a secure enclave.",
                },
                {
                  step: "3",
                  title: "Fairness Proof",
                  desc: "A cryptographic attestation is recorded on Arbitrum.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {step}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
