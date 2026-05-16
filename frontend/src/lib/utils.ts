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
