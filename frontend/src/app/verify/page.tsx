"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Shield, ExternalLink, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { TradeStatus } from "@/components/TradeStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export default function VerifyPage() {
  const [inputId, setInputId]   = useState("");
  const [tradeId, setTradeId]   = useState<string | null>(null);
  const [error,   setError]     = useState("");

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = inputId.trim();
    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      setError("Enter a valid trade ID (positive integer)");
      return;
    }
    setError("");
    setTradeId(id);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 space-y-6">

        <div className="mb-2">
          <Link
            href="/trade"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trade
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" aria-hidden />
            Verify Proof
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enter a trade ID to inspect its on-chain fairness proof and attestation.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Look up Trade</CardTitle>
            <CardDescription>
              Trade IDs are shown after order submission
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="flex gap-2" noValidate>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="e.g. 42"
                  value={inputId}
                  onChange={e => { setInputId(e.target.value); setError(""); }}
                  min="1"
                  step="1"
                  error={error}
                  aria-label="Trade ID"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Search className="h-4 w-4" />}
                className="shrink-0 mt-0.5"
              >
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>

        {tradeId && (
          <TradeStatus tradeId={tradeId} />
        )}
      </main>
    </div>
  );
}
