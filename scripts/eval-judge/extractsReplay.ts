/**
 * Lot extraits (validation sandbox): replays the extract selector on a labelled corpus against the real
 * `video_triggers` rows, with the extract switch forced ON in memory only (no admin_settings write, production
 * refused). Reports selection rate, refusal reasons, latency and agreement with the expected extracts.
 * Usage: npm run eval:extracts -- [--corpus docs/eval/extraits_selection_corpus.json] [--runs 2] [--out report.json] [--env sandbox-ulrich]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fail, log, openEvalSession, readArgs } from "./session";

const args = readArgs(process.argv.slice(2));
const corpusFile = args.get("corpus") ?? "docs/eval/extraits_selection_corpus.json";
const runs = Math.max(1, Number(args.get("runs") ?? 2));
const outFile = args.get("out");
type Case = { id: string; character: string; user: string; reply: string; expect: string[] };
const corpus = JSON.parse(readFileSync(corpusFile, "utf8")) as Case[];

const session = await openEvalSession(args.get("env") ?? "sandbox-ulrich");
const [{ getVideoTriggersCached }, ex, { extractDefaults, getLLMSettings }, { callLLMWithUsage }] = await Promise.all([
  import("@/services/videoTriggerService"),
  import("@/services/extractSelection"),
  import("@/services/settingsService"),
  import("@/services/openRouterLLM"),
]);
const videos = (await getVideoTriggersCached()) as import("@/services/extractSelection").ExtractVideo[];
const model = getLLMSettings().LLM_MODEL_GM;
const settings = { ...extractDefaults, ENABLED: true };
log(`${videos.length} vidéos, modèle ${model}, ${corpus.length} cas × ${runs}`);

const percentile = (values: number[], p: number) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))] : null;
const rows: Array<Record<string, unknown>> = [];
const only = args.get("only")?.split(",");
let lastRaw = "";
for (const item of corpus) {
  if (only && !only.includes(item.id)) continue;
  for (let run = 0; run < runs; run += 1) {
    const gate = ex.selectExtractCandidates(videos, { path: "unseen", character: item.character, shownVideoIds: [], settings, userTurn: 6, lastExtractTurn: null });
    if (!gate.ok) { rows.push({ id: item.id, run, status: gate.reason, expect: item.expect }); continue; }
    const selection = await ex.selectExtract({
      replyText: item.reply, userMessage: item.user, characterName: item.character, candidates: gate.candidates, shown: [], recentExchanges: [],
      timeoutMs: ex.EXTRACT_SELECTION_TIMEOUT_MS,
    }, async (messages, options) => { const out = (await callLLMWithUsage(messages, {
      model, temperature: 0, max_tokens: ex.EXTRACT_SELECTOR_MAX_TOKENS, reasoning: false, disableReasoning: true,
      timeoutMs: options.timeoutMs, signal: options.signal, feature_key: "eval_extract_selection",
    })).content; lastRaw = out; return out; });
    const picked = selection.status === "selected" ? videos.find((v) => v.id === selection.videoId)?.title ?? selection.videoId : null;
    rows.push({ id: item.id, run, status: selection.status, picked, confidence: selection.status === "selected" ? selection.confidence : null,
      presentation: selection.status === "selected" ? selection.presentation : null,
      detail: selection.status === "selected" ? null : selection.detail ?? null, raw: selection.status === "invalid" || selection.status === "weak_link" ? lastRaw.slice(0, 400) : undefined, latencyMs: Math.round(selection.latencyMs), expect: item.expect,
      ok: item.expect.length ? picked !== null && item.expect.includes(picked) : picked === null });
  }
}
const withExpect = rows.filter((r) => (r.expect as string[]).length);
const withoutExpect = rows.filter((r) => !(r.expect as string[]).length);
const lat = rows.map((r) => r.latencyMs as number).filter((n) => Number.isFinite(n));
const byStatus: Record<string, number> = {};
for (const r of rows) byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;
const summary = {
  model, cases: corpus.length, runs, byStatus,
  recallOnRelevant: withExpect.filter((r) => r.ok).length / Math.max(1, withExpect.length),
  falsePositiveRateOnIrrelevant: withoutExpect.filter((r) => !r.ok).length / Math.max(1, withoutExpect.length),
  latencyMs: { p50: percentile(lat, 0.5), p90: percentile(lat, 0.9), max: lat.length ? Math.max(...lat) : null },
};
process.stdout.write(`${JSON.stringify({ summary, rows }, null, 1)}\n`);
if (outFile) writeFileSync(outFile, JSON.stringify({ summary, rows }, null, 1));
log(`✓ ${rows.length} rejeux`);
await session.close();
