/**
 * 0G Storage integration — real SDK with in-memory fallback.
 *
 * Uses the official @0gfoundation/0g-storage-ts-sdk:
 *   - Indexer.upload(MemData, rpcUrl, signer)  → rootHash (content address)
 *   - Indexer.downloadToBlob(rootHash)          → Blob
 *
 * Priority:
 *   1. Real 0G Storage (ZEROG_INDEXER_RPC + ZEROG_PRIVATE_KEY set)
 *   2. Mock in-memory  (fallback for local dev / CI)
 *
 * Docs: https://docs.0g.ai/build-with-0g/storage-sdk
 */

import { createHash } from "crypto";
import { ethers } from "ethers";
import { encryptOrder, decryptOrder, serializePayload, deserializePayload } from "./encryption";
import type { StorageUploadResult, EncryptedPayload } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INDEXER_RPC = (process.env.ZEROG_INDEXER_RPC ?? "").replace(/\/$/, "");
const ZG_RPC_URL  = (process.env.ZEROG_RPC_URL    ?? "https://evmrpc-testnet.0g.ai").replace(/\/$/, "");
const ZG_KEY      = process.env.ZEROG_PRIVATE_KEY  ?? process.env.PRIVATE_KEY ?? "";
const USE_MOCK    = !INDEXER_RPC || !ZG_KEY || process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// Persistent in-memory store (lives for the server process lifetime)
const mockStore = new Map<string, string>();

// ---------------------------------------------------------------------------
// 0G Explorer URL helper
// ---------------------------------------------------------------------------

export function get0GStorageExplorerUrl(rootHash: string): string {
  return `https://storagescan-galileo.0g.ai/file?root=${rootHash}`;
}

export function get0GNetworkName(): string {
  return "0G Galileo Testnet";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function makeMockCid(content: string): string {
  return "0x" + sha256Hex(content + Date.now().toString());
}

function get0GSigner(): ethers.Wallet {
  if (!ZG_KEY) throw new Error("ZEROG_PRIVATE_KEY not set");
  const provider = new ethers.JsonRpcProvider(ZG_RPC_URL);
  return new ethers.Wallet(
    ZG_KEY.startsWith("0x") ? ZG_KEY : `0x${ZG_KEY}`,
    provider
  );
}

// ---------------------------------------------------------------------------
// Real 0G Storage upload via SDK
// ---------------------------------------------------------------------------

async function realUpload(
  content: string
): Promise<StorageUploadResult & { rootHash: string }> {
  // Lazy-import the SDK so server builds without it still work
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");

  const signer  = get0GSigner();
  const indexer = new Indexer(INDEXER_RPC);
  const data    = Buffer.from(content, "utf8");
  const memData = new MemData(data);

  const [result, err] = await indexer.upload(memData, ZG_RPC_URL, signer, {
    finalityRequired: false,   // don't block on finality — faster for demo
    skipIfFinalized:  true,    // skip re-upload if same content already stored
    expectedReplica:  1,
  });

  if (err) throw new Error(`0G Storage upload failed: ${err.message}`);

  // SDK returns { txHash, rootHash, txSeq } for single-file uploads
  const single = result as { txHash: string; rootHash: string; txSeq: number };

  console.log(`[0G Storage REAL] ✓ Uploaded → rootHash=${single.rootHash} txHash=${single.txHash}`);

  return {
    cid:      single.rootHash,
    rootHash: single.rootHash,
    size:     data.byteLength,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ---------------------------------------------------------------------------
// Real 0G Storage download via SDK
// ---------------------------------------------------------------------------

async function realDownload(rootHash: string): Promise<string> {
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");

  const indexer = new Indexer(INDEXER_RPC);
  const [blob, err] = await indexer.downloadToBlob(rootHash);

  if (err) throw new Error(`0G Storage download failed: ${err.message}`);

  return await blob.text();
}

// ---------------------------------------------------------------------------
// Upload with mock fallback
// ---------------------------------------------------------------------------

async function uploadWithFallback(
  content: string
): Promise<StorageUploadResult & { isReal: boolean }> {
  if (!USE_MOCK) {
    try {
      const result = await realUpload(content);
      return { ...result, isReal: true };
    } catch (err) {
      console.warn("[0G Storage] Real upload failed, falling back to mock:", err);
    }
  }

  // Mock fallback
  const cid = makeMockCid(content);
  mockStore.set(cid, content);
  console.log(`[0G Storage MOCK] Stored → ${cid.slice(0, 20)}…`);
  return {
    cid,
    size:      Buffer.byteLength(content, "utf8"),
    timestamp: Math.floor(Date.now() / 1000),
    isReal:    false,
  };
}

// ---------------------------------------------------------------------------
// Public API — Encrypted order storage
// ---------------------------------------------------------------------------

export async function uploadEncryptedOrder(
  orderData: Record<string, unknown>
): Promise<StorageUploadResult & { isReal: boolean; explorerUrl: string }> {
  const plaintext = JSON.stringify(orderData);
  const payload   = encryptOrder(plaintext);
  const content   = serializePayload(payload);

  const result = await uploadWithFallback(content);
  return {
    ...result,
    explorerUrl: get0GStorageExplorerUrl(result.cid),
  };
}

export async function retrieveEncryptedOrder(
  cid: string
): Promise<Record<string, unknown>> {
  let content: string;

  const isMock = USE_MOCK || !cid.startsWith("0x");
  if (isMock) {
    const stored = mockStore.get(cid);
    if (!stored) throw new Error(`[0G Storage] CID not found in local store: ${cid}`);
    content = stored;
  } else {
    content = await realDownload(cid);
  }

  const payload   = deserializePayload(content);
  const plaintext = decryptOrder(payload);
  return JSON.parse(plaintext) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API — Attestation storage (unencrypted public proof)
// ---------------------------------------------------------------------------

export async function uploadAttestation(
  attestationData: Record<string, unknown> | string
): Promise<StorageUploadResult & { isReal: boolean; explorerUrl: string }> {
  const content = typeof attestationData === "string"
    ? attestationData
    : JSON.stringify(attestationData, null, 2);

  const result = await uploadWithFallback(content);
  return {
    ...result,
    explorerUrl: get0GStorageExplorerUrl(result.cid),
  };
}

export async function retrieveAttestation(
  cid: string
): Promise<Record<string, unknown>> {
  const isMock = USE_MOCK || !cid.startsWith("0x");
  if (isMock) {
    const stored = mockStore.get(cid);
    if (!stored) throw new Error(`[0G Storage] Attestation CID not found: ${cid}`);
    return JSON.parse(stored) as Record<string, unknown>;
  }
  const content = await realDownload(cid);
  return JSON.parse(content) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export async function isStorageReachable(): Promise<boolean> {
  if (USE_MOCK) return false;
  try {
    const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const indexer = new Indexer(INDEXER_RPC);
    const nodes   = await indexer.getShardedNodes();
    return Array.isArray(nodes?.trusted) && nodes.trusted.length > 0;
  } catch {
    return false;
  }
}

export function isMockMode(): boolean  { return USE_MOCK; }
export function getStorageNode(): string { return INDEXER_RPC || "mock"; }
export function listMockCids(): string[] { return [...mockStore.keys()]; }
export function clearMockStore(): void   { mockStore.clear(); }
export { makeMockCid as mockCid };
