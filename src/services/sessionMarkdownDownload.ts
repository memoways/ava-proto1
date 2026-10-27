import { supabase } from "@/integrations/supabase/client";
import { buildSessionsMarkdown, type ExportRecord, type SessionExportData } from "./sessionMarkdownExport";

const TABLES = ["turn_latencies", "audio_latencies", "voice_turn_events", "experience_events", "llm_usage", "conversation_turn_traces"] as const;
async function readTelemetry(table: typeof TABLES[number], sessionId: string): Promise<ExportRecord[]> {
  const rows: ExportRecord[] = [];
  let after: string | undefined;
  for (;;) {
    const columns = table === "conversation_turn_traces" ? "id,session_id,turn_id,turn_index,character_name,status,schema_version,created_at,updated_at" : "*";
    let query = supabase.from(table).select(columns).eq("session_id", sessionId).order("id", { ascending: true }).limit(500);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as ExportRecord[];
    rows.push(...page);
    if (page.length < 500) return rows;
    const next = page.at(-1)?.id;
    if (typeof next !== "string" || next === after) throw new Error("Pagination interrompue");
    after = next;
  }
}
export async function prepareSessionsMarkdown(sessions: Array<{ id: string; account_display_name?: string }>): Promise<{ blob: Blob; filename: string; warningCount: number }> {
  const reports: SessionExportData[] = [];
  // Bound concurrent requests independently of the size of the selection.
  for (const selected of sessions) {
    const { data, error } = await supabase.from("sessions").select("*").eq("id", selected.id).single();
    if (error || !data) throw new Error(`Session ${selected.id} inaccessible : ${error?.message ?? "absente"}`);
    const report: SessionExportData = { session: { ...data, account_display_name: selected.account_display_name }, telemetry: {}, warnings: [] };
    await Promise.all(TABLES.map(async table => {
      try { report.telemetry[table] = await readTelemetry(table, selected.id); }
      catch (error) { report.warnings.push(`${table} : ${error instanceof Error ? error.message : String(error)}`); }
    }));
    reports.push(report);
  }
  const now = new Date().toISOString();
  return { blob: new Blob([buildSessionsMarkdown(reports, now)], { type: "text/markdown;charset=utf-8" }),
    filename: `ava-sessions-${now.slice(0, 10)}-${sessions.length === 1 ? sessions[0].id : sessions.length}.md`,
    warningCount: reports.reduce((count, report) => count + report.warnings.length, 0) };
}
export async function downloadSessionMarkdown(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}