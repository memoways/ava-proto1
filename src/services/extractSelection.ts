/**
 * Film extracts as video answers (« film pas vu » path, extracts lot 2).
 *
 * A mechanism of its own, separate from the cinematics (own settings, own
 * candidates, own selection call). One switch, `ExtractSettings.ENABLED`, moves
 * the extracts out of the cinematic pool (see `selectEligibleVideos`).
 *
 * - Candidates: extracts with a media, playable for the character, not shown yet,
 *   with a reliable transcript status (silent, or spoken + verified transcription).
 * - Selection: one bounded call as soon as the reply text exists (like the overlay
 *   selector). The question, the recent exchanges and the extracts already shown
 *   are given; what the extract SHOWS (description) and what it SAYS (transcription)
 *   are told apart. A shared theme is not enough: the extract must bring something
 *   the reply does not already say (`complement`), and the reply cue must be a
 *   concrete link.
 * - Presentation: spoken → after the reply, with its own sound (no double speech);
 *   silent → laid over the voice (overlay).
 * - A decision that arrives late, for another turn, character or call, or while
 *   another video is on, is dropped (`extractDecisionBlockedReason`).
 */
import { extractTranscriptStatus } from "../../supabase/functions/_shared/videoMetadata";
import type { CinematicPresentation } from "@/services/cinematicTransition";
import type { ExperiencePath } from "@/services/experienceFrame";
import { checkOverlayLink, OVERLAY_MIN_CONFIDENCE, overlayShortId, type Message } from "@/services/overlayVideoSelector";
import type { ExtractSettings } from "@/services/settingsService";
import { capVideoText } from "@/services/videoCandidateLine";
import { videoAvailableForCharacter, videoNature } from "@/services/videoEligibility";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export const EXTRACT_MAX_CANDIDATES = 12;
export const EXTRACT_SELECTION_MIN_TIMEOUT_MS = 1_500;
export const EXTRACT_SELECTION_MAX_TIMEOUT_MS = 5_000;
export const EXTRACT_SELECTION_TIMEOUT_MS = 3_500;
export const EXTRACT_SELECTOR_MAX_TOKENS = 160;
export const EXTRACT_MIN_COMPLEMENT_CHARS = 12;
const LINE_TEXT_MAX_CHARS = 200;
const TRANSCRIPT_MAX_CHARS = 320;
const REPLY_MAX_CHARS = 1_000;
const USER_MAX_CHARS = 300;
const HISTORY_LINE_MAX_CHARS = 220;
const CUE_MAX_CHARS = 120;
const SHOWN_LINE_MAX_CHARS = 140;

export type ExtractVideo = Pick<VideoTriggerRow, "id" | "title" | "nature" | "characters" | "video_url" | "context" | "description"
  | "ai_description" | "themes" | "priority" | "transcription" | "dialogue" | "transcription_verified">;

export type ExtractUsability = "usable" | "not_extract" | "no_media" | "other_character" | "already_shown" | "transcript_unreliable";

/** Why one video cannot be offered right now (the first reason found), or "usable". */
export function extractUsability(
  video: ExtractVideo,
  input: { character: string; shownVideoIds: readonly string[]; requireVerifiedTranscript: boolean },
): ExtractUsability {
  if (videoNature(video) !== "extract") return "not_extract";
  if (!video.video_url) return "no_media";
  if (!videoAvailableForCharacter(video, input.character)) return "other_character";
  if (input.shownVideoIds.includes(video.id)) return "already_shown";
  const status = extractTranscriptStatus(video);
  // « unknown » is never silent; a spoken extract without transcription is never usable.
  if (status === "silent" || status === "spoken_verified") return "usable";
  if (status === "spoken_unverified" && !input.requireVerifiedTranscript) return "usable";
  return "transcript_unreliable";
}

export function extractPresentation(video: Pick<ExtractVideo, "dialogue">): CinematicPresentation {
  return video.dialogue === "spoken" ? "interrupt" : "overlay";
}

export type ExtractFrequencyBlock = "extracts_disabled" | "extract_first_turn" | "extract_spacing" | "extract_session_maximum";

/** Frequency rules of the extracts themselves (never those of the cinematics). */
export function extractFrequencyBlock(
  settings: ExtractSettings,
  input: { userTurn: number; lastExtractTurn: number | null; extractsShown: number },
): ExtractFrequencyBlock | null {
  if (!settings.ENABLED) return "extracts_disabled";
  if (input.userTurn < settings.MIN_TURNS_BEFORE_FIRST) return "extract_first_turn";
  if (input.lastExtractTurn != null && input.userTurn - input.lastExtractTurn < settings.MIN_TURNS_BETWEEN) return "extract_spacing";
  if (settings.MAX_PER_SESSION > 0 && input.extractsShown >= settings.MAX_PER_SESSION) return "extract_session_maximum";
  return null;
}

export interface ExtractCandidateInput {
  /** Only the « film pas vu » path (`unseen`) shows extracts. */
  path: ExperiencePath | null | undefined;
  character: string;
  shownVideoIds: readonly string[];
  settings: ExtractSettings;
  userTurn: number;
  lastExtractTurn: number | null;
}

export type ExtractCandidates =
  | { ok: true; candidates: ExtractVideo[]; skippedByReason: Record<string, number> }
  | { ok: false; reason: string; skippedByReason: Record<string, number> };

export function selectExtractCandidates(videos: readonly ExtractVideo[], input: ExtractCandidateInput): ExtractCandidates {
  const skippedByReason: Record<string, number> = {};
  if (input.path !== "unseen") return { ok: false, reason: "extract_film_seen_path", skippedByReason };
  const extracts = videos.filter((video) => videoNature(video) === "extract");
  const extractsShown = extracts.filter((video) => input.shownVideoIds.includes(video.id)).length;
  const block = extractFrequencyBlock(input.settings, { userTurn: input.userTurn, lastExtractTurn: input.lastExtractTurn, extractsShown });
  if (block) return { ok: false, reason: block, skippedByReason };
  const candidates: ExtractVideo[] = [];
  for (const video of extracts) {
    const usability = extractUsability(video, { character: input.character, shownVideoIds: input.shownVideoIds,
      requireVerifiedTranscript: input.settings.REQUIRE_VERIFIED_TRANSCRIPT });
    if (usability === "usable") candidates.push(video);
    else skippedByReason[usability] = (skippedByReason[usability] ?? 0) + 1;
  }
  if (!candidates.length) return { ok: false, reason: "extract_no_usable_candidate", skippedByReason };
  return { ok: true, candidates, skippedByReason };
}

// ── Selection call ───────────────────────────────────────────────────────────

export interface ExtractExchangeLine { speaker: "player" | "character"; text: string }

export interface ExtractSelectionInput {
  replyText: string;
  userMessage: string;
  characterName: string;
  candidates: ExtractVideo[];
  /** Extracts already shown this session (title and what they brought), so a new one must add something. */
  shown?: ReadonlyArray<{ title: string; summary: string }>;
  recentExchanges?: ExtractExchangeLine[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ExtractSelection =
  | { status: "selected"; videoId: string; confidence: number; reason: string; replyCue: string; videoCue: string; complement: string;
    presentation: CinematicPresentation; latencyMs: number }
  | { status: "none" | "low_confidence" | "weak_link" | "no_complement" | "invalid" | "timeout" | "error" | "no_candidates"; latencyMs: number; detail?: string };

export type ExtractSelectorLLM = (messages: Message[], options: { signal?: AbortSignal; timeoutMs: number }) => Promise<string>;

export const EXTRACT_SELECTOR_SYSTEM_PROMPT = `Tu choisis un EXTRAIT DU FILM à montrer au joueur, qui n'a PAS vu le film, en réponse à ce qu'il vient de dire.
Règles :
- Choisis uniquement parmi les EXTRAITS CANDIDATS.
- Pour chaque extrait, « montre » = ce que l'image montre ; « dit » = ce qui est prononcé dans l'extrait (transcription). Ne confonds pas les deux.
- Il faut un lien CONCRET entre la question du joueur / la réplique du personnage et l'extrait : même lieu, même action, même objet, même événement, même parole. Un prénom seul, un thème commun ou une ambiance ne suffisent pas.
- L'extrait doit APPORTER quelque chose que la réplique ne dit pas déjà (une preuve, un détail, une scène à voir). S'il ne ferait que répéter la réplique, retourne null.
- Ne reprends pas un extrait déjà montré, ni un qui apporte la même chose qu'un extrait déjà montré.
- Si aucun extrait ne convient, retourne null : jamais d'extrait par défaut.
Réponds uniquement en JSON, sans autre texte :
{"videoId": "id de l'extrait (ex. v2)" | null, "confidence": nombre 0..1, "replyCue": "mots exacts de la question du joueur ou de la réplique", "videoCue": "mots de « montre » ou « dit » de l'extrait qui y correspondent", "complement": "ce que l'extrait apporte de plus que la réplique"}`;

/** Candidate order: priority, then the most words shared with the question and the reply. */
export function orderExtractCandidates(videos: readonly ExtractVideo[]): ExtractVideo[] {
  return videos
    .map((video, position) => ({ video, position }))
    .sort((a, b) => (a.video.priority ?? Number.MAX_SAFE_INTEGER) - (b.video.priority ?? Number.MAX_SAFE_INTEGER) || a.position - b.position)
    .slice(0, EXTRACT_MAX_CANDIDATES)
    .map((entry) => entry.video);
}

/** One line: what the extract shows and what it says are two distinct fields. */
export function formatExtractCandidateLine(video: ExtractVideo, shortId: string): string {
  const shows = capVideoText(video.description, LINE_TEXT_MAX_CHARS) || capVideoText(video.ai_description, LINE_TEXT_MAX_CHARS);
  const context = capVideoText(video.context, LINE_TEXT_MAX_CHARS);
  const said = video.dialogue === "spoken" ? capVideoText(video.transcription, TRANSCRIPT_MAX_CHARS) : "";
  const themes = (video.themes ?? []).join(", ") || "—";
  return `- id=${shortId} | titre="${capVideoText(video.title, 80)}" | priorité=${video.priority ?? "?"} | thèmes=[${themes}]`
    + (context ? ` | contexte="${context}"` : "")
    + (shows ? ` | montre="${shows}"` : "")
    + (video.dialogue === "spoken" ? ` | dit="${said}"` : " | dit=(rien : extrait silencieux)");
}

function cap(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function buildExtractSelectorMessages(input: Pick<ExtractSelectionInput,
  "replyText" | "userMessage" | "characterName" | "candidates" | "shown" | "recentExchanges">): Message[] {
  const lines = orderExtractCandidates(input.candidates).map((video, index) => formatExtractCandidateLine(video, overlayShortId(index))).join("\n");
  const name = input.characterName.toUpperCase();
  const history = (input.recentExchanges ?? []).map((line) =>
    `${line.speaker === "player" ? "JOUEUR" : name} : « ${cap(line.text, HISTORY_LINE_MAX_CHARS)} »`).join("\n");
  const shown = (input.shown ?? []).map((entry) => `- « ${cap(entry.title, 80)} »${entry.summary ? ` : ${cap(entry.summary, SHOWN_LINE_MAX_CHARS)}` : ""}`).join("\n");
  return [
    { role: "system", content: EXTRACT_SELECTOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: (history ? `ÉCHANGES PRÉCÉDENTS (contexte) :\n${history}\n\n` : "")
        + (shown ? `EXTRAITS DÉJÀ MONTRÉS :\n${shown}\n\n` : "")
        + `JOUEUR : « ${cap(input.userMessage, USER_MAX_CHARS)} »
RÉPLIQUE DE ${name} (en cours) : « ${cap(input.replyText, REPLY_MAX_CHARS)} »

EXTRAITS CANDIDATS :
${lines}

Retourne le JSON.`,
    },
  ];
}

/** The selection may take as long as the reply is still ahead, within bounds. Unknown speech → default wait. */
export function extractSelectionTimeoutMs(remainingSpeechMs: number | null): number {
  if (remainingSpeechMs == null) return EXTRACT_SELECTION_TIMEOUT_MS;
  return Math.min(EXTRACT_SELECTION_MAX_TIMEOUT_MS, Math.max(EXTRACT_SELECTION_MIN_TIMEOUT_MS, Math.round(remainingSpeechMs)));
}

/**
 * Strict reading of the answer. The link is checked against what the extract shows AND says;
 * the player's question counts as much as the reply for the reply cue.
 * `candidates` in prompt order (orderExtractCandidates).
 */
export function parseExtractSelection(
  raw: string,
  candidates: readonly ExtractVideo[],
  context: { replyText: string; userMessage: string },
  extraNames: readonly string[] = [],
): { status: "selected"; videoId: string; confidence: number; reason: string; replyCue: string; videoCue: string; complement: string }
  | { status: "none" | "low_confidence" | "weak_link" | "no_complement" | "invalid"; detail?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { status: "invalid", detail: "no_json" };
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return { status: "invalid", detail: "bad_json" }; }
  if (!parsed || typeof parsed !== "object") return { status: "invalid", detail: "not_object" };
  const value = parsed as { videoId?: unknown; confidence?: unknown; replyCue?: unknown; videoCue?: unknown; complement?: unknown };
  if (value.videoId == null || value.videoId === "") return { status: "none" };
  const id = typeof value.videoId === "string" ? value.videoId.trim() : "";
  const video = candidates.find((candidate, index) => overlayShortId(index) === id.toLowerCase() || candidate.id === id);
  if (!video) return { status: "invalid", detail: "unknown_video" };
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence) ? Math.min(1, Math.max(0, value.confidence)) : 0;
  if (confidence < OVERLAY_MIN_CONFIDENCE) return { status: "low_confidence", detail: String(confidence) };
  const replyCue = typeof value.replyCue === "string" ? capVideoText(value.replyCue, CUE_MAX_CHARS) : "";
  const videoCue = typeof value.videoCue === "string" ? capVideoText(value.videoCue, CUE_MAX_CHARS) : "";
  const complement = typeof value.complement === "string" ? capVideoText(value.complement, 200) : "";
  // The cue may come from the player's question or from the reply.
  const heard = `${context.userMessage} ${context.replyText}`;
  const videoTexts = { title: video.title, context: video.context, description: video.description, ai_description: video.ai_description,
    themes: video.themes, transcription: video.dialogue === "spoken" ? video.transcription : null };
  const link = checkOverlayLink({ replyCue, videoCue, confidence }, heard, videoTexts, extraNames);
  if ("detail" in link) return { status: "weak_link", detail: link.detail };
  if (complement.length < EXTRACT_MIN_COMPLEMENT_CHARS) return { status: "no_complement", detail: "empty_complement" };
  return { status: "selected", videoId: video.id, confidence, reason: `« ${replyCue} » ↔ ${videoCue}`, replyCue, videoCue, complement };
}

export async function selectExtract(input: ExtractSelectionInput, llm: ExtractSelectorLLM, now = () => performance.now()): Promise<ExtractSelection> {
  const startedAt = now();
  const elapsed = () => Math.round(now() - startedAt);
  if (!input.candidates.length || !input.replyText.trim()) return { status: "no_candidates", latencyMs: 0 };
  const timeoutMs = input.timeoutMs ?? EXTRACT_SELECTION_TIMEOUT_MS;
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) return { status: "error", latencyMs: 0, detail: "aborted" };
  input.signal?.addEventListener("abort", abortFromParent, { once: true });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => { controller.abort("extract-selection-timeout"); resolve("timeout"); }, timeoutMs);
  });
  try {
    const answer = await Promise.race([llm(buildExtractSelectorMessages(input), { signal: controller.signal, timeoutMs }), deadline]);
    if (answer === "timeout") return { status: "timeout", latencyMs: elapsed() };
    const ordered = orderExtractCandidates(input.candidates);
    const parsed = parseExtractSelection(answer, ordered, { replyText: input.replyText, userMessage: input.userMessage }, [input.characterName]);
    if (parsed.status !== "selected") return { ...parsed, latencyMs: elapsed() };
    const chosen = ordered.find((video) => video.id === parsed.videoId);
    return { ...parsed, presentation: chosen ? extractPresentation(chosen) : "overlay", latencyMs: elapsed() };
  } catch (error) {
    if (controller.signal.reason === "extract-selection-timeout") return { status: "timeout", latencyMs: elapsed() };
    return { status: "error", latencyMs: elapsed(), detail: error instanceof Error ? error.message.slice(0, 120) : "error" };
  } finally {
    if (timer) clearTimeout(timer);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}

// ── Decision still valid? ────────────────────────────────────────────────────

export interface ExtractDecisionContext {
  /** The turn that was selected for is still the current one (no newer turn, no abort). */
  turnIsCurrent: boolean;
  /** The reply of that turn is still being prepared or spoken. */
  replyInFlight: boolean;
  /** The character on screen is still the one the selection was made for. */
  sameCharacter: boolean;
  /** No other video (cinematic or extract) is waiting or playing. */
  transitionIdle: boolean;
  /** The extract was reserved or shown meanwhile. */
  alreadyShown: boolean;
  /** Silent extracts are laid over the voice: enough speech must remain. */
  enoughSpeechForOverlay: boolean;
  presentation: CinematicPresentation;
}

/** The reason a late or misattached decision is dropped, or null. No waiting, no artificial delay. */
export function extractDecisionBlockedReason(context: ExtractDecisionContext): string | null {
  if (!context.turnIsCurrent) return "extract_other_turn";
  if (!context.sameCharacter) return "extract_other_character";
  if (!context.replyInFlight) return "extract_reply_over";
  if (!context.transitionIdle) return "extract_video_overlap";
  if (context.alreadyShown) return "extract_already_shown";
  if (context.presentation === "overlay" && !context.enoughSpeechForOverlay) return "extract_reply_too_short";
  return null;
}

// ── What the character knows afterwards ──────────────────────────────────────

export const EXTRACT_POST_VIDEO_MAX_CHARS = 900;
export const EXTRACT_SAID_MAX_CHARS = 420;

/**
 * Context for the next turn after an extract was really shown: the question that
 * led to it, what was shown and (spoken) what was said, partial when cut short.
 * Never claims content that was not broadcast.
 */
export function buildExtractPostVideoContext(
  video: Pick<ExtractVideo, "title" | "description" | "ai_description" | "dialogue" | "transcription">,
  options: { question: string; partial: boolean },
): string {
  const shows = capVideoText(video.description, 300) || capVideoText(video.ai_description, 300);
  const said = video.dialogue === "spoken" && !options.partial ? capVideoText(video.transcription, EXTRACT_SAID_MAX_CHARS) : "";
  const lines = [
    `Le joueur vient de voir un extrait du film : « ${capVideoText(video.title, 80)} »${options.partial ? " (interrompu avant la fin)" : ""}.`,
    options.question.trim() ? `Il avait demandé : « ${capVideoText(options.question, 200)} ». Reprends le fil de cette question sans la répéter.` : "",
    shows ? `Ce que l'extrait montrait : ${shows}` : "",
    said ? `Ce qui y était dit : « ${said} »` : "",
    options.partial && video.dialogue === "spoken" ? "Il n'a entendu que le début : ne lui attribue pas la suite." : "",
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length <= EXTRACT_POST_VIDEO_MAX_CHARS ? text : `${text.slice(0, EXTRACT_POST_VIDEO_MAX_CHARS - 1).trimEnd()}…`;
}
