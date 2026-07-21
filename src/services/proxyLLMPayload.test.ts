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

  it("capture les paramètres explicites et le raisonnement OpenRouter activé", () => {
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
      temperature: 0.2,
      max_tokens: 321,
      top_p: 0.75,
      stream: false,
      reasoning: { enabled: true, exclude: false },
    });
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
