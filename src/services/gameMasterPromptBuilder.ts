import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig, ExperienceDirectorGuardrails } from "@/types";
import { CHARACTER_CALL_TRANSFER_INSTRUCTIONS } from "./characterConversation";
import { GM_JSON_EXAMPLE, GM_MIN_MAX_TOKENS } from "./gameMasterContract";
import {
  cinematicsFragment,
  customInstructionsFragment,
  derailFragment,
  falseStatusFragment,
  GUIDANCE_LABELS,
  guidanceLengthFragment,
  handoffFragment,
  handoffRulesFragment,
  OFF_WORLD_GUIDANCE_RULE,
  openQuestionsFragment,
  opennessFragment,
  PRIORITY_LABELS,
  prioritiesFragment,
  projectContextFragment,
  TONE_LABELS,
  toneFragment,
} from "./gmSettingsRegistry";

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
Budget de sortie ${GM_MIN_MAX_TOKENS} tokens conservé : émettre handoff_assessment avant memory_delta ; fermer l'objet entier. notes : 40 caractères maximum ; next_turn_guidance et proposalGuidance : 100 caractères chacune. Pas de commentaire ni répétition de preuves.
memory_delta : uniquement les nouveautés du dernier échange, jamais une copie de la mémoire. null si rien de nouveau ; sinon seulement les champs utiles, deux faits courts par liste et lastExchange en 20 mots maximum. N'invente ni n'efface de fait pour raccourcir. Une proposition relationship n'est utile que si elle change l'état, avec métadonnées et preuves exactes ; sinon l'omettre.`;

/** Header of the settings block; the compiled block runs from the optional project sections to the footer. */
export const GM_SETTINGS_BLOCK_HEADER = "## RÉGLAGES ADMINISTRATEUR ACTIFS";
const GM_SETTINGS_BLOCK_FOOTER = "Ces réglages complètent les règles de format JSON ci-dessus sans les remplacer.";
const GM_SETTINGS_LEADING_SECTIONS = ["## CONTEXTE DU PROJET", "## QUESTIONS OUVERTES"];

export function buildGuardrailsBlock(guardrails: ExperienceDirectorGuardrails): string {
  return `Garde-fous de conversation :
${opennessFragment(guardrails)}
${derailFragment(guardrails)}
- ${OFF_WORLD_GUIDANCE_RULE}
${falseStatusFragment(guardrails)}`;
}

/** Settings block exactly as appended after the base prompt (leading newline included). */
function renderSettingsBlock(config: ExperienceDirectorConfig): string {
  const projectContext = projectContextFragment(config);
  const openQuestions = openQuestionsFragment(config);
  return `${projectContext ? `\n${projectContext}\n` : ""}${openQuestions ? `\n${openQuestions}\n` : ""}
${GM_SETTINGS_BLOCK_HEADER}

${toneFragment(config)}
${guidanceLengthFragment(config)}

${prioritiesFragment(config)}

Actions autorisées :
${handoffFragment(config)}
${handoffRulesFragment(config)}
${cinematicsFragment(config)}

${config.editor.guardrails ? buildGuardrailsBlock(config.editor.guardrails) : ""}

${customInstructionsFragment(config)}

${GM_SETTINGS_BLOCK_FOOTER}`;
}

/** Settings block compiled from the registry fragments ("Voir ce que reçoit le GM"). */
export function compileGmSettingsBlock(config: ExperienceDirectorConfig): string {
  return renderSettingsBlock(config).trim();
}

/**
 * Removes every compiled settings block frozen in a stored prompt so the
 * runtime can append the one compiled from the pinned config, never two.
 * A prompt without the settings header is returned trimmed, untouched.
 */
export function stripCompiledSettingsBlock(prompt: string): string {
  let text = prompt;
  for (;;) {
    const header = text.indexOf(`\n${GM_SETTINGS_BLOCK_HEADER}`);
    if (header < 0) return text.trim();
    let start = header;
    for (const section of GM_SETTINGS_LEADING_SECTIONS) {
      const index = text.lastIndexOf(`\n${section}`, header);
      if (index >= 0 && index < start) start = index;
    }
    const footer = text.indexOf(GM_SETTINGS_BLOCK_FOOTER, header);
    const tail = footer >= 0 ? text.slice(footer + GM_SETTINGS_BLOCK_FOOTER.length).trim() : "";
    text = [text.slice(0, start).trim(), tail].filter(Boolean).join("\n\n");
  }
}

export function buildExperienceDirectorPrompt(basePrompt: string, config: ExperienceDirectorConfig): string {
  return `${stripCompiledSettingsBlock(basePrompt)}\n${renderSettingsBlock(config)}`;
}

export { OFF_WORLD_GUIDANCE_RULE };

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
