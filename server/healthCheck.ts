/**
 * Health Check Handler — /api/scheduled/health-check
 *
 * Runs 3x daily via Manus Heartbeat cron (08:00, 14:00, 20:00 UTC).
 * Checks:
 *   1. Database connectivity
 *   2. ElevenLabs API reachability (signed URL endpoint)
 *   3. Portrait CDN reachability (spot-check one image)
 *   4. LLM API reachability (Forge)
 *
 * On any failure: logs the error with full context. Returns 200 always
 * so the platform does not retry (failures are expected occasionally and
 * self-heal on the next trigger).
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { ENV } from "./_core/env";

const PORTRAIT_SPOT_CHECK_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663716052239/js3eMMpFhsGdJ5siAQTARE/anxious-woman-v2-mQLhZgbDpzJSYLfH7WVX7Z.webp";

async function checkUrl(url: string, label: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function healthCheckHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  const results: Record<string, { ok: boolean; status?: number; error?: string; latencyMs?: number }> = {};

  // ── 1. Authenticate as cron ──────────────────────────────────────────────────
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }
  } catch {
    return res.status(403).json({ error: "auth failed" });
  }

  // ── 2. Database connectivity ─────────────────────────────────────────────────
  const dbStart = Date.now();
  try {
    const db = await getDb();
    if (!db) throw new Error("DB not initialised");
    await db.execute(sql`SELECT 1`);
    results.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    results.database = { ok: false, error: String(err), latencyMs: Date.now() - dbStart };
  }

  // ── 3. ElevenLabs API ────────────────────────────────────────────────────────
  const elStart = Date.now();
  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${process.env.ELEVENLABS_AGENT_ID ?? ""}`,
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
        signal: AbortSignal.timeout(10000),
      }
    );
    results.elevenlabs = { ok: elRes.ok, status: elRes.status, latencyMs: Date.now() - elStart };
  } catch (err) {
    results.elevenlabs = { ok: false, error: String(err), latencyMs: Date.now() - elStart };
  }

  // ── 4. Portrait CDN ──────────────────────────────────────────────────────────
  const cdnStart = Date.now();
  const cdnResult = await checkUrl(PORTRAIT_SPOT_CHECK_URL, "portrait-cdn");
  results.portraitCdn = { ...cdnResult, latencyMs: Date.now() - cdnStart };

  // ── 5. LLM / Forge API ───────────────────────────────────────────────────────
  const llmStart = Date.now();
  try {
    const llmRes = await fetch(`${ENV.forgeApiUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    results.llmApi = { ok: llmRes.ok, status: llmRes.status, latencyMs: Date.now() - llmStart };
  } catch (err) {
    results.llmApi = { ok: false, error: String(err), latencyMs: Date.now() - llmStart };
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const allOk = Object.values(results).every(r => r.ok);
  const failures = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([k, r]) => `${k}: ${r.error ?? `HTTP ${r.status}`}`);

  if (!allOk) {
    console.error(`[HealthCheck] FAILURES at ${startedAt}:`, failures.join(" | "), JSON.stringify(results));
  } else {
    console.log(`[HealthCheck] All OK at ${startedAt}`, JSON.stringify(results));
  }

  // Always return 200 — failures are logged, not retried
  return res.json({
    ok: allOk,
    checkedAt: startedAt,
    results,
    ...(failures.length ? { failures } : {}),
  });
}
