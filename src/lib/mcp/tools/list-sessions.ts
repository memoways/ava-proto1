import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { sinceIso } from "../stats";

const MAX_LIMIT = 100;

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default defineTool({
  name: "list_sessions",
  title: "List sessions",
  description:
    "Most recent game sessions as a metadata list: start and end, duration, environment, character called, film seen or not seen, voice modality, ending reason and handoff count. Conversation content is never returned.",
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
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(25)
      .describe("Maximum sessions to return, up to 100."),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Skip this many sessions, for paging."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, environment, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) {
      throw new ToolError("Sign-in required: sessions are read with the connected account's own access rights.");
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("sessions")
      .select(
        "id,started_at,ended_at,duration_seconds,environment_id,context_type,personnage_appele,active_character,has_seen_film,game_over_reason,narrative_end,modalite_voix,output_mode,handoff_count,tester_label",
      )
      .gte("started_at", sinceIso(days))
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (environment) query = query.eq("environment_id", environment);

    const { data, error } = await query;
    if (error) throw new ToolError(`Sessions could not be read: ${error.message}`);
    const rows = data ?? [];

    const sessions = rows.map((row) => ({
      id: row.id,
      startedAt: isoOrNull(row.started_at),
      endedAt: isoOrNull(row.ended_at),
      durationSeconds: row.duration_seconds ?? null,
      environment: row.environment_id,
      contextType: row.context_type,
      character: row.personnage_appele ?? row.active_character ?? null,
      film: row.has_seen_film ?? null,
      voiceModality: row.modalite_voix ?? null,
      outputMode: row.output_mode,
      gameOverReason: row.game_over_reason ?? null,
      narrativeEnd: row.narrative_end ?? null,
      handoffCount: row.handoff_count,
      testerLabel: row.tester_label ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify({ count: sessions.length, limit, offset, sessions }, null, 2) }],
      structuredContent: { count: sessions.length, limit, offset, sessions },
    };
  },
});
