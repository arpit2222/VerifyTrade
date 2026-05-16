/**
 * 0G Key-Value Store — persistent trade index on the 0G network.
 *
 * Uses the KV layer from @0gfoundation/0g-storage-ts-sdk to maintain
 * a per-trader index of trade IDs. This gives the dashboard instant
 * trade history lookups without scanning the blockchain.
 *
 * Stream ID: deterministic sha256("verifytrade.v1.trades") — shared
 *            across all instances, namespaced by trader address as key.
 *
 * Docs: https://docs.0g.ai/build-with-0g/storage-sdk/kv-store
 */

import { createHash } from "crypto";
import { ethers }     from "ethers";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INDEXER_RPC = (process.env.ZEROG_INDEXER_RPC ?? "").replace(/\/$/, "");
const ZG_RPC_URL  = (process.env.ZEROG_RPC_URL ?? "https://evmrpc-testnet.0g.ai").replace(/\/$/, "");
const ZG_KEY      = process.env.ZEROG_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "";
const USE_MOCK    = !INDEXER_RPC || !ZG_KEY;

// 0G KV nodes (hardcoded Galileo testnet node — same indexer reports these)
const KV_NODE_URL = "http://34.19.125.196:6789"; // port 6789 is the KV RPC port

// 0G Storage flow contract on Galileo testnet (reported by storage nodes)
const FLOW_CONTRACT = "0x22e03a6a89b950f1c82ec5e74f8eca321a105296";

// Stream ID: deterministic namespace for VerifyTrade trade records
const STREAM_ID = "0x" + createHash("sha256").update("verifytrade.v1.trades").digest("hex");

// In-memory fallback for when 0G KV is unavailable
const localIndex = new Map<string, string[]>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function traderKey(address: string): Uint8Array {
  // Key = sha256(lowercase trader address) as bytes
  return Buffer.from(
    createHash("sha256").update(address.toLowerCase()).digest("hex"),
    "hex"
  );
}

function get0GSigner(): ethers.Wallet {
  const key = ZG_KEY.startsWith("0x") ? ZG_KEY : `0x${ZG_KEY}`;
  return new ethers.Wallet(key, new ethers.JsonRpcProvider(ZG_RPC_URL));
}

// ---------------------------------------------------------------------------
// Read — get trade IDs for a trader from 0G KV
// ---------------------------------------------------------------------------

export async function getTraderTradeIds(traderAddress: string): Promise<string[]> {
  if (USE_MOCK) return localIndex.get(traderAddress.toLowerCase()) ?? [];

  try {
    const { KvClient } = await import("@0gfoundation/0g-storage-ts-sdk");
    const client = new KvClient(KV_NODE_URL);
    const key    = traderKey(traderAddress);
    const value  = await client.getValue(STREAM_ID, key);

    if (!value || !value.data || value.data.length === 0) return [];

    const raw    = Buffer.from(value.data).toString("utf8");
    return JSON.parse(raw) as string[];
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[0G KV] Read failed:", err instanceof Error ? err.message : err);
    return localIndex.get(traderAddress.toLowerCase()) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Write — append a trade ID to a trader's index in 0G KV
// ---------------------------------------------------------------------------

export async function appendTradeId(traderAddress: string, tradeId: string): Promise<boolean> {
  const lowerAddr = traderAddress.toLowerCase();

  if (USE_MOCK) {
    const existing = localIndex.get(lowerAddr) ?? [];
    if (!existing.includes(tradeId)) existing.push(tradeId);
    localIndex.set(lowerAddr, existing);
    if (process.env.NODE_ENV !== "production") console.log(`[0G KV MOCK] Indexed trade ${tradeId} for ${lowerAddr.slice(0, 10)}…`);
    return true;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await import("@0gfoundation/0g-storage-ts-sdk") as any;
    const { Indexer, getFlowContract, Batcher } = sdk as {
      Indexer:         typeof import("@0gfoundation/0g-storage-ts-sdk").Indexer;
      getFlowContract: typeof import("@0gfoundation/0g-storage-ts-sdk").getFlowContract;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Batcher:         new (...args: any[]) => any;
    };

    // Get current value first (read-modify-write)
    const existing = await getTraderTradeIds(traderAddress);
    if (!existing.includes(tradeId)) existing.push(tradeId);
    const payload = Buffer.from(JSON.stringify(existing), "utf8");
    const key     = traderKey(traderAddress);

    // Select storage nodes from indexer
    const indexer     = new Indexer(INDEXER_RPC);
    const [nodes, err] = await indexer.selectNodes(1);
    if (err || !nodes || nodes.length === 0) throw err ?? new Error("No nodes selected");

    // Build KV transaction
    const signer = get0GSigner();
    const flow   = getFlowContract(FLOW_CONTRACT, signer);
    const batcher = new Batcher(0, nodes, flow, ZG_RPC_URL);

    batcher.streamDataBuilder.set(STREAM_ID, key, payload);

    const [result, writeErr] = await batcher.exec({ finalityRequired: false });
    if (writeErr) throw writeErr;

    if (process.env.NODE_ENV !== "production") console.log(`[0G KV REAL] ✓ Trade ${tradeId} indexed for ${lowerAddr.slice(0, 10)}… txHash=${result.txHash}`);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[0G KV] Write failed:", err instanceof Error ? err.message : err);
    // Fallback: keep in memory
    const existing = localIndex.get(lowerAddr) ?? [];
    if (!existing.includes(tradeId)) existing.push(tradeId);
    localIndex.set(lowerAddr, existing);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function isKvReachable(): Promise<boolean> {
  if (USE_MOCK) return false;
  try {
    const { KvClient } = await import("@0gfoundation/0g-storage-ts-sdk");
    const client = new KvClient(KV_NODE_URL);
    await client.getHoldingStreamIds();
    return true;
  } catch {
    return false;
  }
}

export function isKvMockMode(): boolean { return USE_MOCK; }
export { STREAM_ID as KV_STREAM_ID };
