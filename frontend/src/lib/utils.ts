import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely — use everywhere instead of raw `clsx`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a string in the middle: "0x1234...5678" */
export function truncateMiddle(str: string, startChars = 6, endChars = 4): string {
  if (str.length <= startChars + endChars + 3) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/** Format a unix timestamp to a readable local date string */
export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
}

/** Format a token amount from base units to human readable */
export function formatTokenAmount(
  raw:      string | bigint,
  decimals: number = 6
): string {
  const n = Number(BigInt(raw.toString())) / 10 ** decimals;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/** Sleep for `ms` milliseconds (useful for demo delays) */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a USD dollar value with compact notation for large numbers.
 * e.g. 1_500_000 → "$1.5M", 42_000 → "$42K", 150 → "$150.00"
 */
export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Return the relative time string for a unix timestamp.
 * e.g. "just now", "2 min ago", "3 hours ago"
 */
export function timeAgo(unixSec: number): string {
  const secs = Math.floor(Date.now() / 1000) - unixSec;
  if (secs < 60)       return "just now";
  if (secs < 3_600)    return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86_400)   return `${Math.floor(secs / 3_600)} hours ago`;
  return `${Math.floor(secs / 86_400)} days ago`;
}
