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

  it("laisse Gemini 2.5 Flash inchangé sans demande explicite (GM et autres appelants)", () => {
    const result = buildOpenRouterPayload({
      messages: [{ role: "user", content: "Test" }],
      model: "google/gemini-2.5-flash",
      reasoning: false,
    });
    expect(result.upstreamBody).not.toHaveProperty("reasoning");
  });

  it("coupe la réflexion de Gemini 2.5 Flash sur demande explicite (sélection en superposition)", () => {
    const flash = buildOpenRouterPayload({
      messages: [{ role: "user", content: "Test" }],
      model: "google/gemini-2.5-flash",
      reasoning: false,
      disable_reasoning: true,
    });
    expect(flash.upstreamBody.reasoning).toEqual({ enabled: false, exclude: true });
    const lite = buildOpenRouterPayload({ model: "google/gemini-2.5-flash-lite", disable_reasoning: true });
    expect(lite.upstreamBody.reasoning).toEqual({ enabled: false, exclude: true });
  });

  it("ne touche ni Gemini Pro ni une réflexion demandée", () => {
    expect(buildOpenRouterPayload({ model: "google/gemini-2.5-pro", disable_reasoning: true }).upstreamBody)
      .not.toHaveProperty("reasoning");
    expect(buildOpenRouterPayload({ model: "google/gemini-2.5-flash", reasoning: true, disable_reasoning: true }).upstreamBody.reasoning)
      .toEqual({ enabled: true, exclude: false });
    expect(buildOpenRouterPayload({ model: "openai/o3-mini", disable_reasoning: true }).upstreamBody.reasoning)
      .toEqual({ effort: "minimal", exclude: true });
  });
});

describe("préférence de fournisseur OpenRouter (banc de latence, lot 2)", () => {
  it("n'ajoute rien sans demande : les appelants d'Ava gardent le même payload", () => {
    expect(buildOpenRouterPayload({ model: "openai/gpt-5.6-luna" }).upstreamBody).not.toHaveProperty("provider");
    expect(buildOpenRouterPayload({ model: "openai/gpt-5.6-luna", provider: "latency" }).upstreamBody).not.toHaveProperty("provider");
    expect(buildOpenRouterPayload({ model: "openai/gpt-5.6-luna", provider: { sort: "fastest", only: [42] } }).upstreamBody).not.toHaveProperty("provider");
  });

  it("transmet seulement les champs connus et bornés", () => {
    const result = buildOpenRouterPayload({
      model: "openai/gpt-oss-120b",
      provider: { sort: "latency", only: ["cerebras", "bad slug!", 3], order: ["groq"], allow_fallbacks: false, data_collection: "allow" },
    });
    expect(result.upstreamBody.provider).toEqual({ sort: "latency", only: ["cerebras"], order: ["groq"], allow_fallbacks: false });
  });
});

describe("effort de raisonnement facultatif (banc de latence, lot 2)", () => {
  it("abaisse la réflexion de gpt-oss sur demande, et ignore une valeur inconnue ou une réflexion demandée", () => {
    expect(buildOpenRouterPayload({ model: "openai/gpt-oss-120b" }).upstreamBody).not.toHaveProperty("reasoning");
    expect(buildOpenRouterPayload({ model: "openai/gpt-oss-120b", reasoning_effort: "low" }).upstreamBody.reasoning)
      .toEqual({ effort: "low", exclude: true });
    expect(buildOpenRouterPayload({ model: "openai/gpt-oss-120b", reasoning_effort: "max" }).upstreamBody).not.toHaveProperty("reasoning");
    expect(buildOpenRouterPayload({ model: "openai/gpt-oss-120b", reasoning: true, reasoning_effort: "low" }).upstreamBody.reasoning)
      .toEqual({ enabled: true, exclude: false });
  });
});
