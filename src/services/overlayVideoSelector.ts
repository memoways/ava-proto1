/**
 * Overlay cinematic selection (« Superposer à la réponse »).
 *
 * The Game Master judges a turn only once its reply has been heard (post-turn,
 * on the delivery receipt): its cinematic decision always arrives after the
 * reply it would illustrate. Overlay mode therefore asks a short, dedicated
 * question as soon as the reply text exists — while the voice starts — : which
 * of the already allowed videos shows what this reply says, if any?
 *
 * Bounded and optional: one small call, a strict deadline, JSON only, an id that
 * must belong to the candidates, a minimum confidence. Anything else means « no
 * video »: the reply simply stays as it is.
 */
import { formatVideoCandidateLine } from "@/services/videoCandidateLine";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Selection must answer within this delay after the reply text, or the reply goes on alone. */
export const OVERLAY_SELECTION_TIMEOUT_MS = 2_000;
/** Below this confidence the video is not shown. */
export const OVERLAY_MIN_CONFIDENCE = 0.6;
/** Candidates sent to the selector (eligible, allowed now), ordered by priority. */
export const OVERLAY_MAX_CANDIDATES = 12;
const REPLY_MAX_CHARS = 1_200;
const USER_MAX_CHARS = 400;

export type OverlaySelection =
  | { status: "selected"; videoId: string; confidence: number; reason: string; latencyMs: number }
  | { status: "none" | "low_confidence" | "invalid" | "timeout" | "error" | "no_candidates"; latencyMs: number; detail?: string };

export interface OverlaySelectionInput {
  replyText: string;
  userMessage: string;
  characterName: string;
  candidates: VideoTriggerRow[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type OverlaySelectorLLM = (messages: Message[], options: { signal?: AbortSignal; timeoutMs: number }) => Promise<string>;

export const OVERLAY_SELECTOR_SYSTEM_PROMPT = `Tu choisis une vidéo à montrer PENDANT que le personnage prononce sa réplique : la vidéo remplace son image le temps de la réplique.
Règles :
- Choisis uniquement parmi les VIDÉOS CANDIDATES. Elles sont déjà autorisées pour ce moment.
- La vidéo doit montrer ou prolonger ce que dit la réplique (lieu, personne, souvenir, situation précise). Appuie-toi d'abord sur \`contexte\`, puis \`description\`, puis \`thèmes\`.
- Un thème commun ne suffit pas. Si aucune vidéo ne correspond clairement à la réplique, retourne null : jamais de vidéo par défaut.
- À pertinence égale, la priorité la plus haute (nombre le plus petit).
Réponds uniquement en JSON : {"videoId": string | null, "confidence": nombre 0..1, "reason": courte phrase}.`;

function cap(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function orderOverlayCandidates(videos: VideoTriggerRow[]): VideoTriggerRow[] {
  return [...videos]
    .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))
    .slice(0, OVERLAY_MAX_CANDIDATES);
}

export function buildOverlaySelectorMessages(input: Pick<OverlaySelectionInput, "replyText" | "userMessage" | "characterName" | "candidates">): Message[] {
  const lines = orderOverlayCandidates(input.candidates).map(formatVideoCandidateLine).join("\n");
  return [
    { role: "system", content: OVERLAY_SELECTOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: `JOUEUR : « ${cap(input.userMessage, USER_MAX_CHARS)} »
RÉPLIQUE DE ${input.characterName.toUpperCase()} (en cours) : « ${cap(input.replyText, REPLY_MAX_CHARS)} »

VIDÉOS CANDIDATES :
${lines}

Retourne le JSON.`,
    },
  ];
}

/** Strict reading of the selector answer; anything unexpected is « no video ». */
export function parseOverlaySelection(raw: string, candidateIds: readonly string[]):
  { status: "selected"; videoId: string; confidence: number; reason: string }
  | { status: "none" | "low_confidence" | "invalid"; detail?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { status: "invalid", detail: "no_json" };
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return { status: "invalid", detail: "bad_json" }; }
  if (!parsed || typeof parsed !== "object") return { status: "invalid", detail: "not_object" };
  const value = parsed as { videoId?: unknown; confidence?: unknown; reason?: unknown };
  if (value.videoId == null || value.videoId === "") return { status: "none" };
  if (typeof value.videoId !== "string" || !candidateIds.includes(value.videoId)) return { status: "invalid", detail: "unknown_video" };
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? Math.min(1, Math.max(0, value.confidence)) : 0;
  if (confidence < OVERLAY_MIN_CONFIDENCE) return { status: "low_confidence", detail: String(confidence) };
  const reason = typeof value.reason === "string" ? cap(value.reason, 200) : "";
  return { status: "selected", videoId: value.videoId, confidence, reason };
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
    const parsed = parseOverlaySelection(answer, input.candidates.map((video) => video.id));
    return { ...parsed, latencyMs: elapsed() };
  } catch (error) {
    if (controller.signal.reason === "overlay-selection-timeout") return { status: "timeout", latencyMs: elapsed() };
    return { status: "error", latencyMs: elapsed(), detail: error instanceof Error ? error.message.slice(0, 120) : "error" };
  } finally {
    if (timer) clearTimeout(timer);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}
