/**
 * 0G Storage integration layer.
 *
 * 0G Storage is a decentralized object store designed for AI and DeFi
 * applications. It provides content-addressed storage with on-chain
 * verification — ideal for storing encrypted trade orders and TEE attestations
 * in a way that is tamper-proof and permanently retrievable.
 *
 * This module exposes two modes:
 *   MOCK   — used in local development / CI (no network calls)
 *   REAL   — calls the 0G Storage HTTP API (when ZEROG_STORAGE_NODE is set)
 *
 * The mock uses an in-process Map as a "storage node" so the full API
 * surface works without credentials.
 *
 * Docs: https://docs.0g.ai/0g-storage
 */

import { createHash } from "crypto";
import {
  encryptOrder,
  decryptOrder,
  serializePayload,
  deserializePayload,
  mockCid,
} from "./encryption";
import type { StorageUploadResult, EncryptedPayload } from "./types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STORAGE_NODE  = process.env.ZEROG_STORAGE_NODE ?? "";
const STORAGE_KEY   = process.env.ZEROG_STORAGE_API_KEY ?? "";
const USE_MOCK      = !STORAGE_NODE || process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// In-memory store for mock mode — persists for the lifetime of the dev server
const mockStore = new Map<string, string>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function realUpload(content: string): Promise<StorageUploadResult> {
  const res = await fetch(`${STORAGE_NODE}/upload`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${STORAGE_KEY}`,
    },
    body: JSON.stringify({ data: Buffer.from(content).toString("base64") }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0G Storage upload failed (${res.status}): ${text}`);
  }

  const json = await res.json() as { cid: string; size: number };
  return { cid: json.cid, size: json.size, timestamp: Math.floor(Date.now() / 1000) };
}

async function realRetrieve(cid: string): Promise<string> {
  const res = await fetch(`${STORAGE_NODE}/retrieve/${cid}`, {
    headers: { "Authorization": `Bearer ${STORAGE_KEY}` },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`CID not found: ${cid}`);
    throw new Error(`0G Storage retrieve failed (${res.status})`);
  }

  const json = await res.json() as { data: string };
  return Buffer.from(json.data, "base64").toString("utf8");
}

// ---------------------------------------------------------------------------
// Public API — Order storage
// ---------------------------------------------------------------------------

/**
 * Encrypt an order object and upload it to 0G Storage.
 *
 * The caller receives a CID that can be stored on-chain. The actual order
 * details are only readable by someone who holds the ENCRYPTION_KEY.
 *
 * @param orderData  Plain JS object representing the trade order.
 * @returns          CID and upload metadata.
 */
export async function uploadEncryptedOrder(
  orderData: Record<string, unknown>
): Promise<StorageUploadResult> {
  const plaintext = JSON.stringify(orderData);
  const payload   = encryptOrder(plaintext);
  const content   = serializePayload(payload);

  if (USE_MOCK) {
    const cid = mockCid(payload);
    mockStore.set(cid, content);
    console.log(`[0G Storage MOCK] Stored order → ${cid}`);
    return { cid, size: content.length, timestamp: Math.floor(Date.now() / 1000) };
  }

  return realUpload(content);
}

/**
 * Retrieve and decrypt an encrypted order from 0G Storage.
 *
 * @param cid  Content identifier returned by uploadEncryptedOrder().
 * @returns    The original order object.
 */
export async function retrieveEncryptedOrder(
  cid: string
): Promise<Record<string, unknown>> {
  let content: string;

  if (USE_MOCK) {
    const stored = mockStore.get(cid);
    if (!stored) throw new Error(`[0G Storage MOCK] CID not found: ${cid}`);
    content = stored;
    console.log(`[0G Storage MOCK] Retrieved order ← ${cid}`);
  } else {
    content = await realRetrieve(cid);
  }

  const payload   = deserializePayload(content);
  const plaintext = decryptOrder(payload);
  return JSON.parse(plaintext) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API — Attestation storage
// ---------------------------------------------------------------------------

/**
 * Upload a TEE / 0G-AI execution attestation to 0G Storage.
 *
 * Attestations are stored unencrypted — they are public proofs of execution
 * and are meant to be auditable by anyone.
 *
 * @param attestationData  Object or string representing the attestation.
 * @returns                CID and upload metadata.
 */
export async function uploadAttestation(
  attestationData: Record<string, unknown> | string
): Promise<StorageUploadResult> {
  const content = typeof attestationData === "string"
    ? attestationData
    : JSON.stringify(attestationData, null, 2);

  if (USE_MOCK) {
    const cid = "Qm" + sha256Hex(content).slice(0, 44);
    mockStore.set(cid, content);
    console.log(`[0G Storage MOCK] Stored attestation → ${cid}`);
    return { cid, size: content.length, timestamp: Math.floor(Date.now() / 1000) };
  }

  return realUpload(content);
}

/**
 * Retrieve an attestation from 0G Storage by CID.
 */
export async function retrieveAttestation(
  cid: string
): Promise<Record<string, unknown>> {
  if (USE_MOCK) {
    const stored = mockStore.get(cid);
    if (!stored) throw new Error(`[0G Storage MOCK] CID not found: ${cid}`);
    return JSON.parse(stored) as Record<string, unknown>;
  }

  const content = await realRetrieve(cid);
  return JSON.parse(content) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Check whether the configured 0G Storage node is reachable.
 * Returns false immediately in mock mode (always "reachable").
 */
export async function isStorageReachable(): Promise<boolean> {
  if (USE_MOCK) return true;

  try {
    const res = await fetch(`${STORAGE_NODE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function isMockMode(): boolean {
  return USE_MOCK;
}

/**
 * List all CIDs in mock store — for debugging / testing only.
 */
export function listMockCids(): string[] {
  return [...mockStore.keys()];
}

/**
 * Clear the mock store — useful in test teardown.
 */
export function clearMockStore(): void {
  mockStore.clear();
}
