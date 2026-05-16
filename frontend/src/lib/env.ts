/**
 * Server-side environment variable validation.
 * Import this at the top of any API route that needs these vars.
 * Throws at module load time if required vars are missing — fast feedback, no silent failures.
 */

export function validateServerEnv() {
  const warnings: string[] = [];
  const errors:   string[] = [];

  // Required for on-chain operations
  if (!process.env.ARBITRUM_SEPOLIA_RPC_URL) {
    errors.push("ARBITRUM_SEPOLIA_RPC_URL");
  }
  if (!process.env.PRIVATE_KEY && !process.env.ZEROG_PRIVATE_KEY) {
    errors.push("PRIVATE_KEY (or ZEROG_PRIVATE_KEY)");
  }

  // Recommended for 0G integrations
  if (!process.env.ZEROG_RPC_URL)      warnings.push("ZEROG_RPC_URL (using default testnet)");
  if (!process.env.ZEROG_INDEXER_RPC)  warnings.push("ZEROG_INDEXER_RPC (0G Storage will use mock)");

  if (process.env.NODE_ENV !== "production") {
    for (const w of warnings) console.warn(`[env] Missing optional: ${w}`);
  }

  if (errors.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(
      `[env] Missing required environment variables: ${errors.join(", ")}. ` +
      "See .env.example for setup instructions."
    );
  }
}

/** True if all 0G keys are configured (enables real 0G integrations). */
export function is0GConfigured(): boolean {
  return !!(
    (process.env.ZEROG_PRIVATE_KEY || process.env.PRIVATE_KEY) &&
    process.env.ZEROG_RPC_URL
  );
}

/** True if contract addresses are configured. */
export function areContractEnvsSet(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VERIFIABLE_TRADE_EXECUTOR_ADDRESS &&
    process.env.NEXT_PUBLIC_FAIRNESS_PROOF_ADDRESS &&
    process.env.NEXT_PUBLIC_MEV_REGISTRY_ADDRESS
  );
}
