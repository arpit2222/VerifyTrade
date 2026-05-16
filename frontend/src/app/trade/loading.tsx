export default function TradeLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="h-16 border-b border-zinc-800 bg-zinc-950/90 animate-pulse" />
      <div className="h-44 border-b border-zinc-800 bg-zinc-900/50 animate-pulse" />
      <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-800 animate-pulse" />
          <div className="h-96 rounded-xl bg-zinc-800 animate-pulse" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800 animate-pulse" />
      </div>
    </div>
  );
}
