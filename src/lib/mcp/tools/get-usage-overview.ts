import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { isoDay, latencyStats, sinceIso, sumBy, tally } from "../stats";

const MAX_SESSIONS = 2000;

export default defineTool({
  name: "get_usage_overview",
  title: "Usage overview",
  description:
    "Session statistics for the AVA experience: sessions played, durations, characters called, film seen or not seen, endings, handoffs and voice modes, grouped by environment and by day. Reads session metadata only, never conversation content.",
  inputSchema: {
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
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, environment }, ctx) => {
    if (!ctx.isAuthenticated()) {
      throw new ToolError("Sign-in required: statistics are read with the connected account's own access rights.");
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("sessions")
      .select(
        "id,started_at,duration_seconds,environment_id,context_type,personnage_appele,active_character,has_seen_film,game_over_reason,narrative_end,modalite_voix,output_mode,handoff_count,teaser_shown,ava_start_variant",
      )
      .gte("started_at", sinceIso(days))
      .order("started_at", { ascending: false })
      .range(0, MAX_SESSIONS - 1);
    if (environment) query = query.eq("environment_id", environment);

    const { data, error } = await query;
    if (error) throw new ToolError(`Sessions could not be read: ${error.message}`);
    const rows = data ?? [];

    const summary = {
      windowDays: days,
      environmentFilter: environment ?? null,
      sessionsReturned: rows.length,
      cappedAt: MAX_SESSIONS,
      firstSessionAt: rows.length ? rows[rows.length - 1].started_at : null,
      lastSessionAt: rows.length ? rows[0].started_at : null,
      durationsSeconds: latencyStats(rows.map((row) => row.duration_seconds)),
      totalDurationSeconds: sumBy(rows, (row) => row.duration_seconds),
      byEnvironment: tally(rows, (row) => row.environment_id),
      byContextType: tally(rows, (row) => row.context_type),
      byCharacter: tally(rows, (row) => row.personnage_appele ?? row.active_character),
      filmChoice: tally(rows, (row) => row.has_seen_film),
      endings: tally(rows, (row) => row.game_over_reason, "sans motif"),
      narrativeEndings: sumBy(rows, (row) => (row.narrative_end ? 1 : 0)),
      voiceModes: tally(rows, (row) => row.modalite_voix),
      outputModes: tally(rows, (row) => row.output_mode),
      startVariants: tally(rows, (row) => row.ava_start_variant),
      handoffs: {
        total: sumBy(rows, (row) => row.handoff_count),
        sessionsWithHandoff: sumBy(rows, (row) => (row.handoff_count > 0 ? 1 : 0)),
      },
      sessionsPerDay: tally(rows, (row) => isoDay(row.started_at), "unknown"),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
