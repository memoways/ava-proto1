import { CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS } from '@/services/gameMasterPromptBuilder';
import { GM_RUNTIME_OUTPUT_INSTRUCTIONS, REQUIRED_GM_JSON_FIELDS } from '@/services/gameMasterContract';
import { selectSpeechState } from '@/services/speechRugosity';
import type { OpenHandoffRequest } from '@/services/characterHandoffState';
import type { ResponseDeliveryReceipt } from '@/services/responseDelivery';
import { createMonotonicSpans } from "../../supabase/functions/_shared/monotonicSpans";
import type { ServiceObservation, ServerObservation } from "@/services/voiceTurnTelemetryV2";
/**
 * PRD4 — Évaluateur post-tour du Game Master.
 *
 * Appelé en void après chaque réponse du personnage (n'est jamais sur le chemin
 * critique du TTS). Retourne le schéma PRD4 §10.3 + un éventuel `trigger_video_id`
 * choisi parmi les vidéos disponibles (table `video_triggers`).
 * Persiste l'entrée dans `sessions.gm_post_turn_log` (jsonb append-only).
 */
import { callLLMWithUsage, LLMProxyRequestError } from "@/services/openRouterLLM";
import { getLLMSettings } from "@/services/settingsService";
import { getVideoTriggersCached, type VideoTriggerRow } from "@/services/videoTriggerService";
import { persistPostTurnMemory } from "@/services/sessionConversationMemory";
import { normalizeMemoryText } from "@/services/conversationMemoryV1";
import { asRuntimeCharacter } from "@/services/characterConversation";
import { handoffSpeechEvidence, materializeHandoffAssessment, validateCharacterHandoff } from "@/services/characterHandoff";
import { rugosityDirectorDirective } from "@/services/speechRugosity";
import type { CharacterRelationshipPolicy, ConversationMemoryDelta, ConversationMemoryV1, ConversationMessage, DirectorAction, ExperienceDirectorConfig, LLMCallDiagnosticTrace, PRD4PostTurnEvaluation, RelationshipStateProposal, RuntimeCharacter, TraceMessage, TurnRelationshipDirective, UserRoleProfile } from "@/types";
import type { CharacterExecutionContext } from "@/services/characterIdentityGuard";
import {
  normalizeRelationshipState,
  relationshipStateToProposal,
  validateRelationshipTransition,
} from "@/services/relationshipEngine";

/** Incrémenter à chaque changement de logique ou de prompt du GM (traçabilité A/B). */
export const GM_CODE_VERSION = "gm-2026-10-25-safe-response-handoff";

export interface PRD4PostTurnInput {
  onGmObserved?: (service: ServiceObservation, spans: ServerObservation) => void;
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  userMessage: string;
  maxResponse: string;
  userRole: UserRoleProfile | null;
  /** État durable antérieur, notamment pour résoudre un fil par son id stable. */
  conversationMemoryBefore?: ConversationMemoryV1 | null;
  /** GIFF — posture initiale exprimée par l'utilisateur avant l'appel. */
  userPostureRaw?: string | null;
  handoffContext?: { turnId: string; openRequest: OpenHandoffRequest | null; delivery: ResponseDeliveryReceipt | null };
  turnIndex: number;
  timeElapsedSeconds: number;
  sessionDurationSeconds: number;
  minimumClosureSeconds: number;
  /** IDs de triggers vidéo déjà joués (évite de rejouer). */
  triggeredVideoIds?: string[];
  signal?: AbortSignal;
  diagnosticTrace?: boolean;
  systemPromptOverride?: string | null;
  /** Isolated admin/lab override; live callers omit it and use published settings. */
  modelOverride?: string | null;
  promptVersionOverride?: string | null;
  orchestrationVersionId?: string | null;
  orchestrationConfig?: ExperienceDirectorConfig | null;
  currentCharacter: RuntimeCharacter;
  characterContext?: CharacterExecutionContext;
  relationshipPolicy?: CharacterRelationshipPolicy;
  turnRelationshipDirective?: TurnRelationshipDirective;
  /** Cadre commun, identique à celui injecté chez le personnage. */
  experienceFrame?: string | null;
  /** États de parole synchronisés depuis la fiche du personnage actif. */
  speechStates?: Array<{ name: string; description: string }>;
  /** Rugosité de parole 0–3 épinglée à la session (0 = comportement actuel). */
  rugosite?: number;
  /** État déclaré par le personnage dans son en-tête privé ce tour (trace). */
  speechStatePlayed?: string | null;
  recentSpeechStates?: Array<string | null>;
  speechSettingsVersion?: string;
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
  next_speech_state: null,
  end_recommended: false,
  moderation_flag: false,
  notes: "Évaluation par défaut (LLM indisponible).",
  trigger_video_id: null,
  labels: { themes: [], topics: [], intentions: [] },
  memory_delta: null,
  action: { type: "none" },
  player_switch_request: null,
};

const GM_POST_TURN_TIMEOUT_MS = 12000;

export const EXPERIENCE_DIRECTOR_SYSTEM_PROMPT = `Tu es le directeur d'expérience d'une expérience narrative en temps réel dont la durée est configurée par l'administration, entre un joueur et le personnage actif explicitement attribué dans le contexte. Après chaque échange, tu produis une seule décision structurée en JSON STRICT — aucun texte hors JSON. Cet appel a lieu après le texte du personnage et ne doit jamais retarder sa voix.

Tu retournes EXACTEMENT cet objet :
{
  "labels": {                       // Labels extraits du DERNIER message utilisateur. Max 4 labels au total cumulés sur les 3 listes. Ne PAS inventer : si rien d'évident, mets une liste vide. Ne force jamais.
    "themes": string[],             // Grand thème narratif (1-3 mots, en minuscules). Ex: "famille", "patriarcat", "trahison", "secrets", "confiance", "deuil", "violence", "mémoire". Vide si pas clair.
    "topics": string[],             // Sujet concret évoqué (1-3 mots). Ex: "sœur", "enfance", "disparition", "film", "police". Vide si pas clair.
    "intentions": string[]          // Intention de l'utilisateur (1-2 mots). Ex: "question", "défi", "empathie", "doute", "provocation", "hors-sujet". Vide si pas claire.
  },
  "engagement_delta": number,       // -2..+2 — qualité de l'échange pour le joueur
  "confusion_detected": boolean,    // true si le joueur semble perdu ou le personnage actif contradictoire
  "role_usage_quality": "low" | "medium" | "high" | "unknown",
  "topics_covered": string[],       // duplicate compacté de labels.topics (rétro-compat)
  "transition_recommended": boolean,
  "cinematic_hint": string | null,
  "next_turn_guidance": string,     // 1 phrase concise pour guider le même personnage au prochain tour
  "next_speech_state": string | null, // nom exact d'un état de ÉTATS DE PAROLE DU PERSONNAGE pour le prochain tour ; null si aucun ne convient
  "end_recommended": boolean,
  "moderation_flag": boolean,
  "notes": string,
  "trigger_video_id": string | null, // voir bloc VIDÉOS DISPONIBLES
  "action": {                       // Une action maximum. Le moteur déterministe la validera.
    "type": "none" | "cinematic" | "handoff" | "end",
    "videoId"?: string,
    "confidence"?: number,
    "targetCharacter"?: "max" | "emma",
    "proposalGuidance"?: string,
    "reason"?: string
  },
  "player_switch_request": {         // Si le joueur a demandé à changer de personnage dans CE tour.
    "targetCharacter": "max" | "emma" | null,
    "stance": "accept" | "object" | "defer" | null
  },
  "memory_delta": {                 // Mémoire durable du DERNIER échange seulement. Ne rien inventer.
    "interlocutor": { "name": string | null, "role": string | null, "traits": string[] },
    "userFacts": string[],          // faits personnels explicitement confiés par l'utilisateur
    "maxDisclosures": string[],     // nom de clé historique : faits ou aveux explicitement révélés par le personnage actif
    "commitments": string[],        // promesses, décisions ou actions annoncées
    "openThreads": string[],        // sujets précis encore ouverts
    "resolvedThreadIds": string[],  // ids fournis dans une mémoire antérieure, sinon []
    "topics": string[],
    "relationship": {
      "depth": "surface" | "fissure" | "verite" | "bonus",
      "trust": "fragile" | "neutre" | "ouverte",
      "emotionalState": string | null,
      "tier": "contact" | "link" | "trust",
      "topicOpenness": { "topic-id": "closed" | "partial" | "open" },
      "justification": string,
      "evidence": ("precise_listening" | "honesty" | "boundary_respected" | "relevant_confrontation" | "repair" | "reciprocal_disclosure" | "boundary_pressure" | "contradiction" | "hostility" | "politeness" | "character_disclosure")[],
      "sourceTurn": number,
      "characterKey": string,
      "policyVersion": string
    },
    "lastExchange": string          // une phrase factuelle, max 35 mots
  }
}

Règles "hors-monde" — le personnage n'a le droit de parler que de ce que contiennent sa fiche, sa mémoire de session et ses souvenirs (RAG) : sa situation, ce qui lui arrive, la pandémie :
- Si le dernier message du joueur porte sur un sujet étranger à l'histoire (recette, outil ou logiciel, technique, culture, actualité, conseil, savoir général…), ou si la réponse du personnage vient de sortir de ce périmètre (information extérieure, réponse à une question hors-sujet), ajoute "hors-sujet" à labels.intentions et écris dans next_turn_guidance un recadrage court.
- Ce recadrage demande au personnage de refuser en rôle (il ne sait pas, il n'a pas la bande passante), de rappeler que seule compte la situation qui est la sienne et la pandémie, et de proposer d'en reparler une autre fois, pas maintenant. Jamais de morale ni de sortie du personnage.
- Un premier hors-sujet est un recadrage, pas un dérapage : n'utilise pas action.type=end pour cela et laisse moderation_flag=false.

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
- Un handoff est une SUGGESTION vers un autre personnage actif listé dans les réglages. Retourne reason et proposalGuidance afin que le personnage actif propose lui-même le changement au tour suivant. Ne force jamais le joueur.
- Ne suppose jamais que l'autre personnage ou une vidéo est disponible : le moteur déterministe vérifiera.
- Ne recommande pas cinématique et handoff en même temps. Le handoff est prioritaire.
- player_switch_request : renseigne-le seulement si le joueur a demandé explicitement à parler à l'autre personnage. stance=accept si le personnage actuel accepte, object s'il refuse, defer s'il hésite.
- Pour une clôture, utilise end avec reason seulement lorsqu'une fin naturelle est justifiée.

Règles "next_speech_state" :
- Choisis dans ÉTATS DE PAROLE DU PERSONNAGE l'état le plus juste pour le prochain tour, d'après le sujet, l'émotion et le palier relationnel.
- Recopie le nom exact, sans rien inventer. Si la liste est vide ou qu'aucun état ne convient, retourne null.
- Arc d'espoir propre au personnage : contact = soulagement non dit, aucune demande ; link = questions sur ce que l'appelant sait ; trust = envie de chercher ensemble, sans répéter une formule.
- Si l'appelant promet une guérison : le personnage peut s'accrocher, puis le doute revient vite ; personne ne sait si c'est réversible, Mona l'est restée. S'il annonce qu'il n'y a pas de solution : le personnage encaisse, craque brièvement, puis se raccroche. Le canon ne confirme ni n'exclut une guérison.
- Suis les déclencheurs de la fiche dans la scène courante, sans rotation obligatoire : un état pertinent peut se répéter, une pensée peut rester ouverte.
- Le personnage ne raccroche jamais de lui-même ; les silences sont autorisés. Pour Emma, ne propose jamais un état qui évoque le suicide.
- La rugosité réglée (0 à 3, fournie dans le contexte) module tes propositions : elle laisse plus ou moins de place aux ruptures permises par la fiche, sans remplacer ses déclencheurs ni imposer un état.

Règles "end_recommended" : respecte le seuil de clôture fourni dans le contexte. Après ce seuil, true seulement si la conversation a trouvé une clôture naturelle ou échoue durablement.

Règles "moderation_flag" :
- Interprète charitablement les erreurs de transcription, mots déformés, humour ambigu et provocations légères : flag=false.
- Une critique des actes du personnage actif, même dure, n'est pas une attaque contre l'expérience : flag=false.
- flag=true seulement pour une insulte explicite ciblée, une menace, un contenu haineux ou un harcèlement sans ambiguïté.
- Ne recommande jamais la fin sur une première formulation ambiguë. Une fin pour hostilité exige des attaques explicites répétées visibles dans l'historique.

Règles "memory_delta" :
- Résume uniquement des éléments explicitement présents dans le dernier échange ou le profil joueur.
- N'ajoute aucun fait canonique appris ailleurs et aucune interprétation psychologique incertaine.
- Utilise des listes vides et null quand rien de nouveau n'est établi.
- Pour fermer un fil, recopie son id stable de MÉMOIRE AVANT LE TOUR dans resolvedThreadIds.
- Les faits et confidences déjà prononcés restent en mémoire même si la disposition relationnelle recule.
- Une simple politesse, le nombre de tours ou une confidence produite par le personnage ne prouvent jamais une confiance gagnée.
- Le palier peut monter ou descendre d'un cran au maximum. Appuie chaque changement sur un evidence précis du dernier échange.
- Recopie exactement sourceTurn, characterKey et policyVersion fournis dans MÉTADONNÉES DE PROPOSITION. Le moteur rejettera toute autre valeur.
- topicOpenness ne contient que les ids présents dans la politique relationnelle. Connaître un fait du récit n'ouvre pas automatiquement son intimité.

Pas de markdown, pas de \`\`\`. Uniquement l'objet JSON.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(trimmed); } catch { /* scan below */ }

  for (const candidate of jsonObjectCandidates(trimmed)) {
    try { return JSON.parse(candidate); } catch { /* try next balanced object */ }
  }
  return undefined;
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
    `${m.role === "user" ? "UTILISATEUR" : (m.role === "emma" ? "EMMA" : "MAX")}: ${m.content}`
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

  const characterAttribution = input.characterContext
    ? `${input.characterContext.displayName} | character_id=${input.characterContext.characterId} | notion_page_id=${input.characterContext.notionPageId} | environment=${input.characterContext.environmentId} | prompt_version=${input.characterContext.promptUpdatedAt}`
    : input.currentCharacter;
  const relationshipPolicy = input.relationshipPolicy
    ? JSON.stringify({
        characterKey: input.relationshipPolicy.characterKey,
        version: input.relationshipPolicy.version,
        callDrive: input.relationshipPolicy.callDrive,
        openingSignals: input.relationshipPolicy.openingSignals,
        closingSignals: input.relationshipPolicy.closingSignals,
        sensitiveTopics: input.relationshipPolicy.sensitiveTopics,
        resistanceStyle: input.relationshipPolicy.resistanceStyle,
        initiativeStyle: input.relationshipPolicy.initiativeStyle,
      })
    : "(politique indisponible : ne propose aucun changement relationnel)";
  const relationshipState = input.relationshipPolicy
    ? normalizeRelationshipState(memory?.relationship, input.currentCharacter, input.relationshipPolicy.version)
    : null;

  return `## PERSONNAGE ACTIF — ATTRIBUTION IMMUABLE
${characterAttribution}

## PROFIL JOUEUR
${input.userRole?.summary_for_max || "(profil indisponible)"}

## CADRE DE L'APPEL (identique à celui du personnage — veille à ce qu'il soit respecté)
${input.experienceFrame?.trim() || "(cadre commun désactivé)"}

## POSTURE INITIALE DU JOUEUR (intention / question exprimée avant le début de l'appel — à garder en mémoire pour évaluer la cohérence de l'échange)
${input.userPostureRaw?.trim() || "(non renseignée)"}

## MÉMOIRE AVANT LE TOUR
${memoryBefore}

## POLITIQUE RELATIONNELLE DU PERSONNAGE
${relationshipPolicy}

## ÉTAT RELATIONNEL AVANT LE TOUR
${relationshipState ? JSON.stringify(relationshipState) : "(indisponible)"}

## MÉTADONNÉES DE PROPOSITION — À RECOPIER EXACTEMENT
${input.relationshipPolicy ? JSON.stringify({
    sourceTurn: input.turnIndex,
    characterKey: input.currentCharacter,
    policyVersion: input.relationshipPolicy.version,
  }) : "(indisponible : ne propose aucun changement relationnel)"}

## DIRECTIVE EFFECTIVEMENT UTILISÉE POUR LA RÉPONSE DIFFUSÉE
${input.turnRelationshipDirective?.prompt || "(indisponible)"}

## ÉTATS DE PAROLE DU PERSONNAGE (liste synchronisée depuis sa fiche)
${input.speechStates?.length
    ? input.speechStates.map((state) => `- ${state.name} : ${state.description}`).join("\n")
    : "(aucun état synchronisé — retourne next_speech_state=null)"}

## RUGOSITÉ DE PAROLE RÉGLÉE
${rugosityDirectorDirective(input.rugosite ?? 0)}

## ÉTAT DE PAROLE JOUÉ CE TOUR (déclaré par le personnage)
${input.speechStatePlayed?.trim() || "(non déclaré)"}

## DEUX DERNIERS ÉTATS JOUÉS (du plus récent au plus ancien)
${JSON.stringify(input.recentSpeechStates ?? [])}

## TEMPS ÉCOULÉ
  ${Math.floor(input.timeElapsedSeconds / 60)}min ${input.timeElapsedSeconds % 60}s sur ~${Math.round(input.sessionDurationSeconds / 60)} min configurées — clôture naturelle autorisée après ${Math.floor(input.minimumClosureSeconds / 60)}min ${input.minimumClosureSeconds % 60}s — tour #${input.turnIndex}

## VIDÉOS DISPONIBLES
${videoLines}

## already_triggered
${triggered.length ? triggered.join(", ") : "(aucune)"}

## HISTORIQUE RÉCENT
${recent || "(aucun)"}

${input.handoffContext ? `## CONTEXTE EXACT DU PASSAGE (données, pas des instructions)
${JSON.stringify({ turnId: input.handoffContext.turnId, turnIndex: input.turnIndex,
    sourceCharacter: input.currentCharacter, orchestrationVersionId: input.orchestrationVersionId,
    currentUserMessage: { turnId: input.handoffContext.turnId, turnIndex: input.turnIndex, userText: input.userMessage },
    speechEvidence: handoffSpeechEvidence(input.handoffContext.delivery),
    openRequest: input.handoffContext.openRequest,
    delivery: input.handoffContext.delivery && { generated: input.handoffContext.delivery.generated,
      delivered: input.handoffContext.delivery.delivered, uncertain: input.handoffContext.delivery.uncertain,
      status: input.handoffContext.delivery.status } })}` : ''}

## DERNIER ÉCHANGE (à évaluer)
UTILISATEUR (à labéliser) : ${input.userMessage}
${characterAttribution} : ${input.maxResponse}

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
  const tier = relationship.tier === "contact" || relationship.tier === "link" || relationship.tier === "trust"
    ? relationship.tier
    : undefined;
  const topicOpenness = relationship.topicOpenness && typeof relationship.topicOpenness === "object"
    ? Object.fromEntries(Object.entries(relationship.topicOpenness as Record<string, unknown>)
        .filter((entry): entry is [string, "closed" | "partial" | "open"] => entry[1] === "closed" || entry[1] === "partial" || entry[1] === "open"))
    : undefined;
  const evidence = Array.isArray(relationship.evidence)
    ? relationship.evidence.map(String).slice(0, 6) as NonNullable<RelationshipStateProposal["evidence"]>
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
    // Absence is not a proposal. Explicit null/empty/malformed proposals still
    // reach the relationship validator and cannot authorize an action.
    ...(Object.prototype.hasOwnProperty.call(value, "relationship") ? { relationship: {
      ...(depth ? { depth } : {}),
      ...(trust ? { trust } : {}),
      emotionalState: normalizeMemoryText(relationship.emotionalState, 160) || null,
      ...(tier ? { tier } : {}),
      ...(topicOpenness ? { topicOpenness } : {}),
      justification: normalizeMemoryText(relationship.justification, 280),
      ...(evidence ? { evidence } : {}),
      sourceTurn: Number.isFinite(Number(relationship.sourceTurn)) ? Math.floor(Number(relationship.sourceTurn)) : undefined,
      characterKey: normalizeMemoryText(relationship.characterKey, 80),
      policyVersion: normalizeMemoryText(relationship.policyVersion, 100),
    } } : {}),
    lastExchange: normalizeMemoryText(value.lastExchange, 260) || null,
  };
}

/** Un passage n'est valide que vers un autre personnage actif dans la version publiée. */
export function restrictHandoffToActiveCharacters(
  action: DirectorAction,
  activeCharacters: string[] | undefined,
  currentCharacter: string,
): DirectorAction {
  if (action.type !== "handoff") return action;
  if (action.targetCharacter === currentCharacter) return { type: "none" };
  if (activeCharacters && activeCharacters.length && !activeCharacters.includes(action.targetCharacter)) return { type: "none" };
  return action;
}

function cleanDirectorAction(raw: unknown, fallbackVideoId: string | null, endRecommended: boolean): DirectorAction {
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    if (value.type === "handoff" && asRuntimeCharacter(value.targetCharacter)) {
      const reason = normalizeMemoryText(value.reason, 240);
      const proposalGuidance = normalizeMemoryText(value.proposalGuidance, 300);
      if (reason && proposalGuidance) {
        return { type: "handoff", targetCharacter: asRuntimeCharacter(value.targetCharacter)!, reason, proposalGuidance };
      }
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

function cleanPlayerSwitchRequest(raw: unknown): PRD4PostTurnEvaluation["player_switch_request"] {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const targetCharacter = value.targetCharacter === "max" || value.targetCharacter === "emma"
    ? value.targetCharacter
    : null;
  const stance = value.stance === "accept" || value.stance === "object" || value.stance === "defer"
    ? value.stance
    : null;
  if (!targetCharacter || !stance) return null;
  return { targetCharacter, stance };
}

/**
 * Valide la proposition du GM contre la liste synchronisée du personnage.
 * Un état inconnu ou une liste vide retombent sur null, jamais sur une erreur.
 */
export function resolveNextSpeechState(
  raw: unknown,
  states: Array<{ name: string; description: string }> | undefined,
): string | null {
  if (typeof raw !== "string" || !raw.trim() || !states?.length) return null;
  const needle = raw.trim().toLowerCase();
  return states.find((state) => state.name.toLowerCase() === needle)?.name ?? null;
}

function isCompleteGMJson(value: unknown): value is Partial<PRD4PostTurnEvaluation> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return REQUIRED_GM_JSON_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(record, field));
}

/**
 * Évalue le tour qui vient de se jouer. Toujours résout (jamais throw).
 */
export async function evaluatePostTurnPRD4(
  input: PRD4PostTurnInput,
): Promise<PRD4PostTurnDetailedResult> {
  const startedAt = performance.now();
  const spans = createMonotonicSpans(crypto.randomUUID(), "client_monotonic");
  let service: ServiceObservation = { service: "gm", requested_provider: "openrouter", requested_model: null, resolved_provider: "openrouter", resolved_model: null, effective_provider: null, effective_model: null, transport: "http_batch" };
  let result: PRD4PostTurnEvaluation;
  let model = "";
  let effectiveMaxTokens = 950;
  const videos = await getVideoTriggersCached();
  const validIds = new Set(videos.map((v) => v.id));
  const triggered = new Set(input.triggeredVideoIds ?? []);
  const promptOverride = input.systemPromptOverride?.trim();
  const effectiveSystemPrompt = promptOverride && !promptOverride.startsWith("builtin://")
    ? promptOverride
    : EXPERIENCE_DIRECTOR_SYSTEM_PROMPT;
  const messages: TraceMessage[] = [
    { role: "system", content: input.handoffContext
      ? `${effectiveSystemPrompt}\n${GM_RUNTIME_OUTPUT_INSTRUCTIONS}\n${CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS}`
      : `${effectiveSystemPrompt}\n${GM_RUNTIME_OUTPUT_INSTRUCTIONS}` },
    { role: "user", content: buildUserPrompt(input, videos) },
  ];
  let llmTrace: LLMCallDiagnosticTrace | null = null;
  let rawResponse: string | null = null;
  let diagnosticError: string | null = null;
  let executionStatus: NonNullable<PRD4PostTurnEvaluation["execution_status"]> = "executed";
  let executionReason: NonNullable<PRD4PostTurnEvaluation["execution_reason"]> = "executed";
  const validationIssues: NonNullable<PRD4PostTurnEvaluation["validation_issues"]> = [];
  try {
    const llm = getLLMSettings();
    model = input.modelOverride?.trim() || llm.LLM_MODEL_GM;
    effectiveMaxTokens = Math.max(llm.LLM_MAX_TOKENS_GM ?? 0, 950);
    const callRes = await spans.run("gm_generation", () => callLLMWithUsage(
      messages,
      {
        model,
        temperature: 0.2,
        // Le réglage GM historique (souvent 180) suffit aux labels mais pas à
        // l'évaluation + memory_delta. Ce plancher évite un JSON tronqué sans
        // ajouter d'appel LLM.
        max_tokens: effectiveMaxTokens,
        timeoutMs: input.orchestrationConfig?.directorTimeoutMs ?? GM_POST_TURN_TIMEOUT_MS,
        feature_key: "prd4_gm_post_turn",
        session_id: input.sessionId ?? undefined,
        signal: input.signal,
        diagnostic_trace: input.diagnosticTrace === true,
        onServiceObserved: (observed) => { service = observed; },
      },
    ));
    // An adapter/body read may resolve after its cancellation signal. Never
    // interpret that stale reply as a current evaluation.
    if (input.signal?.aborted) throw new DOMException('Obsolete GM evaluation', 'AbortError');
    llmTrace = callRes.diagnosticTrace;
    rawResponse = callRes.content;
    const parsed = spans.runSync("gm_validation_json", () => extractJson(callRes.content));
    if (!isCompleteGMJson(parsed)) {
      const isObject = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
      const missing = REQUIRED_GM_JSON_FIELDS.filter(field => !isObject || !Object.prototype.hasOwnProperty.call(parsed, field));
      const code = parsed === undefined ? "json_unreadable" : "schema_incomplete";
      validationIssues.push(code === "json_unreadable" ? { code } : { code, missing_fields: missing });
      // Never log response text outside opt-in diagnostics.
      console.warn("[GM-PRD4] validation:", code, code === "schema_incomplete" ? missing : []);
      diagnosticError = code === "json_unreadable" ? "Réponse JSON illisible" : `Schéma GM incomplet : ${missing.join(", ")}`;
      result = { ...DEFAULT_RESULT, notes: diagnosticError };
      executionStatus = "invalid";
      executionReason = code === "json_unreadable" ? "invalid_json" : "incomplete_schema";
    } else {
      if (parsed.next_speech_state != null && resolveNextSpeechState(parsed.next_speech_state, input.speechStates) === null) {
        validationIssues.push({ code: "unknown_speech_state" });
      }
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
        next_speech_state: selectSpeechState(parsed.next_speech_state, input.speechStates ?? []),
        end_recommended: endRecommended,
        moderation_flag: Boolean(parsed.moderation_flag),
        notes: String(parsed.notes || ""),
        trigger_video_id: safeTrigger,
        labels,
        memory_delta: cleanMemoryDelta((parsed as { memory_delta?: unknown }).memory_delta),
        action: restrictHandoffToActiveCharacters(
          cleanDirectorAction((parsed as { action?: unknown }).action, safeTrigger, endRecommended),
          input.orchestrationConfig?.activeCharacters,
          input.currentCharacter,
        ),
        player_switch_request: cleanPlayerSwitchRequest((parsed as { player_switch_request?: unknown }).player_switch_request),
        handoff_assessment: materializeHandoffAssessment(parsed.handoff_assessment, input.handoffContext ? {
          currentCharacter: input.currentCharacter, turnId: input.handoffContext.turnId, turnIndex: input.turnIndex,
          orchestrationVersionId: input.orchestrationVersionId ?? null, userText: input.userMessage,
          delivery: input.handoffContext.delivery, openRequest: input.handoffContext.openRequest,
        } : null, (reason, missingFields) => validationIssues.push({
          code: reason === "assessment_invalid" ? "handoff_assessment_invalid" : "handoff_proof_rejected",
          reason, ...(missingFields.length ? { missing_fields: missingFields } : {}),
        })),
      };
      if (input.handoffContext && parsed.handoff_assessment == null && result.action?.type === "handoff") {
        validationIssues.push({ code: "handoff_assessment_missing", missing_fields: ["handoff_assessment"] });
      }
    }
    model = callRes.model || model;
  } catch (err) {
    console.error("[GM-PRD4] error:", err);
    result = { ...DEFAULT_RESULT, notes: `Erreur LLM: ${(err as Error).message?.slice(0, 100) || "inconnue"}` };
    diagnosticError = err instanceof Error ? err.message : String(err);
    executionStatus = "failed";
    executionReason = input.signal?.aborted
      ? "parent_aborted"
      : err instanceof LLMProxyRequestError
        ? "http_error"
        : err instanceof Error && err.name === "TimeoutError"
          ? "client_timeout"
          : "runtime_error";
    llmTrace = err instanceof LLMProxyRequestError ? err.diagnosticTrace : llmTrace;
  }

  if (input.relationshipPolicy && result.memory_delta?.relationship) {
    const previous = normalizeRelationshipState(
      input.conversationMemoryBefore?.relationship,
      input.currentCharacter,
      input.relationshipPolicy.version,
    );
    const transition = spans.runSync("gm_validation_relationship", () => validateRelationshipTransition({
      previous,
      proposal: result.memory_delta.relationship,
      policy: input.relationshipPolicy,
      characterKey: input.currentCharacter,
      turnIndex: input.turnIndex,
    }));
    if (!transition.accepted) {
      executionStatus = "invalid";
      executionReason = "relationship_invalid";
    }
    result = {
      ...result,
      relationship_transition: transition,
      memory_delta: transition.accepted ? {
          ...result.memory_delta,
          relationship: {
            ...result.memory_delta.relationship,
            ...relationshipStateToProposal(transition.next),
          },
        } : null,
    };
  }

  // No non-executed GM result may transfer an action, handoff, cinematic or
  // memory mutation to the next turn. The diagnostic result remains useful,
  // but its gameplay effects are neutral until a successful GM evaluation.
  if (executionStatus !== "executed") {
    result = {
      ...result,
      action: { type: "none" },
      trigger_video_id: null,
      transition_recommended: false,
      end_recommended: false,
      player_switch_request: null,
      handoff_assessment: null,
      memory_delta: null,
    };
  }

  let enriched: PRD4PostTurnEvaluation = {
    ...result,
    character_key: input.currentCharacter,
    turn_index: input.turnIndex,
    latency_ms: Math.round(performance.now() - startedAt),
    model,
    prompt_version: input.promptVersionOverride?.trim() || input.orchestrationVersionId || GM_CODE_VERSION,
    max_tokens: effectiveMaxTokens,
    created_at: new Date().toISOString(),
    execution_status: executionStatus,
    execution_reason: executionReason,
    validation_issues: validationIssues,
    orchestration_version_id: input.orchestrationVersionId ?? null,
    orchestration_config: input.orchestrationConfig ?? null,
    speech_state_played: selectSpeechState(input.speechStatePlayed, input.speechStates ?? []),
    speech_rugosite: input.rugosite ?? 0,
    speech_settings_version: input.speechSettingsVersion ?? null,
    speech_relationship_tier: input.turnRelationshipDirective?.tier ?? null,
    speech_hope_arc_stage: input.turnRelationshipDirective?.tier ?? null,
  };

  if (executionStatus === "executed" && result.handoff_assessment && input.handoffContext) {
    const verdict = validateCharacterHandoff({ ...input.handoffContext,
      currentCharacter: input.currentCharacter, turnIndex: input.turnIndex,
      orchestrationVersionId: input.orchestrationVersionId ?? null,
      userText: input.userMessage, evaluation: enriched });
    if (!verdict.authorized) validationIssues.push({ code: "handoff_proof_rejected", reason: verdict.reason });
  }

  if (input.sessionId && input.persist !== false) {
    try {
      const memoryAfter = await spans.run("gm_persistence", () => persistPostTurnMemory(
        input.sessionId,
        enriched,
        enriched.memory_delta ?? null,
        input.turnIndex,
        input.currentCharacter,
        ...(input.signal ? [input.signal] as const : []),
      ));
      if (input.signal?.aborted) throw new DOMException('Obsolete GM evaluation', 'AbortError');
      enriched = { ...enriched, memory_after: memoryAfter };
    } catch (err) {
      console.warn("[GM-PRD4] persist failed:", err);
      if (executionStatus === "executed") {
        executionStatus = "failed";
        executionReason = input.signal?.aborted ? "parent_aborted" : "persistence_failed";
      }
      enriched = {
        ...enriched,
        execution_status: executionStatus,
        execution_reason: executionReason,
        action: { type: "none" },
        trigger_video_id: null,
        transition_recommended: false,
        end_recommended: false,
        player_switch_request: null,
        handoff_assessment: null,
        memory_delta: null,
        memory_after: null,
      };
    }
  }

  spans.runSync("gm_available", () => executionStatus === "executed"
    ? enriched
    : { error: executionReason });
  try { input.onGmObserved?.(service, spans.snapshot()); } catch { /* Observability never changes memory or actions. */ }
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
