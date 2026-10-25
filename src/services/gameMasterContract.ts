/** Code-owned wire contract. Published editorial prompts are immutable inputs. */
export const GM_REQUIRED_JSON_EXAMPLE = {
  labels: { themes: [], topics: [], intentions: [] },
  engagement_delta: 0, confusion_detected: false, role_usage_quality: "unknown", topics_covered: [],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: "",
  end_recommended: false, moderation_flag: false, notes: "", trigger_video_id: null,
  action: { type: "none" }, player_switch_request: null, memory_delta: null,
};

export const REQUIRED_GM_JSON_FIELDS = Object.keys(GM_REQUIRED_JSON_EXAMPLE);
export const GM_JSON_EXAMPLE = { ...GM_REQUIRED_JSON_EXAMPLE, next_speech_state: null };

export const GM_RUNTIME_OUTPUT_INSTRUCTIONS = `CONTRAT TECHNIQUE COURANT DU GM — prioritaire sur tout schéma historique fermé ci-dessus, y compris « EXACTEMENT cet objet ».
Les instructions éditoriales restent applicables ; ce contrat définit le format effectif du même appel.
Champs requis : ${REQUIRED_GM_JSON_FIELDS.join(", ")}.
next_speech_state est facultatif pour la compatibilité historique : absent ou null = aucune proposition ; un état inconnu est ignoré. Dans les nouvelles réponses, retourne ce champ avec null ou le nom exact d'un ÉTAT DE PAROLE DU PERSONNAGE fourni. Jamais un état inventé ni trois fois le même état de suite.
Sans CONTEXTE EXACT DU PASSAGE, aucune preuve de transfert n'est demandée. Avec ce contexte, l'extension de passage ci-dessous définit handoff_assessment à la racine.
Un seul objet JSON complet, sans markdown. Exemple neutre complet :
${JSON.stringify(GM_JSON_EXAMPLE)}
L'absence d'un champ requis invalide l'évaluation ; ne tronque pas l'objet et ne reconstruis jamais une autorisation incomplète.`;
