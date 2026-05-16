"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { TradeStatus } from "@/components/TradeStatus";

export default function TradeDetailPage() {
  const params  = useParams();
  const raw     = params.id;
  const tradeId = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/trade"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trade
          </Link>
        </div>

        <TradeStatus tradeId={tradeId} />
      </main>
    </div>
  );
}
