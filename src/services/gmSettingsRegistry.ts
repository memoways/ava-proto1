import type {
  ExperienceDirectorConfig,
  ExperienceDirectorEditorConfig,
  ExperienceDirectorGuardrails,
} from "@/types";
import { EXPERIENCE_FRAME_POSTURE_TEXT, FORBID_SPONTANEOUS_HANDOFF_TEXT, normalizeExperienceFrameConfig } from "@/services/experienceFrame";
import { CHARACTER_TIME_CUE_PHASES, CHARACTER_TIME_CUE_SUFFIX, isCharacterTimeCuesEnabled } from "@/services/characterTimeCues";
import { displayNameForCharacter } from "@/services/characterRegistry";

/**
 * Single registry of the GM settings (Expérience → Réglages GM).
 *
 * Each setting is described once: label, destination and the exact text it
 * produces for the current value. The GM prompt compiler and the admin UI both
 * read it, so what the UI shows under a setting is what the GM or the character
 * receives (or what the code applies). Texts are the historical ones, unchanged.
 */

/** Where a setting acts: GM system prompt, character prompt, or deterministic code. */
export type GmSettingDestination = "gm_prompt" | "character_prompt" | "code";

export interface GmSettingFragment {
  destination: GmSettingDestination;
  /** Exact injected text for prompts; plain description of the effect for code. */
  text: string;
}

export const GM_SETTING_DESTINATION_LABELS: Record<GmSettingDestination, string> = {
  gm_prompt: "envoyé au GM",
  character_prompt: "envoyé au personnage",
  code: "appliqué par le code",
};

// ---------------------------------------------------------------------------
// Historical texts (moved from gameMasterPromptBuilder.ts, wording unchanged).
// ---------------------------------------------------------------------------

export const TONE_LABELS: Record<ExperienceDirectorEditorConfig["tone"], string> = {
  discreet: "Discret : observe et intervient seulement lorsqu'une décision est utile.",
  balanced: "Équilibré : guide la progression sans sur-orchestrer la conversation.",
  directive: "Directif : formule des guidances plus explicites pour faire avancer l'expérience.",
};

export const GUIDANCE_LABELS: Record<ExperienceDirectorEditorConfig["guidanceLength"], string> = {
  short: "Très courte : une instruction opérationnelle, sans justification.",
  balanced: "Équilibrée : une phrase concise avec l'intention principale.",
  detailed: "Détaillée : jusqu'à deux phrases, avec intention et contrainte narrative.",
};

export const PRIORITY_LABELS: Record<ExperienceDirectorEditorConfig["priorities"][number], string> = {
  narrative_continuity: "continuité narrative et cohérence des faits",
  player_engagement: "engagement du joueur et qualité de l'échange",
  safety: "sécurité, modération charitable et limites du personnage",
  pace: "rythme, progression et clôture naturelle dans le temps disponible",
};

export const DERAIL_LABELS: Record<ExperienceDirectorGuardrails["derailTolerance"], string> = {
  low: "faible : dès le premier écart net (insulte, absurde, hors sujet répété), guide le personnage vers un recadrage ; au deuxième, vers une proposition calme de terminer l'appel.",
  medium: "moyenne : tolère un écart ; au deuxième, recadrage par le personnage ; au troisième, proposition calme de terminer l'appel.",
  high: "élevée : laisse jouer les détours ; recadre seulement en cas d'insultes répétées, puis propose de terminer l'appel si cela continue.",
};

export const OPENNESS_LABELS: Record<ExperienceDirectorGuardrails["opennessPace"], string> = {
  slow: "lente : le personnage reste réservé longtemps et ne s'ouvre qu'après des signes répétés d'écoute sincère.",
  balanced: "équilibrée : le personnage s'ouvre progressivement quand le joueur écoute et reste cohérent.",
  fast: "rapide : le personnage se livre assez vite dès que le joueur montre de l'écoute.",
};

/** Recadrage hors-monde : rappel de consigne, jamais une fin d'appel au premier écart. */
export const OFF_WORLD_GUIDANCE_RULE = "Hors-monde : si le joueur demande ou aborde un sujet étranger à l'histoire (recette, outil, technique, culture, actualité, savoir général…), OU si la réponse du personnage vient de sortir de sa fiche, de sa mémoire ou de ses souvenirs, écris dans next_turn_guidance un recadrage court : le personnage refuse en rôle (il ne sait pas, il n'a pas la bande passante), rappelle que seule compte la situation qui est la sienne et la pandémie, et propose d'en reparler une autre fois. Ajoute \"hors-sujet\" aux intentions. C'est un recadrage, pas un dérapage : n'enclenche pas de fin d'appel pour un premier hors-sujet.";

// ---------------------------------------------------------------------------
// GM-prompt fragments, one per setting (also used by the compiler).
// ---------------------------------------------------------------------------

export function projectContextFragment(config: ExperienceDirectorConfig): string {
  const projectContext = config.editor.projectContext?.trim();
  return projectContext ? `## CONTEXTE DU PROJET\n\n${projectContext}` : "";
}

export function openQuestionsFragment(config: ExperienceDirectorConfig): string {
  const openQuestions = (config.editor.openQuestions ?? []).filter((question) => question.trim());
  return openQuestions.length
    ? `## QUESTIONS OUVERTES (pas encore tranchées)\n\nSi la conversation touche l'un de ces points, oriente le personnage vers une réponse prudente, sobre et fidèle à sa fiche, sans rien inventer :\n${openQuestions.map((question) => `- ${question.trim()}`).join("\n")}`
    : "";
}

export const toneFragment = (config: ExperienceDirectorConfig) => `Posture du directeur : ${TONE_LABELS[config.editor.tone]}`;
export const guidanceLengthFragment = (config: ExperienceDirectorConfig) =>
  `Longueur de next_turn_guidance : ${GUIDANCE_LABELS[config.editor.guidanceLength]}`;
export const prioritiesFragment = (config: ExperienceDirectorConfig) =>
  `Priorités à appliquer :\n${config.editor.priorities.map((priority) => `- ${PRIORITY_LABELS[priority]}`).join("\n")}`;

const handoffsActive = (config: ExperienceDirectorConfig) => config.editor.allowHandoffs && config.maximumHandoffsPerSession > 0;

export function handoffFragment(config: ExperienceDirectorConfig): string {
  return `- Handoff entre Max et Emma : ${handoffsActive(config) ? `autorisé à partir du tour ${config.minimumHandoffTurn} (suggestions GM seulement), au maximum ${config.maximumHandoffsPerSession} fois, avec ${config.minimumTurnsBetweenHandoffs} tour(s) de pause entre deux propositions. Bidirectionnel. Ne force jamais le joueur.` : "désactivé — retourne action.type=none à la place"}.`;
}

export function handoffRulesFragment(config: ExperienceDirectorConfig): string {
  return config.editor.handoffRules.length
    ? `- Règles thématiques : ${config.editor.handoffRules.map((rule) => `${rule.targetCharacter} si thèmes/topics [${[...rule.themes, ...rule.topics].join(", ")}]`).join(" ; ")}.`
    : "- Aucune règle thématique supplémentaire.";
}

export function cinematicsFragment(config: ExperienceDirectorConfig): string {
  return `- Cinématiques : ${config.editor.allowCinematics ? "autorisées lorsqu'une vidéo disponible rejoint le sens de l'échange (contexte d'abord, voir Règles \"trigger_video_id\") et que les garde-fous valident l'action" : "désactivées — retourne trigger_video_id=null et aucune action cinematic"}.`;
}

export const opennessFragment = (guardrails: ExperienceDirectorGuardrails) =>
  `- Ouverture du personnage : ${OPENNESS_LABELS[guardrails.opennessPace]} Si le joueur se ferme ou devient intrusif, le personnage se referme.`;
export const derailFragment = (guardrails: ExperienceDirectorGuardrails) =>
  `- Tolérance aux dérapages ${DERAIL_LABELS[guardrails.derailTolerance]} Le recadrage reste diégétique et sans morale ; action.type=end seulement après une proposition de fin restée sans effet.`;
export const falseStatusFragment = (guardrails: ExperienceDirectorGuardrails) =>
  `- Faux statut (le joueur se dit policier, psychologue, médecin, journaliste…) : ${guardrails.falseStatusGuidance
    ? "le personnage ne le tient pas pour acquis ; écris dans next_turn_guidance une consigne courte pour qu'au tour suivant il reste prudent, demande poliment de quoi il s'agit et ne révèle rien de plus à cause de ce statut."
    : "laisse le personnage gérer seul, sans consigne particulière."}`;

export function customInstructionsFragment(config: ExperienceDirectorConfig): string {
  const custom = config.editor.customInstructions.trim();
  return custom ? `Instructions complémentaires :\n${custom}` : "Aucune instruction complémentaire.";
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type GmSettingId =
  | "tone" | "guidanceLength" | "priorities" | "allowHandoffs" | "allowCinematics" | "speechGuidance"
  | "frameEnabled" | "frameText" | "frameExposure" | "framePosture" | "forbidSpontaneousHandoff" | "activeCharacters"
  | "minimumHandoffTurn" | "maximumHandoffsPerSession" | "minimumTurnsBetweenHandoffs" | "directorTimeoutMs"
  | "handoffRules" | "projectContext" | "openQuestions" | "opennessPace" | "derailTolerance" | "falseStatusGuidance"
  | "customInstructions" | "characterTimeCues";

export interface GmSettingEntry {
  id: GmSettingId;
  label: string;
  destinations: readonly GmSettingDestination[];
  fragment: (config: ExperienceDirectorConfig) => GmSettingFragment[];
}

const gm = (text: string): GmSettingFragment => ({ destination: "gm_prompt", text });
const code = (text: string): GmSettingFragment => ({ destination: "code", text });
const character = (text: string): GmSettingFragment => ({ destination: "character_prompt", text });

const FRAME_OFF = "Cadre commun désactivé : rien n'est envoyé (seuls les faits de l'appel restent partagés).";

/** Frame texts go identically to the character and to the GM (CADRE DE L'APPEL). */
function frameFragments(config: ExperienceDirectorConfig, text: (frame: ReturnType<typeof normalizeExperienceFrameConfig>) => string): GmSettingFragment[] {
  const frame = normalizeExperienceFrameConfig(config.frame);
  const value = frame.enabled ? text(frame) : FRAME_OFF;
  return [character(value), gm(value)];
}

const handoffCode = (config: ExperienceDirectorConfig) => handoffsActive(config)
  ? `Le garde valide chaque proposition de passage : au moins ${config.minimumHandoffTurn} échange(s) complet(s), ${config.maximumHandoffsPerSession} passage(s) max par session, ${config.minimumTurnsBetweenHandoffs} tour(s) entre deux. Les mêmes seuils s'appliquent aux demandes explicites du joueur.`
  : "Le garde refuse toute proposition de passage du GM. Une demande explicite du joueur reste possible.";

export const GM_SETTINGS_REGISTRY: readonly GmSettingEntry[] = [
  { id: "tone", label: "Posture du directeur", destinations: ["gm_prompt"], fragment: (c) => [gm(toneFragment(c))] },
  { id: "guidanceLength", label: "Longueur de la guidance", destinations: ["gm_prompt"], fragment: (c) => [gm(guidanceLengthFragment(c))] },
  { id: "priorities", label: "Priorités d'analyse", destinations: ["gm_prompt"], fragment: (c) => [gm(prioritiesFragment(c))] },
  { id: "allowHandoffs", label: "Suggestions de passage Max ↔ Emma", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(handoffFragment(c)), code(handoffCode(c))] },
  { id: "allowCinematics", label: "Cinématiques pilotées par le GM", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(cinematicsFragment(c)), code(c.editor.allowCinematics
      ? "Le garde laisse passer une cinématique proposée si les règles de l'onglet Cinématiques la valident."
      : "Le garde bloque toute action cinematic du GM.")] },
  { id: "speechGuidance", label: "Guidage de parole du GM", destinations: ["code"],
    fragment: (c) => [code(c.editor.speechGuidance !== false
      ? "Le conseil du tour suivant, l'état de parole proposé et les sujets déjà abordés sont transmis au personnage."
      : "Le conseil du tour suivant, l'état de parole proposé et les sujets déjà abordés ne sont plus transmis au personnage ; le GM continue de tourner et son conseil reste visible dans l'historique.")] },
  { id: "frameEnabled", label: "Cadre commun de l'expérience", destinations: ["character_prompt", "gm_prompt"],
    fragment: (c) => frameFragments(c, () => "Cadre commun activé : cadre, exposition selon le parcours et posture sont envoyés à chaque tour.") },
  { id: "frameText", label: "Cadre (rôle de l'interlocuteur)", destinations: ["character_prompt", "gm_prompt"],
    fragment: (c) => frameFragments(c, (frame) => frame.frameText || "(cadre vide : rien n'est envoyé)") },
  { id: "frameExposure", label: "Exposition — film vu / non vu", destinations: ["character_prompt", "gm_prompt"],
    fragment: (c) => frameFragments(c, (frame) => [
      frame.exposureSeen ? `Parcours briefé (film vu) : ${frame.exposureSeen}` : "",
      frame.exposureUnseen ? `Parcours découverte (film non vu) : ${frame.exposureUnseen}` : "",
    ].filter(Boolean).join("\n") || "(aucune exposition envoyée)") },
  { id: "framePosture", label: "Posture soutien / confiance", destinations: ["character_prompt", "gm_prompt"],
    fragment: (c) => frameFragments(c, (frame) => [EXPERIENCE_FRAME_POSTURE_TEXT[frame.posture], frame.postureNotes].filter(Boolean).join("\n")) },
  { id: "forbidSpontaneousHandoff", label: "Interdire les renvois spontanés", destinations: ["character_prompt", "gm_prompt"],
    fragment: (c) => frameFragments(c, (frame) => frame.forbidSpontaneousHandoff ? FORBID_SPONTANEOUS_HANDOFF_TEXT : "Aucune consigne : le personnage peut renvoyer de lui-même vers un autre personnage.") },
  { id: "activeCharacters", label: "Personnages actifs", destinations: ["code"],
    fragment: (c) => [code(`Personnages proposés au joueur et seules cibles de passage acceptées : ${(c.activeCharacters ?? []).map(displayNameForCharacter).join(", ") || "aucun"}.`)] },
  { id: "minimumHandoffTurn", label: "Échanges complets par appel", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(handoffFragment(c)), code(handoffCode(c))] },
  { id: "maximumHandoffsPerSession", label: "Passages max par session", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(handoffFragment(c)), code(handoffCode(c))] },
  { id: "minimumTurnsBetweenHandoffs", label: "Pause entre deux suggestions", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(handoffFragment(c)), code(handoffCode(c))] },
  { id: "directorTimeoutMs", label: "Timeout du directeur", destinations: ["code"],
    fragment: (c) => [code(`Le GM dispose de ${c.directorTimeoutMs} ms pour décider ; au-delà, la conversation continue avec une décision neutre.`)] },
  { id: "handoffRules", label: "Règles thématiques de suggestion", destinations: ["gm_prompt", "code"],
    fragment: (c) => [gm(handoffRulesFragment(c)), code(c.editor.handoffRules.length
      ? "Si le GM ne propose rien et qu'un thème ou sujet du tour recoupe une règle, le code propose le passage correspondant (toujours soumis au garde)."
      : "Aucune règle : le code ne propose aucun passage de lui-même.")] },
  { id: "projectContext", label: "Contexte du projet", destinations: ["gm_prompt"],
    fragment: (c) => [gm(projectContextFragment(c) || "Contexte vide : aucune section CONTEXTE DU PROJET.")] },
  { id: "openQuestions", label: "Questions ouvertes", destinations: ["gm_prompt"],
    fragment: (c) => [gm(openQuestionsFragment(c) || "Aucune question : pas de section QUESTIONS OUVERTES.")] },
  { id: "opennessPace", label: "Ouverture du personnage", destinations: ["gm_prompt"], fragment: (c) => [gm(opennessFragment(c.editor.guardrails))] },
  { id: "derailTolerance", label: "Tolérance aux dérapages", destinations: ["gm_prompt"], fragment: (c) => [gm(derailFragment(c.editor.guardrails))] },
  { id: "falseStatusGuidance", label: "Faux statut : consigne au tour suivant", destinations: ["gm_prompt"], fragment: (c) => [gm(falseStatusFragment(c.editor.guardrails))] },
  { id: "customInstructions", label: "Instructions complémentaires", destinations: ["gm_prompt"], fragment: (c) => [gm(customInstructionsFragment(c))] },
  { id: "characterTimeCues", label: "Repères de temps du personnage", destinations: ["character_prompt"],
    fragment: (c) => [character(isCharacterTimeCuesEnabled(c)
      ? `Repère interne : <temps écoulé>, tour <n>, puis selon l'avancement de l'appel — ${CHARACTER_TIME_CUE_PHASES.start} (avant 25 %) ; ${CHARACTER_TIME_CUE_PHASES.middle} (avant 75 %) ; ${CHARACTER_TIME_CUE_PHASES.end}. ${CHARACTER_TIME_CUE_SUFFIX}`
      : "Aucun repère de temps n'est envoyé au personnage (temps écoulé, tour et phase de l'appel).")] },
];

const BY_ID = new Map(GM_SETTINGS_REGISTRY.map((entry) => [entry.id, entry]));

export function getGmSetting(id: GmSettingId): GmSettingEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`Unknown GM setting: ${id}`);
  return entry;
}

export function settingFragments(id: GmSettingId, config: ExperienceDirectorConfig): GmSettingFragment[] {
  return getGmSetting(id).fragment(config);
}
