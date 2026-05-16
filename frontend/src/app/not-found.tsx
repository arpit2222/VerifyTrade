"use client";

import Link from "next/link";
import { Shield, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-800/40 mb-6">
        <Shield className="h-8 w-8 text-blue-400" />
      </div>

      <h1 className="text-6xl font-bold text-zinc-100 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-zinc-300 mb-3">Page not found</h2>
      <p className="text-sm text-zinc-500 max-w-md mb-8">
        This page doesn&apos;t exist or has been moved. If you were looking for a trade proof,
        use the Verify page with your trade ID.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button variant="primary" asChild>
          <Link href="/trade" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Trade
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/verify" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Verify a Proof
          </Link>
        </Button>
      </div>
    </div>
  );
}
