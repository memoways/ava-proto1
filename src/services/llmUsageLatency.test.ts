import { beforeEach, describe, expect, it, vi } from "vitest";

const inserts: Array<Record<string, unknown>> = [];
let missingColumns = false;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        const rejected = missingColumns && ("latency_ms" in row || "cached_tokens" in row);
        return {
          select: () => ({
            single: async () => rejected
              ? { data: null, error: { code: "PGRST204", message: "Could not find the 'latency_ms' column of 'llm_usage'" } }
              : { data: { id: `row-${inserts.length}` }, error: null },
          }),
        };
      },
    }),
  },
}));
vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock("./settingsService", async (importOriginal) => ({ ...(await importOriginal<object>()), isReasoningEnabledForModel: () => false }));
vi.mock("./debugLogger", () => ({ debugLogger: { log: vi.fn(), logFetch: vi.fn(), logResponse: vi.fn() } }));

import { authenticatedFunctionFetch } from "./gameAuth";
import { logLLMUsage } from "./llmUsageTracker";
import { readCachedTokens } from "./llmUsageMetrics";
import { callLLMWithUsage, streamLLM } from "./openRouterLLM";

/** Latency lot 3: `llm_usage` records latency and cached tokens, without losing a row before the migration. */
describe("llm_usage : latence et tokens en cache (latence, lot 3)", () => {
  beforeEach(() => {
    inserts.length = 0;
    missingColumns = false;
    vi.mocked(authenticatedFunctionFetch).mockReset();
  });

  it("lit les tokens en cache d'OpenRouter, et null quand il n'en dit rien", () => {
    expect(readCachedTokens({ prompt_tokens: 5000, prompt_tokens_details: { cached_tokens: 2688 } })).toBe(2688);
    expect(readCachedTokens({ prompt_tokens: 5000 })).toBeNull();
    expect(readCachedTokens(null)).toBeNull();
    expect(readCachedTokens({ prompt_tokens_details: { cached_tokens: -1 } })).toBeNull();
  });

  it("enregistre latence et cache, et rien de plus sans eux", async () => {
    await logLLMUsage({ feature_key: "chat", model: "m", latency_ms: 812.4, cached_tokens: 0 });
    await logLLMUsage({ feature_key: "chat", model: "m" });
    expect(inserts[0]).toMatchObject({ latency_ms: 812, cached_tokens: 0 });
    expect(inserts[1]).not.toHaveProperty("latency_ms");
    expect(inserts[1]).not.toHaveProperty("cached_tokens");
  });

  it("garde la ligne sans les nouvelles colonnes tant que la migration n'est pas appliquée", async () => {
    missingColumns = true;
    const id = await logLLMUsage({ feature_key: "chat", model: "m", latency_ms: 900, cached_tokens: 12 });
    expect(id).toBe("row-2");
    expect(inserts[1]).not.toHaveProperty("latency_ms");
    expect(inserts[1]).toMatchObject({ feature_key: "chat", model: "m" });
  });

  it("appel en lot : latence totale, cache, fournisseur servi et préférence envoyée", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "gen-1", provider: "Amazon Bedrock", model: "openai/gpt-5.6-luna",
      choices: [{ message: { content: "Oui." }, finish_reason: "stop" }],
      usage: { prompt_tokens: 4800, completion_tokens: 20, total_tokens: 4820, prompt_tokens_details: { cached_tokens: 2560 } },
    }), { status: 200 }));
    await callLLMWithUsage([{ role: "user", content: "Q" }], { model: "openai/gpt-5.6-luna", provider: { sort: "latency" } });
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0]).toMatchObject({ cached_tokens: 2560, prompt_tokens: 4800 });
    expect(typeof inserts[0].latency_ms).toBe("number");
    expect(inserts[0].metadata_json).toMatchObject({ latency_kind: "total", effective_provider: "Amazon Bedrock", provider_preference: { sort: "latency" } });
  });

  it("appel en flux : latence au premier token", async () => {
    const encoder = new TextEncoder();
    const sse = [
      `data: ${JSON.stringify({ id: "gen-2", provider: "Amazon Bedrock", model: "openai/gpt-5.6-luna", choices: [{ delta: { content: "Bon" } }] })}\n\n`,
      `data: ${JSON.stringify({ id: "gen-2", choices: [{ delta: { content: "jour." }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, prompt_tokens_details: { cached_tokens: 4 } } })}\n\n`,
      "data: [DONE]\n\n",
    ];
    const body = new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of sse) controller.enqueue(encoder.encode(chunk)); controller.close(); } });
    vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(body, { status: 200 }));
    const text = await streamLLM([{ role: "user", content: "Q" }], () => {}, { model: "openai/gpt-5.6-luna" });
    expect(text).toBe("Bonjour.");
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0]).toMatchObject({ cached_tokens: 4, status: "success" });
    expect(typeof inserts[0].latency_ms).toBe("number");
    expect(inserts[0].metadata_json).toMatchObject({ latency_kind: "first_token", effective_provider: "Amazon Bedrock" });
    expect(inserts[0].metadata_json).not.toHaveProperty("provider_preference");
  });
});
