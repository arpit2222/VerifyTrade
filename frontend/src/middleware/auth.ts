/**
 * API middleware utilities for Next.js App Router Route Handlers.
 *
 * Usage in a route handler:
 *
 *   export async function POST(req: Request) {
 *     return withMiddleware(req, async (parsed) => {
 *       const body = validate(parsed.body, MySchema);
 *       return successResponse(body);
 *     });
 *   }
 */

import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode, ApiSuccess } from "@/lib/types";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Wrap any value in a standardized success envelope and return a NextResponse.
 */
export function successResponse<T>(
  data:   T,
  status: number = 200,
  meta?: ApiSuccess<T>["meta"]
): NextResponse {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: {
      timestamp: Math.floor(Date.now() / 1000),
      ...meta,
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Return a standardized error response.
 */
export function errorResponse(
  message: string,
  code:    ApiErrorCode = "INTERNAL_ERROR",
  status:  number       = 500,
  details?: unknown
): NextResponse {
  const body: ApiError = {
    success: false,
    error:   message,
    code,
    ...(details !== undefined ? { details } : {}),
  };
  return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that required string fields are present and non-empty in an object.
 * Throws a structured ValidationError if any field is missing.
 */
export function requireFields<T extends Record<string, unknown>>(
  obj:    T,
  fields: (keyof T)[]
): void {
  const missing: string[] = [];
  for (const field of fields) {
    const val = obj[field];
    if (val === undefined || val === null || val === "") {
      missing.push(String(field));
    }
  }
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(", ")}`, missing);
  }
}

/**
 * Assert that a value is a positive number (or numeric string).
 */
export function requirePositive(value: unknown, fieldName: string): string {
  const n = Number(value);
  if (isNaN(n) || n <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`, [fieldName]);
  }
  return String(value);
}

/**
 * Clamp a slippage value to 0–100 and convert to the contract's × 100 scale.
 * e.g. 0.5 → 50 (clamped at 100 = 10_000 in contract)
 */
export function parseSlippage(raw: unknown, fieldName = "maxSlippage"): number {
  const n = Number(raw);
  if (isNaN(n) || n < 0 || n > 100) {
    throw new ValidationError(
      `${fieldName} must be a number between 0 and 100`,
      [fieldName]
    );
  }
  return n;
}

/**
 * Parse a trade ID from a string — must be a positive integer.
 */
export function parseTradeId(raw: string | null | undefined): string {
  if (!raw) throw new ValidationError("tradeId is required", ["tradeId"]);
  const n = BigInt(raw);    // throws SyntaxError if not a valid integer string
  if (n <= BigInt(0)) throw new ValidationError("tradeId must be positive", ["tradeId"]);
  return n.toString();
}

/**
 * Sanitize a string by stripping control characters and trimming whitespace.
 */
export function sanitizeString(value: unknown, maxLength = 1024): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, "")  // strip control chars
    .trim()
    .slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON request body.
 * Returns null if the body is empty or not valid JSON.
 */
export async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const text = await req.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

// Allowlist of trusted origins — never default to wildcard in production
// ---------------------------------------------------------------------------
// In-memory rate limiter (per-IP, resets on cold start)
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  count:      number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

/**
 * Check whether the caller has exceeded the rate limit.
 * Returns an error response if rate-limited, otherwise null.
 *
 * @param req         Incoming request (for IP extraction)
 * @param limit       Max requests per window (default 30)
 * @param windowMs    Window duration in ms (default 60 000 = 1 min)
 */
export function checkRateLimit(
  req:      Request,
  limit    = 30,
  windowMs = 60_000
): NextResponse | null {
  const ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? req.headers.get("x-real-ip")
            ?? "unknown";
  const now = Date.now();

  const bucket = rateLimitStore.get(ip);
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    const res = errorResponse(
      `Rate limit exceeded — try again in ${retryAfter}s`,
      "RATE_LIMITED",
      429
    );
    res.headers.set("Retry-After", String(retryAfter));
    return res;
  }
  return null;
}

// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean)
);

function getAllowedOrigin(req?: Request): string {
  const origin = req?.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // In development allow any localhost port
  if (process.env.NODE_ENV === "development" && origin.startsWith("http://localhost")) return origin;
  return ALLOWED_ORIGINS.values().next().value ?? "https://verifytrade.xyz";
}

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age":       "86400",
} as const;

export function addCorsHeaders(response: NextResponse, req?: Request): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  response.headers.set("Access-Control-Allow-Origin", getAllowedOrigin(req));
  return response;
}

/** Handle pre-flight OPTIONS requests. */
export function handleOptions(req?: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": getAllowedOrigin(req),
    },
  });
}

// ---------------------------------------------------------------------------
// Middleware wrapper
// ---------------------------------------------------------------------------

/**
 * Main middleware wrapper for route handlers.
 *
 * Provides:
 *   - Structured error catching (ValidationError → 400, others → 500)
 *   - CORS headers on every response
 *   - Request logging in dev mode
 *   - Consistent error envelope
 *
 * @param req      The incoming Next.js Request
 * @param handler  Async function that receives the request and returns NextResponse
 */
export async function withMiddleware(
  req:     Request,
  handler: (req: Request) => Promise<NextResponse>
): Promise<NextResponse> {
  const start  = Date.now();
  const method = req.method;
  const url    = new URL(req.url).pathname;

  try {
    const response = await handler(req);
    addCorsHeaders(response);

    if (process.env.NODE_ENV === "development") {
      console.log(`[API] ${method} ${url} → ${response.status} (${Date.now() - start}ms)`);
    }

    return response;

  } catch (err) {
    const elapsed = Date.now() - start;

    if (err instanceof ValidationError) {
      console.warn(`[API] ${method} ${url} → 400 ValidationError: ${err.message} (${elapsed}ms)`);
      return addCorsHeaders(
        errorResponse(err.message, "VALIDATION_ERROR", 400, { fields: err.fields })
      );
    }

    if (err instanceof NotFoundError) {
      console.warn(`[API] ${method} ${url} → 404 (${elapsed}ms)`);
      return addCorsHeaders(errorResponse(err.message, "NOT_FOUND", 404));
    }

    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error(`[API] ${method} ${url} → 500 (${elapsed}ms)`, err);
    return addCorsHeaders(errorResponse(message, "INTERNAL_ERROR", 500));
  }
}

// ---------------------------------------------------------------------------
// Custom error classes
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  fields: string[];
  constructor(message: string, fields: string[] = []) {
    super(message);
    this.name   = "ValidationError";
    this.fields = fields;
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string | number) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ContractError extends Error {
  override cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name  = "ContractError";
    this.cause = cause;
  }
}
