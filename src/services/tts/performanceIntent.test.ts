import { describe, expect, it } from "vitest";
import {
  isHeatedIntent,
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

  it("defaults Emma to a grave voice when the line has no emotional cue (G1)", () => {
    const intent = derivePerformanceIntent({
      text: "Allô ? Oui, je vous écoute.",
      characterKey: "emma",
    });
    expect(intent.emotion).toBe("fragile");
    expect(intent.actingNl).toMatch(/^grave, weighed down; /);
  });

  it("never lets Max or Emma default to a light emotion (G1)", () => {
    for (const characterKey of ["max", "emma"]) {
      for (const text of ["Merci. Prends ton temps, je t'écoute.", "Bien sûr, évidemment, génial.", "Max vient de me passer la ligne. Bonjour."]) {
        const intent = derivePerformanceIntent({ text, characterKey });
        expect(["warm", "sarcastic", "neutral"]).not.toContain(intent.emotion);
        expect(applyElevenLabsPerformance({ style: 0.38, stability: 0.38, speed: 1, modelId: "eleven_v4_turbo" }, text, intent).text)
          .not.toMatch(/\[(?:warmly|sarcastic)\]/);
      }
    }
  });

  it("keeps a light emotion for characters outside the grave set", () => {
    expect(derivePerformanceIntent({ text: "Merci. Prends ton temps, je t'écoute.", characterKey: "guide" }).emotion).toBe("warm");
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
      characterKey: "guide",
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

describe("temper guard (recette d'Ulrich, 1er novembre 2026)", () => {
  const map = {
    "La digue cède": { delivery: "rushed", emotion: "urgent", instruction: "Fast, overflowing remorse; stop abruptly, clear diction", pauses: "short", speed: 1.12 },
    "Bloqué": { delivery: "measured", emotion: "fragile", instruction: "Broken, hesitant speech", pauses: "long", speed: 0.9 },
  };
  const speechSettings = { enabled: true, version: "v", gradiumTagsEnabled: false, byCharacter: { max: map } } as never;
  const states = Object.keys(map);
  // Session 89e1868f (sandbox-ulrich, Max rugosité 3): replies 2 and 3 both rendered "urgent".
  const reply2 = "Emma a été contaminée quand elle a pris Ava dans ses bras. Je ne sais pas quand, ni jusqu’où. J’aurais dû empêcher ça, et maintenant je ne sais même plus comment lui parler.";
  const reply3 = "J’aimerais lui dire que je l’aimerai, quoi qu’il lui arrive. Je voudrais lui parler sans lui demander de me pardonner.";

  it("keeps a single flare-up as the speech state and rugosité render it", () => {
    const intent = derivePerformanceIntent({ text: reply3, characterKey: "max", speechState: "La digue cède",
      validSpeechStates: states, rugosite: 3, speechSettings });
    expect(intent).toMatchObject({ emotion: "urgent", intensity: 2, speedHint: 1.12, source: "speech_state" });
    expect(intent.tempered).toBeUndefined();
  });

  it("calms the second flare-up in a row, keeping the played speech state name", () => {
    const first = derivePerformanceIntent({ text: reply2, characterKey: "max", speechSettings, validSpeechStates: states, rugosite: 3 });
    expect(isHeatedIntent(first)).toBe(true);
    const second = derivePerformanceIntent({ text: reply3, characterKey: "max", speechState: "La digue cède",
      validSpeechStates: states, rugosite: 3, speechSettings, previousHeated: isHeatedIntent(first) });
    expect(isHeatedIntent(second)).toBe(false);
    expect(second).toMatchObject({ emotion: "tense", intensity: 0, delivery: "measured", speedHint: 1, speechState: "La digue cède", tempered: "calmed" });
    expect(second.actingNl).not.toMatch(/overflowing|rushed|urgent/i);
  });

  it("leaves calm replies untouched after a flare-up", () => {
    const calm = derivePerformanceIntent({ text: reply3, characterKey: "max", speechState: "Bloqué",
      validSpeechStates: states, rugosite: 3, speechSettings, previousHeated: true });
    expect(calm).toMatchObject({ emotion: "fragile", speechState: "Bloqué" });
    expect(calm.tempered).toBeUndefined();
  });
});
