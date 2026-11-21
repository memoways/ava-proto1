/**
 * Overlay cinematic selection (« Superposer à la réponse »).
 *
 * The Game Master judges a turn only once its reply has been heard (post-turn,
 * on the delivery receipt): its cinematic decision always arrives after the
 * reply it would illustrate. Overlay mode therefore asks a short, dedicated
 * question as soon as the reply text exists — while the voice starts — : which
 * of the already allowed videos shows what this reply says, if any?
 *
 * Bounded and optional: one small call, a deadline taken from the speech still
 * to come, JSON only, an id that must belong to the candidates, a minimum
 * confidence and a concrete link quoted from the reply (lot 2: a first name or a
 * shared theme alone is not a link). Anything else means « no video ».
 */
import { capVideoText, formatCompactVideoCandidateLine } from "@/services/videoCandidateLine";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Longest wait for an answer, even when the reply is long (lot 2 measures: 2 s lost 20 selections out of 22). */
export const OVERLAY_SELECTION_MAX_TIMEOUT_MS = 5_000;
/** Shortest useful wait: below it the selection is not even started (the reply is too short anyway). */
export const OVERLAY_SELECTION_MIN_TIMEOUT_MS = 1_200;
/** Wait used when the remaining speech cannot be estimated. */
export const OVERLAY_SELECTION_TIMEOUT_MS = 3_000;
/** Below this confidence the video is not shown. */
export const OVERLAY_MIN_CONFIDENCE = 0.7;
/** Candidates sent to the selector (eligible, allowed now), ordered by priority. */
export const OVERLAY_MAX_CANDIDATES = 16;
/** Previous exchanges given to the selector so it understands what the reply answers. */
export const OVERLAY_RECENT_EXCHANGES = 2;
/** Output budget: the JSON answer only (reasoning is disabled for this call). */
export const OVERLAY_SELECTOR_MAX_TOKENS = 120;
const REPLY_MAX_CHARS = 1_000;
const USER_MAX_CHARS = 300;
const HISTORY_LINE_MAX_CHARS = 220;
const CUE_MAX_CHARS = 120;

export type OverlaySelection =
  | { status: "selected"; videoId: string; confidence: number; reason: string; replyCue: string; videoCue: string; latencyMs: number }
  | { status: "none" | "low_confidence" | "weak_link" | "invalid" | "timeout" | "error" | "no_candidates"; latencyMs: number; detail?: string };

export interface OverlayExchangeLine {
  speaker: "player" | "character";
  text: string;
}

export interface OverlaySelectionInput {
  replyText: string;
  userMessage: string;
  characterName: string;
  candidates: VideoTriggerRow[];
  /** Lines said before this turn, oldest first (see recentOverlayExchanges). */
  recentExchanges?: OverlayExchangeLine[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type OverlaySelectorLLM = (messages: Message[], options: { signal?: AbortSignal; timeoutMs: number }) => Promise<string>;

export const OVERLAY_SELECTOR_SYSTEM_PROMPT = `Tu choisis une vidéo à montrer PENDANT que le personnage prononce sa réplique : la vidéo remplace son image le temps de la réplique.
Règles :
- Choisis uniquement parmi les VIDÉOS CANDIDATES. Elles sont déjà autorisées pour ce moment.
- Il faut un lien CONCRET entre ce que dit la réplique MAINTENANT et ce que montre ou raconte la vidéo (\`contexte\`, puis \`description\`) : même lieu, même action, même objet, même événement ou souvenir précis.
- Un prénom seul ne suffit pas (le personnage parle sans cesse de sa famille). Un thème commun ou une ambiance ne suffisent pas.
- Les échanges précédents servent seulement à comprendre la réplique ; le lien doit être dans la réplique.
- Si aucun lien concret n'existe, retourne null : jamais de vidéo par défaut. À pertinence égale, la priorité la plus haute (nombre le plus petit).
Réponds uniquement en JSON, sans autre texte :
{"videoId": "id de la vidéo (ex. v3)" | null, "confidence": nombre 0..1, "replyCue": "mots exacts de la réplique", "videoCue": "élément de la vidéo qui y correspond"}`;

function cap(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Prompt order: priority first; at equal priority, the videos whose own texts share
 * the most concrete words with the reply (so a cap never drops the obvious match).
 */
export function orderOverlayCandidates(videos: VideoTriggerRow[], replyText = ""): VideoTriggerRow[] {
  const reply = replyText ? cueWords(replyText, []).content : [];
  const overlap = (video: VideoTriggerRow) => {
    if (!reply.length) return 0;
    const index = wordIndex([video.title, video.context, video.description, video.ai_description].filter(Boolean).join(" "));
    return new Set(reply.filter((word) => wordIn(word, index.words, index.stems))).size;
  };
  return videos
    .map((video, position) => ({ video, position, score: overlap(video) }))
    .sort((a, b) => (a.video.priority ?? Number.MAX_SAFE_INTEGER) - (b.video.priority ?? Number.MAX_SAFE_INTEGER)
      || b.score - a.score || a.position - b.position)
    .slice(0, OVERLAY_MAX_CANDIDATES)
    .map((entry) => entry.video);
}

/**
 * The last exchanges before the current turn, from a conversation log
 * (`role` "user" for the player, anything else for a character). The current
 * player line and reply are dropped if the log already holds them.
 */
export function recentOverlayExchanges(
  log: ReadonlyArray<{ role: string; content: string }>,
  current: { userMessage: string; replyText: string },
  exchanges = OVERLAY_RECENT_EXCHANGES,
): OverlayExchangeLine[] {
  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  const lines = log.filter((entry) => typeof entry.content === "string" && entry.content.trim()).map((entry) => ({
    speaker: entry.role === "user" ? "player" as const : "character" as const,
    text: entry.content,
  }));
  if (lines.length && lines[lines.length - 1].speaker === "character" && same(lines[lines.length - 1].text, current.replyText)) lines.pop();
  if (lines.length && lines[lines.length - 1].speaker === "player" && same(lines[lines.length - 1].text, current.userMessage)) lines.pop();
  return lines.slice(-exchanges * 2);
}

/** Short id given to the n-th ordered candidate in the prompt (the model answers with it). */
export function overlayShortId(index: number): string {
  return `v${index + 1}`;
}

export function buildOverlaySelectorMessages(input: Pick<OverlaySelectionInput, "replyText" | "userMessage" | "characterName" | "candidates" | "recentExchanges">): Message[] {
  const lines = orderOverlayCandidates(input.candidates, input.replyText)
    .map((video, index) => formatCompactVideoCandidateLine(video, overlayShortId(index))).join("\n");
  const name = input.characterName.toUpperCase();
  const history = (input.recentExchanges ?? []).map((line) =>
    `${line.speaker === "player" ? "JOUEUR" : name} : « ${cap(line.text, HISTORY_LINE_MAX_CHARS)} »`).join("\n");
  return [
    { role: "system", content: OVERLAY_SELECTOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: (history ? `ÉCHANGES PRÉCÉDENTS (contexte) :\n${history}\n\n` : "")
        + `JOUEUR : « ${cap(input.userMessage, USER_MAX_CHARS)} »
RÉPLIQUE DE ${name} (en cours) : « ${cap(input.replyText, REPLY_MAX_CHARS)} »

VIDÉOS CANDIDATES :
${lines}

Retourne le JSON.`,
    },
  ];
}

/**
 * How long the selection may take: the speech still to come, minus what the
 * overlay itself needs to be worth showing. Unknown speech → the default wait.
 */
export function overlaySelectionTimeoutMs(remainingSpeechMs: number | null, neededToShowMs: number): number {
  if (remainingSpeechMs == null) return OVERLAY_SELECTION_TIMEOUT_MS;
  const budget = Math.round(remainingSpeechMs - neededToShowMs);
  return Math.min(OVERLAY_SELECTION_MAX_TIMEOUT_MS, Math.max(OVERLAY_SELECTION_MIN_TIMEOUT_MS, budget));
}

// ── Concrete link check ──────────────────────────────────────────────────────

const STOPWORD_LIST = ("le la les un une des du de d l au aux et ou mais donc ni car que qui quoi dont ce cet cette ces "
  + "je tu il elle on nous vous ils elles me te se lui leur leurs mon ma mes ton ta tes son sa ses notre nos votre vos "
  + "en y a à dans sur sous par pour avec sans vers chez est sont était été être avoir ai as avait ont fait faire "
  + "fera ferai feras ferait font fais vais va vont peut peux pourra dois doit veux veut sais sait dire dit "
  + "pas plus ne n tout tous toute toutes très bien comme quand si ça cela ceci rien encore déjà même aussi alors "
  + "c s j m t qu").split(" ");
/** First names of the story: never a link on their own. */
const STORY_NAMES = new Set(["max", "emma", "ava", "leo", "léo", "mona", "peter", "lise", "philippe", "rosa"]);

function normalizeWord(word: string): string {
  return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
const STOPWORDS = new Set(STOPWORD_LIST.map(normalizeWord));

/** Content words of a cue; proper names (story names, capitalized words after the first) are counted apart. */
function cueWords(cue: string, extraNames: readonly string[]): { content: string[]; names: string[] } {
  const known = new Set([...STORY_NAMES, ...extraNames.map(normalizeWord)].map(normalizeWord));
  const tokens = cue.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const content: string[] = [];
  const names: string[] = [];
  tokens.forEach((token, index) => {
    const word = normalizeWord(token);
    if (STOPWORDS.has(word) || word.length < 3) return;
    const capitalizedInside = index > 0 && /^\p{Lu}/u.test(token);
    if (known.has(word) || capitalizedInside) names.push(word);
    else content.push(word);
  });
  return { content, names };
}

/** Same word, allowing light inflection (fusil/fusils, ligoté/ligoter): shared stem of 5 letters, or exact short word. */
function wordIn(word: string, haystackWords: ReadonlySet<string>, haystackStems: ReadonlySet<string>): boolean {
  return haystackWords.has(word) || (word.length >= 5 && haystackStems.has(word.slice(0, 5)));
}

function wordIndex(text: string): { words: Set<string>; stems: Set<string> } {
  const words = new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalizeWord));
  return { words, stems: new Set([...words].filter((word) => word.length >= 5).map((word) => word.slice(0, 5))) };
}

/** Above this confidence a link without a shared word (synonym, paraphrase) is still accepted. */
export const OVERLAY_PARAPHRASE_MIN_CONFIDENCE = 0.85;

/**
 * The quoted reply cue must come from the reply and hold a concrete word that is
 * not a first name; the video cue must echo the video's own texts. Reply cue and
 * video then share a concrete word, or the selector is very confident (paraphrase).
 */
export function checkOverlayLink(
  link: { replyCue: string; videoCue: string; confidence: number },
  replyText: string,
  video: Pick<VideoTriggerRow, "title" | "context" | "description" | "ai_description" | "themes"> & { transcription?: string | null },
  extraNames: readonly string[] = [],
): { ok: true } | { ok: false; detail: string } {
  const reply = cueWords(link.replyCue, extraNames);
  if (!reply.content.length) return { ok: false, detail: reply.names.length ? "name_only" : "no_reply_cue" };
  const replyIndex = wordIndex(replyText);
  const inReply = reply.content.filter((word) => wordIn(word, replyIndex.words, replyIndex.stems));
  if (!inReply.length || inReply.length * 2 < reply.content.length) return { ok: false, detail: "cue_not_in_reply" };
  // Themes are labels, not what the video shows: they never make a link.
  // A spoken extract's transcription is what it says: it counts like what it shows.
  const videoText = [video.title, video.context, video.description, video.ai_description, video.transcription].filter(Boolean).join(" ");
  const videoIndex = wordIndex(videoText);
  const fromVideo = cueWords(link.videoCue, extraNames).content;
  if (!fromVideo.some((word) => wordIn(word, videoIndex.words, videoIndex.stems))) return { ok: false, detail: "cue_not_in_video" };
  const shared = inReply.some((word) => wordIn(word, videoIndex.words, videoIndex.stems));
  if (!shared && link.confidence < OVERLAY_PARAPHRASE_MIN_CONFIDENCE) return { ok: false, detail: "no_shared_word" };
  return { ok: true };
}

/**
 * Strict reading of the selector answer; anything unexpected is « no video ».
 * `candidates` must be in prompt order (orderOverlayCandidates with the same reply): « v3 » is the third.
 */
export function parseOverlaySelection(raw: string, candidates: readonly VideoTriggerRow[], replyText: string, extraNames: readonly string[] = []):
  { status: "selected"; videoId: string; confidence: number; reason: string; replyCue: string; videoCue: string }
  | { status: "none" | "low_confidence" | "weak_link" | "invalid"; detail?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { status: "invalid", detail: "no_json" };
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return { status: "invalid", detail: "bad_json" }; }
  if (!parsed || typeof parsed !== "object") return { status: "invalid", detail: "not_object" };
  const value = parsed as { videoId?: unknown; confidence?: unknown; replyCue?: unknown; videoCue?: unknown };
  if (value.videoId == null || value.videoId === "") return { status: "none" };
  const id = typeof value.videoId === "string" ? value.videoId.trim() : "";
  const video = candidates.find((candidate, index) => overlayShortId(index) === id.toLowerCase() || candidate.id === id);
  if (!video) return { status: "invalid", detail: "unknown_video" };
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? Math.min(1, Math.max(0, value.confidence)) : 0;
  if (confidence < OVERLAY_MIN_CONFIDENCE) return { status: "low_confidence", detail: String(confidence) };
  const replyCue = typeof value.replyCue === "string" ? capVideoText(value.replyCue, CUE_MAX_CHARS) : "";
  const videoCue = typeof value.videoCue === "string" ? capVideoText(value.videoCue, CUE_MAX_CHARS) : "";
  const link = checkOverlayLink({ replyCue, videoCue, confidence }, replyText, video, extraNames);
  if ("detail" in link) return { status: "weak_link", detail: link.detail };
  return { status: "selected", videoId: video.id, confidence, reason: `« ${replyCue} » ↔ ${videoCue}`, replyCue, videoCue };
}

export async function selectOverlayVideo(input: OverlaySelectionInput, llm: OverlaySelectorLLM, now = () => performance.now()): Promise<OverlaySelection> {
  const startedAt = now();
  const elapsed = () => Math.round(now() - startedAt);
  if (!input.candidates.length || !input.replyText.trim()) return { status: "no_candidates", latencyMs: 0 };
  const timeoutMs = input.timeoutMs ?? OVERLAY_SELECTION_TIMEOUT_MS;
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) return { status: "error", latencyMs: 0, detail: "aborted" };
  input.signal?.addEventListener("abort", abortFromParent, { once: true });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => { controller.abort("overlay-selection-timeout"); resolve("timeout"); }, timeoutMs);
  });
  try {
    const answer = await Promise.race([
      llm(buildOverlaySelectorMessages(input), { signal: controller.signal, timeoutMs }),
      deadline,
    ]);
    if (answer === "timeout") return { status: "timeout", latencyMs: elapsed() };
    const parsed = parseOverlaySelection(answer, orderOverlayCandidates(input.candidates, input.replyText), input.replyText, [input.characterName]);
    return { ...parsed, latencyMs: elapsed() };
  } catch (error) {
    if (controller.signal.reason === "overlay-selection-timeout") return { status: "timeout", latencyMs: elapsed() };
    return { status: "error", latencyMs: elapsed(), detail: error instanceof Error ? error.message.slice(0, 120) : "error" };
  } finally {
    if (timer) clearTimeout(timer);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}
