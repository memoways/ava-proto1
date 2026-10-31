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
