import { describe, expect, it } from "vitest";
import {
  applyCartesiaGenerationConfig,
  applyElevenLabsPerformance,
  applyGradiumPerformance,
  applyInworldPerformance,
  applyFishPerformance,
  derivePerformanceIntent,
  intentFromManualEmotion,
  PROVIDER_ACTING_SUPPORT,
} from "./performanceIntent";

describe("derivePerformanceIntent", () => {
  it("defaults Max to tense when the line has no emotional cue", () => {
    const intent = derivePerformanceIntent({
      text: "Bonjour. Vous cherchez quelqu'un ?",
      characterKey: "max",
    });
    expect(intent.emotion).toBe("tense");
    expect(intent.intensity).toBe(1);
    expect(intent.source).toBe("lexicon");
    expect(intent.actingNl).toContain("tense");
  });

  it("defaults Emma to warm when the line has no emotional cue", () => {
    const intent = derivePerformanceIntent({
      text: "Allô ? Oui, je vous écoute.",
      characterKey: "emma",
    });
    expect(intent.emotion).toBe("warm");
    expect(intent.delivery).toBe("measured");
  });

  it("does not silently apply Max's acting baseline when identity is missing", () => {
    const intent = derivePerformanceIntent({ text: "Bonjour. Je vous écoute." });
    expect(intent.emotion).toBe("neutral");
  });

  it("detects anger from French lexicon", () => {
    const intent = derivePerformanceIntent({
      text: "Ça suffit ! J'en ai marre, dégage de ma vue.",
      characterKey: "max",
    });
    expect(intent.emotion).toBe("angry");
    expect(intent.intensity).toBeGreaterThanOrEqual(1);
  });

  it("detects sadness from French lexicon", () => {
    const intent = derivePerformanceIntent({
      text: "Je suis désolé. Depuis qu'elle a disparu, je n'arrive plus.",
      characterKey: "max",
    });
    expect(intent.emotion).toBe("sad");
    expect(intent.delivery).toBe("measured");
    expect(intent.speedHint ?? 1).toBeLessThan(1);
  });

  it("treats ellipsis as fragile / measured when nothing stronger matches", () => {
    const intent = derivePerformanceIntent({
      text: "Je... je ne sais plus quoi dire.",
      characterKey: "max",
    });
    expect(intent.emotion).toBe("fragile");
    expect(intent.delivery).toBe("measured");
  });

  it("uses GM memory as a bias when the spoken line is emotionally flat", () => {
    const intent = derivePerformanceIntent({
      text: "D'accord. Continuez.",
      characterKey: "max",
      previousEmotionalState: "en colère, sur la défensive",
    });
    expect(intent.emotion).toBe("angry");
    expect(intent.source).toBe("gm_memory");
  });

  it("lets a strong lexicon match win over GM memory", () => {
    const intent = derivePerformanceIntent({
      text: "Merci. Prends ton temps, je t'écoute.",
      characterKey: "max",
      previousEmotionalState: "tendu",
    });
    expect(intent.emotion).toBe("warm");
    expect(intent.source).toBe("lexicon");
  });
});

describe("provider adapters", () => {
  const angry = intentFromManualEmotion("angry", 2);

  it("injects the Fish emotion tag from the turn state and strips LLM tags", () => {
    const base = { speed: 1, emotionTags: true, defaultEmotion: "" };
    expect(applyFishPerformance(base, "(happy) Va-t'en.", angry).text).toBe("(angry) Va-t'en.");
    expect(applyFishPerformance({ ...base, emotionTags: false }, "(happy) Va-t'en.", angry).text).toBe("Va-t'en.");
    expect(applyFishPerformance(base, "Bonjour.", null).text).toBe("Bonjour.");
  });

  it("raises ElevenLabs style and prepends audio tags only on tag-capable models (v3, v4)", () => {
    const v2 = applyElevenLabsPerformance(
      { style: 0.18, stability: 0.5, speed: 1, modelId: "eleven_multilingual_v2" },
      "Écoute-moi.",
      angry,
    );
    expect(v2.style).toBeGreaterThan(0.18);
    expect(v2.text).toBe("Écoute-moi.");

    const v3 = applyElevenLabsPerformance(
      { style: 0.18, stability: 0.5, speed: 1, modelId: "eleven_v3" },
      "Écoute-moi.",
      angry,
    );
    expect(v3.text.startsWith("[angry]")).toBe(true);
  });

  it("raises Gradium temp for anger without dropping pronunciation fields", () => {
    const tuned = applyGradiumPerformance({ temp: 0.7, paddingBonus: 0 }, angry);
    expect(tuned.temp).toBeGreaterThan(0.7);
    expect(tuned.temp).toBeLessThanOrEqual(0.85);
  });

  it("caps Gradium temp even when a legacy base setting exceeds the diction limit", () => {
    const tuned = applyGradiumPerformance({ temp: 1.1, paddingBonus: 0 }, angry);
    expect(tuned.temp).toBe(0.9);
  });

  it("sends Inworld instruction and CREATIVE mode at intensity 2", () => {
    const patch = applyInworldPerformance(
      { deliveryMode: "BALANCED", speakingRate: 1 },
      angry,
    );
    expect(patch.instruction).toContain("angry");
    expect(patch.deliveryMode).toBe("CREATIVE");
  });

  it("omits Cartesia emotion for French and includes it for English", () => {
    const fr = applyCartesiaGenerationConfig(angry, "fr");
    expect(fr.emotion).toBeUndefined();
    expect(fr.speed).toBeGreaterThan(1);
    const en = applyCartesiaGenerationConfig(angry, "en");
    expect(en.emotion).toBe("angry");
  });
});

describe("PROVIDER_ACTING_SUPPORT", () => {
  it("marks Fish Audio and Inworld as the audible acting surfaces", () => {
    expect(PROVIDER_ACTING_SUPPORT.fish.usability).toBe("audible");
    expect(PROVIDER_ACTING_SUPPORT.inworld.usability).toBe("audible");
    expect(PROVIDER_ACTING_SUPPORT.elevenlabs.usability).toBe("weak");
    expect(PROVIDER_ACTING_SUPPORT.gradium.usability).toBe("speed_only");
    expect(PROVIDER_ACTING_SUPPORT.cartesia.usability).toBe("en_emotion_only");
  });
});

describe('AP4-quater: no slowdown for slow providers, expressive temperature', () => {
  const sad = (source: 'manual' | 'speech_state') => ({ emotion: 'sad', intensity: 2, actingNl: 'x', speedHint: 0.88, source } as import('./performanceIntent').PerformanceIntent);
  it('never slows Fish or Inworld outside the game mapping', async () => {
    const m = await import('./performanceIntent');
    expect(m.applyFishPerformance({ speed: 1, emotionTags: false, defaultEmotion: '' }, 'a', sad('manual')).speed).toBe(1);
    expect(m.applyFishPerformance({ speed: 1, emotionTags: false, defaultEmotion: '' }, 'a', sad('speech_state')).speed).toBe(0.88);
    expect(m.applyInworldPerformance({ deliveryMode: 'BALANCED', speakingRate: 1 }, sad('manual')).speakingRate).toBe(1);
  });
  it('raises temperature with intensity only for workshop intents', async () => {
    const m = await import('./performanceIntent');
    expect(m.expressiveTemperature(0.7, sad('manual'))).toBeCloseTo(0.94);
    expect(m.expressiveTemperature(0.7, sad('speech_state'))).toBe(0.7);
    expect(m.expressiveTemperature(0.7, null)).toBe(0.7);
  });
});
