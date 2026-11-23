import { describe, expect, it } from "vitest";
import {
  UNTRACED_CHUNKS_SENTENCE,
  chunksFromMatches,
  formatModelRequest,
  indexTtsByTurn,
  readTurnTrace,
  replyContextLine,
} from "./sessionTurnReading";

describe("session turn reading", () => {
  it("reads stored chunks and the requested model, and nothing when they are absent", () => {
    const traced = readTurnTrace({
      turn_index: 2,
      character_name: "Max",
      trace: {
        rag: { matches: [{ source_id: "src-camp", content: "Mona a été envoyée au camp par son père.", similarity: 0.714, rerank_score: 0.91 }] },
        maxCall: { requestedSettings: { model: "anthropic/claude", temperature: 0.4, maxTokens: 800 } },
      },
    });
    expect(traced?.chunks).toEqual([{
      sourceId: "src-camp",
      scoreLabel: "rerang 0.91",
      excerpt: "Mona a été envoyée au camp par son père.",
    }]);
    expect(formatModelRequest(traced?.model ?? null)).toBe("Modèle demandé : anthropic/claude · température 0.4");

    const empty = readTurnTrace({ turn_index: 2, character_name: "Max", matches: null, settings: null });
    expect(empty?.chunks).toEqual([]);
    expect(empty?.model).toBeNull();
    expect(chunksFromMatches(undefined)).toEqual([]);
    expect(UNTRACED_CHUNKS_SENTENCE).toBe("Chunks et paramètres du modèle non enregistrés pour cette session");
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
});
