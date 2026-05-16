"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bot, ArrowLeft, ExternalLink, Shield, Zap,
  Lock, Eye, Cpu, CheckCircle, Copy, Check,
  Network, Activity,
} from "lucide-react";
import { useState } from "react";
import { Header }     from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AGENTIC_ID_CONTRACT, VERIFYTRADE_AGENT_TOKEN_ID, VERIFYTRADE_AGENT_OWNER } from "@/lib/0g-agentic-id";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface AgentData {
  tokenId:      number;
  owner:        string;
  agentName:    string;
  name:         string;
  symbol:       string;
  totalSupply:  number;
  capabilities: string[];
  network:      string;
  agentId:      string;
  alive:        boolean;
  standard:     string;
  mintedAt:     string;
  explorer:     string;
}

function useAgentInfo() {
  return useQuery<AgentData>({
    queryKey:  ["agent"],
    queryFn:   () => fetch("/api/agent").then(r => r.json()).then(j => j.data),
    staleTime: 5 * 60_000,
    retry:     1,
  });
}

const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  "trade-execution":        <Zap       className="h-4 w-4" />,
  "mev-protection":         <Shield    className="h-4 w-4" />,
  "fairness-verification":  <Eye       className="h-4 w-4" />,
  "tee-attestation":        <Lock      className="h-4 w-4" />,
  "0g-compute-inference":   <Cpu       className="h-4 w-4" />,
};

const CAPABILITY_DESC: Record<string, string> = {
  "trade-execution":        "Executes trades on behalf of authorized traders inside a TEE enclave",
  "mev-protection":         "Detects and blocks sandwich attacks via commit-reveal + private mempool routing",
  "fairness-verification":  "AI model validates slippage is within user-specified tolerance before settlement",
  "tee-attestation":        "Produces cryptographically signed fairness attestations stored on 0G Storage",
  "0g-compute-inference":   "Uses 0G Compute network for verifiable AI inference with live price oracle",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentPage() {
  const { data, isLoading } = useAgentInfo();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 space-y-6">

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-purple-900/60 border border-purple-800/60 flex items-center justify-center shrink-0">
            <Bot className="h-7 w-7 text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">VerifyTrade Executor Agent</h1>
            <p className="text-sm text-zinc-400 mt-1">
              ERC-7857 on-chain AI agent · 0G Galileo Testnet · Token #{Number(VERIFYTRADE_AGENT_TOKEN_ID)}
            </p>
          </div>
          {data && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${data.alive ? "bg-green-400 shadow-[0_0_8px_#4ade80]" : "bg-red-400"}`} />
              <span className={`text-sm font-medium ${data.alive ? "text-green-400" : "text-red-400"}`}>
                {data.alive ? "Active" : "Offline"}
              </span>
            </div>
          )}
        </div>

        {/* Overview card */}
        {isLoading ? (
          <div className="h-48 rounded-xl bg-zinc-800 animate-pulse" />
        ) : data ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-4 w-4 text-blue-400" />
                On-chain Identity
              </CardTitle>
              <CardDescription>Verified on 0G Galileo Testnet (Chain ID 16602)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoTile label="Standard"     value={data.standard} />
                <InfoTile label="Token ID"     value={`#${data.tokenId}`} />
                <InfoTile label="Symbol"       value={data.symbol} />
                <InfoTile label="Total Supply" value={`${data.totalSupply} minted`} />
                <InfoTile label="Agent ID"     value={data.agentId} mono truncate />
                <InfoTile label="Owner"        value={`${VERIFYTRADE_AGENT_OWNER.slice(0,6)}…${VERIFYTRADE_AGENT_OWNER.slice(-4)}`} mono />
              </div>

              <div className="mt-4 space-y-2">
                <ContractRow
                  label="Contract Address"
                  value={AGENTIC_ID_CONTRACT}
                  href={data.explorer}
                />
                <ContractRow
                  label="Mint Transaction"
                  value={data.mintedAt}
                  href={`https://chainscan-galileo.0g.ai/tx/${data.mintedAt}`}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Capabilities
            </CardTitle>
            <CardDescription>What this agent can do on behalf of authorized traders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(CAPABILITY_DESC).map(([cap, desc]) => (
                <div key={cap} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-purple-400">
                    {CAPABILITY_ICONS[cap] ?? <CheckCircle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      {cap.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Authorization model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-400" />
              Authorization Model
            </CardTitle>
            <CardDescription>How traders grant and revoke agent permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-zinc-400">
              <p>
                When you submit a trade, VerifyTrade calls{" "}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">
                  authorizeUsage(tokenId, traderAddress, limit)
                </code>{" "}
                on the ERC-7857 contract. This grants the agent up to{" "}
                <strong className="text-zinc-200">100 trade executions</strong> on your behalf.
              </p>
              <p>
                Authorization is scoped and revocable — you can call{" "}
                <code className="font-mono text-xs bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">
                  revokeAuthorization(tokenId, traderAddress)
                </code>{" "}
                at any time to remove the agent&apos;s access.
              </p>
              <p>
                The agent&apos;s identity is embedded in every attestation payload, so you can always
                audit which agent executed your trade.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Explorer links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-zinc-400" />
              External Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ExternalLink2
              label="0G ChainScan — Contract"
              href={`https://chainscan-galileo.0g.ai/address/${AGENTIC_ID_CONTRACT}`}
              desc="View the ERC-7857 Agentic ID contract on 0G Galileo explorer"
            />
            <ExternalLink2
              label="0G Compute Marketplace"
              href="https://compute-marketplace.0g.ai"
              desc="Browse AI inference providers used by this agent for fairness verification"
            />
            <ExternalLink2
              label="0G Storage Explorer"
              href="https://storagescan-galileo.0g.ai"
              desc="Browse encrypted trade orders stored by this agent on the 0G network"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoTile({ label, value, mono = false, truncate = false }: {
  label:     string;
  value:     string;
  mono?:     boolean;
  truncate?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-sm font-medium text-zinc-200 mt-0.5 ${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function ContractRow({ label, value, href }: { label: string; value: string; href: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="text-zinc-500 hover:text-zinc-300 transition-colors" aria-label="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <p className="font-mono text-xs text-zinc-300 break-all">{value}</p>
    </div>
  );
}

function ExternalLink2({ label, desc, href }: { label: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2.5 hover:bg-zinc-800/60 hover:border-zinc-700 transition-colors group"
    >
      <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-blue-400 shrink-0" />
      <div>
        <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500">{desc}</p>
      </div>
    </a>
  );
}
