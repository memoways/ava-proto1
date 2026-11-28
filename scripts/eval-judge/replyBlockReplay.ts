/**
 * Cadre de l'appel lot 2 — replays every player question asked to Max and Emma
 * since a date through the live optimized_v3 assembly, twice: with the synced
 * sheet as it is, and with the proposed « Comment tu réponds » block pasted in
 * « Ce que tu ne fais jamais » (in memory only). No model is called.
 *
 *   npm run eval:replay:reply-block -- --envs sandbox-ulrich,sandbox-romed,sandbox-benoit --since 2026-11-19 [--block-max file] [--block-emma file] [--out file.json]
 *
 * Read-only, turns rebuilt by `turnReplay.ts` (souvenirs not retrieved). Nothing
 * is written; production is refused.
 *
 * `--hashes` writes one hash per turn of the prompt without block, so the same
 * run on the previous code proves the prompt is unchanged when the sheet has no block.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, readArgs } from "./session";
import { forEachReplayedTurn } from "./turnReplay";
import type { CharacterPrompt } from "@/services/characterPromptService";
import type { MaxPromptAssemblyTrace } from "@/types";

const KEYS = ["character_core", "experience_frame", "relationship_directive", "character_state", "runtime_context", "conversation_memory", "character_canon", "rag_context"];

function readBlock(file: string | undefined): string | null {
  if (!file) return null;
  return readFileSync(path.resolve(process.cwd(), file), "utf8").trim();
}

function withBlock(sheet: CharacterPrompt, block: string): CharacterPrompt {
  return { ...sheet, ce_que_tu_ne_fais_jamais: `${(sheet.ce_que_tu_ne_fais_jamais ?? "").trim()}\n\n${block}` };
}

interface TurnRow {
  env: string; session: string; turn: number; character: "max" | "emma"; hash: string;
  plain: { system: number; limit: number; sections: Record<string, number>; warnings: string[] };
  block?: { system: number; limit: number; sections: Record<string, number>; warnings: string[]; sent: boolean; inCore: boolean; memoryDeduplicated?: string[] };
}

const sizes = (trace: MaxPromptAssemblyTrace) => Object.fromEntries((trace.budget?.sections ?? []).map((item) => [item.key, item.included ? item.chars : 0]));

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const envs = (args.get("envs") ?? "sandbox-ulrich").split(",").map((value) => value.trim()).filter(Boolean);
  if (envs.includes("prod")) fail("Production refusée.");
  const since = args.get("since") ?? "2026-11-19";
  const blocks = { max: readBlock(args.get("block-max")), emma: readBlock(args.get("block-emma")) };
  const rows: TurnRow[] = [];

  for (const env of envs) {
    await forEachReplayedTurn(env, since, async ({ session, turn, character: characterKey, sheet, build: buildTurn }) => {
      // The live assembly reads the sheet from the in-memory cache: the block is pasted
      // into that cached copy for one build, then the field is restored (never written).
      const build = async (block?: string) => {
        const saved = sheet.ce_que_tu_ne_fais_jamais;
        if (block) sheet.ce_que_tu_ne_fais_jamais = withBlock(sheet, block).ce_que_tu_ne_fais_jamais;
        try {
          return await buildTurn();
        } finally {
          sheet.ce_que_tu_ne_fais_jamais = saved;
        }
      };
      const plain = await build();
      const out: TurnRow = {
        env, session, turn, character: characterKey,
        hash: createHash("sha256").update(plain.finalSystemPrompt).digest("hex").slice(0, 16),
        plain: { system: plain.finalSystemPrompt.length, limit: plain.budget?.contextLimitChars ?? 0, sections: sizes(plain), warnings: (plain.budget?.warnings ?? []).map((item) => item.code) },
      };
      const block = blocks[characterKey];
      if (block) {
        const trace = await build(block);
        const core = trace.injectedSections.find((item) => item.key === "character_core")?.content ?? "";
        const body = block.split("\n").slice(1).join("\n").trim();
        out.block = {
          system: trace.finalSystemPrompt.length, limit: trace.budget?.contextLimitChars ?? 0, sections: sizes(trace),
          warnings: (trace.budget?.warnings ?? []).map((item) => item.code),
          sent: trace.budget?.replyBlock?.sent === true, inCore: core.includes(body),
        };
        // A memory sentence now said by the block is deduplicated, not evicted: keep it visible.
        const memoryOf = (value: MaxPromptAssemblyTrace) => value.injectedSections.find((item) => item.key === "conversation_memory")?.content ?? "";
        const after = memoryOf(trace);
        const removed = memoryOf(plain).split(/\n+|(?<=[.!?…])\s+|;\s+/).filter((part) => part.trim() && !after.includes(part.trim()));
        if (removed.length) out.block.memoryDeduplicated = removed;
      }
      rows.push(out);
    });
  }

  const report = summarize(rows);
  log(report.text);
  const file = args.get("out");
  if (file) {
    const target = path.resolve(process.cwd(), file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify({ since, envs, capturedAt: new Date().toISOString(), summary: report.numbers, turns: rows }, null, 2)}\n`, "utf8");
    log(`✓ ${target}`);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

export function summarize(rows: TurnRow[]) {
  const numbers: Record<string, unknown> = {};
  const lines: string[] = [];
  for (const character of ["max", "emma"] as const) {
    const own = rows.filter((row) => row.character === character);
    const withBlockRows = own.filter((row) => row.block);
    const sameOthers = withBlockRows.filter((row) => KEYS.filter((key) => key !== "character_core")
      .every((key) => (row.block!.sections[key] ?? 0) === (row.plain.sections[key] ?? 0))).length;
    const deltas = withBlockRows.map((row) => row.block!.system - row.plain.system);
    const entry = {
      questions: own.length,
      systemMedian: median(own.map((row) => row.plain.system)),
      systemMax: Math.max(0, ...own.map((row) => row.plain.system)),
      blockSent: withBlockRows.filter((row) => row.block!.sent && row.block!.inCore).length,
      otherSectionsUnchanged: sameOthers,
      deltaMin: deltas.length ? Math.min(...deltas) : 0, deltaMax: deltas.length ? Math.max(...deltas) : 0,
      newWarnings: withBlockRows.filter((row) => row.block!.warnings.join() !== row.plain.warnings.join()).length,
      memoryDropped: own.filter((row) => row.plain.sections.conversation_memory === 0).length,
      canonDropped: own.filter((row) => row.plain.sections.character_canon === 0).length,
    };
    numbers[character] = entry;
    lines.push(`${character} : ${entry.questions} questions · prompt médian ${entry.systemMedian} car. (max ${entry.systemMax}) · bloc envoyé ${entry.blockSent}/${withBlockRows.length} · autres sections identiques ${entry.otherSectionsUnchanged}/${withBlockRows.length} · écart ${entry.deltaMin}–${entry.deltaMax} car. · nouvelles alertes ${entry.newWarnings}`);
  }
  return { numbers, text: lines.join("\n") };
}

main().then(() => process.exit(0), (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
