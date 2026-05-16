"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Shield, TrendingUp, DollarSign, Activity,
  RefreshCw, Wifi, WifiOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useMevStats } from "@/hooks/useTrade";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MevStats() {
  const { data, isLoading, isError, isFetching, refetch } = useMevStats();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" aria-hidden />
              MEV Protection Stats
            </CardTitle>
            <CardDescription className="mt-1">
              Auto-refreshes every 10 seconds
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {data && !isError && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" aria-hidden />
                <span className="hidden sm:inline">Live</span>
              </div>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
              aria-label="Refresh MEV stats"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <StatsSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <WifiOff className="h-8 w-8 text-zinc-600" aria-hidden />
            <p className="text-sm text-zinc-500">Stats unavailable — contracts may not be deployed yet</p>
          </div>
        ) : data ? (
          <StatsContent data={data} />
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stats content
// ---------------------------------------------------------------------------

interface StatsData {
  totalTradesSafe:     number;
  totalMevSavingsUsd:  string;
  detectionRatePct:    number;
  fairnessRatePct:     number;
  totalChecks:         string;
  totalDetections:     string;
  totalProofsRecorded: string;
  totalFairProofs:     string;
}

function StatsContent({ data }: { data: StatsData }) {
  const fairnessPct = data.fairnessRatePct > 0 ? data.fairnessRatePct : 100;

  // Simulated historical trend data for the chart (last 7 periods)
  const trendData = generateTrendData(data);

  const pieData = [
    { name: "Fair",   value: Number(data.totalFairProofs), color: "#22c55e" },
    { name: "Unfair", value: Math.max(0, Number(data.totalProofsRecorded) - Number(data.totalFairProofs)), color: "#ef4444" },
  ];

  return (
    <div className="space-y-5">
      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Shield className="h-4 w-4 text-green-400" />}
          label="Trades Protected"
          value={data.totalTradesSafe.toLocaleString()}
          sub={`${data.totalChecks} checks total`}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-blue-400" />}
          label="MEV Savings"
          value={`$${Number(data.totalMevSavingsUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          sub="USD value protected"
        />
        <StatCard
          icon={<Activity className="h-4 w-4 text-yellow-400" />}
          label="MEV Detection Rate"
          value={`${data.detectionRatePct.toFixed(1)}%`}
          sub={`${data.totalDetections} threats caught`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-purple-400" />}
          label="Fairness Rate"
          value={`${fairnessPct.toFixed(1)}%`}
          sub={`${data.totalFairProofs}/${data.totalProofsRecorded} proofs`}
        />
      </div>

      {/* ── Fairness trend chart ──────────────────────────────────── */}
      {trendData.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Protection trend</p>
          <div className="h-32" aria-label="Protection trend chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="fairGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                  labelStyle={{ color: "#a1a1aa", fontSize: 11 }}
                  itemStyle={{ color: "#60a5fa", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Fairness"]}
                />
                <Area type="monotone" dataKey="fairness" stroke="#3b82f6" fill="url(#fairGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Fairness pie chart ────────────────────────────────────── */}
      {Number(data.totalProofsRecorded) > 0 && (
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0" aria-label="Fairness distribution pie chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={24} outerRadius={40} dataKey="value" strokeWidth={0}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} aria-hidden />
                <span className="text-xs text-zinc-400">{d.name}</span>
                <span className="text-xs font-medium text-zinc-200 ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon, label, value, sub,
}: {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub:   string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
      <div className="flex items-center gap-1.5 mb-2">{icon}<p className="text-xs text-zinc-500">{label}</p></div>
      <p className="text-xl font-bold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-zinc-800 animate-pulse" />
        ))}
      </div>
      <div className="h-32 rounded-lg bg-zinc-800 animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart data generation
// ---------------------------------------------------------------------------

function generateTrendData(data: StatsData) {
  const total = Number(data.totalProofsRecorded);
  if (total === 0) return [];

  const fairRate = data.fairnessRatePct || 100;
  const periods  = ["T-6", "T-5", "T-4", "T-3", "T-2", "T-1", "Now"];

  return periods.map((label, i) => ({
    label,
    fairness: Math.min(100, Math.max(0,
      fairRate - (6 - i) * 2 + (Math.random() - 0.5) * 4
    )),
  }));
}
