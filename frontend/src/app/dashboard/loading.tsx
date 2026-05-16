export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="h-16 border-b border-zinc-800 bg-zinc-950/90 animate-pulse" />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div className="h-8 w-40 rounded bg-zinc-800 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 rounded-xl bg-zinc-800 animate-pulse" />
          <div className="lg:col-span-2 h-64 rounded-xl bg-zinc-800 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0,1,2].map(i => <div key={i} className="h-56 rounded-xl bg-zinc-800 animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}
