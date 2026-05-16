"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot, CheckCircle, ExternalLink, Shield,
  Zap, Eye, Lock, Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

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
  "trade-execution":        <Zap       className="h-3 w-3" />,
  "mev-protection":         <Shield    className="h-3 w-3" />,
  "fairness-verification":  <Eye       className="h-3 w-3" />,
  "tee-attestation":        <Lock      className="h-3 w-3" />,
  "0g-compute-inference":   <Cpu       className="h-3 w-3" />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentCard() {
  const { data, isLoading } = useAgentInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-purple-400" />
          Agentic Executor
        </CardTitle>
        <CardDescription className="text-xs">ERC-7857 on-chain AI agent</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Token badge */}
            <div className="flex items-center gap-2 rounded-lg border border-purple-900/60 bg-purple-950/20 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-purple-900/60 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-purple-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{data.agentName}</p>
                <p className="text-xs text-zinc-500">
                  {data.name} ({data.symbol}) · Token #{data.tokenId}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <div className={`h-2 w-2 rounded-full ${data.alive ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-red-400"}`} />
                <span className={`text-xs ${data.alive ? "text-green-400" : "text-red-400"}`}>
                  {data.alive ? "Active" : "Offline"}
                </span>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <MetaItem label="Standard" value={data.standard} />
              <MetaItem label="Network"  value="0G Galileo" />
              <MetaItem label="Supply"   value={`${data.totalSupply} minted`} />
              <MetaItem label="Owner"    value={`${data.owner.slice(0, 6)}…${data.owner.slice(-4)}`} mono />
            </div>

            {/* Capabilities */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Capabilities</p>
              <div className="flex flex-wrap gap-1.5">
                {data.capabilities.map(cap => (
                  <span
                    key={cap}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300"
                  >
                    {CAPABILITY_ICONS[cap] ?? <CheckCircle className="h-3 w-3" />}
                    {cap.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            {/* Explorer link */}
            <a
              href={data.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View on 0G ChainScan
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Bot className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-500">Agent info unavailable</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-800/30 px-2 py-1.5">
      <p className="text-zinc-600">{label}</p>
      <p className={`text-zinc-300 font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
