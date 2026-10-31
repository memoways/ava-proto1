import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_EXPRESSIVE_MODEL,
  buildElevenLabsModelParts,
  normalizeElevenLabsModelId,
  supportsElevenLabsAudioTags,
} from "../../../supabase/functions/_shared/elevenLabsModels";
import { ELEVENLABS_MODELS, TTS_PRESETS } from "@/services/settingsService";
import { ELEVENLABS_WORKSHOP_MODEL } from "./speechIntentWorkshop";
import { applyElevenLabsPerformance, intentFromManualEmotion } from "./performanceIntent";

describe("ElevenLabs model capabilities (AP4-ter)", () => {
  it("omits the deprecated optimize_streaming_latency for v3 and v4", () => {
    for (const modelId of ["eleven_v3", "eleven_v4", "eleven_v4_turbo", "eleven_v3_conversational"]) {
      expect(buildElevenLabsModelParts({ text: "Oui.", modelId, optimizeStreamingLatency: 0 }).query).toEqual({});
    }
  });

  it("keeps optimize_streaming_latency for Multilingual and Flash", () => {
    for (const modelId of ["eleven_multilingual_v2", "eleven_flash_v2_5"]) {
      expect(buildElevenLabsModelParts({ text: "Oui.", modelId, optimizeStreamingLatency: 2 }).query).toEqual({ optimize_streaming_latency: "2" });
    }
  });

  it("sends request stitching only where accepted", () => {
    const ctx = { text: "Oui.", previousText: "Avant.", nextText: "Après." };
    expect(buildElevenLabsModelParts({ ...ctx, modelId: "eleven_v4" }).stitching).toEqual({});
    expect(buildElevenLabsModelParts({ ...ctx, modelId: "eleven_multilingual_v2" }).stitching).toEqual({ previous_text: "Avant.", next_text: "Après." });
  });

  it("cuts text at the model limit", () => {
    const parts = buildElevenLabsModelParts({ text: "a".repeat(6000), modelId: "eleven_v3" });
    expect(parts.text).toHaveLength(5000);
    expect(parts.truncated).toBe(true);
  });

  it("reads deprecated Turbo ids as Flash and empty ids as the game default", () => {
    expect(normalizeElevenLabsModelId("eleven_turbo_v2_5")).toBe("eleven_flash_v2_5");
    expect(normalizeElevenLabsModelId("eleven_turbo_v2")).toBe("eleven_flash_v2_5");
    expect(normalizeElevenLabsModelId("")).toBe("eleven_multilingual_v2");
    expect(buildElevenLabsModelParts({ text: "Oui.", modelId: "eleven_turbo_v2_5" }).modelId).toBe("eleven_flash_v2_5");
  });

  it("lists current models only and presets use none of the deprecated ones", () => {
    const ids = ELEVENLABS_MODELS.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["eleven_v4", "eleven_v4_turbo", "eleven_v3", "eleven_v3_conversational", "eleven_multilingual_v2", "eleven_flash_v2_5"]));
    expect(ids.some((id) => id.startsWith("eleven_turbo"))).toBe(false);
    for (const preset of Object.values(TTS_PRESETS)) {
      const modelId = preset.settings.modelId;
      if (modelId) expect(normalizeElevenLabsModelId(modelId)).toBe(modelId);
    }
  });

  it("uses v4 Turbo as workshop default and applies audio tags on every tag-capable model", () => {
    expect(ELEVENLABS_WORKSHOP_MODEL).toBe(ELEVENLABS_EXPRESSIVE_MODEL);
    expect(ELEVENLABS_EXPRESSIVE_MODEL).toBe("eleven_v4_turbo");
    const intent = intentFromManualEmotion("angry", 2);
    for (const modelId of ["eleven_v4", "eleven_v4_turbo", "eleven_v3", "eleven_v3_conversational"]) {
      expect(supportsElevenLabsAudioTags(modelId)).toBe(true);
      expect(applyElevenLabsPerformance({ style: 0.2, stability: 0.5, speed: 1, modelId }, "Non.", intent).text).toContain("[angry]");
    }
    expect(applyElevenLabsPerformance({ style: 0.2, stability: 0.5, speed: 1, modelId: "eleven_multilingual_v2" }, "Non.", intent).text).toBe("Non.");
  });
});
