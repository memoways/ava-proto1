import { describe, expect, it } from "vitest";
import {
  MISSING_CHARACTER_REPLY,
  UNTRACED_CHUNKS_SENTENCE,
  chunksFromMatches,
  formatModelRequest,
  indexTtsByTurn,
  labelSummary,
  readTurnTrace,
  replyContextLine,
} from "./sessionTurnReading";

describe("session turn reading", () => {
  it("reads stored chunks and the requested model, and nothing when they are absent", () => {
    const traced = readTurnTrace({
      turn_index: 2,
      character_name: "Max",
      trace: {
        rag: {
          matches: [{ source_id: "src-camp", content: "Mona a été envoyée au camp par son père.", similarity: 0.714, rerank_score: 0.91 }],
          request: { rewrittenQuery: "camp de Mona", searchInput: "où est Mona" },
        },
        maxCall: { requestedSettings: { model: "anthropic/claude", temperature: 0.4, maxTokens: 800 } },
      },
    });
    expect(traced?.chunks).toEqual([{
      sourceId: "src-camp",
      scoreLabel: "rerang 0.91",
      excerpt: "Mona a été envoyée au camp par son père.",
    }]);
    expect(formatModelRequest(traced?.model ?? null)).toBe("Modèle demandé : anthropic/claude · température 0.4");
    expect(traced?.search).toBe("camp de Mona");

    const empty = readTurnTrace({ turn_index: 2, character_name: "Max", matches: null, settings: null });
    expect(empty?.chunks).toEqual([]);
    expect(empty?.model).toBeNull();
    expect(empty?.search).toBeNull();
    expect(chunksFromMatches(undefined)).toEqual([]);
    expect(UNTRACED_CHUNKS_SENTENCE).toBe("Chunks et paramètres du modèle non enregistrés pour cette session");
    expect(MISSING_CHARACTER_REPLY).toBe("Réponse du personnage non enregistrée pour ce tour.");
    expect(labelSummary({ themes: ["famille"], topics: ["Mona"], intentions: [] })).toBe("Thèmes : famille · Mots-clés : Mona");
    expect(labelSummary({ themes: [], topics: [], intentions: [] })).toBeNull();
    expect(labelSummary(null)).toBeNull();
  });

  it("keeps the TTS emotion, speech state and model that were logged for the turn", () => {
    const byTurn = indexTtsByTurn([
      { turn_index: 1, metadata_json: { model: "eleven_v3" } },
      { turn_index: 1, metadata_json: { performance_emotion: "tense", performance_speech_state: "à vif", model: "eleven_v3" } },
      { turn_index: 2, metadata_json: { error_type: "ok" } },
    ]);
    expect(byTurn.get(1)).toEqual({ emotion: "tense", speechState: "à vif", model: "eleven_v3" });
    expect(byTurn.has(2)).toBe(false);
    expect(replyContextLine({
      speechState: "à vif",
      gmToCharacter: "Laisse-la parler.",
      tts: byTurn.get(1),
      face: "concerned · tense",
    })).toBe("État de parole : à vif · GM → personnage : Laisse-la parler. · Émotion de jeu : tense · Parole TTS : à vif · Voix : eleven_v3 · Visage : concerned · tense");
  });

  it("shows the rendered intensity and the voice pacing guard of a reply", () => {
    const byTurn = indexTtsByTurn([
      { turn_index: 3, metadata_json: { performance_emotion: "urgent", performance_intensity: 1, performance_paced_from: 2,
        performance_paced_reason: "ramp", model: "eleven_v4_turbo" } },
      { turn_index: 4, metadata_json: { performance_emotion: "tense", performance_intensity: 1, performance_tempered: "calmed" } },
      { turn_index: 5, metadata_json: { performance_emotion: "urgent", performance_intensity: 2, performance_outburst: true } },
    ]);
    expect(replyContextLine({ tts: byTurn.get(3) })).toBe("Émotion de jeu : urgent 1/2 (rampe, au lieu de 2) · Voix : eleven_v4_turbo");
    expect(replyContextLine({ tts: byTurn.get(4) })).toBe("Émotion de jeu : tense 1/2 (retenu, budget d'éclats)");
    expect(replyContextLine({ tts: byTurn.get(5) })).toBe("Émotion de jeu : urgent 2/2 (éclat autorisé)");
  });
});
