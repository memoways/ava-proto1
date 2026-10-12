import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig, ExperienceDirectorGuardrails } from "@/types";

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

const DERAIL_LABELS: Record<ExperienceDirectorGuardrails["derailTolerance"], string> = {
  low: "faible : dès le premier écart net (insulte, absurde, hors sujet répété), guide le personnage vers un recadrage ; au deuxième, vers une proposition calme de terminer l'appel.",
  medium: "moyenne : tolère un écart ; au deuxième, recadrage par le personnage ; au troisième, proposition calme de terminer l'appel.",
  high: "élevée : laisse jouer les détours ; recadre seulement en cas d'insultes répétées, puis propose de terminer l'appel si cela continue.",
};

const OPENNESS_LABELS: Record<ExperienceDirectorGuardrails["opennessPace"], string> = {
  slow: "lente : le personnage reste réservé longtemps et ne s'ouvre qu'après des signes répétés d'écoute sincère.",
  balanced: "équilibrée : le personnage s'ouvre progressivement quand le joueur écoute et reste cohérent.",
  fast: "rapide : le personnage se livre assez vite dès que le joueur montre de l'écoute.",
};

export function buildGuardrailsBlock(guardrails: ExperienceDirectorGuardrails): string {
  return `Garde-fous de conversation :
- Ouverture du personnage : ${OPENNESS_LABELS[guardrails.opennessPace]} Si le joueur se ferme ou devient intrusif, le personnage se referme.
- Tolérance aux dérapages ${DERAIL_LABELS[guardrails.derailTolerance]} Le recadrage reste diégétique et sans morale ; action.type=end seulement après une proposition de fin restée sans effet.
- Faux statut (le joueur se dit policier, psychologue, médecin, journaliste…) : ${guardrails.falseStatusGuidance
    ? "le personnage ne le tient pas pour acquis ; écris dans next_turn_guidance une consigne courte pour qu'au tour suivant il reste prudent, demande poliment de quoi il s'agit et ne révèle rien de plus à cause de ce statut."
    : "laisse le personnage gérer seul, sans consigne particulière."}`;
}

export function buildExperienceDirectorPrompt(basePrompt: string, config: ExperienceDirectorConfig): string {
  const priorities = config.editor.priorities.map((priority) => `- ${PRIORITY_LABELS[priority]}`).join("\n");
  const custom = config.editor.customInstructions.trim();
  const projectContext = config.editor.projectContext?.trim();
  const openQuestions = (config.editor.openQuestions ?? []).filter((question) => question.trim());
  return `${basePrompt.trim()}
${projectContext ? `\n## CONTEXTE DU PROJET\n\n${projectContext}\n` : ""}${openQuestions.length ? `\n## QUESTIONS OUVERTES (pas encore tranchées)\n\nSi la conversation touche l'un de ces points, oriente le personnage vers une réponse prudente, sobre et fidèle à sa fiche, sans rien inventer :\n${openQuestions.map((question) => `- ${question.trim()}`).join("\n")}\n` : ""}
## RÉGLAGES ADMINISTRATEUR ACTIFS

Posture du directeur : ${TONE_LABELS[config.editor.tone]}
Longueur de next_turn_guidance : ${GUIDANCE_LABELS[config.editor.guidanceLength]}

Priorités à appliquer :
${priorities}

Actions autorisées :
- Handoff entre Max et Emma : ${config.editor.allowHandoffs && config.maximumHandoffsPerSession > 0 ? `autorisé à partir du tour ${config.minimumHandoffTurn} (suggestions GM seulement), au maximum ${config.maximumHandoffsPerSession} fois, avec ${config.minimumTurnsBetweenHandoffs} tour(s) de pause entre deux propositions. Bidirectionnel. Ne force jamais le joueur.` : "désactivé — retourne action.type=none à la place"}.
${config.editor.handoffRules.length ? `- Règles thématiques : ${config.editor.handoffRules.map((rule) => `${rule.targetCharacter} si thèmes/topics [${[...rule.themes, ...rule.topics].join(", ")}]`).join(" ; ")}.` : "- Aucune règle thématique supplémentaire."}
- Cinématiques : ${config.editor.allowCinematics ? "autorisées lorsqu'un thème correspond et que les garde-fous valident l'action" : "désactivées — retourne trigger_video_id=null et aucune action cinematic"}.

${config.editor.guardrails ? buildGuardrailsBlock(config.editor.guardrails) : ""}

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
