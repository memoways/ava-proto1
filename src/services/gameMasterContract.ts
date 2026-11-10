/** Code-owned wire contract. Published editorial prompts are immutable inputs. */
export const GM_REQUIRED_JSON_EXAMPLE = {
  labels: { themes: [], topics: [], intentions: [] },
  engagement_delta: 0, confusion_detected: false, role_usage_quality: "unknown", topics_covered: [],
  transition_recommended: false, cinematic_hint: null, next_turn_guidance: "",
  end_recommended: false, moderation_flag: false, notes: "", trigger_video_id: null,
  action: { type: "none" }, player_switch_request: null, memory_delta: null,
};

export const REQUIRED_GM_JSON_FIELDS = Object.keys(GM_REQUIRED_JSON_EXAMPLE);

/**
 * Output budget floor of the post-turn GM call. At 950 the indented object hit the
 * limit in ~1 turn in 4 (finish_reason "length", J3 measure of 10 November 2026):
 * the compact format below keeps it well under, the floor keeps headroom.
 */
export const GM_MIN_MAX_TOKENS = 1600;
export const GM_JSON_EXAMPLE = { ...GM_REQUIRED_JSON_EXAMPLE, next_speech_state: null };

export const GM_RUNTIME_OUTPUT_INSTRUCTIONS = `CONTRAT TECHNIQUE COURANT DU GM — prioritaire sur tout schéma historique fermé ci-dessus, y compris « EXACTEMENT cet objet ».
Les instructions éditoriales restent applicables ; ce contrat définit le format effectif du même appel.
Champs requis : ${REQUIRED_GM_JSON_FIELDS.join(", ")}.
next_speech_state est facultatif pour la compatibilité historique : absent ou null = aucune proposition ; un état inconnu est ignoré. Dans les nouvelles réponses, retourne ce champ avec null ou le nom exact d'un ÉTAT DE PAROLE DU PERSONNAGE fourni. Jamais un état inventé. Le choix suit les déclencheurs de la fiche dans la scène courante, sans rotation obligatoire : un état pertinent peut se répéter, une pensée peut rester ouverte. Cette règle prime sur toute consigne historique de fréquence ou de rotation ; la rugosité module les possibilités de la fiche sans imposer un état.
Sans CONTEXTE EXACT DU PASSAGE, aucune preuve de transfert n'est demandée. Avec ce contexte, l'extension de passage ci-dessous définit handoff_assessment à la racine.
Un seul objet JSON complet, compact sur une seule ligne : ni markdown, ni bloc \`\`\`, ni indentation, ni retour à la ligne.
memory_delta : uniquement les nouveautés du dernier échange, jamais une copie de la mémoire. Chaque liste ne contient que des chaînes courtes nouvelles ; ne recopie jamais les entrées de MÉMOIRE AVANT LE TOUR (notées « id — texte ») : elles sont déjà conservées. Pour fermer un fil, son id seul dans resolvedThreadIds. Sans nouveauté : listes vides, lastExchange toujours renseigné.
Exemple neutre complet :
${JSON.stringify(GM_JSON_EXAMPLE)}
L'absence d'un champ requis invalide l'évaluation ; ne tronque pas l'objet et ne reconstruis jamais une autorisation incomplète.`;
