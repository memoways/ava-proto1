import { describe, expect, it } from "vitest";
import { buildOpenRouterPayload } from "../../supabase/functions/proxy-llm/payload";

describe("proxy-llm — payload OpenRouter exact", () => {
  it("applique toutes les valeurs par défaut avant l'envoi", () => {
    const messages = [{ role: "user" as const, content: "Bonjour" }];
    const result = buildOpenRouterPayload({ messages });

    expect(result.upstreamBody).toEqual({
      model: "qwen/qwen-2.5-72b-instruct",
      messages,
      temperature: 0.8,
      max_tokens: 500,
      top_p: 0.95,
      stream: true,
      usage: { include: true },
    });
  });

  it("omet les paramètres de sampling non supportés par GPT-5 mini", () => {
    const result = buildOpenRouterPayload({
      messages: [{ role: "system", content: "Exact" }],
      model: "openai/gpt-5-mini",
      temperature: 0.2,
      max_tokens: 321,
      top_p: 0.75,
      stream: false,
      reasoning: true,
    });

    expect(result.upstreamBody).toMatchObject({
      model: "openai/gpt-5-mini",
      max_tokens: 321,
      stream: false,
      reasoning: { enabled: true, exclude: false },
    });
    expect(result.upstreamBody).not.toHaveProperty("temperature");
    expect(result.upstreamBody).not.toHaveProperty("top_p");
  });

  it("conserve temperature et top_p pour un modèle compatible", () => {
    const result = buildOpenRouterPayload({
      messages: [{ role: "user", content: "Bonjour" }],
      model: "google/gemini-2.5-flash",
      temperature: 0.4,
      top_p: 0.7,
    });
    expect(result.upstreamBody).toMatchObject({ temperature: 0.4, top_p: 0.7 });
  });

  it("force l'effort minimal pour un modèle OpenAI reasoning non activé", () => {
    const result = buildOpenRouterPayload({
      messages: [{ role: "user", content: "Test" }],
      model: "openai/o3-mini",
      reasoning: false,
    });

    expect(result.upstreamBody.reasoning).toEqual({ effort: "minimal", exclude: true });
  });
});
