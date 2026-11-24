/**
 * Souvenirs lot 1 — replays player questions of a sandbox session through the
 * live prompt assembly, without calling any model, and shows which sections and
 * souvenirs actually reach the character.
 *
 *   npm run eval:replay:souvenirs -- --env sandbox-romed --session 5215c870 --turns 10,12,37 [--compare] [--out file.json]
 *   npm run eval:replay:souvenirs -- --env sandbox-romed --session 783f4a09 --turns 15,46 --compare
 *
 * `--keep-candidates` also writes the retrieved souvenirs (editorial text only) in
 * `--out`, to refresh src/agents/__fixtures__/souvenirsSandboxRomed20261123.json.
 *
 * Read-only: `sessions`, `experience_orchestration_versions`, the synced sheet,
 * the radar profile and the real `query-rag` search (same settings as the live
 * turn). Nothing is written; production is refused. `--turns` counts the
 * player's messages of the session (1 = first question). `--compare` also
 * assembles each turn without the reserved room (previous behaviour).
 *
 * Known approximations, written in the report: the structured memory is the
 * session's final one (capped at 1 200 characters anyway), the radar uses the
 * initial levels and the speech-state line of the turn is not rebuilt.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, log, openEvalSession, readArgs } from "./session";
import type { ConversationMessage, MaxPromptAssemblyTrace } from "@/types";

const SOUVENIR_CODE = /\b[JS]-\d+\.\d+\b/;

function uuidRange(prefix: string): [string, string] | null {
  const hex = prefix.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!hex || hex.length > 32) return null;
  const pad = (value: string, fill: string) => {
    const full = value.padEnd(32, fill);
    return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`;
  };
  return [pad(hex, "0"), pad(hex, "f")];
}

export interface ReplayTurnSummary {
  turn: number;
  character: string;
  question: string;
  reservations: boolean;
  limitChars: number;
  systemChars: number;
  historyChars: number;
  sections: Array<{ key: string; chars: number; included: boolean; reason?: string }>;
  ragFound: Array<{ rank: number; code: string | null; similarity: number }>;
  ragSent: Array<{ rank: number; code: string | null }>;
  warnings: string[];
}

export function summarizeReplayTurn(
  base: Pick<ReplayTurnSummary, "turn" | "character" | "question" | "reservations">,
  trace: MaxPromptAssemblyTrace,
  matches: Array<{ id: string; content: string; similarity: number }>,
): ReplayTurnSummary {
  const budget = trace.budget;
  const sent = new Set(budget?.sentRagIds ?? []);
  const code = (content: string) => content.match(SOUVENIR_CODE)?.[0] ?? null;
  return {
    ...base,
    limitChars: budget?.limitChars ?? 0,
    systemChars: budget?.totalSystemChars ?? trace.finalSystemPrompt.length,
    historyChars: budget?.historyChars ?? 0,
    sections: (budget?.sections ?? []).map((section) => ({
      key: section.key,
      chars: section.chars,
      included: section.included,
      ...(section.omissionReason ? { reason: section.omissionReason } : {}),
    })),
    ragFound: matches.map((match, index) => ({ rank: index + 1, code: code(match.content), similarity: Math.round(match.similarity * 100) / 100 })),
    ragSent: matches.flatMap((match, index) => sent.has(match.id) ? [{ rank: index + 1, code: code(match.content) }] : []),
    warnings: (budget?.warnings ?? []).map((warning) => warning.code),
  };
}

function printTurn(summary: ReplayTurnSummary): void {
  const label = summary.reservations ? "avec place réservée" : "sans place réservée";
  log(`\n— ${summary.character} · tour ${summary.turn} · ${label}\n  « ${summary.question.slice(0, 110)} »`);
  log(`  système ${summary.systemChars} / limite ${summary.limitChars} car. · historique ${summary.historyChars}`);
  for (const section of summary.sections) {
    if (!section.included && section.reason === "section_vide") continue;
    log(`  ${section.included ? "✓" : "✗"} ${section.key.padEnd(24)} ${section.included ? `${section.chars} car.` : section.reason}`);
  }
  log(`  RAG trouvés : ${summary.ragFound.map((match) => `${match.rank}:${match.code ?? "?"}(${match.similarity})`).join(" ") || "aucun"}`);
  log(`  Souvenirs envoyés : ${summary.ragSent.map((match) => `${match.rank}:${match.code ?? "?"}`).join(" ") || "aucun"}`);
  if (summary.warnings.length) log(`  ⚠ ${summary.warnings.join(", ")}`);
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const sessionArg = args.get("session");
  const turnsArg = args.get("turns");
  if (!sessionArg || !turnsArg) fail("--session <id ou préfixe> et --turns <n,n,…> sont requis.");
  const turns = turnsArg.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
  if (!turns.length) fail("--turns : liste de numéros de question (1 = première question du joueur).");
  const evalSession = await openEvalSession(args.get("env") ?? "sandbox-romed");
  const { supabase } = evalSession;

  const range = sessionArg.length >= 36 ? [sessionArg, sessionArg] as const : uuidRange(sessionArg);
  if (!range) fail(`Identifiant de session illisible : ${sessionArg}`);
  const { data: rows, error } = await supabase.from("sessions")
    .select("id, environment_id, conversation_log, conversation_memory, memory_last_turn, orchestration_version_id, has_seen_film, user_posture_raw")
    .gte("id", range[0]).lte("id", range[1]).limit(2);
  if (error) fail(`Lecture de la session refusée : ${error.message}`);
  if (!rows?.length) fail(`Aucune session ${sessionArg} lisible dans ${evalSession.environment}.`);
  if (rows.length > 1) fail(`Préfixe ambigu : ${rows.map((row) => row.id).join(", ")}`);
  const row = rows[0];
  if (row.environment_id && row.environment_id !== evalSession.environment) {
    fail(`La session appartient à ${row.environment_id}, pas à ${evalSession.environment} : relancer avec --env ${row.environment_id}.`);
  }
  log(`✓ Session ${row.id} · orchestration ${row.orchestration_version_id ?? "aucune"}`);

  const [
    { buildMaxSystemPrompt },
    { OPTIMIZED_V3_LIMITS, OPTIMIZED_V3_SECTION_RESERVATIONS },
    { resolveEvalCharacterContext },
    { queryRAGDetailed },
    { getGameplaySettings },
    { characterRagTopKForVariant },
    { RAG_DEFAULT_RETRIEVE_K, normalizeSessionDurationSeconds },
    { selectOptimizedConversation, selectRecentConversation },
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
    import("@/agents/maxOptimizedPromptCompiler"),
    import("@/services/evalJudgePipeline"),
    import("@/services/ragService"),
    import("@/services/settingsService"),
    import("@/services/characterRagTopK"),
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

  const orchestration = row.orchestration_version_id
    ? (await supabase.from("experience_orchestration_versions").select("config").eq("id", row.orchestration_version_id).maybeSingle()).data
    : null;
  const directorConfig = orchestration?.config ? normalizeDirectorConfig(orchestration.config as never) : null;
  const gameplay = getGameplaySettings();
  const log_ = projectDeliveredConversation((Array.isArray(row.conversation_log) ? row.conversation_log : []) as unknown as ConversationMessage[]);
  const userIndexes = log_.flatMap((message, index) => message.role === "user" ? [index] : []);
  const memoryAll = normalizeConversationMemory(row.conversation_memory);
  const contexts = new Map<string, Awaited<ReturnType<typeof resolveEvalCharacterContext>>>();
  const summaries: ReplayTurnSummary[] = [];

  for (const turn of turns) {
    const index = userIndexes[turn - 1];
    if (index === undefined) { log(`⚠ Tour ${turn} absent (la session compte ${userIndexes.length} questions).`); continue; }
    const question = log_[index];
    const answer = log_.slice(index + 1).find((message) => message.role !== "user");
    const characterKey = (question.spokenWith ?? (answer?.role === "emma" ? "emma" : "max")) as "max" | "emma";
    const name = characterKey === "max" ? "Max" : "Emma";
    if (!contexts.has(name)) contexts.set(name, await resolveEvalCharacterContext(name));
    const { characterContext } = contexts.get(name)!;
    const sheet = await loadCharacterPrompt(characterContext.characterId);
    if (!sheet) fail(`Fiche ${name} introuvable.`);
    const history = log_.slice(0, index);
    const memory = filterConversationMemoryForCharacter(memoryAll, characterKey);
    const sliceUserTurns = history.filter((message) => message.role === "user").length;
    const conversation = selectOptimizedConversation(history, characterKey === "max" && memory.lastTurn < sliceUserTurns ? memory.lastTurn : 0);
    const recent = selectRecentConversation(history).slice(-2).map((message) => message.content).join(" ");
    const topK = characterRagTopKForVariant("optimized_v3", gameplay.RAG_TOP_K);
    const rag = await queryRAGDetailed(question.content, recent, topK, gameplay.RAG_MATCH_THRESHOLD, {
      characterId: characterContext.characterId,
      characterContext,
      rerank: gameplay.RAG_RERANK_ENABLED,
      retrieveK: Math.max(gameplay.RAG_RETRIEVE_K ?? RAG_DEFAULT_RETRIEVE_K, topK),
      rerankModel: gameplay.RAG_RERANK_MODEL,
      rerankTruncation: gameplay.RAG_RERANK_TRUNCATION,
    });
    if (rag.error) log(`⚠ RAG en erreur au tour ${turn} : ${rag.error}`);
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
    const profile = await fetchCharacterStateProfile(characterKey, null).catch((cause: unknown) => {
      log(`⚠ Profil radar illisible (${cause instanceof Error ? cause.message : String(cause)}) : tour assemblé sans état.`);
      return null;
    });
    if (!profile) log(`ℹ ${name} : aucun profil radar dans cet environnement.`);
    const levels = resolveCharacterStateForTurn({ profile, mode: "full", logged: null });
    const firstAt = log_[0]?.timestamp ?? question.timestamp;
    const input = {
      conversationHistory: conversation,
      userMessage: question.content,
      conversationMemory: memory,
      ragCandidates: rag.matches.map((match, rank) => ({ id: match.id, content: match.content, rank: rank + 1 })),
      userRoleSummary: row.user_posture_raw?.trim() ? `L'utilisateur a démarré la conversation en exprimant ceci : « ${row.user_posture_raw.trim()} »` : undefined,
      temporalContext: isCharacterTimeCuesEnabled(directorConfig)
        ? { timeElapsedSeconds: Math.max(0, Math.round((question.timestamp - firstAt) / 1000)), sessionDurationSeconds: normalizeSessionDurationSeconds(gameplay.TIMEOUT_SECONDS), turnIndex: turn }
        : undefined,
      relationshipDirective: directive.prompt,
      experienceFrame: frame.prompt || undefined,
      characterState: profile && levels ? compileCharacterStateBlock(levels, profile) : undefined,
    };
    const modes = args.has("compare") ? [false, true] : [true];
    for (const reservations of modes) {
      const saved = { enabled: OPTIMIZED_V3_SECTION_RESERVATIONS.enabled, limit: OPTIMIZED_V3_LIMITS.generatedContextChars };
      OPTIMIZED_V3_SECTION_RESERVATIONS.enabled = reservations;
      OPTIMIZED_V3_LIMITS.generatedContextChars = OPTIMIZED_V3_SECTION_RESERVATIONS.baseContextChars
        + (reservations ? OPTIMIZED_V3_SECTION_RESERVATIONS.extraContextChars : 0);
      try {
        const trace = await buildMaxSystemPrompt(input as never, characterContext.displayName, characterContext, "optimized_v3");
        const summary = summarizeReplayTurn({ turn, character: name, question: question.content, reservations }, trace, rag.matches);
        summaries.push(args.has("keep-candidates") && reservations
          // Read-only copy of the editorial souvenirs, used to refresh the test fixture.
          ? { ...summary, candidates: rag.matches.map((match) => ({ id: match.id, content: match.content })) } as ReplayTurnSummary
          : summary);
        printTurn(summary);
      } finally {
        OPTIMIZED_V3_SECTION_RESERVATIONS.enabled = saved.enabled;
        OPTIMIZED_V3_LIMITS.generatedContextChars = saved.limit;
      }
    }
  }

  const file = args.get("out");
  if (file) {
    const target = path.resolve(process.cwd(), file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify({ session: row.id, environment: evalSession.environment, capturedAt: new Date().toISOString(), turns: summaries }, null, 2)}\n`, "utf8");
    log(`\n✓ ${path.relative(process.cwd(), target)}`);
  }
  await evalSession.close();
}

main().then(() => process.exit(0), (error: unknown) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
