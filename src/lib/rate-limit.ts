import { NextResponse } from "next/server";

/**
 * Best-effort sliding-window rate limiter.
 *
 * This guards *spend*, not CPU: it exists so a public demo URL cannot be
 * scripted to drain the model quota in one sitting. When no LLM key is
 * configured the pipeline is local and effectively free, so the limit is
 * deliberately loose — a judge clicking quickly through all three sample
 * letters must never be throttled.
 *
 * Caveat worth stating plainly: serverless instances each hold their own Map
 * and a cold start resets it, so this is a speed bump rather than a hard
 * quota. Real protection is the provider-side quota plus the graceful
 * fallback to the demo engine in each route.
 */

const WINDOW_MS = 60_000;
const MAX_WITH_KEY = 30;
const MAX_WITHOUT_KEY = 120;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function check(request: Request): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();

  // Opportunistic prune so a long-lived instance cannot grow without bound.
  if (windows.size > 5000) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  const key = clientIp(request);
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  const max = process.env.LLM_API_KEY ? MAX_WITH_KEY : MAX_WITHOUT_KEY;
  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

/** Returns a 429 response when the caller is over the limit, else null. */
export function rateLimitOrResponse(request: Request): NextResponse | null {
  const result = check(request);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}
