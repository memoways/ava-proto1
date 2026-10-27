import type { ConversationPipelineTimings } from "@/types";
import { displayNameForCharacter } from "./characterRegistry";
import { messageCharacter } from "./sessionCharacters";
import { getPipelineServiceLatency, LATENCY_SEGMENT_LABELS, percentile, type LatencySegmentKey } from "./latencySegments";

export type ExportRecord = Record<string, unknown>;
export interface SessionExportData {
  session: ExportRecord;
  telemetry: Record<string, ExportRecord[]>;
  warnings: string[];
}
const record = (value: unknown): ExportRecord => value && typeof value === "object" && !Array.isArray(value) ? value as ExportRecord : {};
const text = (value: unknown): string => value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
const cell = (value: unknown) => text(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
function jsonBlock(value: unknown): string {
  const json = JSON.stringify(value, null, 2) ?? "null";
  const fence = "`".repeat(Math.max(3, ...[...json.matchAll(/`+/g)].map(match => match[0].length + 1)));
  return `${fence}json\n${json}\n${fence}`;
}
export function latencyStats(values: unknown[]) {
  const measured = values.filter(positive);
  return measured.length ? { count: measured.length, mean: measured.reduce((a, b) => a + b, 0) / measured.length,
    median: percentile(measured, 0.5), p95: percentile(measured, 0.95), max: Math.max(...measured) } : null;
}

export function buildSessionMarkdown({ session, telemetry, warnings }: SessionExportData): string {
  const messages = Array.isArray(session.conversation_log) ? session.conversation_log.map(record) : [];
  const lines = [`# Session : ${cell(session.name || session.id)}`, "", "## Contexte", "",
    `- Identifiant : ${text(session.id)}`, `- Début (horodatage enregistré) : ${text(session.started_at)}`,
    `- Fin : ${text(session.ended_at)}`, `- Compte : ${text(session.account_display_name)}`,
    `- Testeur : ${text(session.tester_label)}`, `- Environnement : ${text(session.environment_id)}`,
    `- Type de contexte : ${text(session.context_type)}`, `- Campagne : ${text(session.campaign_id)}`,
    `- Durée : ${text(session.duration_seconds)} s`, `- Fin de session : ${text(session.game_over_reason)}`,
    `- Messages utilisateur : ${messages.filter(m => m.role === "user").length}`,
    `- Réponses personnages : ${messages.filter(m => messageCharacter(m as { role?: string; spokenWith?: string })).length}`,
    "", "## Latences", "", "Mesures en millisecondes, sans addition des étapes concurrentes. Les mesures absentes, nulles ou non positives sont exclues. Les sources et origines restent séparées.", "",
    "| Mesure / source | Échantillons | Moyenne (ms) | Médiane (ms) | P95 (ms) | Maximum (ms) |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"];
  let metrics = 0;
  function metric(label: string, values: unknown[]) {
    const stats = latencyStats(values);
    if (!stats) return;
    metrics++;
    lines.push(`| ${cell(label)} | ${stats.count} | ${Math.round(stats.mean)} | ${Math.round(stats.median)} | ${Math.round(stats.p95)} | ${Math.round(stats.max)} |`);
  }
  const pipelines = messages.filter(m => m.role !== "user" && m.pipeline).map(m => record(m.pipeline) as ConversationPipelineTimings);
  const origins = [...new Set(pipelines.filter(p => p.first_sound_status === "measured" && p.latency_origin && p.latency_origin !== "legacy_service_sum").map(p => p.latency_origin))];
  for (const origin of origins) metric(`Attente réelle jusqu'au premier son (${origin}, conversation)`, pipelines.filter(p => p.first_sound_status === "measured" && p.latency_origin === origin).map(p => p.total_ms));
  for (const key of Object.keys(LATENCY_SEGMENT_LABELS) as LatencySegmentKey[]) {
    if (key !== "total_ms") metric(`${LATENCY_SEGMENT_LABELS[key]} (conversation)`, pipelines.map(p => getPipelineServiceLatency(p, key)));
  }
  for (const [table, rows] of Object.entries(telemetry)) {
    if (table !== "audio_latencies" && table !== "turn_latencies") continue;
    const keys = [...new Set(rows.flatMap(row => Object.keys(row).filter(key => /^t_.*_ms$/.test(key))))];
    for (const key of keys) {
      if (table === "audio_latencies") {
        for (const direction of [...new Set(rows.map(row => row.direction))]) metric(`${key} (${table}, ${text(direction)})`, rows.filter(row => row.direction === direction).map(row => row[key]));
      } else metric(`${key} (${table})`, rows.map(row => row[key]));
    }
  }
  if (!metrics) lines.push("", "Aucune mesure de latence exploitable enregistrée.");
  lines.push("", "Les temps TTS de génération, premier octet et lecture ne sont pas équivalents. Un total de traitement ne représente pas nécessairement l’attente avant le premier son. Le P95 est interpolé ; les petits échantillons ne sont pas représentatifs.", "", "## Incidents et limites des diagnostics", "");
  let incidents = 0;
  function incident(label: string, value: unknown) { incidents++; lines.push(`- ${label} : ${cell(value)}`); }
  for (const warning of warnings) incident("Diagnostic incomplet", warning);
  let turn = 0;
  for (const m of messages) {
    if (m.role === "user") turn++;
    if (m.gmFallback) incident(`Tour ${turn} — repli GM`, m.gmFallback);
    const p = record(m.pipeline);
    if (p.blocker && p.blocker !== "none") incident(`Tour ${turn} — étape signalée comme bloquante (pas nécessairement un échec)`, p.blocker);
    if (p.first_sound_status === "failed") incident(`Tour ${turn} — premier son en échec`, p);
  }
  for (const [table, rows] of Object.entries(telemetry)) for (const row of rows) {
    const meta = record(row.metadata_json);
    if (row.error_message || row.had_fallback === true || meta.had_fallback === true || /error|fail|critical|timeout|unavailable|blocked/i.test(`${row.status ?? ""} ${row.severity ?? ""} ${row.event_name ?? ""} ${row.event_type ?? ""}`)) incident(`${table} — tour ${text(row.turn_index)} — ${text(row.created_at)}`, row);
  }
  const gm = Array.isArray(session.gm_post_turn_log) ? session.gm_post_turn_log.map(record) : [];
  for (const entry of gm) if (entry.execution_status && entry.execution_status !== "executed") incident(`GM post-tour ${text(entry.turn_index)}`, entry);
  if (!incidents) lines.push("Aucun incident identifié dans les données disponibles. Cela ne garantit pas l’absence de problème non enregistré.");
  lines.push("", "## Conversation", "");
  turn = 0;
  for (const m of messages) {
    if (m.role === "user") { turn++; lines.push(`### Tour ${turn}`, ""); }
    const character = messageCharacter(m as { role?: string; spokenWith?: string });
    const speaker = m.role === "user" ? "Utilisateur" : character ? displayNameForCharacter(character) : `Message ${text(m.role)}`;
    lines.push(`**${speaker} :**`, "", typeof m.content === "string" ? m.content : text(m.content), "");
  }
  if (!messages.length) lines.push("Aucun échange enregistré.", "");
  lines.push("## Métadonnées historiques complètes", "", "Les textes sont ceux du journal enregistré, pas une preuve que tout l’audio a été entendu. Les données sensibles de cette session sont incluses : partager ce document uniquement avec les destinataires autorisés.", "");
  const { conversation_log: _log, ...context } = session;
  lines.push("### Session", "", jsonBlock(context), "", "### Messages et diagnostics par message", "", jsonBlock(messages));
  for (const [table, rows] of Object.entries(telemetry)) lines.push("", `### ${table}`, "", jsonBlock(rows));
  return lines.join("\n");
}
export function buildSessionsMarkdown(sessions: SessionExportData[], exportedAt = new Date().toISOString()): string {
  return `<!-- Export Ava — ${exportedAt} — ${sessions.length} session(s) -->\n\n${sessions.map(buildSessionMarkdown).join("\n\n---\n\n")}\n`;
}