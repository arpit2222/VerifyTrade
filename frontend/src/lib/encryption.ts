/**
 * Encryption utilities for VerifyTrade order privacy.
 *
 * We use AES-256-GCM (authenticated encryption) so that:
 *   - Orders stored on 0G Storage are unreadable without the key
 *   - The auth tag detects any tampering with ciphertext
 *   - The IV is random per encryption so equal orders produce different ciphertexts
 *
 * All functions are synchronous Node.js crypto — safe in Next.js API routes.
 * Do NOT import this file in browser-side components (use server actions instead).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { EncryptedPayload, KeyPair } from "./types";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH  = 12;  // 96 bits — optimal for GCM

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Derive a 32-byte encryption key from an arbitrary string secret.
 * The secret is typically the ENCRYPTION_KEY env var.
 */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/**
 * Get the active encryption key from env, falling back to a deterministic
 * dev-only key so the app starts without crashing in local development.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY env var is required in production");
    }
    // Deterministic dev key — never use in production
    return deriveKey("dev-only-insecure-key-replace-me");
  }
  return deriveKey(secret);
}

// ---------------------------------------------------------------------------
// Core encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a plain-text string with AES-256-GCM using the app's encryption key.
 *
 * @param plaintext  The string to encrypt (typically JSON-serialized order).
 * @returns          An EncryptedPayload containing IV, ciphertext, and auth tag.
 */
export function encryptOrder(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv  = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    iv:         iv.toString("hex"),
    ciphertext: encryptedBuffer.toString("hex"),
    authTag:    authTag.toString("hex"),
    algorithm:  ALGORITHM,
  };
}

/**
 * Decrypt an EncryptedPayload back to the original plain-text string.
 *
 * @param payload  The encrypted payload returned by encryptOrder().
 * @returns        The original plain-text string.
 * @throws         If the auth tag is invalid (tampered data) or key is wrong.
 */
export function decryptOrder(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv  = Buffer.from(payload.iv, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// Public-key helpers (for future TEE integration)
// ---------------------------------------------------------------------------

/**
 * Generate a fresh symmetric key pair for a trader session.
 * Currently returns a symmetric key as both "public" and "private" sides —
 * this will be replaced with ECDH once the TEE verifier supports it.
 */
export function generateKeys(): KeyPair {
  const privateKey = randomBytes(KEY_LENGTH).toString("hex");
  // Derive a "public" key from the private key — for real TEE use ECDH/RSA
  const publicKey  = createHash("sha256").update(privateKey).digest("hex");
  return { publicKey, privateKey };
}

// ---------------------------------------------------------------------------
// Attestation helpers
// ---------------------------------------------------------------------------

/**
 * Hash an attestation object for on-chain storage.
 * Returns a 0x-prefixed hex string suitable for passing to Solidity.
 *
 * @param attestation  The attestation data — string or serializable object.
 */
export function hashAttestation(attestation: string | object): string {
  const payload = typeof attestation === "string"
    ? attestation
    : JSON.stringify(attestation);

  return "0x" + createHash("sha256").update(payload).digest("hex");
}

/**
 * Create a deterministic content identifier from encrypted order bytes.
 * This simulates what 0G Storage would return as a CID before the real
 * network SDK is integrated.
 */
export function mockCid(payload: EncryptedPayload): string {
  const content = JSON.stringify(payload);
  const hash    = createHash("sha256").update(content).digest("hex");
  // Use Qm prefix to look like an IPFS-style CIDv0
  return `Qm${hash.slice(0, 44)}`;
}

/**
 * Serialize an EncryptedPayload to a JSON string for network transport.
 */
export function serializePayload(payload: EncryptedPayload): string {
  return JSON.stringify(payload);
}

/**
 * Deserialize a JSON string back to an EncryptedPayload.
 */
export function deserializePayload(raw: string): EncryptedPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("iv" in parsed) ||
    !("ciphertext" in parsed) ||
    !("authTag" in parsed)
  ) {
    throw new Error("Invalid encrypted payload format");
  }
  return parsed as EncryptedPayload;
}
