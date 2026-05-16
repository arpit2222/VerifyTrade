"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Shield, ArrowLeft, Share2, Check, Link2,
  Database, Cpu, Bot, ChevronRight,
} from "lucide-react";
import { Header }      from "@/components/Header";
import { TradeStatus } from "@/components/TradeStatus";
import { Button }      from "@/components/ui/Button";
import { Input }       from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AGENTIC_ID_CONTRACT, VERIFYTRADE_AGENT_TOKEN_ID } from "@/lib/0g-agentic-id";

// ---------------------------------------------------------------------------
// Inner page (needs Suspense for useSearchParams)
// ---------------------------------------------------------------------------

function VerifyInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [inputId, setInputId] = useState(searchParams.get("id") ?? "");
  const [tradeId, setTradeId] = useState<string | null>(searchParams.get("id") ?? null);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  // Sync URL param → state on first render
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && !tradeId) { setInputId(id); setTradeId(id); }
  }, [searchParams, tradeId]);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const id = inputId.trim();
    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      setError("Enter a valid trade ID (positive integer)");
      return;
    }
    setError("");
    setTradeId(id);
    // Update URL so this page is shareable
    router.replace(`/verify?id=${id}`, { scroll: false });
  }

  const copyShareUrl = useCallback(() => {
    if (!tradeId) return;
    const url = `${window.location.origin}/verify?id=${tradeId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [tradeId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-8 space-y-6">

        <div>
          <Link
            href="/trade"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trade
          </Link>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-400" aria-hidden />
              Verify Proof
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Verify any trade&apos;s fairness proof on-chain. Share the URL for public auditability.
            </p>
          </div>
          {tradeId && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareUrl}
              leftIcon={copied
                ? <Check   className="h-3.5 w-3.5 text-green-400" />
                : <Share2  className="h-3.5 w-3.5" />}
            >
              {copied ? "Copied!" : "Share"}
            </Button>
          )}
        </div>

        {/* Search form */}
        <Card>
          <CardHeader>
            <CardTitle>Look up Trade</CardTitle>
            <CardDescription>
              Trade IDs are shown after order submission. The URL is shareable.
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
              <Button type="submit" variant="primary" leftIcon={<Search className="h-4 w-4" />} className="shrink-0 mt-0.5">
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trust chain explanation (static) */}
        {!tradeId && <TrustChainExplainer />}

        {/* Trade result */}
        {tradeId && (
          <>
            <TradeStatus tradeId={tradeId} />
            <TrustChainLinks tradeId={tradeId} />
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trust chain explainer (shown before search)
// ---------------------------------------------------------------------------

function TrustChainExplainer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">How VerifyTrade Works</CardTitle>
        <CardDescription className="text-xs">Every trade leaves a cryptographic trail across 3 layers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {[
            {
              icon:  <Database className="h-4 w-4 text-blue-400" />,
              step:  "1. 0G Storage",
              desc:  "Encrypted order committed to 0G Galileo testnet — immutable, content-addressed by keccak256 root hash",
            },
            {
              icon:  <Cpu className="h-4 w-4 text-purple-400" />,
              step:  "2. 0G Compute TEE",
              desc:  "AI model inside a Trusted Execution Environment verifies fairness and produces a signed attestation",
            },
            {
              icon:  <Shield className="h-4 w-4 text-green-400" />,
              step:  "3. On-chain Proof",
              desc:  "Attestation hash + slippage verdict recorded on Arbitrum Sepolia via FairnessProof contract",
            },
            {
              icon:  <Bot className="h-4 w-4 text-orange-400" />,
              step:  "4. Agentic ID",
              desc:  `ERC-7857 Token #${VERIFYTRADE_AGENT_TOKEN_ID} signs each attestation — provable on-chain agent identity on 0G Galileo`,
            },
          ].map((item, i, arr) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                {i < arr.length - 1 && <div className="w-px flex-1 my-1 bg-zinc-800" />}
              </div>
              <div className={`pb-4 ${i === arr.length - 1 ? "" : ""}`}>
                <p className="text-sm font-semibold text-zinc-200">{item.step}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Trust chain links (shown after a trade is loaded)
// ---------------------------------------------------------------------------

function TrustChainLinks({ tradeId }: { tradeId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-400" />
          Trust Chain
        </CardTitle>
        <CardDescription className="text-xs">External verification links for Trade #{tradeId}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <ExternalChainLink
            icon={<Database className="h-3.5 w-3.5 text-blue-400" />}
            label="0G Storage Explorer"
            sublabel="View encrypted order on Galileo testnet"
            href="https://storagescan-galileo.0g.ai"
          />
          <ExternalChainLink
            icon={<Bot className="h-3.5 w-3.5 text-purple-400" />}
            label="0G Agentic ID Contract"
            sublabel={`ERC-7857 Token #${VERIFYTRADE_AGENT_TOKEN_ID} · ${AGENTIC_ID_CONTRACT.slice(0,10)}…`}
            href={`https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`}
          />
          <ExternalChainLink
            icon={<Shield className="h-3.5 w-3.5 text-green-400" />}
            label="Arbiscan — Fairness Proof TX"
            sublabel="Attestation recorded on Arbitrum Sepolia"
            href="https://sepolia.arbiscan.io"
          />
          <ExternalChainLink
            icon={<Cpu className="h-3.5 w-3.5 text-yellow-400" />}
            label="0G Compute Marketplace"
            sublabel="AI inference providers used for TEE verification"
            href="https://compute-marketplace.0g.ai"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ExternalChainLink({ icon, label, sublabel, href }: {
  icon:     React.ReactNode;
  label:    string;
  sublabel: string;
  href:     string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2.5 hover:bg-zinc-800/60 hover:border-zinc-700 transition-colors group"
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500 truncate">{sublabel}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Export (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <VerifyInner />
    </Suspense>
  );
}
