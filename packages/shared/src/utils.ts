import type { Address, Hash } from "./types";

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

export function shortenAddress(address: Address, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function isZeroAddress(address: Address): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}

// ---------------------------------------------------------------------------
// Amount formatting
// ---------------------------------------------------------------------------

export function formatUnits(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integer = value / divisor;
  const remainder = value % divisor;

  if (remainder === 0n) return integer.toString();

  const remainderStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${integer}.${remainderStr}`;
}

export function parseUnits(value: string, decimals: number): bigint {
  const [integer, fraction = ""] = value.split(".");
  const fractionPadded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(integer + fractionPadded);
}

export function formatUsd(value: bigint, decimals = 8): string {
  const formatted = formatUnits(value, decimals);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(formatted));
}

// ---------------------------------------------------------------------------
// BPS helpers
// ---------------------------------------------------------------------------

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

// ---------------------------------------------------------------------------
// Proof / hash helpers
// ---------------------------------------------------------------------------

export function shortenHash(hash: Hash, chars = 6): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function deadlineFromNow(seconds: number): number {
  return unixNow() + seconds;
}

export function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}
