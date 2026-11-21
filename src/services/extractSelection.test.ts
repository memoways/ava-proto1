import { describe, expect, it } from "vitest";
import { extractDefaults, type ExtractSettings } from "@/services/settingsService";
import {
  buildExtractPostVideoContext,
  buildExtractSelectorMessages,
  extractDecisionBlockedReason,
  extractPresentation,
  extractUsability,
  formatExtractCandidateLine,
  orderExtractCandidates,
  parseExtractSelection,
  selectExtract,
  selectExtractCandidates,
  type ExtractVideo,
} from "./extractSelection";
import { selectEligibleVideos } from "./videoEligibility";
import { formatWatchedVideos, watchedVideoFrom } from "./watchedVideoMemory";

function extract(overrides: Partial<ExtractVideo> & { id: string }): ExtractVideo {
  return {
    title: "Le procès-verbal", nature: "extract", characters: ["all"], video_url: "https://cdn/x.mp4", context: null,
    description: "Un policier lit le procès-verbal de l'interrogatoire devant la famille.", ai_description: null, themes: [],
    priority: 1, transcription: null, dialogue: "silent", transcription_verified: false, ...overrides,
  };
}
const settings: ExtractSettings = { ...extractDefaults, ENABLED: true, MIN_TURNS_BEFORE_FIRST: 2, MIN_TURNS_BETWEEN: 2 };
const base = { path: "unseen" as const, character: "max", shownVideoIds: [] as string[], settings, userTurn: 3, lastExtractTurn: null };
const spokenVerified = extract({ id: "a", dialogue: "spoken", transcription: "Vous avez signé le procès-verbal, monsieur.", transcription_verified: true });

describe("extract usability", () => {
  it("accepts silent and verified spoken extracts only", () => {
    const input = { character: "max", shownVideoIds: [], requireVerifiedTranscript: true };
    expect(extractUsability(extract({ id: "s" }), input)).toBe("usable");
    expect(extractUsability(spokenVerified, input)).toBe("usable");
    expect(extractUsability(extract({ id: "u", dialogue: "spoken", transcription: "texte", transcription_verified: false }), input)).toBe("transcript_unreliable");
    expect(extractUsability(extract({ id: "m", dialogue: "spoken", transcription: " ", transcription_verified: true }), input)).toBe("transcript_unreliable");
    expect(extractUsability(extract({ id: "n", dialogue: null }), input)).toBe("transcript_unreliable");
  });
  it("accepts an unverified transcription only when the setting allows it", () => {
    const unverified = extract({ id: "u", dialogue: "spoken", transcription: "texte", transcription_verified: false });
    expect(extractUsability(unverified, { character: "max", shownVideoIds: [], requireVerifiedTranscript: false })).toBe("usable");
  });
  it("rejects shown, medialess, other-character and non-extract videos", () => {
    const input = { character: "max", shownVideoIds: ["a"], requireVerifiedTranscript: true };
    expect(extractUsability(spokenVerified, input)).toBe("already_shown");
    expect(extractUsability(extract({ id: "b", video_url: "" }), input)).toBe("no_media");
    expect(extractUsability(extract({ id: "c", characters: ["emma"] }), input)).toBe("other_character");
    expect(extractUsability(extract({ id: "d", nature: "transformed" }), input)).toBe("not_extract");
  });
  it("silent plays over the voice, spoken after it", () => {
    expect(extractPresentation(extract({ id: "s" }))).toBe("overlay");
    expect(extractPresentation(spokenVerified)).toBe("interrupt");
  });
});

describe("extract candidates and frequency", () => {
  it("only the unseen path, with the extracts' own frequency rules", () => {
    const videos = [extract({ id: "s" })];
    expect(selectExtractCandidates(videos, { ...base, path: "seen" })).toMatchObject({ ok: false, reason: "extract_film_seen_path" });
    expect(selectExtractCandidates(videos, { ...base, settings: { ...settings, ENABLED: false } })).toMatchObject({ ok: false, reason: "extracts_disabled" });
    expect(selectExtractCandidates(videos, { ...base, userTurn: 1 })).toMatchObject({ ok: false, reason: "extract_first_turn" });
    expect(selectExtractCandidates(videos, { ...base, userTurn: 3, lastExtractTurn: 2 })).toMatchObject({ ok: false, reason: "extract_spacing" });
    expect(selectExtractCandidates(videos, { ...base, settings: { ...settings, MAX_PER_SESSION: 1 }, shownVideoIds: ["s"], userTurn: 9 }))
      .toMatchObject({ ok: false, reason: "extract_session_maximum" });
    expect(selectExtractCandidates(videos, base)).toMatchObject({ ok: true });
  });
  it("without usable extract (transcription absent), nothing is offered and the reasons are counted", () => {
    const result = selectExtractCandidates([extract({ id: "u", dialogue: null })], base);
    expect(result).toMatchObject({ ok: false, reason: "extract_no_usable_candidate", skippedByReason: { transcript_unreliable: 1 } });
  });
  it("an already shown extract is not offered again", () => {
    const result = selectExtractCandidates([extract({ id: "s" }), extract({ id: "t" })], { ...base, shownVideoIds: ["s"] });
    expect(result.ok && result.candidates.map((v) => v.id)).toEqual(["t"]);
  });
});

describe("pool switch", () => {
  const cinematic = { id: "t", type: "transformed", nature: "transformed" as const, characters: [] as string[] };
  const ext = { id: "e", type: "extract", nature: "extract" as const, characters: [] as string[] };
  const input = { path: "unseen" as const, currentCharacter: "max", playedVideoIds: [], extractsShown: 0, minExtractsBeforeCinematic: 2 };
  it("unchanged while the switch is off", () => {
    expect(selectEligibleVideos([cinematic, ext], input).map((v) => v.id)).toEqual(["e"]);
  });
  it("extracts leave the cinematic pool in one switch, whatever the minimum", () => {
    expect(selectEligibleVideos([cinematic, ext], { ...input, extractsSeparate: true }).map((v) => v.id)).toEqual(["t"]);
    expect(selectEligibleVideos([cinematic, ext], { ...input, extractsSeparate: true, minExtractsBeforeCinematic: 0 }).map((v) => v.id)).toEqual(["t"]);
  });
});

describe("selection prompt", () => {
  it("tells apart what is shown and what is said, and lists shown extracts", () => {
    const line = formatExtractCandidateLine(spokenVerified, "v1");
    expect(line).toContain('montre="Un policier');
    expect(line).toContain('dit="Vous avez signé');
    expect(formatExtractCandidateLine(extract({ id: "s" }), "v2")).toContain("extrait silencieux");
    const messages = buildExtractSelectorMessages({ replyText: "Il a signé quelque chose.", userMessage: "Qu'a-t-il signé ?", characterName: "Max",
      candidates: [spokenVerified], shown: [{ title: "Le couteau", summary: "Un couteau sur la table." }] });
    expect(messages[1].content).toContain("EXTRAITS DÉJÀ MONTRÉS");
    expect(messages[1].content).toContain("Le couteau");
    expect(messages[0].content).toContain("APPORTER");
  });
  it("orders by priority", () => {
    expect(orderExtractCandidates([extract({ id: "x", priority: 3 }), extract({ id: "y", priority: 1 })]).map((v) => v.id)).toEqual(["y", "x"]);
  });
});

describe("selection answer", () => {
  const ctx = { replyText: "Il a signé le procès-verbal sans le lire.", userMessage: "Qu'est-ce qui s'est passé au commissariat ?" };
  const answer = (patch: Record<string, unknown>) => JSON.stringify({ videoId: "v1", confidence: 0.9,
    replyCue: "signé le procès-verbal", videoCue: "lit le procès-verbal", complement: "on voit la scène de la signature elle-même", ...patch });
  it("selects a relevant extract with a concrete link and a complement", () => {
    expect(parseExtractSelection(answer({}), [spokenVerified], ctx, ["Max"])).toMatchObject({ status: "selected", videoId: "a" });
  });
  it("a shared theme without a concrete link is refused", () => {
    expect(parseExtractSelection(answer({ replyCue: "famille", videoCue: "famille" }), [spokenVerified], ctx, ["Max"]).status).toBe("weak_link");
  });
  it("an extract that adds nothing is refused", () => {
    expect(parseExtractSelection(answer({ complement: "" }), [spokenVerified], ctx, ["Max"]).status).toBe("no_complement");
  });
  it("low confidence, null and unknown ids never select", () => {
    expect(parseExtractSelection(answer({ confidence: 0.4 }), [spokenVerified], ctx).status).toBe("low_confidence");
    expect(parseExtractSelection('{"videoId": null}', [spokenVerified], ctx).status).toBe("none");
    expect(parseExtractSelection(answer({ videoId: "v9" }), [spokenVerified], ctx).status).toBe("invalid");
    expect(parseExtractSelection("pas du json", [spokenVerified], ctx).status).toBe("invalid");
  });
  it("end to end: presentation follows the dialogue; timeout and errors mean no extract", async () => {
    const ok = await selectExtract({ ...ctx, characterName: "Max", candidates: [spokenVerified] }, async () => answer({}));
    expect(ok).toMatchObject({ status: "selected", presentation: "interrupt" });
    const silent = await selectExtract({ ...ctx, characterName: "Max", candidates: [extract({ id: "s" })] }, async () => answer({}));
    expect(silent).toMatchObject({ status: "selected", presentation: "overlay" });
    const slow = await selectExtract({ ...ctx, characterName: "Max", candidates: [spokenVerified], timeoutMs: 20 }, () => new Promise<string>(() => {}));
    expect(slow.status).toBe("timeout");
    const failing = await selectExtract({ ...ctx, characterName: "Max", candidates: [spokenVerified] }, async () => { throw new Error("boom"); });
    expect(failing.status).toBe("error");
  });
});

describe("late or misattached decision", () => {
  const ok = { turnIsCurrent: true, replyInFlight: true, sameCharacter: true, transitionIdle: true, alreadyShown: false,
    enoughSpeechForOverlay: true, presentation: "interrupt" as const };
  it("applies only to the current turn, character and an idle transition", () => {
    expect(extractDecisionBlockedReason(ok)).toBeNull();
    expect(extractDecisionBlockedReason({ ...ok, turnIsCurrent: false })).toBe("extract_other_turn");
    expect(extractDecisionBlockedReason({ ...ok, sameCharacter: false })).toBe("extract_other_character");
    expect(extractDecisionBlockedReason({ ...ok, replyInFlight: false })).toBe("extract_reply_over");
    expect(extractDecisionBlockedReason({ ...ok, transitionIdle: false })).toBe("extract_video_overlap");
    expect(extractDecisionBlockedReason({ ...ok, alreadyShown: true })).toBe("extract_already_shown");
  });
  it("a silent extract also needs enough speech to cover; a spoken one does not", () => {
    expect(extractDecisionBlockedReason({ ...ok, presentation: "overlay", enoughSpeechForOverlay: false })).toBe("extract_reply_too_short");
    expect(extractDecisionBlockedReason({ ...ok, enoughSpeechForOverlay: false })).toBeNull();
  });
});

describe("resumption", () => {
  it("restates the question and only what was really broadcast", () => {
    const full = buildExtractPostVideoContext(spokenVerified, { question: "Qu'a-t-il signé ?", partial: false });
    expect(full).toContain("Qu'a-t-il signé ?");
    expect(full).toContain("Vous avez signé le procès-verbal");
    const partial = buildExtractPostVideoContext(spokenVerified, { question: "Qu'a-t-il signé ?", partial: true });
    expect(partial).not.toContain("Vous avez signé le procès-verbal");
    expect(partial).toContain("interrompu");
  });
  it("watched memory keeps what was said for a heard spoken extract only", () => {
    const heard = watchedVideoFrom(spokenVerified, 3, false, { transcription: spokenVerified.transcription });
    expect(formatWatchedVideos([heard])).toContain("dit : « Vous avez signé");
    const cut = watchedVideoFrom(spokenVerified, 3, true, { transcription: spokenVerified.transcription });
    expect(formatWatchedVideos([cut])).not.toContain("dit :");
    expect(formatWatchedVideos([watchedVideoFrom(spokenVerified, 3, false)])).not.toContain("dit :");
  });
});
