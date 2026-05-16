"use client";

export default function TradePage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">VerifyTrade</h1>
          <p className="text-muted-foreground mt-2">
            Fair DeFi execution with cryptographic proofs
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Place Order</h2>
          <p className="text-sm text-muted-foreground">
            Trade form coming soon — connect your wallet to get started.
          </p>
        </div>
      </div>
    </main>
  );
}
