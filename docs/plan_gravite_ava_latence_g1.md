# Lot G1 — gravité des personnages, nom « Ava », latence réelle

Source : [prompt G1](prompt_reprise_gravite_ava_latence_lot_g1.md). Session de référence
`d00687ba-f31c-47b7-9398-93ea98a14ec2` (sandbox-ulrich, 31 oct. 2026, ElevenLabs v4 Turbo).

## G1.0 — Diagnostic (31 octobre 2026, sans code)

Sources lues : `sessions.conversation_log` (texte généré et livré, transcription STT),
`voice_turn_events` (jalons et spans serveur), `llm_usage` (appels LLM par tour),
`admin_settings` sandbox/prod, `character_prompts` sandbox/prod (copie des fiches Notion),
code des compilateurs de prompt, de `performanceIntent.ts` et de l'orchestrateur.

### B. « Eva » vient de la voix ElevenLabs

- Transcription STT : « Ava » correct (« si tu as pu avec Ava »).
- Texte LLM généré et livré : « Ava » partout (Max tours 2 et 4, Emma tour 6 deux fois).
- Donc ni STT, ni LLM, ni sources : c'est la prononciation TTS. `languageCode = fr` est bien
  envoyé à ElevenLabs (`proxy-tts`), mais v4 Turbo lit « Ava » à l'anglaise (/ˈeɪvə/, entendu
  « Éva »), probablement selon la voix (Emma). Preuve d'écoute à faire par Ulrich ; aucune
  mesure automatique ne prouve un rendu vocal.

### A. Ton : ce qui part réellement au LLM et aux voix

Texte (prompt `optimized_v3`, Max et Emma) :
- Les fiches (Manière de parler, Qui tu es) sont déjà graves ; rien de léger.
- Aucun invariant de gravité côté code.
- `RESPONSE_HOOK_RULE` (R1) impose de finir par « un détail concret non expliqué » avec le
  gabarit « Et [un détail]… je ne sais pas pourquoi je pense à ça. » ; le contrat de flux répète
  « Termine sur une accroche (détail concret…) ». Constat session : 3 tours de Max sur 5
  finissent sur le café (« l'odeur du café », « le café refroidit », « la cafetière vient de
  s'arrêter »). Cause directe des trivialités.

Voix (`derivePerformanceIntent`, chemin live) :
- Ton de base codé : Emma `warm` (« warm, open, gently concerned »), Max `tense`. Hors état de
  parole autorisé, chaque réplique d'Emma part en `warm` : ElevenLabs v4/v4 Turbo reçoit
  `[warmly]` en tête, Inworld « warm, open… », Fish `(empathetic)`, Cartesia `content` (en).
- Le décroché d'Emma (« Max vient de me passer la ligne. Bonjour. », grille de
  `characterHandoffGreeting`) n'a pas d'état de parole : il part en `[warmly]`. Cause directe
  du décroché guilleret.
- Le lexique peut aussi forcer `warm` (« merci », « d'accord », « vas-y ») ou `sarcastic`
  (« bien sûr », « évidemment », « génial ») → `[sarcastic]` en v4.
- Les mappings d'états (`ava_speech_performance`) sont graves (fragile, tense, urgent,
  scared) mais ne s'appliquent que si un état est joué et que la rugosité est > 0.
- Gradium : température et rythme seulement, aucune émotion nommée ; inchangé.

### C. Latence : causes nommées

| Tour | Appels LLM | Écart fin LLM → TTS | Cause |
|---|---|---|---|
| 1, 3, 6 | 1 | 3–4 ms | — |
| 2, 4 | 2 | 2,6 s | relance complète du LLM |
| 5 | 2 | 5,9 s | relance + préparation du passage à Emma (GM attendu, 3,2 s) |

- **Écart fin LLM → TTS = relance de récupération.** Sur les tours lents, `llm_usage` montre un
  second `prd4_chat` (≈2 900 tokens d'entrée au lieu de ≈3 350 : sans le contrat de flux privé)
  et les spans serveur un second appel `proxy-llm` (1,4–1,8 s). `processPRD4Turn` relance
  (`recoverySpeechOnly`) quand `ResponseIntentParser` rejette la première sortie : en-tête JSON
  manquant ou invalide, phrase finale incomplète, parole vide. La raison exacte n'est loguée
  qu'en console, pas persistée. Corrélation : un tour sur cinq avant R1, un sur deux après ;
  R1 demande de « laisser la pensée ouverte » et finir sur des fragments, que le parseur
  refuse s'ils ne finissent pas par une ponctuation.
- **Passage (tour 5)** : `needsHandoffPreparation` attend le GM avant de parler (voulu par
  l'invariant « Transfers alone await preparation »).
- **Contexte** : RAG 0,6–1,7 s (embedding Voyage 0,2–0,7 s, rerank 0,2–0,7 s), puis
  0,7–1,1 s entre `context_ready` et `llm_request` (construction du prompt, non découpée).
  Tour 3 : 3,7 s non attribués hors RAG ; coïncide avec la persistance GM du tour 2 (2,4 s, la
  plus longue) ; à instrumenter avant de conclure.
- **LLM Max** : 1,6–3,3 s, non streamé : avec ElevenLabs le chemin incrémental n'existe pas
  (`incremental` exige Gradium), indépendamment de `VOICE_INCREMENTAL_OUTPUT`.
- **Non mesuré** : `endOfSpeechMs` vaut 2 000 ms en sandbox-ulrich (900 en prod) + 700 ms
  d'hésitation : jusqu'à 2,7 s de silence avant `turn_decided`, absents des jalons.

## G1.1 — Changements proposés (accord d'Ulrich le 31 octobre 2026)

A texte : invariant de gravité non tronquable dans les quatre compilateurs (Max, Emma) ;
accroche réécrite vers un fil du drame, jamais un détail du décor ; garde locale de sortie
(sans LLM) qui retire une dernière phrase triviale ou légère.
A voix : base Emma `fragile`/`measured` ; `warm` et `sarcastic` jamais par défaut pour Max et
Emma ; consigne grave par fournisseur (balise v4, instruction Inworld, émotion Fish).
B : réécriture phonétique de « Ava » pour ElevenLabs seulement, variante choisie à l'oreille.
C : raison de relance persistée ; parseur aligné sur R1 (fin de flux `stop` acceptée sur un
fragment, balise fermante retirée) ; découpage du temps de contexte.

Sur accord d'Ulrich seulement : `endOfSpeechMs` sandbox 2 000 → 900 ; streaming LLM vers
ElevenLabs ou modèle de Max plus rapide.

Proposition Notion (non appliquée, base en lecture seule) : voir le compte rendu G1.0.

Texte proposé pour « Ce que tu évites » de Max et d'Emma (à ajouter par Ulrich s'il le
souhaite ; l'invariant tient déjà côté code) : « Aucune légèreté, aucun humour, aucun détail
du quotidien (café, objets, odeurs, bruits) pour remplir un silence : ce qui t'est arrivé
occupe tout l'appel. »

## Exécution G1.1 — 31 octobre 2026

- `src/agents/gravity.ts` : `GRAVITY_INVARIANT` ajouté au bloc d'identité non tronquable
  (`buildMaxSystemPrompt`, toutes variantes) ; `enforceGravity` retire les phrases triviales
  (café, tasse, odeur, objets domestiques) ou légères (rire, blague), jamais la première
  phrase. Appliquée phrase à phrase dans `ResponseIntentParser` avant émission (chemins batch
  et incrémental), et sur la réponse de récupération.
- `RESPONSE_HOOK_RULE` et contrat de flux : accroche = fil du drame ; gabarit « je pense à ça »
  retiré. Défaut `responseStyle` aligné.
- `performanceIntent.ts` : `withGravity` pour Max et Emma — `neutral`/`warm` → `fragile`,
  `sarcastic` → `tense`, préfixe « grave, weighed down; » pour l'instruction (Inworld). Base
  d'Emma `fragile` (sans ralentissement « measured », elle parle plus vite que Max). Gradium :
  mêmes réglages qu'avant (même rembourrage). Ateliers (intentions manuelles) inchangés.
- Décroché d'Emma : « Max vient de me passer la ligne… Je vous écoute. ».
- ElevenLabs : `prepareElevenLabsText` remplace « Ava » par `Ahva` pour les modèles à balises
  (v3, v4, v4 Turbo), aussi dans `previous_text`/`next_text`. Multilingual v2 (prod) inchangé.
- Relance : `ResponseIntentParser.finish(true)` dit une pensée finale non ponctuée en
  suspension (guillemets ouverts et résidu de balise restent refusés). En batch, un en-tête
  privé manquant ou invalide sur une réponse complète (`stop`) est sauvé localement
  (`salvageBatchSpeech` + `validateRecoverySpeech`) au lieu d'un second appel LLM.
- Télémétrie : `voice_turn_finished.metadata_json.server` reçoit une entrée
  `<turn>:character` (horloge client, origine début de tour) avec `character_rag`,
  `character_context_reads`, `character_prompt_build`, `character_attempt`,
  `character_retry_{intent|sentence|empty|timeout|other}`, `character_local_salvage`,
  `character_gravity_guard`, `character_handoff_preparation`.
- Construction du prompt `optimized_v3` mesurée hors navigateur : ~50 ms. Elle n'explique
  pas les 0,7–1,1 s entre `context_ready` et `llm_request` ; les spans tranchent à la recette.
- Validations : `npm run test:quality` vert (lint sans erreur, 1 avertissement préexistant ;
  unitaires, régression, intégration, build). Une simulation ne prouve pas le rendu vocal.
- Correctif L1 découvert par la CI : `elevenLabsStreamPlayer` — un `ended` précoce réglait la
  lecture en attendant la génération, puis l'échec de la requête sortait de `failAll` sans
  rejeter la génération : tour bloqué sur « répond… ». `failAll` rejette maintenant toujours la
  génération. E2E concerné : 12/12 sous charge (avant : 5 échecs sur 8 ; main : 2 sur 8).

## G1.2a — Recette d'Ulrich (31 octobre 2026, sans code)

Session `4671a23a-2fc1-4597-92e7-9ae6d0e6c31a` (sandbox-ulrich, 20 h 19, Max → Emma, un passage,
10 tours, ElevenLabs v4 Turbo, LLM `openai/gpt-5.6-luna`). Ressenti d'Ulrich : « bien, correct,
bonne direction » ; demande : plus de réactivité sans régression ni cassure de voix.

- **Gravité** : aucune trivialité ni légèreté dans le texte livré (Max 7 répliques, Emma 3) ;
  aucun span `character_gravity_guard` : la garde n'a rien eu à retirer. Décroché d'Emma :
  « Oui, Emma à l'appareil… Max m'a transmis l'appel. »
- **Relance** : 10 `prd4_chat` pour 10 tours, aucune relance. `character_local_salvage` sur
  5 tours (2, 3, 4, 5, 10) : l'en-tête privé manquait et a été sauvé sans second appel ; avant
  G1.1, ces tours auraient coûté +1,4 à 2,6 s.
- **« Ava »** : non commenté par Ulrich ; `Ahva` reste en place, à confirmer à l'oreille.
- **Latence** (origine = décision de tour, horloge client) : premier son à 4,1–4,8 s hors
  passage (6,0 s au tour 10, LLM 3,0 s), 6,8 s et 8,6 s sur les deux tours de passage.
  Décomposition type : RAG 0,83–1,35 s → **construction du prompt 0,77–0,96 s à chaque tour**
  (`character_prompt_build` = écart `context_ready → llm_request`) → LLM 1,3–2,4 s (serveur
  1,34–3,05 s) → texte → premier son 0,47–0,61 s. `character_context_reads` : 2–3 ms.
- **Cause de la construction lente** : calcul pur, pas de réseau (la fiche est en cache).
  `duplicateOf` (compilateur `optimized_v3`) recalculait normalisation, mots-clés et shingles
  de chaque unité déjà retenue pour chaque nouvelle unité comparée : coût quadratique sur des
  fiches de ~50 000 caractères. Profil Node : 175 ms par construction, dont 85 % dans
  `shingleSet`/`duplicateOf`/`normalizeForComparison` ; plus lent dans le navigateur.
- **Passage** : au tour 6 (« si tu peux me la passer »), le MJ a retenu le transfert ; Max a dit
  la phrase de pause après 2,3 s de préparation, puis le transfert s'est fait au tour 7 après
  4,0 s de préparation. La pause était vouvoyée (« Attendez. Qu'est-ce que vous voudriez lui
  dire ? ») alors que Max tutoyait depuis le tour 2 : cassure de continuité.

## Exécution G1.2b — 31 octobre 2026

- `maxOptimizedPromptCompiler.ts` : profil de comparaison (texte normalisé, mots-clés,
  shingles) calculé une fois par texte et gardé en cache borné (4 000 entrées) ; mêmes seuils,
  même résultat (test cache froid = cache chaud). Construction mesurée en Node : 175 ms →
  11 ms au premier tour, 5 ms ensuite. Gain attendu en sandbox : ~0,8 s par tour, à confirmer
  par `character_prompt_build` à la prochaine recette.
- `characterConversationContinuity.ts` : `characterRegister` lit le registre que le personnage
  emploie déjà (dernière réplique avec une adresse) ; pause de transfert retenu, phrases de
  reprise, retour d'appel et rappel passent au « tu » quand il tutoie. Premier contact
  inchangé (vouvoiement).
- Sans changement : `Ahva`, termes de la garde (aucun faux positif ni oubli observé),
  Gradium, `VOICE_INCREMENTAL_OUTPUT`, préparation des passages (invariant « Transfers alone
  await preparation »).
- Validations : `npm run test:quality` vert. Une simulation ne prouve pas le rendu vocal.

### Restant, décisions d'Ulrich

1. `endOfSpeechMs` sandbox 2 000 → 900 ms (prod 900) : jusqu'à 1,1 s de silence en moins avant
   la décision de tour, hors des jalons mesurés ; risque : couper une phrase hésitante.
2. Streaming du LLM vers ElevenLabs : LLM 1,3–2,4 s en batch, premier son possible après la
   première phrase ; chantier plus lourd (le chemin incrémental n'existe que pour Gradium).
3. Modèle de Max/Emma plus rapide : à comparer sur la gravité et la langue avant tout choix.
4. RAG 0,8–1,35 s (embedding 0,1–0,7 s, rerank ~0,2 s) : piste suivante, non traitée.
5. Transfert retenu par le MJ alors que le joueur le demande clairement (tour 6) : coûte un
   tour complet ; règle éditoriale du MJ à revoir avec Ulrich si ce n'est pas voulu.

## G1.3a — Recette d'Ulrich (31 octobre 2026, sans code)

Session `e6918bd8-50e9-499a-8d9d-875b217cc36a` (sandbox-ulrich, 21 h 02, Max, 10 tours, non
terminée, ElevenLabs v4 Turbo, LLM `openai/gpt-5.6-luna`, MJ `google/gemini-2.5-flash`).
Retour d'Ulrich : gros blocage sur le passage à Emma, impossible ; Max a répété plusieurs fois
la même chose.

- **G1.2 tient** : `character_prompt_build` 25–58 ms (avant : 770–960 ms), soit l'écart
  `context_ready → llm_request`. Un seul `prd4_chat` par tour (10 pour 10), aucune relance ;
  sauvetage local aux tours 5 et 6. Registre « tu » tenu partout, pauses comprises.
- **Gravité** : tenue sur les 7 répliques générées ; aucun déclenchement de la garde.
- **Latence** (origine = transcription finale) : premier son hors passage 3,2–4,7 s
  (RAG 0,68–1,75 s, LLM 1,5–2,9 s, texte → son 0,37–0,72 s). Tours 8–10 : 4,9–6,6 s, dont
  1,9–2,9 s de préparation du passage.
- **`Ahva`** : à confirmer à l'oreille par Ulrich ; aucune mesure ne prouve un rendu vocal.

### Cause du blocage du passage

| Tour | Joueur | Max (dit) | MJ | Résultat |
|---|---|---|---|---|
| 6 | « Tu crois que je pourrais parler avec elle » | « Oui… je peux lui transmettre l'appel. […] Je passe Emma. » | handoff, accord validé | offre jetée |
| 7 | « Volontiers pour parler avec Emma, oui. » | « Je passe Emma maintenant. » | handoff, accord validé | offre jetée |
| 8 | « Tu pourrais me passer Emma » | pause « De quoi veux-tu lui parler, au juste ? » | preuve refusée (`consent_reference_invalid`) | pause |
| 9 | « J'aimerais savoir comment elle se sent… » | pause « Attends. Qu'est-ce que tu voudrais lui dire ? » | idem | pause |
| 10 | « …lui poser des questions… » | pause « De quoi veux-tu lui parler… » (répétée) | `request_unresolved` | pause |

- Tours 6–7 : le MJ a validé l'accord sur le reçu entendu (`handoff_blocked`, raison
  `consent_validated`, étape `delivery` dans `experience_events`). Mais le détecteur de
  maintien `needsHandoffPreparation` ne reconnaissait ni « Je passe Emma » ni « transmettre
  l'appel » : la réplique est partie sans préparation, et `finalizeCharacterHandoff` révoque
  toute offre non préparée. Aucun bouton de passage n'est apparu.
- Tours 8–10 : la phrase de Max (non conservée) déclenchait la préparation ; le MJ candidat a
  rendu une preuve invalide (`assessment_missing`) ; repli sur la phrase de pause scriptée, qui
  n'a que deux variantes et a tourné en boucle.
- Le point 5 de G1.2b (« transfert retenu par le MJ ») ne s'applique pas à cette session : le
  MJ a accepté deux fois, c'est le code qui a jeté l'offre.

## Exécution G1.3 — 31 octobre 2026

- `handoffCoordinator.ts` : `needsHandoffPreparation` maintient aussi « je (te/vous) passe
  Max/Emma », « je vais passer Emma », « je (lui) transmets / passe l'appel, la ligne, le
  téléphone » ; « je passe mes nuits… », « je ne passe pas Emma », « il m'a transmis l'appel »
  restent ordinaires (tests).
- `IndexPRD4.tsx` : un accord validé par le MJ sur le reçu entendu, sans préparation préalable
  (formulation que le maintien manquerait encore), passe par la même préparation
  (`prepareCharacterHandoff` : disponibilité de la cible, garde du directeur, quota, seuil)
  au lieu d'être révoqué. L'offre devient disponible : bouton de passage, clic du joueur
  inchangé. Refus de garde ou de disponibilité : offre révoquée comme avant.
- `prd4Orchestrator.ts` + `characterConversationContinuity.ts` : jamais deux pauses de transfert
  de suite. Si la réplique précédente du personnage était déjà une pause et que la préparation
  échoue encore, le personnage dit sa propre réplique sans les phrases de promesse de passage
  (`withoutTransferOffer`) ; pause scriptée seulement si rien ne reste.
- Sans changement : MJ et ses preuves, vetos, clic du joueur, Gradium, `endOfSpeechMs`,
  `VOICE_INCREMENTAL_OUTPUT`, modèle, RAG.
- Validations : unitaires ciblés (détection, retrait, pause répétée), `npm run test:quality`.
  Une simulation ne prouve pas le parcours vocal : recette d'Ulrich attendue.

### G1.3b — décisions d'Ulrich (présentées le 31 octobre, aucune prise seul)

1. `endOfSpeechMs` sandbox 2 000 → 900 ms (prod 900) : jusqu'à 1,1 s de silence en moins avant
   chaque tour ; risque de couper une phrase hésitante. Changement de réglage sandbox seul.
2. Streaming du LLM vers ElevenLabs : LLM 1,5–2,9 s en batch ; premier son possible après la
   première phrase (gain estimé 0,8–1,5 s) ; chantier lourd (incrémental Gradium seulement).
3. Modèle de Max/Emma plus rapide : comparaison sur gravité et langue avant tout choix.
4. RAG 0,68–1,75 s : mesurer embedding/rerank puis paralléliser avec les lectures ou cacher.
5. Acceptation vocale du passage : aujourd'hui l'offre attend un clic sur le bouton. En mains
   libres, un « oui » du joueur après l'offre pourrait la déclencher ; à décider (invariant
   « clic du joueur »).

### G1.3c — décision 1 appliquée (31 octobre 2026)

- Ulrich accepte la fin de parole à 900 ms en sandbox. `admin_settings`, clé
  `ava_gameplay_settings`, `sandbox-ulrich` : `VOICE_HANDS_FREE.endOfSpeechMs` 2 000 → 900 ms
  (écrit via le MCP Lovable Ava à 20 h 46 UTC, relu). Rien d'autre changé : attente
  supplémentaire sur phrase hésitante toujours 700 ms, interruption toujours désactivée en
  sandbox. Production déjà à 900 ms, non touchée. Aucun code modifié.
- Pas de surcharge persistante : la page de jeu relit `admin_settings` au démarrage et
  remplace le cache du navigateur.
- À mesurer à la prochaine recette : délai entre la fin réelle de la parole et la décision de
  tour (gain attendu jusqu'à 1,1 s), et toute phrase coupée trop tôt (écoute d'Ulrich).
  Retour arrière : remettre 2 000 dans la même clé.
- Décisions 2 à 5 : toujours en attente d'Ulrich.
