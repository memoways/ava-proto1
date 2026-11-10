# Plan — GM post-tour : JSON lisible à chaque tour (10 novembre 2026)

Origine : le juge J3 ([rapport](rapport_llm_juge_j3_sandbox_20261109.md)) mesure un post-tour illisible dans ~17 % des
tours (`invalid_json · json_unreadable`). Dans ces tours, en jeu comme en rejeu, aucun `next_turn_guidance` n'atteint
le tour suivant et le `memory_delta` du tour est perdu. Le lot R (rumination et sous-texte) s'appuiera sur ce conseil.

## Diagnostic (sandbox-ulrich, GM `google/gemini-2.5-flash`, sans raisonnement)

Instrument : chaque post-tour illisible garde une description bornée de sa sortie, jamais son texte
(`validation_issues[].output_shape` : `empty` | `truncated` | `no_object` | `syntax`, plus `finish_reason`,
`completion_tokens`, `output_chars`). Le rapport J3 et Admin › Sessions l'affichent. Les sorties brutes du run de
diagnostic sont restées dans un dossier temporaire local, hors dépôt.

- **17 post-tours illisibles sur 72 (23,6 %), tous tronqués** : `finish_reason: length`, 930 à 944 tokens pour un
  plafond de 950. Aucun texte autour du JSON, aucun échappement fautif, aucun champ manquant.
- Les sorties lisibles frôlaient aussi le plafond (médiane 840 tokens, maximum 923).
- Cause du volume : objet **indenté dans un bloc \`\`\`json** et, dans les 17 cas, `memory_delta` qui **recopie la
  mémoire antérieure** sous forme d'objets `{id, text, sourceTurn}` dans `openThreads` et `topics`. Ces objets ne
  servent à rien : `cleanMemoryDelta` ne garde que des chaînes.

## Correctif (consigne et budget, sans changer le sens des champs)

1. **Contrat technique commun** (`GM_RUNTIME_OUTPUT_INSTRUCTIONS`, code, ajouté à tout prompt GM publié) : objet
   compact sur une ligne, sans markdown ni indentation ; `memory_delta` = nouveautés du dernier échange seulement, en
   chaînes courtes, jamais une copie de MÉMOIRE AVANT LE TOUR ; fermer un fil par son id dans `resolvedThreadIds` ;
   sans nouveauté, listes vides et `lastExchange` toujours renseigné. C'est la
   règle déjà écrite pour l'extension de passage et le sens du schéma historique (« DERNIER échange seulement »,
   listes de chaînes), désormais dite à chaque tour.
2. **Mémoire antérieure présentée en chaînes** « id — texte » (fils, engagements, sujets, traits) dans
   MÉMOIRE AVANT LE TOUR, au lieu d'objets `{id, text, sourceTurn}` : l'id reste disponible pour `resolvedThreadIds`,
   le modèle n'a plus de gabarit d'objet à recopier. Ajouté après un run où deux sorties bouclaient sur cette copie
   jusqu'au nouveau plafond, malgré la consigne.
3. **Plancher de budget** `GM_MIN_MAX_TOKENS` = 1600 (au lieu de 950), partagé par le GM, la normalisation des
   réglages, l'écran LLM et l'extension de passage. Le réglage `admin_settings` n'est pas modifié : un 950 enregistré
   est relevé au plancher à la lecture. Le GM reste hors du chemin de la voix ; le délai GM n'est pas changé.
4. **Extraction** déplacée dans `src/agents/gmJsonOutput.ts` (pure) ; un guillemet hors objet ne fausse plus la
   recherche de l'objet. Aucune réparation d'un objet tronqué : une sortie incomplète reste `invalid`, neutre en jeu.

Hors périmètre : modèle GM, `proxy-llm` (aucun déploiement Edge), `admin_settings`, base Caractères, production.

## Validation

- Tests unitaires sur une sortie réelle tronquée anonymisée et sa forme compacte (`gameMasterPRD4.output.test.ts`,
  `gmJsonOutput.test.ts`) ; tests GM existants avec le nouveau plancher.
- Mesure avant/après : `npm run eval:judge:sequences -- --candidate optimized_v3 --repeats 2 --max-cost-usd 3` sur
  sandbox-ulrich, même code de part et d'autre du témoin. Résultats : [rapport](rapport_gm_post_tour_json_sandbox_20261110.md).
- **Résultat** : illisibles 17/72 → 0/72 ; conseils transmis 44/56 → 56/56 ; mémoire absorbée 54/72 → 63/72 ;
  notes du juge sans recul au-delà du bruit (séquence −0,35, seuil 1,0, à surveiller). 8,72 $ mesurés.

## Suite

Lot R inchangé : [prompt](prompt_reprise_rumination_sous_texte_lot_r.md), dont le point 4 (GM illisible) est levé.
Proposition à décider à part : garder les faits du `memory_delta` quand seule la proposition `relationship` est
refusée par le moteur (9/72 tours perdent encore leur mémoire pour cette raison).
