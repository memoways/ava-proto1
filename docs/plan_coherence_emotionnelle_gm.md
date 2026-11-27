# Plan — Cohérence émotionnelle des personnages, dirigée par le Game Master

Statut : plan validé par Ulrich le 27 novembre 2026. **Lots 1 et 1 bis livrés en code** (voir leurs sections) ; lots 2 à 6 à faire, un par conversation. Reprise : [lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md). Remplace [prompt_reprise_emotions_max_gradation_lot_1.md](prompt_reprise_emotions_max_gradation_lot_1.md).

Décisions d'Ulrich (27 novembre) : le radar donne le départ, mais l'état doit bouger et ne jamais rester bloqué ; éclats rares, mérités et autorisés ; recadrage gradué par le personnage quand l'appelant sort du rôle de bénévole ; premier lot = garde-fous voix et mesure. Les fiches Notion gardent le caractère fondamental, l'application gère l'état de l'expérience ; on minimise les injonctions multiples et contradictoires.

## Contexte

Le 27 novembre, sur sandbox-ulrich (voix seule et Tavus), Max s'emporte et crie un tour sur deux ou trois, sans montée progressive. C'est un exemple d'un problème plus large : l'état émotionnel n'a ni point de départ maîtrisé, ni trajectoire cohérente avec la conversation. Tâche Notion : [5 développements Game Master AVA](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) (sections du 27 novembre et M04).

Objectif : le radar à 5 axes donne le point de départ. Le Game Master, en réalisateur, fait évoluer l'état cran par cran, selon le registre de la conversation et les cinématiques montrées. L'état reste vivant, jamais figé. Les éclats sont rares, mérités et autorisés. Quand l'appelant sort de son rôle de bénévole, le personnage le recadre lui-même, en douceur puis plus fermement. Le monde reste ouvert : il n'y a ni but ni résolution.

## Audit (code au 27 novembre, main `6a50539`)

**Voix : la cause directe des cris**
- L'intensité ne dépend que de la rugosité : à 3, on a toujours une intensité de 2, dès la première apparition de l'état (`src/services/tts/performanceIntent.ts:370-372`).
- `withTemper` (`performanceIntent.ts:345-359`, `IndexPRD4.tsx:486-491`) n'interdit que deux éclats de suite. L'alternance chaud / tempéré / chaud reste permise, et c'est exactement le symptôme.
- « La digue cède » et « L'espoir revient » sont jouées `urgent`/`rushed`. Sur v4, cela donne `[urgent]`, une stabilité de 0,23 et un style de 0,62, et la balise est répétée sur chaque morceau envoyé à l'avatar (`avatarAudioBridge.ts:292-302`). La fiche Notion de Max dit pourtant « l'intensité n'impose pas de crier ».
- Le chemin dérivé chauffe aussi : base de Max `tense`/`cutting` (`:305`), lexique `maintenant`/`vite` → urgent (`:191-194`), `/dur/` sans bornes de mot → accusatoire (`:203`).
- Aucun lissage ni plafond par personnage. L'intensité, l'atténuation et la balise envoyée ne sont pas journalisées sur les chemins streaming et PCM.

**État : trois sources qui ne se parlent pas**
1. Le radar (`src/services/characterState.ts`) : initial, bornes et `maxStepPerTurn` = 1. Il est validé et transmis au personnage, mais **la voix ne le lit pas**.
2. `memory.relationship.emotionalState`, écrit par le GM, est la seule source émotionnelle de la voix (`IndexPRD4.tsx:2826` → `derivePerformanceIntent`).
3. L'état de parole est choisi par le personnage dans son en-tête privé, et c'est lui qui gagne. Aucune règle n'empêche un saut d'un tour à l'autre (`gameMasterContract.ts:23` autorise même la répétition). `speechStateHistory` n'est jamais rendu dans le prompt (`maxAgent.ts:148-157`).

Ces sources se contredisent : le bloc radar dit au personnage que l'état « ne touche jamais la forme de la parole », alors que le GM doit coupler l'état de parole au radar (`characterState.ts:339`), sans que rien ne le vérifie.

**Bugs de persistance**
- Un delta tardif est ignoré en direct mais déjà enregistré en base. À la reprise, `rebuildCharacterStates` peut réimposer un état plus ancien.
- `character_state_after` est appliqué même quand le GM n'a pas réussi à enregistrer (`IndexPRD4.tsx:2822`).
- Le profil peut être figé trop tard, au tour 1.
- `character_state_delta` est absent du schéma système et de `REQUIRED_GM_JSON_FIELDS`.

**Ce que le GM ne fait pas**
- Il ne lit pas le registre de la conversation (factuel ou émotionnel).
- Il ne reçoit pas le contexte post-vidéo (`postVideoContext` ne va qu'au personnage).
- Il ne détecte pas la sortie du rôle de bénévole. Il existe seulement une règle « hors-monde » et un garde-fou « faux statut » (`gmSettingsRegistry.ts:73,116`).
- `experienceDirection.ts` (E1) n'est pas branché.

## Principe cible (une seule logique)

- **Notion** : le caractère fondamental (histoire, manière de parler, états de parole décrits). Lecture seule pour les agents.
- **Radar dans l'application** (back-office, par personnage et par environnement) : le point de départ et les bornes de l'expérience. C'est la seule source de l'état émotionnel courant.
- **Le Game Master** fait bouger le radar à chaque tour, d'un cran au plus par axe et dans les deux sens, selon trois éléments : le registre de l'appelant, ce qui vient d'être dit, la cinématique montrée. Sans stimulation, l'état revient lentement vers le caractère de départ. Il ne se fige jamais.
- **Tout le reste est dérivé du radar**, par le code et de façon déterministe :
  - l'intensité maximale de la voix ;
  - les états de parole permis (par exemple, « La digue cède » demande une agitation au maximum du profil) ;
  - le budget d'éclats.
- **Le personnage** garde le choix de ses mots et de son état de parole, dans ce cadre. Une seule consigne émotionnelle lui parvient, au lieu de plusieurs.

## Lots (un lot par conversation, puis arrêt et prompt de reprise)

### Lot 1 — Garde-fous voix et mesure, plan inscrit dans le dépôt — livré en code le 27 novembre 2026

Réalisé : rampe (au plus un cran de plus que la réplique précédente, réplique d'ouverture plafonnée à 1), budget d'éclats (`DEFAULT_OUTBURST_WINDOW` = 6, au plus une réplique chaude par fenêtre de 6 ; une réplique retenue garde au plus l'intensité 1), plafond par personnage (Max 1 par défaut ; un éclat qui passe le budget et suit une réplique d'intensité ≥ 1 peut atteindre 2), réglage optionnel `pacing { outburstWindow, intensityCeiling }` dans `ava_speech_performance` (sans écran pour l'instant), balise ElevenLabs sur la première phrase seulement, style ≤ 0,5 et stabilité ≥ 0,3 pour les émotions chaudes, lexique corrigé, journalisation `performance_intensity`, `performance_tempered`, `performance_paced_from/reason`, `performance_outburst`, `performance_continuation` sur les trois chemins, et ligne de tour « Émotion de jeu : urgent 1/2 (rampe, au lieu de 2) ». Auditions et ateliers : inchangés (pas d'historique, donc ni rampe ni plafond). Non fait : style, stabilité et vitesse finaux ne sont pas journalisés ; aucune écoute.

Prévu :
- Écrire ce plan dans `docs/plan_coherence_emotionnelle_gm.md`, avec le prompt de reprise du lot 2. Mettre à jour `docs/etat_courant.md`, le CHANGELOG et la tâche Notion (section du 27 novembre).
- **Rampe d'intensité** : intensité ≤ intensité du tour précédent + 1, avec décroissance d'un cran par tour sans stimulation. Elle remplace le calcul fondé sur la rugosité seule (`performanceIntent.ts:370-372`).
- **Budget d'éclats** : au plus un tour « chaud » à intensité 2 par N tours (N réglable, défaut 6). Il remplace la simple alternance de `withTemper` et l'état associé dans `IndexPRD4.tsx`.
- **Plafond d'intensité par personnage**, dans les réglages de parole (`speechPerformanceSettings.ts`). Défaut : aucun. Max : 1, sauf éclat autorisé.
- **ElevenLabs v4** : balise seulement sur le premier morceau d'une réplique. Plancher de stabilité et plafond de style pour `urgent`/`angry` (`performanceIntent.ts:131-142, 488-526`).
- **Chemin dérivé** : retirer `maintenant`/`vite` du lexique urgent ; borner `\bdur\b`.
- **Journalisation** (streaming, PCM et blob) : intensité, atténuation, raison du budget, balise envoyée, style, stabilité et vitesse finaux. Les afficher sur la ligne de tour de `SessionsTab` (`sessionTurnReading.ts`).
- On ne touche ni le mapping enregistré en base ni la fiche. Tests unitaires de `performanceIntent` pour la rampe, le budget, le plafond et la balise unique.

### Lot 1 bis — Max ne s'emporte plus, tempérament vocal réglable — livré en code le 27 novembre 2026

Constat sur `sandbox-ulrich`, session `70968df2-1092-4e94-9f0b-178041b6b760` : au tour 3, « La digue cède » jouée `urgent`, intensité 2, éclat autorisé sur les trois morceaux ; deux autres sessions du jour avaient un éclat au tour 3. Le texte était calme selon Ulrich (non relu ici) : l'emportement venait de la voix. La balise ElevenLabs ne dépend pas de l'intensité : plafonner à 1 ne suffisait pas.

Décision d'Ulrich : régler et comparer depuis le back-office. Écran **Atelier de parole → Tempérament vocal en jeu** (`SpeechPacingPanel.tsx`), par personnage et par sandbox, dans `ava_speech_performance.pacing` :

| Réglage | Valeurs | Max par défaut | Emma par défaut |
|---|---|---|---|
| Moments chauds | Jamais / Contenus / Éclats forts | Jamais | Éclats forts |
| Intensité maximale (hors éclat fort) | 0, 1, 2 | 1 | 2 |
| Au plus un moment chaud toutes les N répliques | 1 à 20 | 6 | 6 |
| Montée progressive | oui / non | oui | oui |

- **Jamais** : les états chauds sont joués retenus (`tense`, mesuré, sans `[urgent]` ni `[angry]`), journalisés `performance_tempered = muted`.
- **Contenus** : un moment chaud par fenêtre, avec sa balise, sous le plafond.
- **Éclats forts** : comportement du lot 1 (intensité 2 possible après une montée).
- Retour au lot 1 pour Max : « Éclats forts », intensité 1.
- Les défauts d'Emma reproduisent le lot 1. La forme `pacing { outburstWindow, intensityCeiling }` du lot 1 est remplacée ; aucune valeur n'était enregistrée.
- Auditions et ateliers inchangés. Aucune migration, rien en production. À la prochaine publication, la production prendra les défauts (Max calme) ; l'écran n'y est pas disponible.
- La manière de s'emporter (émotion, débit, instruction de chaque état) reste dans le mapping existant, sous les options avancées de l'atelier.
- Non fait : aucune écoute.

### Lot 2 — Audit des fiches Notion face au radar (document, lecture seule)
- Pour Max et Emma, champ par champ (Manière de parler, états de parole, Dynamique, Politique relationnelle, mémoires RAG qui contiennent « furieux » ou « tu cries »), relever chaque consigne émotionnelle qui contredit le radar ou le double. Exemples : « confiance dès le début », un état de parole qui impose une intensité.
- Livrable : `docs/audit_fiches_vs_radar.md`, avec ce qui reste dans Notion (le caractère) et ce que le radar prend en charge (l'état de l'expérience), plus des propositions de formulation pour Romed. **Aucune écriture dans la base Caractères.**

### Lot 3 — Le radar comme seule source de l'état
- La voix lit le radar : agitation et combativité donnent l'intensité maximale du tour ; ouverture et lucidité tirent vers fragile ou mesuré. `emotionalState` ne pilote plus la voix. Il reste une étiquette du GM.
- **Table radar → états de parole permis**, par personnage, dans le back-office, avec un défaut raisonnable. Si le personnage choisit un état non permis, le code le ramène à l'état permis le plus proche et le journalise.
- Remplacer la phrase « ne touche jamais la forme de la parole » par une consigne unique et cohérente. Rendre `speechStateHistory` au personnage (« évite de rejouer le même état fort »).
- **État vivant** : retour d'un cran vers l'initial après K tours sans stimulation (K réglable). Le GM peut bouger dans les deux sens, et la consigne GM interdit l'immobilité injustifiée.
- Corriger la persistance : ne pas enregistrer `character_state_after` d'un tour dépassé ; ordonner la reconstruction par tour source ; vérifier `gmExecuted` ; figer le profil avant le tour 1 ; ajouter `character_state_delta` au schéma et aux champs requis.
- Mode GM off : radar initial fixe (inchangé) ; garde-fous voix des lots 1 et 1 bis actifs. Le tempérament vocal réglé au lot 1 bis reste la limite haute de ce que le radar peut demander à la voix.

### Lot 4 — Registre de la conversation et direction de jeu
- Le GM produit `conversation_register` (factuel, personnel, émotionnel ou confrontant), avec l'amplitude cible qui en découle. Le code borne le delta du radar à cette amplitude : une conversation factuelle garde un personnage plutôt factuel.
- Le GM reçoit le contexte post-vidéo et la tonalité de la cinématique ou de l'extrait montré. Il ajuste le radar en cohérence, sans dépasser un cran.
- **Intention de jeu en une ligne** pour le tour suivant (« plus retenu », « laisse monter un peu »), transmise en mode full. Elle remplace les consignes émotionnelles dispersées.
- Vue par tour dans le back-office : registre, intention, radar avant et après.

### Lot 5 — Sortie du rôle de bénévole et recadrage gradué
- Le GM qualifie `frame_drift` (0 aucune, 1 étrange, 2 hors cadre persistant), à partir de signaux observables : méta, test du système, demande sans lien avec le soutien, faux statut.
- Le niveau 1 donne au personnage une consigne de recadrage doux, dans ses mots (« vous appelez pour quoi, au juste ? je croyais que vous étiez bénévole »). Le niveau 2, répété, donne un recadrage plus ferme. Pas de rupture du quatrième mur, pas d'éclat de colère sur un recadrage.
- Cas de non-intervention : la détresse réelle de l'appelant prime ; une évocation du « film » est lue comme le procès-verbal (convention existante).
- Raccord avec la règle « hors-monde » et le garde-fou « faux statut », dans un seul réglage du registre du GM, pour éviter les doublons.

### Lot 6 — Mesure et recette
- Rejouer les sessions avec le juge J3, plus un critère « continuité émotionnelle » (aucun saut de plus d'un cran, nombre d'éclats).
- Écoute d'Ulrich sur sandbox-ulrich, Max et Emma, GM off, léger et fort. L'écoute tranche.

## Fichiers clés

- Voix : `src/services/tts/performanceIntent.ts`, `speechPerformanceSettings.ts`, `src/services/tts/index.ts`, `elevenLabsPcmStream.ts`, `avatarAudioBridge.ts`.
- Pilotage : `src/pages/IndexPRD4.tsx`.
- État et GM : `src/services/characterState.ts`, `src/services/prd4Orchestrator.ts`, `src/agents/gameMasterPRD4.ts`, `src/services/gameMasterContract.ts`, `src/services/gmSettingsRegistry.ts`, `src/services/gmSpeechGuidance.ts`.
- Prompt du personnage : `src/agents/maxAgent.ts`, `maxOptimizedPromptCompiler.ts`.
- Back-office : `src/components/admin/SessionsTab.tsx`, `sessionTurnReading.ts`, `CharacterStateEditor.tsx`.

## Vérification

- À chaque lot : tests unitaires ciblés, `npm run test:quality` et `npm run test:delivery`, CI de la PR verte avec `regression-gates`, puis fusion par `github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
- Lot 1 : session réelle sur sandbox-ulrich avec Max. Vérifier en base (`audio_latencies.metadata_json`) l'intensité par tour (aucun saut de 0 à 2), au plus un éclat par fenêtre et une seule balise par réplique. Puis écoute d'Ulrich.
- Sandbox uniquement. Production, fiches Notion et base Caractères ne sont pas touchées.
