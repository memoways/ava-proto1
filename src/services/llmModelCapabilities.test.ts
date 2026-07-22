import { describe, expect, it } from "vitest";
import { getSupportedSamplingParameters } from "./llmModelCapabilities";

describe("getSupportedSamplingParameters", () => {
  it("omet temperature et top_p pour GPT-5 mini", () => {
    expect(getSupportedSamplingParameters("openai/gpt-5-mini", 1.2, 0.9)).toEqual({});
  });

  it("les transmet pour les modèles compatibles", () => {
    expect(getSupportedSamplingParameters("google/gemini-2.5-flash", 0.8, 0.95)).toEqual({
      temperature: 0.8,
      top_p: 0.95,
    });
  });
});
