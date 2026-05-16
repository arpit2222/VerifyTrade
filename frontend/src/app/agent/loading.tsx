export default function AgentLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="h-16 border-b border-zinc-800 animate-pulse bg-zinc-900/50" />
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-zinc-800 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-64 rounded bg-zinc-800 animate-pulse" />
            <div className="h-4 w-48 rounded bg-zinc-800 animate-pulse" />
          </div>
        </div>
        {[0,1,2].map(i => <div key={i} className="h-48 rounded-xl bg-zinc-800 animate-pulse" />)}
      </div>
    </div>
  );
}
