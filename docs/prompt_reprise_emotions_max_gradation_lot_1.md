# Prompt de reprise — Émotions de Max : graduer au lieu d'exploser, lot 1 (diagnostic)

> **Remplacé le 27 novembre 2026** par le [plan de cohérence émotionnelle](plan_coherence_emotionnelle_gm.md) (lot 1 livré : garde-fous voix et mesure). Reprendre au [lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md).

À copier dans un nouveau chat Ava, **une fois le chantier latence terminé** (lots 4 et 5, bilan) sauf demande contraire d'Ulrich. Tâche Notion : [5 développements Game Master AVA](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) (Gamilab, section « États dynamiques — M04 », où des ruptures émotionnelles étaient déjà perçues le 20 novembre).

---

**Objectif** : comprendre pourquoi Max passe d'un ton posé à la colère et aux cris d'un tour à l'autre, un tour sur deux ou trois. Proposer un réglage ou une correction qui rende l'évolution émotionnelle graduelle et continue. Ce lot est un **diagnostic mesuré** : aucun changement de jeu sans accord d'Ulrich sur la cause et le levier.

**Constat d'Ulrich (27 novembre 2026, sandbox-ulrich, voix seule et Tavus)** : Max « pète un cadre », devient agressif, crie, sans montée progressive. Le problème dure depuis un moment, il ne vient pas du lot 3 de latence. Il nuit à la cohérence et à la continuité du personnage.

**Indices relevés le 27 novembre (lecture seule, `audio_latencies` de sandbox-ulrich)**

- 8 répliques en état de parole « La digue cède », jouées `urgent` à intensité 2. 7 en « Bloqué », jouées `fragile` à intensité 2. Toutes sur ElevenLabs `eleven_v4_turbo`.
- Sur v3/v4, `applyElevenLabsPerformance` (src/services/tts/performanceIntent.ts) monte `style`, baisse `stability`, accélère, et colle une balise (`[angry]`, `[urgent]`, `[tense]`…). Voir aussi [tenue audio Tavus](prompt_reprise_tavus_audio_tenue_lot_1.md), qui en parlait dès le 23 novembre.
- Ces indices ne prouvent pas la cause. Ils ne disent pas si l'état vient du personnage, du Game Master ou de la table état → jeu vocal.

**Chaîne à isoler (une étape à la fois, avant toute correction)**

1. **Texte** : la réplique écrite est-elle déjà en colère ? Prompt du personnage, directive relationnelle du tour, conseil du GM (`gm_advice`).
2. **État de parole choisi** : l'en-tête privé de la réponse (`ResponseIntentParser`) et l'état proposé par le GM (`gmSpeechGuidance`). Rugosité, historique des états (`speechStateHistory`), et existence d'une règle qui interdit un saut d'état d'un tour à l'autre.
3. **Radar d'état** (combativité, initiative, lucidité, ouverture, agitation ; lot D) : calcul, bornes, cadence, transmission au personnage.
4. **Jeu vocal** : table état → recette dans les réglages de parole (`speechPerformanceSettings`, par personnage et par environnement), `performanceIntent`, modèle ElevenLabs et preset (« Expressif » sur v4 contre « Max diction FR » sur multilingual v2).

**Sources à lire** : la section M04 de la tâche Notion ; src/services/prd4Orchestrator.ts (états, GM, directive relationnelle) ; src/services/gmSpeechGuidance.ts ; src/services/tts/performanceIntent.ts, speechPerformanceSettings.ts et speechIntentWorkshop.ts ; les réglages réels de sandbox-ulrich (`admin_settings`, lecture seule) ; `voice_turn_events`, `audio_latencies` et les messages des sessions du 27 novembre ; les invariants d'expérience et de parole en fin d'AGENTS.md.

**Périmètre du lot 1**

- Pour au moins 3 sessions récentes de Max sur sandbox-ulrich, tableau tour par tour : texte de la réplique, état de parole, émotion, intensité, preset et modèle TTS, valeurs du radar, conseil du GM. Marquer les sauts (calme → colère en un tour).
- Rejouer quelques tours en isolant chaque étage : le même texte en preset neutre (`eleven_multilingual_v2`), le même état sans GM (mode GM off ou guidage de parole coupé).
- Livrable : `docs/audit_emotions_max_<date>.md`, avec la cause la plus probable, 2 ou 3 leviers chiffrés (par exemple : limiter le saut d'état à un cran par tour, plafonner l'intensité de Max, preset sans balise v4) et leur risque. Décision d'Ulrich avant tout lot de correction.

**Hors périmètre** : fiches personnages et Base Caractères Notion (**lecture seule, interdiction formelle**), latence, production, Emma (sauf comparaison).

**Invariants et limites** : sandbox uniquement. Les réglages de parole ne changent pas pendant le diagnostic sans accord d'Ulrich. Appels payants bornés et annoncés. Une simulation ne prouve pas le rendu vocal humain : l'écoute d'Ulrich tranche. Gami DigiDouble exclu.

**Validations** : rapport relu, chiffres tirés des tables avec leurs requêtes, aucun code de jeu modifié (ou, si un outil de diagnostic est ajouté : tests, `npm run test:quality`, `npm run test:delivery`, CI verte avec `regression-gates`).

**Livraison** : branche de lot depuis main à jour, PR, CI, fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, vérification sur origin/main, état courant, CHANGELOG et tâche Notion (section M04) mis à jour.

**Première action exécutable** : lister les sessions de Max du 27 novembre sur sandbox-ulrich et sortir, tour par tour, l'état de parole et l'émotion jouée (`audio_latencies.metadata_json`), en face du texte de la réplique.

**Clôture obligatoire** : avant le push, écrire le prompt du lot suivant (correction choisie par Ulrich), avec l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation. Donner le lien direct dans le compte rendu.
