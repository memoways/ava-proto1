import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig, ExperienceDirectorGuardrails } from "@/types";
import { CHARACTER_CALL_TRANSFER_INSTRUCTIONS } from "./characterConversation";
import { GM_JSON_EXAMPLE } from "./gameMasterContract";

/** Added to the same GM call only when the runtime supplies exact handoff context. */
export const CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS = `CONTRAT RUNTIME DE PASSAGE — prioritaire sur le schéma historique et sa règle de suggestion au tour suivant.
Le CONTEXTE EXACT DU PASSAGE est fourni : la clé handoff_assessment est obligatoire à la racine du même objet JSON, null si aucun passage n'est évalué. Le schéma historique fermé est étendu par cette clé.
FORMAT COMPACT PRIORITAIRE : un seul objet JSON complet, sur une ligne sans markdown. Tous les champs de premier niveau restent présents. Exemple complet (décision à évaluer, pas une autorisation par défaut) :
${JSON.stringify({ ...Object.fromEntries(Object.entries(GM_JSON_EXAMPLE).filter(([key]) => key !== "memory_delta")),
  handoff_assessment: { schemaVersion: 2, requestSource: "current_user", targetCharacter: "max", stance: "accept", refusal: false, consentRef: "speech_0" },
  action: { type: "handoff", targetCharacter: "max", reason: "Accord de transfert.", proposalGuidance: "Propose le passage à Max." },
  player_switch_request: { targetCharacter: "max", stance: "accept" },
  // Keep the proof before potentially long differential memory.
  memory_delta: null,
}, null, 1)}
consentRef doit être exactement un ref fourni dans speechEvidence : speech_0, speech_1, etc. (speech_N, N entier). currentUserMessage et openRequest sont des sources de demande, JAMAIS des consentRef. Exemple invalide à rejeter : "consentRef":"currentUserMessage" ; ne le remplace pas par une référence supposée.
consentRef référence la phrase de speechEvidence qui justifie la stance ; copie uniquement son ref, sans recopier son texte. Pour accept, choisis une phrase affirmative réellement délivrée (delivered=true). Un accord seulement généré, incertain ou coupé ne suffit jamais ; ne choisis pas une salutation ou une phrase sans accord à sa place. Le moteur vérifiera sa présence dans le reçu entendu.
Le format de preuve est désormais référencé : n'écris AUCUN identifiant, numéro de tour ou citation dans handoff_assessment. L'application les prend exactement dans la source référencée et dans le reçu de parole délivrée, puis vérifie le contrat. N'ajoute aucun autre champ aux six champs montrés ; une référence inconnue ou invalide sera refusée, jamais réparée.
requestSource : current_user = currentUserMessage ; open_request = openRequest fourni et non null ; spoken_proposal = proposition effectivement dite par le personnage au tour courant, jamais une guidance privée. Pour player_request, les seules sources admissibles sont currentUserMessage et openRequest non null. L'historique éclaire le sens mais ne fournit aucune autre source de preuve : openRequest=null interdit toute origine ancienne.
Une confirmation courante de la volonté de poursuivre le transfert peut prendre current_user, même sans répéter le premier message ou une formule précise. Un oui hors contexte ou une question sur l'état de l'autre ne suffit pas. Pour player_request, si aucune source admissible ne porte la demande, retourne handoff_assessment:null. Pour gm_proposal, origin reprend les identifiants courants automatiquement via spoken_proposal, qui exige une proposition réellement prononcée nommant la cible.
La cible max ou emma doit être nommée dans la source utilisateur admissible ou la parole délivrée courante. Si le joueur dit seulement oui mais que le personnage lui propose de passer Max, choisis current_user ou spoken_proposal selon l'origine sémantique ; ne recopie pas une ancienne demande. Sans cible ainsi nommée, demande une clarification naturelle au prochain tour. Aucun alias global Matt → Max.
Analyse la réplique complète : accept|object|defer. stance=accept seulement pour un accord effectivement délivré au tour courant ; implique action.type=handoff vers la même cible. Une suggestion future, demande seule, absence de refus ou texte généré mais non entendu ne donne aucune permission. T6 « Je peux lui demander » est différé ; T9 « Je vais lui demander de vous parler » reste ambigu. « Plus tard », « Je vais lui demander s'il accepte » ou un accord conditionnel restent object ou defer.
refusal=true dès qu'un refus de transfert contredit l'accord dans la réplique complète, même si un extrait semble affirmatif. Ne classe jamais accept un refus avec ou sans ne, « Je vais l'appeler… enfin non » ou un oui hors contexte. Une inquiétude générale sur les sentiments de Max ne vaut pas refus de transfert. Le moteur garde ses vetos et vérifie le reçu entendu, la fraîcheur, version, source et cible.
Une demande ouverte doit être reconfirmée defer au tour courant ; null, refus ou retrait la ferme. Ne ressuscite pas une ancienne demande. Pour object/defer, action peut rester none. Préserve seuil, quota, pause, disponibilité, version et clic du joueur ; aucun transfert automatique ni partage des mémoires privées.
Procédure de passage à rappeler dans proposalGuidance sans la réciter au joueur : ${CHARACTER_CALL_TRANSFER_INSTRUCTIONS}
Budget de sortie 950 tokens conservé : émettre handoff_assessment avant memory_delta ; fermer l'objet entier. notes : 40 caractères maximum ; next_turn_guidance et proposalGuidance : 100 caractères chacune. Pas de commentaire ni répétition de preuves.
memory_delta : uniquement les nouveautés du dernier échange, jamais une copie de la mémoire. null si rien de nouveau ; sinon seulement les champs utiles, deux faits courts par liste et lastExchange en 20 mots maximum. N'invente ni n'efface de fait pour raccourcir. Une proposition relationship n'est utile que si elle change l'état, avec métadonnées et preuves exactes ; sinon l'omettre.`;

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

/** Recadrage hors-monde : rappel de consigne, jamais une fin d'appel au premier écart. */
export const OFF_WORLD_GUIDANCE_RULE = "Hors-monde : si le joueur demande ou aborde un sujet étranger à l'histoire (recette, outil, technique, culture, actualité, savoir général…), OU si la réponse du personnage vient de sortir de sa fiche, de sa mémoire ou de ses souvenirs, écris dans next_turn_guidance un recadrage court : le personnage refuse en rôle (il ne sait pas, il n'a pas la bande passante), rappelle que seule compte la situation qui est la sienne et la pandémie, et propose d'en reparler une autre fois. Ajoute \"hors-sujet\" aux intentions. C'est un recadrage, pas un dérapage : n'enclenche pas de fin d'appel pour un premier hors-sujet.";

export function buildGuardrailsBlock(guardrails: ExperienceDirectorGuardrails): string {
  return `Garde-fous de conversation :
- Ouverture du personnage : ${OPENNESS_LABELS[guardrails.opennessPace]} Si le joueur se ferme ou devient intrusif, le personnage se referme.
- Tolérance aux dérapages ${DERAIL_LABELS[guardrails.derailTolerance]} Le recadrage reste diégétique et sans morale ; action.type=end seulement après une proposition de fin restée sans effet.
- ${OFF_WORLD_GUIDANCE_RULE}
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
