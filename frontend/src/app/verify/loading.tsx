export default function VerifyLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="h-16 border-b border-zinc-800 animate-pulse bg-zinc-900/50" />
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="h-8 w-36 rounded bg-zinc-800 animate-pulse" />
        <div className="h-36 rounded-xl bg-zinc-800 animate-pulse" />
        <div className="h-64 rounded-xl bg-zinc-800 animate-pulse" />
      </div>
    </div>
  );
}
