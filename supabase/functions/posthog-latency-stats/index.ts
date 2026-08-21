import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const ALLOWED_PERIODS = new Set(["24h", "7d", "30d", "custom"]);
const ALLOWED_FILTERS = new Set(["character", "model", "stt", "tts", "browser"]);
const EVENTS = [
  "voice_turn_completed",
  "prd4_gm_post_turn",
  "prd4_video_recommended",
  "prd4_video_triggered",
  "prd4_video_completed",
  "prd4_handoff_proposed",
  "prd4_handoff_accepted",
  "prd4_handoff_refused",
  "prd4_handoff_executed",
  "prd4_handoff_blocked",
];

interface RequestBody {
  period?: string;
  from?: string;
  to?: string;
  filters?: Record<string, string>;
  include_sandbox?: boolean;
}

interface EventRow {
  event: string;
  timestamp: string;
  sessionId: string | null;
  turnId: string | null;
  turnIndex: number | null;
  character: string | null;
  model: string | null;
  stt: string | null;
  tts: string | null;
  browser: string | null;
  responseReadyMs: number | null;
  firstSoundMs: number | null;
  endToEndMs: number | null;
  sttMs: number | null;
  ragMs: number | null;
  maxMs: number | null;
  ttsMs: number | null;
  gmMs: number | null;
  blocker: string | null;
  severity: string | null;
  fallback: boolean;
}

function json(value: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function periodRange(body: RequestBody): { period: string; from: Date; to: Date } {
  const period = ALLOWED_PERIODS.has(body.period ?? "") ? body.period! : "24h";
  const to = period === "custom" ? parseDate(body.to) : new Date();
  const from = period === "custom" ? parseDate(body.from) : new Date((to ?? new Date()).getTime());
  if (!to || !from) throw new Error("Période personnalisée invalide");
  if (period === "24h") from.setHours(from.getHours() - 24);
  if (period === "7d") from.setDate(from.getDate() - 7);
  if (period === "30d") from.setDate(from.getDate() - 30);
  if (from >= to || to.getTime() - from.getTime() > 93 * 24 * 60 * 60_000) {
    throw new Error("La période doit être positive et inférieure à 93 jours");
  }
  return { period, from, to };
}

function safeFilters(raw: Record<string, string> | undefined): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (!ALLOWED_FILTERS.has(key)) continue;
    const clean = String(value).trim().slice(0, 120);
    if (clean) filters[key] = clean;
  }
  return filters;
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function percentile(values: Array<number | null>, p: number): number | null {
  const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function percentiles(rows: EventRow[], key: keyof EventRow) {
  const values = rows.map((row) => numberOrNull(row[key]));
  return { p50: percentile(values, 50), p95: percentile(values, 95), measured: values.filter((value) => value != null).length };
}

function counts(values: Array<string | null>): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

function actionCounts(rows: EventRow[]) {
  const count = (event: string) => rows.filter((row) => row.event === event).length;
  return {
    cinematics: {
      recommended: count("prd4_video_recommended"),
      played: count("prd4_video_triggered"),
      skipped: rows.filter((row) => row.event === "prd4_video_completed" && row.fallback).length,
    },
    handoffs: {
      proposed: count("prd4_handoff_proposed"),
      accepted: count("prd4_handoff_accepted"),
      refused: count("prd4_handoff_refused"),
      executed: count("prd4_handoff_executed"),
      blocked: count("prd4_handoff_blocked"),
    },
  };
}

function timeline(turns: EventRow[], range: { from: Date; to: Date }) {
  const durationMs = range.to.getTime() - range.from.getTime();
  const bucketMs = durationMs <= 2 * 24 * 60 * 60_000
    ? 60 * 60_000
    : durationMs <= 14 * 24 * 60 * 60_000
      ? 6 * 60 * 60_000
      : durationMs <= 45 * 24 * 60 * 60_000
        ? 24 * 60 * 60_000
        : 3 * 24 * 60 * 60_000;
  const buckets = new Map<number, EventRow[]>();
  for (const turn of turns) {
    const timestamp = new Date(turn.timestamp).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const bucket = Math.floor(timestamp / bucketMs) * bucketMs;
    const bucketRows = buckets.get(bucket);
    if (bucketRows) bucketRows.push(turn);
    else buckets.set(bucket, [turn]);
  }
  return [...buckets.entries()].sort(([left], [right]) => left - right).map(([timestamp, rows]) => ({
    timestamp: new Date(timestamp).toISOString(),
    turns: rows.length,
    responseReadyP50: percentile(rows.map((row) => row.responseReadyMs), 50),
    responseReadyP95: percentile(rows.map((row) => row.responseReadyMs), 95),
    firstSoundP50: percentile(rows.map((row) => row.firstSoundMs), 50),
    firstSoundP95: percentile(rows.map((row) => row.firstSoundMs), 95),
    endToEndP50: percentile(rows.map((row) => row.endToEndMs), 50),
    endToEndP95: percentile(rows.map((row) => row.endToEndMs), 95),
  }));
}

function slowestTurns(turns: EventRow[]) {
  const latencyScore = (row: EventRow) => row.endToEndMs ?? row.firstSoundMs ?? row.responseReadyMs ?? -1;
  return [...turns]
    .filter((row) => latencyScore(row) >= 0)
    .sort((left, right) => latencyScore(right) - latencyScore(left))
    .slice(0, 25)
    .map((row) => ({
      turnId: row.turnId,
      sessionId: row.sessionId,
      timestamp: row.timestamp,
      turnIndex: row.turnIndex,
      character: row.character,
      model: row.model,
      stt: row.stt,
      tts: row.tts,
      browser: row.browser,
      responseReadyMs: row.responseReadyMs,
      firstSoundMs: row.firstSoundMs,
      endToEndMs: row.endToEndMs,
      sttMs: row.sttMs,
      ragMs: row.ragMs,
      maxMs: row.maxMs,
      ttsMs: row.ttsMs,
      blocker: row.blocker,
      severity: row.severity,
      fallback: row.fallback,
    }));
}

function aggregate(rows: EventRow[], range: { period: string; from: Date; to: Date }, projectId: string, host: string) {
  const turns = rows.filter((row) => row.event === "voice_turn_completed");
  const gmPostTurns = rows.filter((row) => row.event === "prd4_gm_post_turn");
  const errors = turns.filter((row) => row.severity === "failed").length;
  const fallbacks = turns.filter((row) => row.fallback).length;
  return {
    source: "PostHog",
    hasData: rows.length > 0,
    freshAt: new Date().toISOString(),
    period: { key: range.period, from: range.from.toISOString(), to: range.to.toISOString() },
    dashboardUrl: `${host}/project/${encodeURIComponent(projectId)}/dashboard`,
    totals: {
      sessions: new Set(turns.map((row) => row.sessionId).filter(Boolean)).size,
      turns: turns.length,
      errors,
      errorRate: turns.length ? errors / turns.length : null,
      fallbacks,
      fallbackRate: turns.length ? fallbacks / turns.length : null,
    },
    latency: {
      responseReady: percentiles(turns, "responseReadyMs"),
      firstSound: percentiles(turns, "firstSoundMs"),
      endToEnd: percentiles(turns, "endToEndMs"),
      stt: percentiles(turns, "sttMs"),
      rag: percentiles(turns, "ragMs"),
      max: percentiles(turns, "maxMs"),
      tts: percentiles(turns, "ttsMs"),
      gmPost: percentiles(gmPostTurns, "gmMs"),
    },
    blockers: counts(turns.map((row) => row.blocker)),
    providers: {
      models: counts(turns.map((row) => row.model)),
      stt: counts(turns.map((row) => row.stt)),
      tts: counts(turns.map((row) => row.tts)),
      browsers: counts(turns.map((row) => row.browser)),
      characters: counts(turns.map((row) => row.character)),
    },
    actions: actionCounts(rows),
    timeline: timeline(turns, range),
    slowestTurns: slowestTurns(turns),
    turnIds: turns.map((row) => row.turnId).filter(Boolean),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  const personalApiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
  const projectId = Deno.env.get("POSTHOG_PROJECT_ID");
  const host = (Deno.env.get("POSTHOG_API_HOST") || "https://eu.posthog.com").replace(/\/$/, "");
  if (!personalApiKey || !projectId) {
    return json({ error: "PostHog non configuré", code: "posthog_not_configured" }, 503);
  }

  let body: RequestBody;
  let range: { period: string; from: Date; to: Date };
  try {
    body = await req.json();
    range = periodRange(body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Requête invalide", code: "invalid_request" }, 400);
  }
  const filters = safeFilters(body.filters);
  const includeSandbox = body.include_sandbox === true;
  const cacheKey = JSON.stringify({ period: range.period, from: range.from.toISOString(), to: range.to.toISOString(), filters, includeSandbox });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value, 200, { "X-AVA-Cache": "HIT" });

  const sqlString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const conditions = [
    `timestamp >= toDateTime(${sqlString(range.from.toISOString())})`,
    `timestamp < toDateTime(${sqlString(range.to.toISOString())})`,
    `event IN (${EVENTS.map((event) => sqlString(event)).join(", ")})`,
  ];
  if (!includeSandbox) {
    conditions.push(`coalesce(toString(properties.context_type), 'public') != 'sandbox'`);
  }
  const filterProperties: Record<string, string> = {
    character: "character",
    model: "max_model",
    stt: "stt_provider",
    tts: "tts_provider",
    browser: "browser_family",
  };
  for (const [key, value] of Object.entries(filters)) {
    conditions.push(`toString(properties.${filterProperties[key]}) = ${sqlString(value)}`);
  }

  const query = `
    SELECT
      event, timestamp,
      properties.session_id, properties.turn_id, properties.turn_index,
      properties.character, properties.max_model, properties.stt_provider,
      properties.tts_provider, properties.browser_family,
      properties.t_turn_response_ready_ms, properties.t_turn_voice_ready_ms,
      properties.t_turn_end_to_end_ms, properties.t_stt_total_ms,
      properties.t_rag_total_ms, properties.t_max_llm_ms,
      properties.t_tts_total_ms, coalesce(properties.t_gm_post_ms, properties.latency_ms),
      properties.blocker_step, properties.severity,
      coalesce(properties.had_fallback, properties.skipped, false)
    FROM events
    WHERE ${conditions.join(" AND ")}
    ORDER BY timestamp DESC
    LIMIT 10000
  `;

  try {
    const response = await fetch(`${host}/api/projects/${encodeURIComponent(projectId)}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });
    const payload = await response.json().catch(() => null) as { results?: unknown[][]; error?: string; detail?: string } | null;
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? "posthog_auth" : response.status === 429 ? "posthog_quota" : "posthog_unavailable";
      return json({ error: payload?.detail || payload?.error || `PostHog HTTP ${response.status}`, code }, response.status === 429 ? 429 : 502);
    }
    const rows: EventRow[] = (payload?.results ?? []).map((row) => ({
      event: String(row[0] ?? ""), timestamp: String(row[1] ?? ""),
      sessionId: row[2] == null ? null : String(row[2]), turnId: row[3] == null ? null : String(row[3]),
      turnIndex: numberOrNull(row[4]), character: row[5] == null ? null : String(row[5]),
      model: row[6] == null ? null : String(row[6]), stt: row[7] == null ? null : String(row[7]),
      tts: row[8] == null ? null : String(row[8]), browser: row[9] == null ? null : String(row[9]),
      responseReadyMs: numberOrNull(row[10]), firstSoundMs: numberOrNull(row[11]), endToEndMs: numberOrNull(row[12]),
      sttMs: numberOrNull(row[13]), ragMs: numberOrNull(row[14]), maxMs: numberOrNull(row[15]),
      ttsMs: numberOrNull(row[16]), gmMs: numberOrNull(row[17]), blocker: row[18] == null ? null : String(row[18]),
      severity: row[19] == null ? null : String(row[19]), fallback: row[20] === true || row[20] === 1,
    }));
    const result = aggregate(rows, range, projectId, host);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return json(result, 200, { "X-AVA-Cache": "MISS" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "PostHog indisponible", code: "posthog_unavailable" }, 502);
  }
});
