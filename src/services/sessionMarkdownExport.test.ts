import { describe, expect, it } from "vitest";
import { buildSessionMarkdown, buildSessionsMarkdown, latencyStats, type SessionExportData } from "./sessionMarkdownExport";

const fixture = (): SessionExportData => ({ session: { id: "s1", started_at: "2026-10-27T18:44:00Z", tester_label: "Ulrich", environment_id: "sandbox-ulrich",
  conversation_log: [{ role: "user", content: "Où est Ava ?" }, { role: "max", spokenWith: "emma", content: "Je ne sais pas.", pipeline: { latency_origin: "text_submitted", first_sound_status: "measured", total_ms: 2000 } },
    { role: "user", content: "Et Max ?" }, { role: "max", content: "Je suis là.", pipeline: { latency_origin: "text_submitted", first_sound_status: "measured", total_ms: 4000 } }] }, telemetry: {}, warnings: [] });
describe("session Markdown report", () => {
  it("averages only available positive finite measures", () => {
    expect(latencyStats([1000, 3000, null, undefined, 0, -10, NaN, Infinity])).toEqual({ count: 2, mean: 2000, median: 2000, p95: 2900, max: 3000 });
    expect(latencyStats([null, 0])).toBeNull();
  });
  it("attributes each answer from the persisted character rather than the current session character", () => {
    const md = buildSessionMarkdown(fixture());
    expect(md).toContain("**Emma :**\n\nJe ne sais pas.");
    expect(md).toContain("**Max :**\n\nJe suis là.");
    expect(md.indexOf("Où est Ava ?")).toBeLessThan(md.indexOf("Je ne sais pas."));
  });
  it("reports measured first sound averages and keeps origins separate", () => {
    const data = fixture();
    (data.session.conversation_log as unknown[]).push({ role: "max", pipeline: { latency_origin: "text_submitted", first_sound_status: "failed", total_ms: 20000 } },
      { role: "emma", pipeline: { latency_origin: "ptt_finalized", first_sound_status: "measured", total_ms: 9000 } });
    const md = buildSessionMarkdown(data);
    expect(md).toContain("(text_submitted, conversation) | 2 | 3000");
    expect(md).toContain("(ptt_finalized, conversation) | 1 | 9000");
  });
  it("includes telemetry failures, fallbacks and technical failures without fabricating a diagnosis", () => {
    const data = fixture();
    data.warnings.push("audio_latencies : refus d’accès");
    data.telemetry.voice_turn_events = [{ turn_index: 2, event_name: "tts_failed", severity: "error", metadata_json: { reason: "402" } }];
    (data.session.conversation_log as unknown[]).push({ role: "emma", content: "…", gmFallback: { kind: "timeout" } });
    const md = buildSessionMarkdown(data);
    expect(md).toContain("audio_latencies : refus d’accès");
    expect(md).toContain("tts_failed");
    expect(md).toContain("repli GM");
    expect(md).toContain("402");
  });
  it("exports all selected reports and handles empty conversations", () => {
    const empty = { session: { id: "s2", conversation_log: [] }, telemetry: {}, warnings: [] };
    const md = buildSessionsMarkdown([fixture(), empty], "2026-10-27T18:44:00Z");
    expect(md).toContain("Session : s1");
    expect(md).toContain("Session : s2");
    expect(md).toContain("Aucun échange enregistré.");
    expect(md).toContain("2026-10-27T18:44:00Z");
  });
  it("identifies a user message with no recorded response without claiming a technical cause", () => {
    const data = fixture();
    (data.session.conversation_log as unknown[]).push({ role: "user", content: "Tu m’entends ?" });
    const md = buildSessionMarkdown(data);
    expect(md).toContain("aucune réponse personnage enregistrée");
    expect(md).toContain("Cause indéterminée");
    expect(md).toContain("Tu m’entends ?");
  });
});