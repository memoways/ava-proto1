/**
 * Compression de la fiche, lot 1 — replays every player question asked to Max and
 * Emma since a date through the live optimized_v3 assembly, once per level
 * (Actuel, Consignes entières, Fiche entière). No model is called, nothing is
 * written, production is refused; turns are rebuilt by `turnReplay.ts`
 * (souvenirs not retrieved).
 *
 *   npm run eval:replay:compression -- --envs sandbox-ulrich,sandbox-romed,sandbox-benoit --since 2026-11-19 [--out file.json] [--hashes file.json]
 *
 * For each turn and level: system prompt size and limit, part of the sheet sent
 * (field by field), sections left out and warnings, and the memory sentences that
 * a level removes compared with « Actuel ». `--hashes` writes one hash per turn
 * of the « Actuel » prompt: the same run on main's code proves it is unchanged.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, readArgs } from "./session";
import { forEachReplayedTurn } from "./turnReplay";
import { measureSheetCoverage, SHEET_COMPRESSION_LEVELS, type SheetCompressionLevel } from "@/agents/sheetCompression";
import type { MaxPromptAssemblyTrace } from "@/types";

interface LevelRow {
  system: number;
  limit: number;
  share: number;
  fields: Record<string, number>;
  sections: Record<string, number>;
  dropped: string[];
  warnings: string[];
  memoryRemoved?: string[];
}
interface TurnRow { env: string; session: string; turn: number; character: "max" | "emma"; hash: string; levels: Record<SheetCompressionLevel, LevelRow> }

const memoryOf = (trace: MaxPromptAssemblyTrace) => trace.injectedSections.find((item) => item.key === "conversation_memory")?.content ?? "";
const memoryParts = (text: string) => text.split(/\n+|(?<=[.!?…])\s+|;\s+/).map((part) => part.trim()).filter(Boolean);
const comparable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const envs = (args.get("envs") ?? "sandbox-ulrich").split(",").map((value) => value.trim()).filter(Boolean);
  if (envs.includes("prod")) fail("Production refusée.");
  const since = args.get("since") ?? "2026-11-19";
  const rows: TurnRow[] = [];
  for (const env of envs) {
    await forEachReplayedTurn(env, since, async ({ session, turn, character, sheet, build }) => {
      const levels = {} as Record<SheetCompressionLevel, LevelRow>;
      let current: MaxPromptAssemblyTrace | null = null;
      let hash = "";
      for (const level of SHEET_COMPRESSION_LEVELS) {
        const trace = await build({ sheetCompression: level });
        if (level === "current") {
          current = trace;
          hash = createHash("sha256").update(trace.finalSystemPrompt).digest("hex").slice(0, 16);
        }
        const coverage = measureSheetCoverage(sheet, trace.finalSystemPrompt);
        const sections = trace.budget?.sections ?? [];
        const row: LevelRow = {
          system: trace.finalSystemPrompt.length,
          limit: trace.budget?.contextLimitChars ?? 0,
          share: Math.round(coverage.share * 1000) / 1000,
          fields: Object.fromEntries(coverage.fields.map((field) => [field.key, field.chars ? Math.round((field.sentChars / field.chars) * 1000) / 1000 : 0])),
          sections: Object.fromEntries(sections.map((item) => [item.key, item.included ? item.chars : 0])),
          dropped: sections.filter((item) => !item.included && item.omissionReason && item.omissionReason !== "section_vide").map((item) => `${item.key}:${item.omissionReason}`),
          warnings: (trace.budget?.warnings ?? []).map((item) => item.code),
        };
        if (level !== "current" && current) {
          // A sentence counts as removed when its words are no longer in the memory sent.
          const after = ` ${comparable(memoryOf(trace))} `;
          const removed = memoryParts(memoryOf(current)).filter((part) => comparable(part) && !after.includes(` ${comparable(part)} `));
          if (removed.length) row.memoryRemoved = removed;
        }
        levels[level] = row;
      }
      rows.push({ env, session, turn, character, hash, levels });
    });
  }
  const report = summarize(rows);
  log(report.text);
  const write = (file: string | undefined, value: unknown) => {
    if (!file) return;
    const target = path.resolve(process.cwd(), file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    log(`✓ ${target}`);
  };
  write(args.get("out"), { since, envs, capturedAt: new Date().toISOString(), summary: report.numbers, turns: rows });
  write(args.get("hashes"), rows.map((row) => ({ env: row.env, session: row.session, turn: row.turn, hash: row.hash })));
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
}

export function summarize(rows: TurnRow[]) {
  const numbers: Record<string, unknown> = {};
  const lines: string[] = [];
  for (const character of ["max", "emma"] as const) {
    const own = rows.filter((row) => row.character === character);
    if (!own.length) continue;
    for (const level of SHEET_COMPRESSION_LEVELS) {
      const values = own.map((row) => row.levels[level]);
      const count = (predicate: (row: LevelRow) => boolean) => values.filter(predicate).length;
      const entry = {
        questions: own.length,
        systemMedian: quantile(values.map((row) => row.system), 0.5),
        systemP90: quantile(values.map((row) => row.system), 0.9),
        systemMax: Math.max(...values.map((row) => row.system)),
        shareMedian: quantile(values.map((row) => row.share), 0.5),
        memoryDropped: count((row) => row.dropped.some((item) => item.startsWith("conversation_memory"))),
        canonDropped: count((row) => row.dropped.some((item) => item.startsWith("character_canon"))),
        anyDropped: count((row) => row.dropped.length > 0),
        warnings: count((row) => row.warnings.length > 0),
        memoryTrimmed: count((row) => Boolean(row.memoryRemoved?.length)),
        memoryLonger: own.filter((row) => (row.levels[level].sections.conversation_memory ?? 0) > (row.levels.current.sections.conversation_memory ?? 0)).length,
      };
      numbers[`${character}.${level}`] = entry;
      lines.push(`${character} · ${level} : ${entry.questions} questions · prompt médian ${entry.systemMedian} car. (p90 ${entry.systemP90}, max ${entry.systemMax}) · part de la fiche ${Math.round(entry.shareMedian * 100)} % · sections évincées ${entry.anyDropped} (mémoire ${entry.memoryDropped}, canon ${entry.canonDropped}) · alertes ${entry.warnings} · phrases de mémoire retirées ${entry.memoryTrimmed} · mémoire plus longue ${entry.memoryLonger}`);
    }
  }
  return { numbers, text: lines.join("\n") };
}

main().then(() => process.exit(0), (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
