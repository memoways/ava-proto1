import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig } from "@/types";

const TONE_LABELS: Record<ExperienceDirectorEditorConfig["tone"], string> = {
  discreet: "Discret : observe et intervient seulement lorsqu'une décision est utile.",
  balanced: "Équilibré : guide la progression sans sur-orchestrer la conversation.",
  directive: "Directif : formule des guidances plus explicites pour faire avancer l'expérience.",
};

const GUIDANCE_LABELS: Record<ExperienceDirectorEditorConfig["guidanceLength"], string> = {
  short: "Très courte : une instruction opérationnelle, sans justification.",
  balanced: "Équilibrée : une phrase concise avec l'intention principale.",
  detailed: "Détaillée : jusqu'à deux phrases, avec intention et contrainte narrative.",
};

const PRIORITY_LABELS: Record<ExperienceDirectorEditorConfig["priorities"][number], string> = {
  narrative_continuity: "continuité narrative et cohérence des faits",
  player_engagement: "engagement du joueur et qualité de l'échange",
  safety: "sécurité, modération charitable et limites du personnage",
  pace: "rythme, progression et clôture naturelle dans le temps disponible",
};

export function buildExperienceDirectorPrompt(basePrompt: string, config: ExperienceDirectorConfig): string {
  const priorities = config.editor.priorities.map((priority) => `- ${PRIORITY_LABELS[priority]}`).join("\n");
  const custom = config.editor.customInstructions.trim();
  return `${basePrompt.trim()}

## RÉGLAGES ADMINISTRATEUR ACTIFS

Posture du directeur : ${TONE_LABELS[config.editor.tone]}
Longueur de next_turn_guidance : ${GUIDANCE_LABELS[config.editor.guidanceLength]}

Priorités à appliquer :
${priorities}

Actions autorisées :
- Handoff entre Max et Emma : ${config.editor.allowHandoffs && config.maximumHandoffsPerSession > 0 ? `autorisé à partir du tour ${config.minimumHandoffTurn} (suggestions GM seulement), au maximum ${config.maximumHandoffsPerSession} fois, avec ${config.minimumTurnsBetweenHandoffs} tour(s) de pause entre deux propositions. Bidirectionnel. Ne force jamais le joueur.` : "désactivé — retourne action.type=none à la place"}.
${config.editor.handoffRules.length ? `- Règles thématiques : ${config.editor.handoffRules.map((rule) => `${rule.targetCharacter} si thèmes/topics [${[...rule.themes, ...rule.topics].join(", ")}]`).join(" ; ")}.` : "- Aucune règle thématique supplémentaire."}
- Cinématiques : ${config.editor.allowCinematics ? "autorisées lorsqu'un thème correspond et que les garde-fous valident l'action" : "désactivées — retourne trigger_video_id=null et aucune action cinematic"}.

${custom ? `Instructions complémentaires :\n${custom}` : "Aucune instruction complémentaire."}

Ces réglages complètent les règles de format JSON ci-dessus sans les remplacer.`;
}

export const GM_TONE_OPTIONS = [
  { value: "discreet", label: "Discret", description: TONE_LABELS.discreet },
  { value: "balanced", label: "Équilibré", description: TONE_LABELS.balanced },
  { value: "directive", label: "Directif", description: TONE_LABELS.directive },
] as const;

export const GM_GUIDANCE_OPTIONS = [
  { value: "short", label: "Très courte", description: GUIDANCE_LABELS.short },
  { value: "balanced", label: "Équilibrée", description: GUIDANCE_LABELS.balanced },
  { value: "detailed", label: "Détaillée", description: GUIDANCE_LABELS.detailed },
] as const;

export const GM_PRIORITY_OPTIONS = (Object.entries(PRIORITY_LABELS) as Array<[
  ExperienceDirectorEditorConfig["priorities"][number],
  string,
]>).map(([value, label]) => ({ value, label }));
