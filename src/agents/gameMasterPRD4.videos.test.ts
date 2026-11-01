import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({ callLLMWithUsage: vi.fn(), LLMProxyRequestError: class extends Error {} }));
vi.mock("@/services/settingsService", () => ({ getLLMSettings: () => ({ LLM_MODEL_GM: "existing-gm", LLM_MAX_TOKENS_GM: 950 }) }));
vi.mock("@/services/videoTriggerService", () => ({ getVideoTriggersCached: vi.fn() }));
vi.mock("@/services/sessionConversationMemory", () => ({ persistPostTurnMemory: vi.fn().mockResolvedValue(null) }));

import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, evaluatePostTurnPRD4 } from "./gameMasterPRD4";
import { formatWatchedVideos, watchedVideoFrom } from "@/services/watchedVideoMemory";
import publishedReplacement from "../../docs/prompt_gm_publie_regle_videos_lot_3.md?raw";

const row = (id: string, extra: Partial<VideoTriggerRow>): VideoTriggerRow => ({
  id, notion_id: null, title: id, type: "mid_conversation", themes: [], video_url: "https://video", context: null,
  description: null, priority: null, transition_style: null, post_video_context: null, updated_at: null, ...extra,
});

const catalog = [
  row("extract-max", { nature: "extract", characters: ["max"] }),
  row("transformed-all", { nature: "transformed", characters: ["all"] }),
  row("transformed-emma", { nature: "transformed", characters: ["emma"] }),
  row("intro", { type: "intro" }),
];

function gmReply(videoId: string) {
  return {
    content: JSON.stringify({
      labels: { themes: [], topics: [], intentions: [] }, engagement_delta: 0, confusion_detected: false,
      role_usage_quality: "high", topics_covered: [], transition_recommended: false, cinematic_hint: null,
      next_speech_state: null, next_turn_guidance: "Continuer.", end_recommended: false, moderation_flag: false,
      notes: "", trigger_video_id: videoId, action: { type: "cinematic", videoId, reason: "pertinent", confidence: 0.8 },
      player_switch_request: null, memory_delta: null,
    }),
    model: "existing-gm", latencyMs: 1, usage: null, generationId: null, diagnosticTrace: null,
  } as never;
}

const baseInput = {
  sessionId: null, conversationHistory: [], userMessage: "Montre-moi.", maxResponse: "Regarde.", userRole: null,
  currentCharacter: "max" as const, turnIndex: 5, timeElapsedSeconds: 120, sessionDurationSeconds: 900,
  minimumClosureSeconds: 600, persist: false,
};

describe("Game Master PRD4 — eligible video candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoTriggersCached).mockResolvedValue(catalog);
  });

  it("lists only eligible videos for the seen path and drops an ineligible trigger", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("extract-max"));
    const result = await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "seen" });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("id=transformed-all");
    expect(prompt).not.toContain("id=extract-max");
    expect(prompt).not.toContain("id=transformed-emma");
    expect(prompt).not.toContain("id=intro");
    expect(result.trigger_video_id).toBeNull();
  });

  it("offers extracts first on the unseen path", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("extract-max"));
    const result = await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "unseen", minExtractsBeforeCinematic: 2 });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("id=extract-max");
    expect(prompt).not.toContain("id=transformed-all");
    expect(result.trigger_video_id).toBe("extract-max");
  });

  it("sends each candidate's context and factual description to the GM", async () => {
    vi.mocked(getVideoTriggersCached).mockResolvedValue([
      row("transformed-all", { nature: "transformed", characters: ["all"], context: "Quand le joueur doute de Max.", ai_description: "Max seul dans la neige." }),
    ]);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("transformed-all"));
    await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "seen" });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain('id=transformed-all | titre="transformed-all" | type=mid_conversation | priorité=? | thèmes=[—] | contexte="Quand le joueur doute de Max." | description="Max seul dans la neige."');
    expect(prompt).toContain("dont le `contexte`");
    expect(prompt).not.toContain("recoupe les `themes` d'une vidéo disponible");
  });
});

describe("Game Master PRD4 — videos the player watched (lot 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoTriggersCached).mockResolvedValue(catalog);
  });

  it("receives the watched videos block verbatim, shared with the character", async () => {
    const watched = formatWatchedVideos([
      watchedVideoFrom({ id: "feu", title: "Emma regard feu avec Max", description: null, ai_description: "Emma fixe les flammes." }, 4, false),
      watchedVideoFrom({ id: "neige", title: "Max lampe perdu dans la neige", description: null, ai_description: "Max cherche dans la neige." }, 7, true),
    ]);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("transformed-all"));
    await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "seen", watchedVideos: watched });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain(`## VIDÉOS DÉJÀ VUES PAR LE JOUEUR (données ; une allusion du joueur à une scène peut viser l'une d'elles)\n${watched}\n`);
    expect(watched).toContain("(tour 7, passée avant la fin)");
  });

  it("says none when nothing has been watched", async () => {
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce(gmReply("transformed-all"));
    await evaluatePostTurnPRD4({ ...baseInput, experiencePath: "seen" });
    const prompt = String(vi.mocked(callLLMWithUsage).mock.calls[0][0][1].content);
    expect(prompt).toContain("## VIDÉOS DÉJÀ VUES PAR LE JOUEUR (données ; une allusion du joueur à une scène peut viser l'une d'elles)\n(aucune)");
  });
});

describe("Game Master PRD4 — built-in video rule", () => {
  it("chooses by meaning, context first, themes no longer the only criterion", () => {
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).toContain("choix au sens");
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).toContain("Appuie-toi d'abord sur `contexte`");
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).toContain("Un thème commun ne suffit pas");
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).not.toContain("Si `labels.themes` est vide, retourne null");
    expect(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT).toContain('"trigger_video_id": string | null');
  });

  it("keeps the prepared published replacement identical to the built-in rule", () => {
    const start = EXPERIENCE_DIRECTOR_SYSTEM_PROMPT.indexOf('Règles "trigger_video_id"');
    const rule = EXPERIENCE_DIRECTOR_SYSTEM_PROMPT.slice(start, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT.indexOf('\n\nRègles "action"', start));
    expect(rule.length).toBeGreaterThan(500);
    expect(publishedReplacement).toContain(rule);
  });
});
