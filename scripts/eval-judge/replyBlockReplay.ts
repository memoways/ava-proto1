/**
 * Cadre de l'appel lot 2 — replays every player question asked to Max and Emma
 * since a date through the live optimized_v3 assembly, twice: with the synced
 * sheet as it is, and with the proposed « Comment tu réponds » block pasted in
 * « Ce que tu ne fais jamais » (in memory only). No model is called.
 *
 *   npm run eval:replay:reply-block -- --envs sandbox-ulrich,sandbox-romed,sandbox-benoit --since 2026-11-19 [--block-max file] [--block-emma file] [--out file.json]
 *
 * Read-only: `sessions`, `experience_orchestration_versions`, the synced sheets
 * and the radar profile. Nothing is written; production is refused. Like the
 * lot 1 diagnostic, souvenirs are not retrieved (no `query-rag` call): the unit
 * tests cover them on real souvenirs. The structured memory is the session's
 * final one, the radar uses the initial levels.
 *
 * `--hashes` writes one hash per turn of the prompt without block, so the same
 * run on the previous code proves the prompt is unchanged when the sheet has no block.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";
import type { CharacterPrompt } from "@/services/characterPromptService";
import type { ConversationMessage, MaxPromptAssemblyTrace } from "@/types";

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
    const evalSession = await openEvalSession(env);
    const { supabase } = evalSession;
    const [
      { buildMaxSystemPrompt },
      { resolveEvalCharacterContext },
      { getGameplaySettings },
      { normalizeSessionDurationSeconds },
      { selectOptimizedConversation },
      { filterConversationMemoryForCharacter, normalizeConversationMemory },
      relationship,
      { buildExperienceFrame },
      { latestCallTransfer },
      { normalizeDirectorConfig, fetchCharacterStateProfile },
      { compileCharacterStateBlock, resolveCharacterStateForTurn },
      { isCharacterTimeCuesEnabled },
      { loadCharacterPrompt },
      { projectDeliveredConversation },
    ] = await Promise.all([
      import("@/agents/maxAgent"),
      import("@/services/evalJudgePipeline"),
      import("@/services/settingsService"),
      import("@/config/experienceRuntime"),
      import("@/services/conversationMemory"),
      import("@/services/conversationMemoryV1"),
      import("@/services/relationshipEngine"),
      import("@/services/experienceFrame"),
      import("@/services/characterConversationContinuity"),
      import("@/services/experienceOrchestration"),
      import("@/services/characterState"),
      import("@/services/characterTimeCues"),
      import("@/services/characterPromptService"),
      import("@/services/responseDelivery"),
    ]);
    const { data: sessions, error } = await supabase.from("sessions")
      .select("id, environment_id, started_at, conversation_log, conversation_memory, orchestration_version_id, has_seen_film, user_posture_raw")
      .eq("environment_id", env).gte("started_at", since).order("started_at");
    if (error) fail(`${env} : lecture des sessions refusée (${error.message})`);
    const gameplay = getGameplaySettings();
    const characters = new Map<string, { context: Awaited<ReturnType<typeof resolveEvalCharacterContext>>; sheet: CharacterPrompt; profile: Awaited<ReturnType<typeof fetchCharacterStateProfile>> | null }>();
    for (const key of ["max", "emma"] as const) {
      const context = await resolveEvalCharacterContext(key === "max" ? "Max" : "Emma");
      const sheet = await loadCharacterPrompt(context.characterContext.characterId);
      if (!sheet) fail(`${env} : fiche ${key} introuvable.`);
      const profile = await fetchCharacterStateProfile(key, null).catch(() => null);
      characters.set(key, { context, sheet, profile });
    }
    const orchestrations = new Map<string, unknown>();
    let count = 0;
    for (const row of sessions ?? []) {
      const versionId = row.orchestration_version_id as string | null;
      if (versionId && !orchestrations.has(versionId)) {
        orchestrations.set(versionId, (await supabase.from("experience_orchestration_versions").select("config").eq("id", versionId).maybeSingle()).data?.config ?? null);
      }
      const config = versionId ? orchestrations.get(versionId) : null;
      const directorConfig = config ? normalizeDirectorConfig(config as never) : null;
      const log_ = projectDeliveredConversation((Array.isArray(row.conversation_log) ? row.conversation_log : []) as unknown as ConversationMessage[]);
      const memoryAll = normalizeConversationMemory(row.conversation_memory);
      let turn = 0;
      for (const [index, question] of log_.entries()) {
        if (question.role !== "user") continue;
        turn += 1;
        const answer = log_.slice(index + 1).find((message) => message.role !== "user");
        if (!answer) continue;
        const characterKey = (question.spokenWith ?? (answer.role === "emma" ? "emma" : "max")) as "max" | "emma";
        const { context, sheet, profile } = characters.get(characterKey)!;
        const history = log_.slice(0, index);
        const memory = filterConversationMemoryForCharacter(memoryAll, characterKey);
        const sliceUserTurns = history.filter((message) => message.role === "user").length;
        const policy = relationship.compileCharacterRelationshipPolicy(sheet, characterKey);
        const relationshipState = relationship.normalizeRelationshipState(memory.relationship, characterKey, policy.version);
        const directive = relationship.buildTurnRelationshipDirective({ policy, state: relationshipState, userMessage: question.content });
        const frame = buildExperienceFrame({
          config: directorConfig?.frame,
          filmAnswer: row.has_seen_film as never,
          callTransfer: latestCallTransfer(characterKey, history),
          knownAboutPlayer: [
            memory.interlocutor?.name ? `prénom : ${memory.interlocutor.name}` : "",
            memory.interlocutor?.role ? `statut évoqué : ${memory.interlocutor.role}` : "",
          ],
        });
        const levels = resolveCharacterStateForTurn({ profile, mode: "full", logged: null });
        const firstAt = log_[0]?.timestamp ?? question.timestamp;
        const input = {
          conversationHistory: selectOptimizedConversation(history, characterKey === "max" && memory.lastTurn < sliceUserTurns ? memory.lastTurn : 0),
          userMessage: question.content,
          conversationMemory: memory,
          ragCandidates: [],
          userRoleSummary: row.user_posture_raw?.trim() ? `L'utilisateur a démarré la conversation en exprimant ceci : « ${row.user_posture_raw.trim()} »` : undefined,
          temporalContext: isCharacterTimeCuesEnabled(directorConfig)
            ? { timeElapsedSeconds: Math.max(0, Math.round((question.timestamp - firstAt) / 1000)), sessionDurationSeconds: normalizeSessionDurationSeconds(gameplay.TIMEOUT_SECONDS), turnIndex: turn }
            : undefined,
          relationshipDirective: directive.prompt,
          experienceFrame: frame.prompt || undefined,
          characterState: profile && levels ? compileCharacterStateBlock(levels, profile) : undefined,
        };
        // The live assembly reads the sheet from the in-memory cache: the block is pasted
        // into that cached copy for one build, then the field is restored (never written).
        const build = async (block?: string) => {
          const saved = sheet.ce_que_tu_ne_fais_jamais;
          if (block) sheet.ce_que_tu_ne_fais_jamais = withBlock(sheet, block).ce_que_tu_ne_fais_jamais;
          try {
            return await buildMaxSystemPrompt(input as never, context.characterContext.displayName, context.characterContext, "optimized_v3");
          } finally {
            sheet.ce_que_tu_ne_fais_jamais = saved;
          }
        };
        const plain = await build();
        const out: TurnRow = {
          env, session: row.id as string, turn, character: characterKey,
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
        count += 1;
      }
    }
    log(`✓ ${env} : ${sessions?.length ?? 0} sessions, ${count} questions rejouées.`);
    await evalSession.close();
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
