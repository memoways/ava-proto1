import { voiceTurnPageSchema, latencyStatsSchema } from "../voiceTurnProjection";
import { readVoiceTurnPage } from "../voiceTurnQuery";
import { ToolError } from "@lovable.dev/mcp-js";
import { defineTool } from "../defineTool";
import { z } from "zod-mcp";
import { supabaseForAdmin } from "../supabase";
import { latencyStats, sinceIso, sumBy, tally } from "../stats";

const MAX_ROWS = 3000;

export default defineTool({
  name: "get_voice_latencies",
  title: "Voice latencies",
  description:
    "Voice pipeline timing statistics: speech-to-text, text-to-speech first byte and total, audio playback, plus per-turn retrieval, model and validation timings as count, mean, p50, p90, p95 and max.",
  inputSchema: {
    from: z.iso.datetime().optional(), to: z.iso.datetime().optional(),
    character: z.string().min(1).max(80).optional(),
    provider: z.string().min(1).max(160).optional(), model: z.string().min(1).max(160).optional(),
    service: z.enum(["stt", "llm", "tts", "gm"]).default("tts"),
    transport: z.string().min(1).max(80).optional(),
    code_version: z.string().min(1).max(160).optional(),
    prompt_version: z.string().min(1).max(160).optional(), config_version: z.string().min(1).max(160).optional(),
    turn_id: z.string().min(1).max(160).optional(), attempt_id: z.string().min(1).max(160).optional(),
    offset: z.number().int().min(0).max(3000).default(0), limit: z.number().int().min(1).max(300).default(100),
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30)
      .describe("Number of past days to include."),
    environment: z
      .string()
      .min(1)
      .optional()
      .describe("Optional environment id: prod, sandbox-ulrich, sandbox-benoit, sandbox-romed."),
  },
  outputSchema: z.object({ summary: z.object({
    windowDays: z.number(), window: z.object({ from: z.string(), to: z.string() }),
    percentileMethod: z.string(), environmentFilter: z.string().nullable(),
    legacy: z.object({ source: z.array(z.string()), attribution: z.string(), filtersApplied: z.array(z.string()), additionalV2FiltersApplied: z.literal(false) }),
    v2: voiceTurnPageSchema,
    audio: z.object({ samples: z.number(), cappedAt: z.number(), byDirection: z.record(z.string(), z.number()), byContextType: z.record(z.string(), z.number()), sttMs: latencyStatsSchema, ttsFirstByteMs: latencyStatsSchema, ttsTotalMs: latencyStatsSchema, playbackMs: latencyStatsSchema, spokenChars: z.number(), heardChars: z.number() }),
    turn: z.object({ samples: z.number(), cappedAt: z.number(), byContextType: z.record(z.string(), z.number()), ragTotalMs: latencyStatsSchema, characterLlmMs: latencyStatsSchema, characterFirstTokenMs: latencyStatsSchema, validatorMs: latencyStatsSchema, gameMasterPostMs: latencyStatsSchema, turnTotalMs: latencyStatsSchema, fallbackTurns: z.number(), tokens: z.number() }),
  }) }),
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, environment, from, to, ...filters }, ctx) => {
    if (!ctx.isAuthenticated()) {
      throw new ToolError("Sign-in required: latency data is read with the connected account's own access rights.");
    }
    const supabase = await supabaseForAdmin(ctx);
    const since = from ?? sinceIso(days);
    const until = to ?? new Date().toISOString();
    if (Date.parse(since) >= Date.parse(until) || Date.parse(until) - Date.parse(since) > 365 * 86400000) throw new ToolError("Invalid time window (maximum 365 days)");
    const v2 = await readVoiceTurnPage(supabase, { ...filters, from: since, to: until, environment });

    let audioQuery = supabase
      .from("audio_latencies")
      .select(
        "direction,t_stt_ms,t_tts_first_byte_ms,t_tts_total_ms,t_audio_playback_ms,stt_text_len,tts_text_len,context_type",
      )
      .gte("created_at", since)
      .lt("created_at", until)
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS - 1);
    if (environment) audioQuery = audioQuery.eq("environment_id", environment);

    let turnQuery = supabase
      .from("turn_latencies")
      .select(
        "t_rag_total_ms,t_max_llm_ms,t_max_first_token_ms,t_validator_ms,t_gm_post_ms,t_turn_total_ms,rag_matches_count,usage_total_tokens,had_fallback,context_type",
      )
      .gte("created_at", since)
      .lt("created_at", until)
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS - 1);
    if (environment) turnQuery = turnQuery.eq("environment_id", environment);

    const [audio, turn] = await Promise.all([audioQuery, turnQuery]);
    if (audio.error) throw new ToolError(`Audio latencies could not be read: ${audio.error.message}`);
    if (turn.error) throw new ToolError(`Turn latencies could not be read: ${turn.error.message}`);

    const audioRows = audio.data ?? [];
    const turnRows = turn.data ?? [];

    const summary = {
      windowDays: days,
      window: { from: since, to: until },
      percentileMethod: "linear_interpolation_(n-1)*p_rounded_ms",
      legacy: { source: ["audio_latencies", "turn_latencies"], attribution: "historical_not_verified", filtersApplied: ["window", "environment"], additionalV2FiltersApplied: false },
      v2,
      environmentFilter: environment ?? null,
      audio: {
        samples: audioRows.length,
        cappedAt: MAX_ROWS,
        byDirection: tally(audioRows, (row) => row.direction),
        byContextType: tally(audioRows, (row) => row.context_type),
        sttMs: latencyStats(audioRows.map((row) => row.t_stt_ms)),
        ttsFirstByteMs: latencyStats(audioRows.map((row) => row.t_tts_first_byte_ms)),
        ttsTotalMs: latencyStats(audioRows.map((row) => row.t_tts_total_ms)),
        playbackMs: latencyStats(audioRows.map((row) => row.t_audio_playback_ms)),
        spokenChars: sumBy(audioRows, (row) => row.tts_text_len),
        heardChars: sumBy(audioRows, (row) => row.stt_text_len),
      },
      turn: {
        samples: turnRows.length,
        cappedAt: MAX_ROWS,
        byContextType: tally(turnRows, (row) => row.context_type),
        ragTotalMs: latencyStats(turnRows.map((row) => row.t_rag_total_ms)),
        characterLlmMs: latencyStats(turnRows.map((row) => row.t_max_llm_ms)),
        characterFirstTokenMs: latencyStats(turnRows.map((row) => row.t_max_first_token_ms)),
        validatorMs: latencyStats(turnRows.map((row) => row.t_validator_ms)),
        gameMasterPostMs: latencyStats(turnRows.map((row) => row.t_gm_post_ms)),
        turnTotalMs: latencyStats(turnRows.map((row) => row.t_turn_total_ms)),
        fallbackTurns: sumBy(turnRows, (row) => (row.had_fallback ? 1 : 0)),
        tokens: sumBy(turnRows, (row) => row.usage_total_tokens),
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
