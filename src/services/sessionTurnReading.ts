/**
 * Reads what a session history can show under a reply.
 * Chunks and model settings come only from a stored diagnostic trace.
 * A normal session has none of those rows: the reader says so and stops.
 */

export const UNTRACED_CHUNKS_SENTENCE = "Chunks et paramètres du modèle non enregistrés pour cette session";

/** A user turn whose journal has no character message after it. */
export const MISSING_CHARACTER_REPLY = "Réponse du personnage non enregistrée pour ce tour.";

export interface TurnLabelSource {
  themes?: string[] | null;
  topics?: string[] | null;
  intentions?: string[] | null;
}

/** Themes, keywords and intentions actually stored on the turn. Empty lists stay silent. */
export function labelSummary(labels: TurnLabelSource | null | undefined): string | null {
  if (!labels) return null;
  const parts: string[] = [];
  const themes = (labels.themes ?? []).map((value) => value.trim()).filter(Boolean);
  const topics = (labels.topics ?? []).map((value) => value.trim()).filter(Boolean);
  const intentions = (labels.intentions ?? []).map((value) => value.trim()).filter(Boolean);
  if (themes.length) parts.push(`Thèmes : ${themes.join(", ")}`);
  if (topics.length) parts.push(`Mots-clés : ${topics.join(", ")}`);
  if (intentions.length) parts.push(`Intentions : ${intentions.join(", ")}`);
  return parts.length ? parts.join(" · ") : null;
}

const EXCERPT_LENGTH = 160;

export interface RagChunkView {
  sourceId: string;
  scoreLabel: string;
  excerpt: string;
}

export interface ModelRequestView {
  model: string;
  temperature: number | null;
}

export interface TurnTraceView {
  turnIndex: number;
  characterName: string;
  chunks: RagChunkView[];
  model: ModelRequestView | null;
  /** Rewritten RAG query when the trace stored one. Never invented. */
  search: string | null;
}

export interface TtsReading {
  emotion: string | null;
  speechState: string | null;
  model: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function excerptOf(content: unknown, max = EXCERPT_LENGTH): string {
  if (typeof content !== "string") return "";
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}

function scoreLabel(match: Record<string, unknown>): string {
  const rerank = finite(match.rerank_score);
  if (rerank != null) return `rerang ${formatScore(rerank)}`;
  const similarity = finite(match.similarity);
  if (similarity != null) return `similarité ${formatScore(similarity)}`;
  return "score non enregistré";
}

function formatScore(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Chunks actually stored on the trace. An absent or malformed list is empty. */
export function chunksFromMatches(matches: unknown): RagChunkView[] {
  if (!Array.isArray(matches)) return [];
  const chunks: RagChunkView[] = [];
  for (const item of matches) {
    const match = asRecord(item);
    if (!match) continue;
    const sourceId = textOrNull(match.source_id) ?? textOrNull(match.id) ?? "";
    const excerpt = excerptOf(match.content);
    if (!sourceId && !excerpt) continue;
    chunks.push({
      sourceId: sourceId || "source inconnue",
      scoreLabel: scoreLabel(match),
      excerpt,
    });
  }
  return chunks;
}

export function modelFromSettings(settings: unknown): ModelRequestView | null {
  const record = asRecord(settings);
  const model = textOrNull(record?.model);
  if (!model) return null;
  return { model, temperature: finite(record?.temperature) };
}

export function formatModelRequest(model: ModelRequestView | null): string | null {
  if (!model) return null;
  return model.temperature == null
    ? `Modèle demandé : ${model.model}`
    : `Modèle demandé : ${model.model} · température ${formatScore(model.temperature)}`;
}

/**
 * Accepts either the narrow admin select (`matches` / `settings` JSON paths)
 * or a full `trace` object. Never fills a missing field from somewhere else.
 */
function searchFromRequest(request: unknown): string | null {
  const record = asRecord(request);
  return textOrNull(record?.rewrittenQuery) ?? textOrNull(record?.searchInput);
}

export function readTurnTrace(row: {
  turn_index?: unknown;
  character_name?: unknown;
  matches?: unknown;
  settings?: unknown;
  search?: unknown;
  trace?: unknown;
}): TurnTraceView | null {
  const turnIndex = finite(row.turn_index);
  if (turnIndex == null) return null;
  const trace = asRecord(row.trace);
  const matches = row.matches !== undefined ? row.matches : asRecord(trace?.rag)?.matches;
  const settings = row.settings !== undefined ? row.settings : asRecord(trace?.maxCall)?.requestedSettings;
  const request = row.search !== undefined ? row.search : asRecord(trace?.rag)?.request;
  return {
    turnIndex,
    characterName: typeof row.character_name === "string" ? row.character_name : "",
    chunks: chunksFromMatches(matches),
    model: modelFromSettings(settings),
    search: searchFromRequest(request),
  };
}

export function tracesForTurn(traces: readonly TurnTraceView[], turn: number): TurnTraceView[] {
  return traces.filter((trace) => trace.turnIndex === turn);
}

export function readTtsMetadata(metadata: unknown): TtsReading | null {
  const record = asRecord(metadata);
  if (!record) return null;
  const reading: TtsReading = {
    emotion: textOrNull(record.performance_emotion),
    speechState: textOrNull(record.performance_speech_state),
    model: textOrNull(record.model),
  };
  if (!reading.emotion && !reading.speechState && !reading.model) return null;
  return reading;
}

/** Last readable TTS row for a turn wins, keeping an earlier emotion if a later row omits it. */
export function indexTtsByTurn(rows: ReadonlyArray<{ turn_index?: unknown; metadata_json?: unknown }>): Map<number, TtsReading> {
  const map = new Map<number, TtsReading>();
  for (const row of rows) {
    const turn = finite(row.turn_index);
    const reading = readTtsMetadata(row.metadata_json);
    if (turn == null || !reading) continue;
    const previous = map.get(turn);
    map.set(turn, {
      emotion: reading.emotion ?? previous?.emotion ?? null,
      speechState: reading.speechState ?? previous?.speechState ?? null,
      model: reading.model ?? previous?.model ?? null,
    });
  }
  return map;
}

export function replyContextLine(parts: {
  speechState?: string | null;
  playedState?: string | null;
  gmToCharacter?: string | null;
  tts?: TtsReading | null;
  face?: string | null;
}): string | null {
  const bits: string[] = [];
  if (parts.speechState) bits.push(`État de parole : ${parts.speechState}`);
  if (parts.playedState) bits.push(`État joué : ${parts.playedState}`);
  if (parts.gmToCharacter) bits.push(`GM → personnage : ${parts.gmToCharacter}`);
  if (parts.tts?.emotion) bits.push(`Émotion de jeu : ${parts.tts.emotion}`);
  if (parts.tts?.speechState) bits.push(`Parole TTS : ${parts.tts.speechState}`);
  if (parts.tts?.model) bits.push(`Voix : ${parts.tts.model}`);
  if (parts.face) bits.push(`Visage : ${parts.face}`);
  return bits.length ? bits.join(" · ") : null;
}
