"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[GlobalError]", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20 border border-red-800/40 mb-6">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Something went wrong</h1>
      <p className="text-sm text-zinc-500 max-w-md mb-2">
        An unexpected error occurred. Your funds and trades are safe — this is a UI error only.
      </p>
      {error.digest && (
        <p className="text-xs text-zinc-600 font-mono mb-6">Error ID: {error.digest}</p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button variant="primary" onClick={reset} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/trade" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Trade
          </Link>
        </Button>
      </div>
    </div>
  );
}
