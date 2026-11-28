/**
 * Shared reconstruction of every player question asked to Max and Emma since a
 * date, as the live optimized_v3 assembly saw it (lot 2 of the call frame, then
 * the sheet compression lot 1). Read-only: `sessions`,
 * `experience_orchestration_versions`, the synced sheets and the radar profile.
 * Production is refused. Souvenirs are not retrieved (no `query-rag` call); the
 * structured memory is the session's final one, the radar uses the initial levels.
 */
import { fail, log, openEvalSession } from "./session";
import type { CharacterPrompt } from "@/services/characterPromptService";
import type { ConversationMessage, MaxPromptAssemblyTrace } from "@/types";
import type { MaxAgentInput } from "@/agents/maxAgent";

export interface ReplayedTurn {
  env: string;
  session: string;
  turn: number;
  character: "max" | "emma";
  sheet: CharacterPrompt;
  input: MaxAgentInput;
  /** The live assembly for this turn; `options` are passed to the agent input. */
  build: (options?: Partial<MaxAgentInput>) => Promise<MaxPromptAssemblyTrace>;
}

export async function forEachReplayedTurn(env: string, since: string, onTurn: (turn: ReplayedTurn) => Promise<void>): Promise<number> {
  if (env === "prod") fail("Production refusée.");
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
      const build = (options: Partial<MaxAgentInput> = {}) =>
        buildMaxSystemPrompt({ ...input, ...options } as never, context.characterContext.displayName, context.characterContext, "optimized_v3");
      await onTurn({ env, session: row.id as string, turn, character: characterKey, sheet, input: input as unknown as MaxAgentInput, build });
      count += 1;
    }
  }
  log(`✓ ${env} : ${sessions?.length ?? 0} sessions, ${count} questions rejouées.`);
  await evalSession.close();
  return count;
}
