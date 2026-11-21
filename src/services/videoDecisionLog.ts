/**
 * Read-only journal of video decisions (cinematics and extracts).
 *
 * The game keeps writing the same events. This module only shapes what is
 * stored (bounded payload fields) and what the admin tab reads back.
 * Older events, written before these fields existed, still render.
 */
import { supabase } from "@/integrations/supabase/client";
import { isMissingVideoLabelColumnError } from "../../supabase/functions/_shared/videoVocabulary";
import {
  interpretVocabularyRead,
  isOutsideList,
  vocabularyFromRows,
  type VideoLabelLists,
  type VocabularyLoad,
} from "@/services/videoLabelVocabulary";

export const VIDEO_DECISION_CANDIDATE_LIMIT = 16;
export const VIDEO_DECISION_TITLE_MAX = 80;
export const VIDEO_DECISION_REPLY_MAX = 300;
export const VIDEO_DECISION_USER_MAX = 200;

export const CINEMATIC_EVENT_TYPES = [
  "cinematic_recommended",
  "cinematic_played",
  "cinematic_completed",
  "cinematic_blocked",
  "cinematic_skipped",
] as const;

export type VideoMechanism = "overlay" | "extract" | "game_master";
export type MechanismFilter = "all" | VideoMechanism;

/** French labels for every blocked reason the three decision paths already emit. */
export const BLOCKED_REASON_LABELS: Record<string, string> = {
  cinematic_cooldown: "espacement trop court",
  cinematic_disabled: "cinématiques désactivées",
  cinematic_unavailable: "vidéo indisponible",
  cinematic_already_played: "déjà jouée",
  cinematic_limit_reached: "maximum de vidéos atteint",
  ineligible: "hors parcours ou personnage",
  invalid_configuration: "configuration non publiée",
  late_result: "décision trop tardive",
  action_already_pending: "une action est déjà en cours",
  overlay_no_allowed_video: "aucune vidéo autorisée",
  overlay_reply_too_short: "réplique trop courte pour superposer",
  overlay_reply_over: "réplique déjà terminée",
  overlay_selection_none: "aucune vidéo ne convient",
  overlay_selection_low_confidence: "confiance trop faible",
  overlay_selection_weak_link: "lien trop faible",
  overlay_selection_invalid: "réponse du sélecteur illisible",
  overlay_selection_timeout: "sélecteur trop lent",
  overlay_selection_error: "erreur du sélecteur",
  overlay_selection_no_candidates: "aucun candidat",
  transition_cancelled: "annulée avant la lecture",
  none: "aucune vidéo",
  invalid: "réponse invalide",
  unknown: "motif inconnu",
  no_video: "aucune vidéo disponible",
  extract_first_turn: "trop tôt pour un extrait",
  extract_spacing: "espacement des extraits",
  extract_session_maximum: "maximum d'extraits atteint",
  extract_no_usable_candidate: "aucun extrait utilisable",
  extract_video_overlap: "une vidéo est déjà en cours",
  extract_reply_over: "réplique déjà terminée",
  extract_selection_none: "aucun extrait ne convient",
  extract_selection_low_confidence: "confiance trop faible",
  extract_selection_weak_link: "lien trop faible",
  extract_selection_no_complement: "l'extrait n'apporte rien de plus",
  extract_selection_invalid: "réponse du sélecteur illisible",
  extract_selection_timeout: "sélecteur trop lent",
  extract_selection_error: "erreur du sélecteur",
  extract_selection_no_candidates: "aucun candidat",
  extract_unknown_video: "extrait inconnu",
  extract_other_turn: "le tour a changé",
  extract_other_character: "le personnage a changé",
  extract_already_shown: "extrait déjà montré",
  extract_reply_too_short: "réplique trop courte",
  extract_film_seen_path: "parcours film déjà vu",
  extracts_disabled: "extraits désactivés",
  not_extract: "pas un extrait",
  no_media: "média absent",
  other_character: "réservé à un autre personnage",
  already_shown: "déjà montré",
  transcript_unreliable: "transcription non vérifiée",
  cinematic_skipped: "lecture passée",
};

/** Details attached to a weak link (`selection.detail`) and to invalid selector answers. */
export const LINK_DETAIL_LABELS: Record<string, string> = {
  name_only: "prénom seul",
  no_reply_cue: "citation absente",
  cue_not_in_reply: "citation absente de la réplique",
  cue_not_in_video: "citation absente de la vidéo",
  no_shared_word: "aucun mot commun",
  no_json: "pas de JSON",
  bad_json: "JSON illisible",
  not_object: "réponse inattendue",
  unknown_video: "vidéo hors liste",
  aborted: "appel interrompu",
  empty_complement: "apport vide",
};

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "motif non précisé";
  return BLOCKED_REASON_LABELS[reason] ?? LINK_DETAIL_LABELS[reason] ?? reason;
}

export function clipDecisionText(text: string | null | undefined, max: number): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export interface DecisionCandidate {
  id: string;
  title: string;
}

/**
 * Fields added to `cinematic_recommended` and `cinematic_blocked` payloads.
 * Does not decide anything: callers keep their existing control flow.
 */
export function videoDecisionJournal(input: {
  mechanism: VideoMechanism;
  candidates: readonly { id: string; title?: string | null }[];
  excluded?: readonly { id: string; reason: string | null | undefined }[];
  replyText?: string | null;
  userText?: string | null;
  linkDetail?: string | null;
}): Record<string, unknown> {
  const seen = new Set<string>();
  const unique: DecisionCandidate[] = [];
  for (const video of input.candidates) {
    const id = String(video.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push({ id, title: clipDecisionText(video.title || id, VIDEO_DECISION_TITLE_MAX) });
  }
  const excluded: Record<string, string[]> = {};
  for (const entry of input.excluded ?? []) {
    const id = String(entry.id ?? "").trim();
    if (!id) continue;
    const reason = entry.reason || "unknown";
    const list = excluded[reason] ?? [];
    if (!list.includes(id)) list.push(id);
    excluded[reason] = list;
  }
  const fields: Record<string, unknown> = {
    mechanism: input.mechanism,
    candidates: unique.slice(0, VIDEO_DECISION_CANDIDATE_LIMIT),
    candidateCount: unique.length,
    excluded,
    replyExcerpt: clipDecisionText(input.replyText, VIDEO_DECISION_REPLY_MAX),
    userExcerpt: clipDecisionText(input.userText, VIDEO_DECISION_USER_MAX),
  };
  if (input.linkDetail) fields.linkDetail = input.linkDetail;
  return fields;
}

export interface DecisionEventRow {
  id: string;
  session_id: string;
  created_at: string;
  event_type: string;
  turn_id: string | null;
  turn_index: number | null;
  character_key: string | null;
  payload: unknown;
}

export interface VideoCatalogEntry {
  id: string;
  title: string;
  themes: string[];
  characters: string[];
  emotions?: string[] | null;
  stakes?: string[] | null;
  on_screen?: string[] | null;
}

export type LabelDimension = "themes" | "emotions" | "stakes";

export interface GmTurnLabels {
  themes: string[];
  topics: string[];
  intentions: string[];
  emotions: string[];
  stakes: string[];
}

export interface DecisionTurn {
  key: string;
  sessionId: string;
  turnIndex: number | null;
  turnId: string | null;
  character: string | null;
  createdAt: string;
  mechanism: VideoMechanism | "unknown";
  outcome: "played" | "skipped";
  reason: string | null;
  reasonLabel: string;
  videoId: string | null;
  videoTitle: string | null;
  quote: string | null;
  confidence: number | null;
  candidates: DecisionCandidate[];
  candidateCount: number | null;
  excluded: { reason: string; label: string; videoIds: string[] }[];
  replyExcerpt: string | null;
  userExcerpt: string | null;
  linkDetail: string | null;
  themes: string[];
  topics: string[];
  emotions: string[];
  stakes: string[];
  /** True when the event predates the enriched payload. */
  degraded: boolean;
}

export interface DecisionSession {
  sessionId: string;
  startedAt: string;
  turns: DecisionTurn[];
}

export interface PlayCount {
  videoId: string;
  title: string;
  plays: number;
  sessions: number;
  lastPlayedAt: string;
}

export interface FlowLink {
  source: string;
  target: string;
  count: number;
  examples: string[];
}

export interface ThemeFlows {
  toVideos: FlowLink[];
  evolution: FlowLink[];
}

export interface CriteriaSummary {
  turns: number;
  played: number;
  skipped: number;
  byReason: { reason: string; label: string; count: number }[];
  confidence: { label: string; count: number }[];
  linkDetails: { detail: string; label: string; count: number }[];
}

export interface VideoDecisionReport {
  sessions: DecisionSession[];
  turns: DecisionTurn[];
  playCounts: PlayCount[];
  themeFlows: ThemeFlows;
  criteria: CriteriaSummary;
  /** A successful read that returned no event row. Access rules can look the same. */
  zeroRows: boolean;
  truncated: boolean;
  error: string | null;
  catalogUnreadable: boolean;
  themesUnreadable: boolean;
  /** Notion lists when the snapshot was read. Null when it is missing, unreadable, or returned no row. */
  vocabulary: VideoLabelLists | null;
  vocabularyZeroRows: boolean;
  vocabularyUnavailable: boolean;
  vocabularyError: string | null;
  /** Emotion or stake can be chosen once a column or the exported list actually contains a term. */
  labelDimensions: { emotion: boolean; stake: boolean };
}

interface Payload {
  [key: string]: unknown;
}

function asPayload(value: unknown): Payload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Payload : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

export function inferMechanism(payload: Payload): VideoMechanism | "unknown" {
  const explicit = asString(payload.mechanism);
  if (explicit === "overlay" || explicit === "extract" || explicit === "game_master") return explicit;
  const source = asString(payload.source);
  if (source === "overlay_selector") return "overlay";
  if (source === "extract_selector") return "extract";
  if (source === "game_master") return "game_master";
  const reason = asString(payload.blockedReason) ?? "";
  if (reason.startsWith("overlay_")) return "overlay";
  if (reason.startsWith("extract_") || reason === "not_extract" || reason === "no_media" || reason === "transcript_unreliable") return "extract";
  if (reason.startsWith("cinematic_") || reason === "ineligible" || reason === "transition_cancelled" || reason === "late_result") return "game_master";
  return "unknown";
}

function candidatesFrom(payload: Payload): { candidates: DecisionCandidate[]; count: number | null; degraded: boolean } {
  const raw = payload.candidates;
  if (Array.isArray(raw)) {
    const candidates: DecisionCandidate[] = [];
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) candidates.push({ id: item.trim(), title: item.trim() });
      else if (item && typeof item === "object") {
        const record = item as Payload;
        const id = asString(record.id);
        if (id) candidates.push({ id, title: asString(record.title) ?? id });
      }
    }
    const count = asNumber(payload.candidateCount) ?? candidates.length;
    return { candidates, count, degraded: false };
  }
  if (typeof raw === "number") return { candidates: [], count: raw, degraded: true };
  return { candidates: [], count: asNumber(payload.candidateCount), degraded: true };
}

function quoteFrom(payload: Payload): string | null {
  const reply = asString(payload.replyCue);
  const video = asString(payload.videoCue);
  if (reply && video) return `« ${reply} » ↔ ${video}`;
  if (reply) return `« ${reply} »`;
  return null;
}

function spacingLabel(reason: string | null, payload: Payload, turnIndex: number | null): string | null {
  if (reason !== "cinematic_cooldown" && reason !== "extract_spacing") return null;
  const rules = payload.rules;
  if (!rules || typeof rules !== "object") return null;
  const last = asNumber((rules as Payload).lastVideoTurn);
  if (last == null || turnIndex == null) return null;
  const gap = turnIndex - last;
  if (gap < 0) return null;
  return `espacement : ${gap} tour${gap > 1 ? "s" : ""} depuis la dernière`;
}

export function decisionReasonLabel(reason: string | null, linkDetail: string | null, payload: Payload, turnIndex: number | null): string {
  const spacing = spacingLabel(reason, payload, turnIndex);
  const base = spacing ?? reasonLabel(reason);
  if (linkDetail) return `${reasonLabel(reason)} : ${reasonLabel(linkDetail)}`;
  return base;
}

function excludedFrom(payload: Payload): { reason: string; label: string; videoIds: string[] }[] {
  const raw = payload.excluded;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([reason, ids]) => ({
      reason,
      label: reasonLabel(reason),
      videoIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && Boolean(id)) : [],
    }))
    .filter((entry) => entry.videoIds.length > 0);
}

interface GmEntry {
  turn_index?: unknown;
  labels?: { themes?: unknown; topics?: unknown; intentions?: unknown; emotions?: unknown; stakes?: unknown };
}

function gmLabels(log: unknown): Map<number, GmTurnLabels> {
  const map = new Map<number, GmTurnLabels>();
  if (!Array.isArray(log)) return map;
  for (const entry of log as GmEntry[]) {
    const index = asNumber(entry?.turn_index);
    if (index == null) continue;
    map.set(index, {
      themes: stringList(entry.labels?.themes),
      topics: stringList(entry.labels?.topics),
      intentions: stringList(entry.labels?.intentions),
      emotions: stringList(entry.labels?.emotions),
      stakes: stringList(entry.labels?.stakes),
    });
  }
  return map;
}

interface TurnBucket {
  sessionId: string;
  turnIndex: number | null;
  turnId: string | null;
  character: string | null;
  createdAt: string;
  mechanism: VideoMechanism | "unknown";
  videoId: string | null;
  payloads: Payload[];
  played: boolean;
  playedAt: string | null;
  blockedReason: string | null;
  skippedOnly: boolean;
}

function turnKey(sessionId: string, turnIndex: number | null, turnId: string | null, mechanism: string, videoId: string | null): string {
  return [sessionId, turnIndex ?? "na", turnId ?? "na", mechanism, videoId ?? "none"].join(":");
}

/**
 * One row per decision on a turn. A played event closes the matching
 * recommendation; a block without a play is a skip. Legacy rows stay readable.
 */
export function groupBySession(
  events: readonly DecisionEventRow[],
  catalog: readonly VideoCatalogEntry[],
  gmLogs: ReadonlyMap<string, unknown>,
): DecisionSession[] {
  const titles = new Map(catalog.map((video) => [video.id, video.title]));
  const buckets = new Map<string, TurnBucket>();
  const playedByTurn = new Map<string, { videoId: string; at: string }[]>();

  const ensure = (key: string, seed: Omit<TurnBucket, "payloads" | "played" | "playedAt" | "blockedReason" | "skippedOnly">): TurnBucket => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: TurnBucket = { ...seed, payloads: [], played: false, playedAt: null, blockedReason: null, skippedOnly: false };
    buckets.set(key, created);
    return created;
  };

  const ordered = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const event of ordered) {
    const payload = asPayload(event.payload);
    const videoId = asString(payload.videoId);
    const plainKey = `${event.session_id}:${event.turn_index ?? "na"}:${event.turn_id ?? "na"}`;
    if (event.event_type === "cinematic_played" && videoId) {
      const list = playedByTurn.get(plainKey) ?? [];
      list.push({ videoId, at: event.created_at });
      playedByTurn.set(plainKey, list);
      continue;
    }
    if (event.event_type === "cinematic_completed") continue;
    if (event.event_type !== "cinematic_recommended" && event.event_type !== "cinematic_blocked" && event.event_type !== "cinematic_skipped") continue;
    const mechanism = inferMechanism(payload);
    const reason = asString(payload.blockedReason);
    const attachCancelled = event.event_type === "cinematic_blocked" && reason === "transition_cancelled" && videoId;
    let bucket: TurnBucket | undefined;
    if (attachCancelled) {
      bucket = [...buckets.values()].find((candidate) =>
        candidate.sessionId === event.session_id
        && candidate.turnIndex === event.turn_index
        && candidate.videoId === videoId);
    }
    if (!bucket) {
      const key = turnKey(event.session_id, event.turn_index, event.turn_id, mechanism, event.event_type === "cinematic_blocked" && !videoId ? null : videoId);
      bucket = ensure(key, {
        sessionId: event.session_id,
        turnIndex: event.turn_index,
        turnId: event.turn_id,
        character: event.character_key,
        createdAt: event.created_at,
        mechanism,
        videoId,
      });
    }
    bucket.payloads.push(payload);
    if (!bucket.character && event.character_key) bucket.character = event.character_key;
    if (videoId) bucket.videoId = videoId;
    if (event.event_type === "cinematic_blocked") bucket.blockedReason = reason ?? bucket.blockedReason;
    if (event.event_type === "cinematic_skipped") bucket.skippedOnly = true;
    if (event.created_at < bucket.createdAt) bucket.createdAt = event.created_at;
  }

  for (const bucket of buckets.values()) {
    const plainKey = `${bucket.sessionId}:${bucket.turnIndex ?? "na"}:${bucket.turnId ?? "na"}`;
    const plays = playedByTurn.get(plainKey) ?? [];
    const match = plays.find((play) => play.videoId === bucket.videoId) ?? (bucket.videoId == null && plays.length === 1 ? plays[0] : undefined);
    if (match && !bucket.blockedReason) {
      bucket.played = true;
      bucket.playedAt = match.at;
      if (!bucket.videoId) bucket.videoId = match.videoId;
    }
  }

  for (const [plainKey, plays] of playedByTurn) {
    for (const play of plays) {
      const claimed = [...buckets.values()].some((bucket) =>
        `${bucket.sessionId}:${bucket.turnIndex ?? "na"}:${bucket.turnId ?? "na"}` === plainKey && bucket.videoId === play.videoId && bucket.played);
      if (claimed) continue;
      const [sessionId, turnIndexRaw, turnIdRaw] = plainKey.split(":");
      const turnIndex = turnIndexRaw === "na" ? null : Number(turnIndexRaw);
      const key = turnKey(sessionId, Number.isFinite(turnIndex) ? turnIndex : null, turnIdRaw === "na" ? null : turnIdRaw, "unknown", play.videoId);
      const bucket = ensure(key, {
        sessionId,
        turnIndex: Number.isFinite(turnIndex) ? turnIndex : null,
        turnId: turnIdRaw === "na" ? null : turnIdRaw,
        character: null,
        createdAt: play.at,
        mechanism: "unknown",
        videoId: play.videoId,
      });
      bucket.played = true;
      bucket.playedAt = play.at;
    }
  }

  const sessions = new Map<string, DecisionTurn[]>();
  for (const bucket of buckets.values()) {
    const labels = bucket.turnIndex == null ? undefined : gmLabels(gmLogs.get(bucket.sessionId)).get(bucket.turnIndex);
    const richest = [...bucket.payloads].reverse().find((payload) => Array.isArray(payload.candidates) || asString(payload.replyCue) || asString(payload.replyExcerpt))
      ?? bucket.payloads[bucket.payloads.length - 1]
      ?? {};
    const parsed = candidatesFrom(richest);
    const linkDetail = asString(richest.linkDetail) ?? (asString(richest.blockedReason)?.endsWith("weak_link") ? asString(richest.detail) : null);
    const replyExcerpt = asString(richest.replyExcerpt);
    const userExcerpt = asString(richest.userExcerpt);
    const confidence = asNumber(richest.confidence);
    const outcome = bucket.played ? "played" as const : "skipped" as const;
    const reason = outcome === "played" ? null : (bucket.blockedReason ?? (bucket.skippedOnly ? "cinematic_skipped" : null));
    const turn: DecisionTurn = {
      key: turnKey(bucket.sessionId, bucket.turnIndex, bucket.turnId, bucket.mechanism, bucket.videoId),
      sessionId: bucket.sessionId,
      turnIndex: bucket.turnIndex,
      turnId: bucket.turnId,
      character: bucket.character,
      createdAt: bucket.playedAt ?? bucket.createdAt,
      mechanism: bucket.mechanism,
      outcome,
      reason,
      reasonLabel: outcome === "played" ? "jouée" : decisionReasonLabel(reason, linkDetail, richest, bucket.turnIndex),
      videoId: bucket.videoId,
      videoTitle: bucket.videoId ? (titles.get(bucket.videoId) ?? bucket.videoId) : null,
      quote: quoteFrom(richest),
      confidence,
      candidates: parsed.candidates.map((candidate) => ({ ...candidate, title: titles.get(candidate.id) ?? candidate.title })),
      candidateCount: parsed.count,
      excluded: excludedFrom(richest).map((entry) => ({ ...entry, videoIds: entry.videoIds })),
      replyExcerpt,
      userExcerpt,
      linkDetail,
      themes: labels?.themes ?? [],
      topics: labels?.topics ?? [],
      emotions: labels?.emotions ?? [],
      stakes: labels?.stakes ?? [],
      degraded: parsed.degraded || (!replyExcerpt && !userExcerpt && !Array.isArray(richest.candidates)),
    };
    const list = sessions.get(bucket.sessionId) ?? [];
    list.push(turn);
    sessions.set(bucket.sessionId, list);
  }

  return [...sessions.entries()]
    .map(([sessionId, turns]) => ({
      sessionId,
      startedAt: turns.map((turn) => turn.createdAt).sort()[0] ?? "",
      turns: turns.sort((a, b) => (a.turnIndex ?? 0) - (b.turnIndex ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function playCounts(events: readonly DecisionEventRow[], catalog: readonly VideoCatalogEntry[]): PlayCount[] {
  const titles = new Map(catalog.map((video) => [video.id, video.title]));
  const byVideo = new Map<string, { plays: number; sessions: Set<string>; lastPlayedAt: string }>();
  for (const event of events) {
    if (event.event_type !== "cinematic_played") continue;
    const videoId = asString(asPayload(event.payload).videoId);
    if (!videoId) continue;
    const current = byVideo.get(videoId) ?? { plays: 0, sessions: new Set<string>(), lastPlayedAt: event.created_at };
    current.plays += 1;
    current.sessions.add(event.session_id);
    if (event.created_at > current.lastPlayedAt) current.lastPlayedAt = event.created_at;
    byVideo.set(videoId, current);
  }
  return [...byVideo.entries()]
    .map(([videoId, value]) => ({
      videoId,
      title: titles.get(videoId) ?? videoId,
      plays: value.plays,
      sessions: value.sessions.size,
      lastPlayedAt: value.lastPlayedAt,
    }))
    .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title, "fr"));
}

function addFlow(map: Map<string, FlowLink>, source: string, target: string, example: string | null) {
  const key = `${source}\u0000${target}`;
  const current = map.get(key) ?? { source, target, count: 0, examples: [] };
  current.count += 1;
  if (example && current.examples.length < 2 && !current.examples.includes(example)) current.examples.push(example);
  map.set(key, current);
}

const DIMENSION_EMPTY: Record<LabelDimension, string> = {
  themes: "(sans thème)",
  emotions: "(sans émotion)",
  stakes: "(sans enjeu)",
};

function dimensionLabels(turn: DecisionTurn, dimension: LabelDimension): string[] {
  if (dimension === "emotions") return turn.emotions ?? [];
  if (dimension === "stakes") return turn.stakes ?? [];
  return turn.themes;
}

function flowSource(label: string, list: readonly string[] | null | undefined): string {
  return list && isOutsideList(label, list) ? `${label} (hors liste)` : label;
}

export function themeFlows(
  sessions: readonly DecisionSession[],
  options?: { dimension?: LabelDimension; vocabulary?: VideoLabelLists | null },
): ThemeFlows {
  const dimension = options?.dimension ?? "themes";
  const list = dimension === "emotions"
    ? options?.vocabulary?.emotions
    : dimension === "stakes"
      ? options?.vocabulary?.stakes
      : options?.vocabulary?.themes;
  const empty = DIMENSION_EMPTY[dimension];
  const toVideos = new Map<string, FlowLink>();
  const evolution = new Map<string, FlowLink>();
  for (const session of sessions) {
    const turns = [...session.turns].sort((a, b) => (a.turnIndex ?? 0) - (b.turnIndex ?? 0));
    turns.forEach((turn, index) => {
      const labels = dimensionLabels(turn, dimension);
      const sources = (labels.length ? labels : [empty]).map((label) => label === empty ? empty : flowSource(label, list));
      const target = turn.outcome === "played"
        ? (turn.videoTitle ?? "vidéo")
        : `aucune vidéo (${turn.reasonLabel})`;
      for (const source of sources) addFlow(toVideos, source, target, turn.quote);
      const next = turns[index + 1];
      if (!next || turn.turnIndex == null || next.turnIndex == null || next.turnIndex <= turn.turnIndex) return;
      const nextLabels = dimensionLabels(next, dimension);
      const nextSources = (nextLabels.length ? nextLabels : [empty]).map((label) => label === empty ? empty : flowSource(label, list));
      for (const source of sources) {
        for (const later of nextSources) addFlow(evolution, source, later, null);
      }
    });
  }
  const sortLinks = (map: Map<string, FlowLink>) => [...map.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source, "fr"));
  return { toVideos: sortLinks(toVideos), evolution: sortLinks(evolution) };
}

const CONFIDENCE_BUCKETS: { label: string; test: (value: number) => boolean }[] = [
  { label: "< 0,5", test: (value) => value < 0.5 },
  { label: "0,5 – 0,7", test: (value) => value >= 0.5 && value < 0.7 },
  { label: "0,7 – 0,8", test: (value) => value >= 0.7 && value < 0.8 },
  { label: "0,8 – 0,9", test: (value) => value >= 0.8 && value < 0.9 },
  { label: "≥ 0,9", test: (value) => value >= 0.9 },
];

export function criteriaSummary(turns: readonly DecisionTurn[]): CriteriaSummary {
  const reasons = new Map<string, number>();
  const details = new Map<string, number>();
  const confidence = new Map<string, number>([...CONFIDENCE_BUCKETS.map((bucket) => [bucket.label, 0] as const), ["absente", 0]]);
  let played = 0;
  for (const turn of turns) {
    if (turn.outcome === "played") {
      played += 1;
      if (turn.quote) details.set("quoted_link", (details.get("quoted_link") ?? 0) + 1);
    } else {
      const reason = turn.reason ?? "none";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    if (turn.linkDetail) details.set(turn.linkDetail, (details.get(turn.linkDetail) ?? 0) + 1);
    if (turn.confidence == null) confidence.set("absente", (confidence.get("absente") ?? 0) + 1);
    else {
      const bucket = CONFIDENCE_BUCKETS.find((candidate) => candidate.test(turn.confidence as number));
      const label = bucket?.label ?? "absente";
      confidence.set(label, (confidence.get(label) ?? 0) + 1);
    }
  }
  return {
    turns: turns.length,
    played,
    skipped: turns.length - played,
    byReason: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, label: reasonLabel(reason), count }))
      .sort((a, b) => b.count - a.count),
    confidence: [...confidence.entries()].map(([label, count]) => ({ label, count })),
    linkDetails: [...details.entries()]
      .map(([detail, count]) => ({ detail, label: detail === "quoted_link" ? "lien cité" : reasonLabel(detail), count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function filterSessions(sessions: readonly DecisionSession[], filter: { mechanism?: MechanismFilter; sessionId?: string | null }): DecisionSession[] {
  return sessions
    .filter((session) => !filter.sessionId || session.sessionId === filter.sessionId)
    .map((session) => ({
      ...session,
      turns: session.turns.filter((turn) => !filter.mechanism || filter.mechanism === "all" || turn.mechanism === filter.mechanism),
    }))
    .filter((session) => session.turns.length > 0);
}

const PAGE = 1000;
const MAX_EVENTS = 5000;

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface EventQuery {
  in(column: string, values: readonly string[]): EventQuery;
  gte(column: string, value: string): EventQuery;
  eq(column: string, value: string): EventQuery;
  order(column: string, options: { ascending: boolean }): EventQuery;
  range(from: number, to: number): Promise<QueryResult<DecisionEventRow>>;
}

export interface DecisionReader {
  events(sinceIso: string, sessionId: string | null, from: number, to: number): Promise<QueryResult<DecisionEventRow>>;
  videos(): Promise<QueryResult<VideoCatalogEntry>>;
  sessionLogs(ids: string[]): Promise<QueryResult<{ id: string; gm_post_turn_log: unknown }>>;
  vocabulary?(): Promise<VocabularyLoad>;
}

export function supabaseDecisionReader(client: typeof supabase = supabase): DecisionReader {
  return {
    events(sinceIso, sessionId, from, to) {
      let query = (client.from("experience_events" as never) as unknown as { select: (columns: string) => EventQuery })
        .select("id, session_id, created_at, event_type, turn_id, turn_index, character_key, payload")
        .in("event_type", CINEMATIC_EVENT_TYPES)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });
      if (sessionId) query = query.eq("session_id", sessionId);
      return query.range(from, to);
    },
    videos() {
      const select = (columns: string) =>
        (client.from("video_triggers" as never) as unknown as { select: (columns: string) => Promise<QueryResult<VideoCatalogEntry>> })
          .select(columns);
      return select("id, title, themes, characters, emotions, stakes, on_screen").then((result) => {
        if (result.error && isMissingVideoLabelColumnError(result.error)) return select("id, title, themes, characters");
        return result;
      });
    },
    async vocabulary() {
      try {
        const { data, error } = await client
          .from("video_label_vocabulary")
          .select("themes, emotions, stakes, on_screen")
          .eq("id", "current")
          .maybeSingle();
        return interpretVocabularyRead({ data, error });
      } catch (error) {
        return {
          lists: null,
          zeroRows: false,
          unavailable: false,
          error: error instanceof Error ? error.message : "lecture impossible",
        };
      }
    },
    sessionLogs(ids) {
      return (client.from("sessions" as never) as unknown as { select: (columns: string) => { in: (column: string, values: string[]) => Promise<QueryResult<{ id: string; gm_post_turn_log: unknown }>> } })
        .select("id, gm_post_turn_log")
        .in("id", ids);
    },
  };
}

function emptyReport(partial: Partial<VideoDecisionReport>): VideoDecisionReport {
  return {
    sessions: [],
    turns: [],
    playCounts: [],
    themeFlows: { toVideos: [], evolution: [] },
    criteria: criteriaSummary([]),
    zeroRows: false,
    truncated: false,
    error: null,
    catalogUnreadable: false,
    themesUnreadable: false,
    vocabulary: null,
    vocabularyZeroRows: false,
    vocabularyUnavailable: false,
    vocabularyError: null,
    labelDimensions: { emotion: false, stake: false },
    ...partial,
  };
}

function labelDimensionsFrom(catalog: readonly VideoCatalogEntry[], vocabulary: VideoLabelLists | null): { emotion: boolean; stake: boolean } {
  const filled = (values: readonly string[] | null | undefined) => (values?.length ?? 0) > 0;
  return {
    emotion: filled(vocabulary?.emotions) || catalog.some((video) => filled(video.emotions)),
    stake: filled(vocabulary?.stakes) || catalog.some((video) => filled(video.stakes)),
  };
}

export async function loadVideoDecisions(options: {
  sinceDays: number;
  sessionId?: string | null;
  now?: Date;
  reader?: DecisionReader;
} = { sinceDays: 30 }): Promise<VideoDecisionReport> {
  const reader = options.reader ?? supabaseDecisionReader();
  const now = options.now ?? new Date();
  const sinceIso = new Date(now.getTime() - options.sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const events: DecisionEventRow[] = [];
  let truncated = false;
  for (let from = 0; from < MAX_EVENTS; from += PAGE) {
    const page = await reader.events(sinceIso, options.sessionId ?? null, from, from + PAGE - 1);
    if (page.error) return emptyReport({ error: page.error.message });
    const rows = page.data ?? [];
    events.push(...rows);
    if (rows.length < PAGE) break;
    if (from + PAGE >= MAX_EVENTS) truncated = true;
  }
  if (events.length === 0) return emptyReport({ zeroRows: true, truncated });

  const videos = await reader.videos();
  const catalog = (videos.data ?? []).map((video) => ({
    id: video.id,
    title: video.title,
    themes: video.themes ?? [],
    characters: video.characters ?? [],
    emotions: video.emotions ?? undefined,
    stakes: video.stakes ?? undefined,
    on_screen: video.on_screen ?? undefined,
  }));
  const sessionIds = [...new Set(events.map((event) => event.session_id))];
  const logs = new Map<string, unknown>();
  let themesUnreadable = false;
  for (let index = 0; index < sessionIds.length; index += 100) {
    const slice = sessionIds.slice(index, index + 100);
    const page = await reader.sessionLogs(slice);
    if (page.error) {
      themesUnreadable = true;
      break;
    }
    for (const row of page.data ?? []) logs.set(row.id, row.gm_post_turn_log);
  }
  const sessions = groupBySession(events, catalog, logs);
  const turns = sessions.flatMap((session) => session.turns);
  const vocabularyLoad: VocabularyLoad = reader.vocabulary
    ? await reader.vocabulary()
    : { lists: null, zeroRows: false, unavailable: true, error: null };
  const vocabulary = vocabularyLoad.zeroRows || vocabularyLoad.error
    ? null
    : (vocabularyLoad.lists ?? vocabularyFromRows(catalog));
  return {
    sessions,
    turns,
    playCounts: playCounts(events, catalog),
    themeFlows: themeFlows(sessions, { vocabulary }),
    criteria: criteriaSummary(turns),
    zeroRows: false,
    truncated,
    error: null,
    catalogUnreadable: Boolean(videos.error) || (catalog.length === 0 && events.some((event) => asString(asPayload(event.payload).videoId))),
    themesUnreadable,
    vocabulary,
    vocabularyZeroRows: vocabularyLoad.zeroRows,
    vocabularyUnavailable: vocabularyLoad.unavailable,
    vocabularyError: vocabularyLoad.error,
    labelDimensions: labelDimensionsFrom(catalog, vocabulary),
  };
}

/** Badge text for a video card. An unreadable journal is not “never played”. */
export function playCountLabel(count: PlayCount | undefined, unreadable: boolean): string {
  if (unreadable) return "lectures non confirmées";
  const plays = count?.plays ?? 0;
  if (plays === 0) return "jamais jouée";
  const sessions = count?.sessions ?? 0;
  return `${plays} lecture${plays > 1 ? "s" : ""} · ${sessions} session${sessions > 1 ? "s" : ""}`;
}

/** Play counts for the video cards. Zero rows are reported instead of “never played”. */
export async function loadPlayCounts(options: { sinceDays?: number; now?: Date; reader?: DecisionReader } = {}): Promise<{
  counts: PlayCount[];
  zeroRows: boolean;
  error: string | null;
}> {
  const report = await loadVideoDecisions({ sinceDays: options.sinceDays ?? 30, now: options.now, reader: options.reader });
  if (report.error) return { counts: [], zeroRows: false, error: report.error };
  return { counts: report.playCounts, zeroRows: report.zeroRows, error: null };
}
