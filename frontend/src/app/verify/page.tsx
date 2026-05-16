"use client";

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Verify Proof</h1>
          <p className="text-muted-foreground mt-2">
            Enter an order ID to verify its cryptographic execution proof.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Proof verifier coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
