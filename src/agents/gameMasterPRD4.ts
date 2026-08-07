/**
 * PRD4 — Évaluateur post-tour du Game Master.
 *
 * Appelé en void après chaque réponse de Max (n'est jamais sur le chemin
 * critique du TTS). Retourne le schéma PRD4 §10.3 + un éventuel `trigger_video_id`
 * choisi parmi les vidéos disponibles (table `video_triggers`).
 * Persiste l'entrée dans `sessions.gm_post_turn_log` (jsonb append-only).
 */
import { callLLMWithUsage, LLMProxyRequestError } from "@/services/openRouterLLM";
import { getLLMSettings } from "@/services/settingsService";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { persistPostTurnMemory } from "@/services/sessionConversationMemory";
import { normalizeMemoryText } from "@/services/conversationMemoryV1";
import type { ConversationMemoryDelta, ConversationMemoryV1, ConversationMessage, DirectorAction, ExperienceDirectorConfig, LLMCallDiagnosticTrace, PRD4PostTurnEvaluation, TraceMessage, UserRoleProfile } from "@/types";

export interface PRD4PostTurnInput {
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  userRole: UserRoleProfile | null;
  /** État durable antérieur, notamment pour résoudre un fil par son id stable. */
  conversationMemoryBefore?: ConversationMemoryV1 | null;
  /** GIFF — posture initiale exprimée par l'utilisateur avant l'appel. */
  userPostureRaw?: string | null;
  turnIndex: number;
  timeElapsedSeconds: number;
  sessionDurationSeconds: number;
  minimumClosureSeconds: number;
  /** IDs de triggers vidéo déjà joués (évite de rejouer). */
  triggeredVideoIds?: string[];
  signal?: AbortSignal;
  diagnosticTrace?: boolean;
  systemPromptOverride?: string | null;
  orchestrationVersionId?: string | null;
  orchestrationConfig?: ExperienceDirectorConfig | null;
  currentCharacter?: "max" | "emma";
  /** Admin draft tests set this to false so they cannot mutate live sessions. */
  persist?: boolean;
}

export type PRD4PostTurnDetailedResult = PRD4PostTurnEvaluation & {
  diagnostic?: {
    messages: TraceMessage[];
    llm: LLMCallDiagnosticTrace | null;
    rawResponse: string | null;
    parsedOutput: PRD4PostTurnEvaluation;
    error: string | null;
  };
};

const DEFAULT_RESULT: PRD4PostTurnEvaluation = {
  engagement_delta: 0,
  confusion_detected: false,
  role_usage_quality: "unknown",
  topics_covered: [],
  transition_recommended: false,
  cinematic_hint: null,
  next_turn_guidance: "Continue la conversation naturellement.",
  end_recommended: false,
  moderation_flag: false,
  notes: "Évaluation par défaut (LLM indisponible).",
  trigger_video_id: null,
  labels: { themes: [], topics: [], intentions: [] },
  memory_delta: null,
  action: { type: "none" },
};

const GM_POST_TURN_TIMEOUT_MS = 12000;

export const EXPERIENCE_DIRECTOR_SYSTEM_PROMPT = `Tu es le directeur d'expérience d'une expérience narrative en temps réel dont la durée est configurée par l'administration, entre un joueur et Max (père d'Ava), puis éventuellement Emma. Après chaque échange, tu produis une seule décision structurée en JSON STRICT — aucun texte hors JSON. Cet appel a lieu après le texte du personnage et ne doit jamais retarder sa voix.

Tu retournes EXACTEMENT cet objet :
{
  "labels": {                       // Labels extraits du DERNIER message utilisateur. Max 4 labels au total cumulés sur les 3 listes. Ne PAS inventer : si rien d'évident, mets une liste vide. Ne force jamais.
    "themes": string[],             // Grand thème narratif (1-3 mots, en minuscules). Ex: "famille", "patriarcat", "trahison", "secrets", "confiance", "deuil", "violence", "mémoire". Vide si pas clair.
    "topics": string[],             // Sujet concret évoqué (1-3 mots). Ex: "sœur", "enfance", "disparition", "film", "police". Vide si pas clair.
    "intentions": string[]          // Intention de l'utilisateur (1-2 mots). Ex: "question", "défi", "empathie", "doute", "provocation". Vide si pas claire.
  },
  "engagement_delta": number,       // -2..+2 — qualité de l'échange pour le joueur
  "confusion_detected": boolean,    // true si le joueur semble perdu ou Max contradictoire
  "role_usage_quality": "low" | "medium" | "high" | "unknown",
  "topics_covered": string[],       // duplicate compacté de labels.topics (rétro-compat)
  "transition_recommended": boolean,
  "cinematic_hint": string | null,
  "next_turn_guidance": string,     // 1 phrase concise pour guider Max au prochain tour
  "end_recommended": boolean,
  "moderation_flag": boolean,
  "notes": string,
  "trigger_video_id": string | null, // voir bloc VIDÉOS DISPONIBLES
  "action": {                       // Une action maximum. Le moteur déterministe la validera.
    "type": "none" | "cinematic" | "handoff" | "end",
    "videoId"?: string,
    "confidence"?: number,
    "targetCharacter"?: "emma",
    "proposalGuidance"?: string,
    "reason"?: string
  },
  "memory_delta": {                 // Mémoire durable du DERNIER échange seulement. Ne rien inventer.
    "interlocutor": { "name": string | null, "role": string | null, "traits": string[] },
    "userFacts": string[],          // faits personnels explicitement confiés par l'utilisateur
    "maxDisclosures": string[],     // faits ou aveux que Max a explicitement révélés dans sa réponse
    "commitments": string[],        // promesses, décisions ou actions annoncées
    "openThreads": string[],        // sujets précis encore ouverts
    "resolvedThreadIds": string[],  // ids fournis dans une mémoire antérieure, sinon []
    "topics": string[],
    "relationship": { "depth": "surface" | "fissure" | "verite" | "bonus", "trust": "fragile" | "neutre" | "ouverte", "emotionalState": string | null },
    "lastExchange": string          // une phrase factuelle, max 35 mots
  }
}

Règles "labels" :
- MAX 4 labels au total (additionnés sur themes + topics + intentions).
- NE PAS inventer ni extrapoler. Si le message utilisateur est trop court / vague / général (ex: "salut", "ok", "je sais pas"), retourne des listes vides.
- N'utilise que des mots simples, minuscules, sans accents superflus, sans phrase.
- Pour "themes", privilégie les grands thèmes narratifs : famille, patriarcat, trahison, secrets, confiance, deuil, violence, mémoire, identité, amour, mensonge.

Règles "trigger_video_id" — PRIORITÉ HAUTE :
- Compare \`labels.themes\` aux champs \`themes\` de VIDÉOS DISPONIBLES.
- Tolère synonymes/fautes : "patricarcat"="patriarcat" ; "famille" ⊃ parents/sœur/père/frère/enfance/fratrie ; "trahison" ⊃ mensonge/cacher/secret ; "secrets" ⊃ cacher/vérité.
- DÈS QU'UN thème de la vidéo recoupe un label \`themes\` que tu viens d'extraire → renseigne \`trigger_video_id\` avec l'id de la vidéo.
- Plusieurs matchs : prends la priorité la plus haute (number le plus petit = plus prioritaire).
- Jamais d'id déjà présent dans \`already_triggered\`.
- Si \`labels.themes\` est vide, retourne null (pas de trigger sans label clair).

Règles "action" :
- Utilise {"type":"none"} par défaut.
- Pour une cinématique, retourne videoId, reason et confidence 0..1 ; videoId doit appartenir aux vidéos disponibles.
- Un handoff est uniquement Max vers Emma. Retourne reason et proposalGuidance afin que Max formule lui-même la proposition au tour suivant.
- Ne suppose jamais qu'Emma ou une vidéo est disponible : le moteur déterministe vérifiera.
- Ne recommande pas cinématique et handoff en même temps. Le handoff est prioritaire.
- Pour une clôture, utilise end avec reason seulement lorsqu'une fin naturelle est justifiée.

Règles "end_recommended" : respecte le seuil de clôture fourni dans le contexte. Après ce seuil, true seulement si la conversation a trouvé une clôture naturelle ou échoue durablement.

Règles "moderation_flag" :
- Interprète charitablement les erreurs de transcription, mots déformés, humour ambigu et provocations légères : flag=false.
- Une critique des actes de Max, même dure, n'est pas une attaque contre l'expérience : flag=false.
- flag=true seulement pour une insulte explicite ciblée, une menace, un contenu haineux ou un harcèlement sans ambiguïté.
- Ne recommande jamais la fin sur une première formulation ambiguë. Une fin pour hostilité exige des attaques explicites répétées visibles dans l'historique.

Règles "memory_delta" :
- Résume uniquement des éléments explicitement présents dans le dernier échange ou le profil joueur.
- N'ajoute aucun fait canonique appris ailleurs et aucune interprétation psychologique incertaine.
- Utilise des listes vides et null quand rien de nouveau n'est établi.
- Pour fermer un fil, recopie son id stable de MÉMOIRE AVANT LE TOUR dans resolvedThreadIds.
- La profondeur ne redescend pas après un aveu ou une contradiction reconnue.

Pas de markdown, pas de \`\`\`. Uniquement l'objet JSON.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(trimmed); } catch { /* scan below */ }

  for (const candidate of jsonObjectCandidates(trimmed)) {
    try { return JSON.parse(candidate); } catch { /* try next balanced object */ }
  }
  return null;
}

function jsonObjectCandidates(text: string): string[] {
  const out: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) out.push(text.slice(start, i + 1));
    }
  }
  return out;
}

function buildUserPrompt(input: PRD4PostTurnInput, videos: VideoTriggerRow[]): string {
  const recent = input.conversationHistory.slice(-6).map((m) =>
    `${m.role === "user" ? "UTILISATEUR" : "MAX"}: ${m.content}`
  ).join("\n");

  const triggered = input.triggeredVideoIds ?? [];
  const videoLines = videos.length
    ? videos
        .map((v) => `- id=${v.id} | titre="${v.title}" | type=${v.type} | priorité=${v.priority ?? "?"} | thèmes=[${(v.themes ?? []).join(", ") || "—"}]${v.description ? ` | description="${v.description.slice(0, 160)}"` : ""}`)
        .join("\n")
    : "(aucune)";
  const memory = input.conversationMemoryBefore;
  const memoryBefore = memory ? JSON.stringify({
    interlocutor: memory.interlocutor,
    openThreads: memory.openThreads,
    commitments: memory.commitments,
    topics: memory.topics.slice(-8),
    relationship: memory.relationship,
    lastExchange: memory.lastExchange,
    lastTurn: memory.lastTurn,
  }) : "(aucune mémoire structurée)";

  return `## PROFIL JOUEUR
${input.userRole?.summary_for_max || "(profil indisponible)"}

## POSTURE INITIALE DU JOUEUR (intention / question exprimée avant le début de l'appel — à garder en mémoire pour évaluer la cohérence de l'échange)
${input.userPostureRaw?.trim() || "(non renseignée)"}

## MÉMOIRE AVANT LE TOUR
${memoryBefore}

## TEMPS ÉCOULÉ
  ${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s sur ~${Math.round(input.sessionDurationSeconds / 60)} min configurées — clôture naturelle autorisée après ${Math.floor(input.minimumClosureSeconds / 60)}min ${input.minimumClosureSeconds % 60}s — tour #${input.turnIndex}

## VIDÉOS DISPONIBLES
${videoLines}

## already_triggered
${triggered.length ? triggered.join(", ") : "(aucune)"}

## HISTORIQUE RÉCENT
${recent || "(aucun)"}

## DERNIER ÉCHANGE (à évaluer)
UTILISATEUR (à labéliser) : ${input.userMessage}
MAX : ${input.maxResponse}

Retourne l'évaluation JSON. Extrais d'abord \`labels\` à partir du message UTILISATEUR uniquement (max 4 labels, vides si pas évident). Puis renseigne \`trigger_video_id\` si un de tes \`labels.themes\` recoupe les \`themes\` d'une vidéo disponible.`;
}

function cleanMemoryDelta(raw: unknown): ConversationMemoryDelta | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const cleanList = (candidate: unknown, max = 8): string[] => Array.isArray(candidate)
    ? candidate.map((item) => normalizeMemoryText(item)).filter(Boolean).slice(0, max)
    : [];
  const interlocutor = value.interlocutor && typeof value.interlocutor === "object"
    ? value.interlocutor as Record<string, unknown>
    : {};
  const relationship = value.relationship && typeof value.relationship === "object"
    ? value.relationship as Record<string, unknown>
    : {};
  const depth = relationship.depth === "surface" || relationship.depth === "fissure" || relationship.depth === "verite" || relationship.depth === "bonus"
    ? relationship.depth
    : undefined;
  const trust = relationship.trust === "fragile" || relationship.trust === "neutre" || relationship.trust === "ouverte"
    ? relationship.trust
    : undefined;
  return {
    interlocutor: {
      name: normalizeMemoryText(interlocutor.name, 80) || null,
      role: normalizeMemoryText(interlocutor.role, 160) || null,
      traits: cleanList(interlocutor.traits, 4),
    },
    userFacts: cleanList(value.userFacts),
    maxDisclosures: cleanList(value.maxDisclosures),
    commitments: cleanList(value.commitments, 6),
    openThreads: cleanList(value.openThreads, 6),
    resolvedThreadIds: cleanList(value.resolvedThreadIds, 8),
    topics: cleanList(value.topics, 6),
    relationship: {
      ...(depth ? { depth } : {}),
      ...(trust ? { trust } : {}),
      emotionalState: normalizeMemoryText(relationship.emotionalState, 160) || null,
    },
    lastExchange: normalizeMemoryText(value.lastExchange, 260) || null,
  };
}

function cleanDirectorAction(raw: unknown, fallbackVideoId: string | null, endRecommended: boolean): DirectorAction {
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (value.type === "handoff" && value.targetCharacter === "emma") {
      const reason = normalizeMemoryText(value.reason, 240);
      const proposalGuidance = normalizeMemoryText(value.proposalGuidance, 300);
      if (reason && proposalGuidance) return { type: "handoff", targetCharacter: "emma", reason, proposalGuidance };
    }
    if (value.type === "cinematic") {
      const videoId = normalizeMemoryText(value.videoId, 100);
      const reason = normalizeMemoryText(value.reason, 240);
      const confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0));
      if (videoId && reason) return { type: "cinematic", videoId, reason, confidence };
    }
    if (value.type === "end") {
      const reason = normalizeMemoryText(value.reason, 240);
      if (reason) return { type: "end", reason };
    }
  }
  if (fallbackVideoId) {
    return { type: "cinematic", videoId: fallbackVideoId, reason: "Correspondance thématique GM", confidence: 0.5 };
  }
  if (endRecommended) return { type: "end", reason: "Clôture naturelle recommandée par le GM" };
  return { type: "none" };
}

/**
 * Évalue le tour qui vient de se jouer. Toujours résout (jamais throw).
 */
export async function evaluatePostTurnPRD4(
  input: PRD4PostTurnInput,
): Promise<PRD4PostTurnDetailedResult> {
  const startedAt = performance.now();
  let result: PRD4PostTurnEvaluation;
  let model = "";
  const videos = await getVideoTriggersCached();
  const validIds = new Set(videos.map((v) => v.id));
  const triggered = new Set(input.triggeredVideoIds ?? []);
  const promptOverride = input.systemPromptOverride?.trim();
  const effectiveSystemPrompt = promptOverride && !promptOverride.startsWith("builtin://")
    ? promptOverride
    : EXPERIENCE_DIRECTOR_SYSTEM_PROMPT;
  const messages: TraceMessage[] = [
    { role: "system", content: effectiveSystemPrompt },
    { role: "user", content: buildUserPrompt(input, videos) },
  ];
  let llmTrace: LLMCallDiagnosticTrace | null = null;
  let rawResponse: string | null = null;
  let diagnosticError: string | null = null;
  try {
    const llm = getLLMSettings();
    model = llm.LLM_MODEL_GM;
    const callRes = await callLLMWithUsage(
      messages,
      {
        model: llm.LLM_MODEL_GM,
        temperature: 0.2,
        // Le réglage GM historique (souvent 180) suffit aux labels mais pas à
        // l'évaluation + memory_delta. Ce plancher évite un JSON tronqué sans
        // ajouter d'appel LLM.
        max_tokens: Math.max(llm.LLM_MAX_TOKENS_GM ?? 0, 800),
        timeoutMs: input.orchestrationConfig?.directorTimeoutMs ?? GM_POST_TURN_TIMEOUT_MS,
        feature_key: "prd4_gm_post_turn",
        session_id: input.sessionId ?? undefined,
        signal: input.signal,
        diagnostic_trace: input.diagnosticTrace === true,
      },
    );
    llmTrace = callRes.diagnosticTrace;
    rawResponse = callRes.content;
    const parsed = extractJson(callRes.content) as Partial<PRD4PostTurnEvaluation> | null;
    if (!parsed) {
      console.warn("[GM-PRD4] no JSON in response:", callRes.content.slice(0, 200));
      result = { ...DEFAULT_RESULT, notes: "Réponse LLM non parsable (fallback)." };
      diagnosticError = "Réponse JSON non parsable";
    } else {
      const rawTrigger = parsed.trigger_video_id ? String(parsed.trigger_video_id) : null;
      const safeTrigger = rawTrigger && validIds.has(rawTrigger) && !triggered.has(rawTrigger) ? rawTrigger : null;
      const rawLabels = (parsed as { labels?: { themes?: unknown[]; topics?: unknown[]; intentions?: unknown[] } }).labels;
      const cleanList = (list: unknown[] | undefined): string[] =>
        Array.isArray(list)
          ? list.map((v) => String(v).trim().toLowerCase()).filter((v) => v && v.length <= 30).slice(0, 4)
          : [];
      const themes = cleanList(rawLabels?.themes);
      const topics = cleanList(rawLabels?.topics);
      const intentions = cleanList(rawLabels?.intentions);
      // Cap total à 4 labels (priorité themes > topics > intentions)
      const cap = 4;
      const total = () => themes.length + topics.length + intentions.length;
      while (total() > cap) {
        if (intentions.length) intentions.pop();
        else if (topics.length) topics.pop();
        else themes.pop();
      }
      const labels = { themes, topics, intentions };
      const topicsCovered = Array.isArray(parsed.topics_covered) && parsed.topics_covered.length
        ? parsed.topics_covered.slice(0, 6).map(String)
        : topics;
      const endRecommended = Boolean(parsed.end_recommended);
      result = {
        engagement_delta: Number(parsed.engagement_delta ?? 0),
        confusion_detected: Boolean(parsed.confusion_detected),
        role_usage_quality: (parsed.role_usage_quality as PRD4PostTurnEvaluation["role_usage_quality"]) || "unknown",
        topics_covered: topicsCovered,
        transition_recommended: Boolean(parsed.transition_recommended),
        cinematic_hint: parsed.cinematic_hint ? String(parsed.cinematic_hint) : null,
        next_turn_guidance: String(parsed.next_turn_guidance || DEFAULT_RESULT.next_turn_guidance),
        end_recommended: endRecommended,
        moderation_flag: Boolean(parsed.moderation_flag),
        notes: String(parsed.notes || ""),
        trigger_video_id: safeTrigger,
        labels,
        memory_delta: cleanMemoryDelta((parsed as { memory_delta?: unknown }).memory_delta),
        action: cleanDirectorAction((parsed as { action?: unknown }).action, safeTrigger, endRecommended),
      };
    }
    model = callRes.model || model;
  } catch (err) {
    console.error("[GM-PRD4] error:", err);
    result = { ...DEFAULT_RESULT, notes: `Erreur LLM: ${(err as Error).message?.slice(0, 100) || "inconnue"}` };
    diagnosticError = err instanceof Error ? err.message : String(err);
    llmTrace = err instanceof LLMProxyRequestError ? err.diagnosticTrace : llmTrace;
  }

  let enriched: PRD4PostTurnEvaluation = {
    ...result,
    turn_index: input.turnIndex,
    latency_ms: Math.round(performance.now() - startedAt),
    model,
    created_at: new Date().toISOString(),
    orchestration_version_id: input.orchestrationVersionId ?? null,
    orchestration_config: input.orchestrationConfig ?? null,
  };

  if (input.sessionId && input.persist !== false) {
    try {
      const memoryAfter = await persistPostTurnMemory(
        input.sessionId,
        enriched,
        enriched.memory_delta ?? null,
        input.turnIndex,
        input.currentCharacter ?? "max",
      );
      enriched = { ...enriched, memory_after: memoryAfter };
    } catch (err) {
      console.warn("[GM-PRD4] persist failed:", err);
    }
  }

  return input.diagnosticTrace ? {
    ...enriched,
    diagnostic: {
      messages,
      llm: llmTrace,
      rawResponse,
      parsedOutput: enriched,
      error: diagnosticError,
    },
  } : enriched;
}
