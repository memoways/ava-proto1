import { ToolError } from "@lovable.dev/mcp-js";
import { defineTool } from "../defineTool";
import { z } from "zod-mcp";
import { supabaseForAdmin } from "../supabase";
import { groupBy, isoDay, round4, sumBy, tally } from "../stats";

const MAX_USAGE_ROWS = 5000;

export default defineTool({
  name: "get_llm_costs",
  title: "Model usage and costs",
  description:
    "Language-model usage statistics: calls, tokens and cost grouped by model, feature and day, with a success or error breakdown. Reads the usage log only, never conversation content.",
  inputSchema: {
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30)
      .describe("Number of past days to include."),
    model: z
      .string()
      .min(1)
      .optional()
      .describe("Optional model id filter, e.g. an OpenRouter model name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, model }, ctx) => {
    if (!ctx.isAuthenticated()) {
      throw new ToolError("Sign-in required: usage costs are read with the connected account's own access rights.");
    }
    const supabase = await supabaseForAdmin(ctx);
    let query = supabase
      .from("llm_usage")
      .select(
        "created_at,feature_key,request_type,model,prompt_tokens,completion_tokens,total_tokens,cost_usd,status",
      )
      .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .range(0, MAX_USAGE_ROWS - 1);
    if (model) query = query.eq("model", model);

    const { data, error } = await query;
    if (error) throw new ToolError(`Usage log could not be read: ${error.message}`);
    const rows = data ?? [];

    const modelGroups = groupBy(rows, (row) => row.model || "inconnu");
    const featureGroups = groupBy(rows, (row) => row.feature_key || "inconnu");

    const summary = {
      windowDays: days,
      modelFilter: model ?? null,
      rowsReturned: rows.length,
      cappedAt: MAX_USAGE_ROWS,
      calls: rows.length,
      tokens: {
        prompt: sumBy(rows, (row) => row.prompt_tokens),
        completion: sumBy(rows, (row) => row.completion_tokens),
        total: sumBy(rows, (row) => row.total_tokens),
      },
      costUsd: round4(sumBy(rows, (row) => row.cost_usd)),
      byStatus: tally(rows, (row) => row.status),
      byRequestType: tally(rows, (row) => row.request_type),
      byModel: Object.fromEntries(
        Object.entries(modelGroups).map(([name, list]) => [
          name,
          {
            calls: list.length,
            costUsd: round4(sumBy(list, (row) => row.cost_usd)),
            totalTokens: sumBy(list, (row) => row.total_tokens),
          },
        ]),
      ),
      byFeature: Object.fromEntries(
        Object.entries(featureGroups).map(([name, list]) => [
          name,
          {
            calls: list.length,
            costUsd: round4(sumBy(list, (row) => row.cost_usd)),
          },
        ]),
      ),
      costPerDay: Object.fromEntries(
        Object.entries(
          groupBy(rows, (row) => isoDay(row.created_at)),
        ).map(([day, list]) => [day, round4(sumBy(list, (row) => row.cost_usd))]),
      ),
      callsPerDay: tally(rows, (row) => isoDay(row.created_at), "unknown"),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { summary },
    };
  },
});
