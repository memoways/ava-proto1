# Réglages du GM : lisibles, gradués, comparables — et état des personnages

Plan validé par Ulrich le 19 novembre 2026. Lot A livré le 19 novembre (voir « État des lots »). Lot suivant :
[prompt de reprise lot B](prompt_reprise_reglages_gm_lot_b.md).

## État des lots

- **A — livré (19 novembre)** : registre `src/services/gmSettingsRegistry.ts` (24 entrées, dont « Repères de temps du
  personnage ») ; bloc compilé au runtime par `resolveDirectorSystemPrompt` (`src/agents/gameMasterPRD4.ts`), qui retire
  tout bloc figé (`stripCompiledSettingsBlock`) ; aperçus et « Voir ce que reçoit le GM » ; nettoyage. Écarts au plan :
  la température passe par une nouvelle clé `LLM_GM_TEMPERATURE` (l'ancienne valait 0.3 partout sans jamais s'appliquer :
  la brancher aurait changé le GM) ; la v7 publiée reçoit la formulation actuelle de la ligne Cinématiques et la règle
  hors-monde (tout le reste identique, test de non-régression). Constat Lovable du 19 novembre : `builtin://` en
  sandbox-romed v4 et sandbox-benoit v5 (config sans éditeur, 1 passage max) ; prod v8, sandbox-julien v9 et
  sandbox-ulrich v13 portaient le bloc figé.
- **C — livré (19 novembre)** : `editor.gmMode`, `injected` et `gm_mode` par tour, colonne « GM → personnage »
  (historique, export), `gmMode` pour le juge J3, sélecteur 3 crans. Écarts : la surcharge `gmSpeechGuidance` n'était pas
  branchée au juge (ajout de `gmMode` au snapshot) ; en off, le passage validé par le GM n'est pas disponible (seule la
  règle de procédure de la demande explicite subsiste) ; `injected` se lit sur l'entrée du tour où le texte est reçu.
- **B — livré (19 novembre)** : `editor.priorityLevels` (0–3, plancher sécurité à 1), `src/services/gmPriorities.ts`
  (fragments par axe et cran, règle d'arbitrage générée seulement quand les niveaux diffèrent ; tout à 2 = texte
  historique à l'octet près), 4 curseurs dans Réglages GM, surcharge `priorityLevels` dans les instantanés du juge.
  Lecture Lovable : toutes les versions publiées (prod, sandbox-ulrich/romed/benoit/julien) ont les 4 axes cochés ou
  aucun champ → tout passe au cran 2, aucune migration. **Effet mesurable : non démontré** (voir « Mesure du lot B »).
  Suite : [lot D](prompt_reprise_reglages_gm_lot_d.md), puis [lot E](prompt_reprise_courbe_experience_gm_lot_e.md).
- **D — livré (code, 19 novembre)** : `src/services/characterState.ts` (modèle, fragments par axe et niveau 0–5,
  validation déterministe de `character_state_delta`, séries d'historique), colonne `state_profile` jsonb et RPC
  `get_character_state_profile` (migration `20261119140000_character_state_profile.sql`, **à coller dans le chat Lovable
  après fusion**), bloc « ÉTAT DU PERSONNAGE À CE TOUR » juste après « PAROLE DU TOUR » dans les quatre compilateurs,
  section « ## ÉTAT DU PERSONNAGE » côté GM, éditeur de radar (Recharts) dans Réglages personnages, mini-radar et courbes
  dans l'historique des sessions, ligne « État joué » dans l'export Markdown. Constat Lovable du 19 novembre :
  `character_runtime_profiles` = 20 lignes (4 personnages × 5 environnements), RLS admin seulement, la lecture joueur
  passe par une RPC `SECURITY DEFINER`. Écarts au plan : (1) une **seconde RPC** de lecture plutôt que de modifier
  `get_character_speech_runtime` (absente des migrations du dépôt, changer son type de retour aurait imposé de la
  recréer à l'aveugle) ; elle fige le profil sur l'instantané de session dès que celui-ci existe (au plus tard au
  tour 2) ; (2) les fragments d'axe vivent dans `characterState.ts`, pas dans `gmSettingsRegistry.ts` (qui décrit les
  réglages du GM, pas ceux des personnages) ; (3) `state_profile` NULL = fonction absente, aucune ligne n'est
  initialisée : tout est neutre tant qu'un administrateur n'active pas le radar d'un personnage. **Dimensions à valider
  avec Romed** : non consignées avant ce lot, les cinq libellés sont éditables par personnage ; la validation reste à
  obtenir avant d'activer le radar en production.

## Contexte

Ulrich ne voit pas l'intérêt des cases « Priorités d'analyse » : on/off, sans effet visible. L'analyse du code confirme
et élargit le constat (Réglages GM, `src/components/GameMasterSettingsTab.tsx`) :

- **Priorités** : les 4 cases ajoutent seulement une liste non pondérée au prompt système du GM
  (`gameMasterPromptBuilder.ts:41-46, :85-86`). Aucun effet dans le code, aucune règle d'arbitrage.
- **La moitié des réglages n'agit que par un texte figé** : `buildExperienceDirectorPrompt` tourne dans l'admin, à la
  sauvegarde du brouillon ; le runtime lit le prompt enregistré (`prd4Orchestrator.ts:568`). Si la version épinglée
  vaut `builtin://experience-director/v1` (sandbox-romed, sandbox-benoit), le bloc « RÉGLAGES ADMINISTRATEUR ACTIFS »
  est absent : posture, longueur, priorités, garde-fous, contexte, questions et instructions n'ont **aucun effet**.
- **Réglages morts** : `handoffTarget` (jamais lu), `LLM_TEMPERATURE_GM` (curseur, mais 0.2 en dur
  `gameMasterPRD4.ts:550`), clés Gameplay retirées.
- **Pas de vrai GM off** : #203 coupe seulement le conseil de parole ; le GM tourne toujours (mémoire, relation,
  passages, cinématiques, fin).
- **Personnages** : le back-office n'a que la rugosité (0–3). Aucun état actif/passif, abattu, combatif, sonné.
- **Courbe** : 3 tranches codées en dur (début < 25 %, milieu < 75 %, fin) côté personnage + clôture GM à 80 %.

Besoins d'Ulrich : (1) sentir l'incidence du GM sur les tours (test off/léger/fort) ; (2) mieux paramétrer
l'expérience au-dessus des fiches, avec un état de personnage réglable et que le GM fait évoluer. Tâche Notion :
[5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) (comparaison avec/sans GM demandée
le 19 novembre).

Décisions prises (19 novembre) : curseurs 0–3 par priorité ; trois modes GM off/léger/fort ; état du personnage en
**radar à 5 dimensions** (intensité 0–5) que le GM fait évoluer ; **courbe d'expérience = chantier séparé**, encore
ouvert (directions et critères plutôt que phases chronométrées, lien avec les fiches).

## Principe directeur : un registre unique des réglages

Chaque réglage est décrit une seule fois : libellé, destination (prompt GM / prompt personnage / code), et fonction
`fragment(valeur)` qui rend le texte exact injecté. Le compilateur du prompt **et** l'interface lisent ce registre.
Ainsi l'UI montre sous chaque réglage « ➜ envoyé au GM : … » ou « ➜ appliqué par le code : … », sans lire le master prompt.

## Lot A — Transparence et réglages qui agissent vraiment (préalable)

1. Créer `src/services/gmSettingsRegistry.ts` : entrées pour les 23 réglages du panneau (cf. tableau d'analyse), avec
   `destination` et `fragment()`. Reprendre les textes actuels de `gameMasterPromptBuilder.ts` (TONE_LABELS,
   guardrails, etc.) sans les réécrire.
2. **Compiler le bloc de réglages au runtime** depuis la config épinglée (`get_pinned_orchestration_runtime`) : le
   prompt enregistré ne garde que la base ; `gameMasterPRD4.ts:526-529` ajoute le bloc compilé, y compris pour
   `builtin://`. Tests : une version `builtin://` reçoit bien les réglages ; texte identique pour une version publiée
   existante (pas de double bloc : détecter et retirer l'ancien bloc figé).
3. UI : sous chaque réglage, aperçu repliable du fragment et de sa destination ; bouton « Voir ce que reçoit le GM »
   (bloc complet compilé). Badge « effet : prompt / code / les deux ».
4. Nettoyage : supprimer `handoffTarget` ; brancher `LLM_TEMPERATURE_GM` sur l'appel GM (ou retirer le curseur — choix :
   le brancher, défaut 0.2 pour ne rien changer) ; retirer les clés Gameplay mortes ; aligner le ratio de clôture du
   test admin (0.7) sur le runtime (0.8) ; aligner les `??` de `IndexPRD4.tsx:2123-2125` sur `DEFAULT_DIRECTOR_CONFIG`.
5. Interrupteur « Repères de temps du personnage » (tranches début/milieu/fin de `buildTemporalContextBlock`), défaut
   activé : première brique on/off de la courbe, sans préjuger du chantier E.

## Lot C — Modes GM off / léger / fort et vue « ce que le GM a envoyé »

1. `editor.gmMode: 'off' | 'light' | 'full'` remplace `editor.speechGuidance` (normalisation : `false` → `light`,
   sinon `full`). Fixe pour la session (version épinglée, comme #203).
   - **off** : aucun appel GM post-tour (`prd4Orchestrator.ts:804`) ; le personnage garde fiche, RAG, mémoire de
     conversation, cadre ; pas de passage proposé par le GM ni de cinématique ; fin au minuteur ; demande explicite du
     joueur de changer de personnage conservée.
   - **light** : comportement actuel « guidage désactivé » (`gmSpeechGuidance.ts`) : mémoire, relation, cinématiques,
     passages, fin ; aucun conseil de jeu ni état de parole.
   - **full** : tout, comme aujourd'hui.
   - Les recadrages des garde-fous en mode light restent l'arbitrage déjà ouvert (lot 2 de #203) ; ne pas le trancher ici.
2. Persister par tour le **texte exact injecté** chez le personnage depuis le GM (blocs conseil, état de parole, état
   du personnage du lot D, déjà abordé) dans `gm_post_turn_log[]` (champ `injected`), en plus de `gmMode`.
3. Historique des sessions (`SessionsTab.tsx:899-955`) : pour chaque tour, colonne « GM → personnage » (texte injecté,
   ou « rien : mode off / light ») à côté de la réplique jouée. Export Markdown idem (`sessionMarkdownExport.ts`).
4. Juge J3 : `evaluationOverrides.gmMode` remplace `gmSpeechGuidance` pour rejouer un corpus dans les 3 modes.
5. Réglage UI : sélecteur 3 crans avec une phrase sur ce que chaque mode coupe.

## Lot B — Priorités d'analyse en curseurs 0–3

1. `editor.priorityLevels: Record<PriorityKey, 0|1|2|3>` (0 = ignoré, 1 = léger, 2 = normal, 3 = prioritaire) ;
   normalisation depuis `priorities[]` : cochée → 2, décochée → 0 ; `schemaVersion` + 1.
2. Fragment par cran et par axe dans le registre (ex. rythme 3 : « Fais avancer la scène à chaque tour ; signale la
   clôture dès le seuil atteint »), plus une règle d'arbitrage générée : « En cas de conflit, applique d'abord : X (3),
   puis Y (2)… ». Sécurité : plancher à 1 (ne peut pas être coupée), affiché dans l'UI.
3. UI : 4 curseurs (composant `Slider` shadcn existant) avec le texte du cran courant sous chacun.
4. Effet mesurable : rejouer le corpus J3 avec deux profils contrastés et vérifier dans les conseils GM que la
   différence est visible (sinon, réduire à 3 crans).

## Lot D — État du personnage : radar 5 dimensions, évolution par le GM

1. Dimensions proposées (0–5, à valider avec Romed avant code définitif — libellés éditables) :
   - **Combativité** (abattu 0 ↔ combatif 5)
   - **Initiative** (passif, subit 0 ↔ mène l'échange 5)
   - **Lucidité** (sonné, confus 0 ↔ clair 5)
   - **Ouverture** (fermé 0 ↔ se livre 5)
   - **Agitation** (calme 0 ↔ à vif 5)
2. Stockage : colonne `state_profile` jsonb dans `character_runtime_profiles` : `{ initial, min, max, gmCanEvolve,
   maxStepPerTurn (défaut 1) }`. Migration SQL **appliquée via le chat Lovable** (pas de Supabase direct). Base
   Caractères Notion intacte.
3. Back-office (`CharacterRuntimeSettingsTab.tsx`) : radar Recharts (`recharts` déjà présent) éditable via 5 curseurs,
   bornes min/max affichées en zone, aperçu du fragment envoyé.
4. Personnage : bloc « ÉTAT DU PERSONNAGE À CE TOUR » compilé par niveau d'axe (tableau de fragments dans le
   registre), placé avec « PAROLE DU TOUR » (`maxAgent.ts` et `maxOptimizedPromptCompiler.ts`). Coexiste avec la
   rugosité (forme de la parole) ; l'état règle l'attitude.
5. GM : section « ## ÉTAT DU PERSONNAGE » (valeur courante, bornes, consigne : faire évoluer selon ce que vit l'appel)
   et champ optionnel `character_state_delta` dans la sortie JSON post-tour. Validation déterministe : ±maxStep,
   bornes, personnage et tour source corrects, résultat tardif ignoré (mêmes protections que le conseil en attente).
   Appliqué au tour suivant, sans appel ajouté. Mode off : état initial fixe ; light : évolution conservée, état transmis
   (c'est un état, pas un conseil de parole — à confirmer à l'écoute). Format réalisé :
   `character_state_delta: { characterKey, sourceTurn, changes: { axe: entier signé } }` ; personnage ou tour source
   différents (résultat tardif) = delta ignoré en entier ; pas au-delà de `maxStepPerTurn` et bornes = écrêtés.
6. Trace : état par tour dans `gm_post_turn_log`, mini-radar + courbe par dimension dans l'historique des sessions.
7. Lien `emotionalState` → prosodie inchangé dans ce lot.

## Lot E — Courbe d'expérience : nouveau chantier (cadrage seulement)

Pas de code dans ce plan. Livrer un document de cadrage `docs/cadrage_courbe_experience_gm.md` + prompt de reprise :
interrupteur courbe ouverte / dirigée ; **directions** à atteindre (pas des phases chronométrées) avec critères de
choix ; lien avec des indications à porter par les fiches (Romed) ; articulation avec le radar du lot D, la clôture à
80 % et les triggers narratifs ([tâche](https://app.notion.com/p/2083482bf92f477aa47b66cf473fac25)). Mise à jour de la
tâche Notion GM (tâches uniquement).

## Mesure du lot B (19 novembre, J3, sandbox-ulrich)

Rejeu `npm run eval:judge:sequences -- --reference optimized_v3 --candidate optimized_v3 --reference-json
'{"priorityLevels":{"narrative_continuity":0,"player_engagement":0,"safety":1,"pace":3}}' --candidate-json
'{"priorityLevels":{"narrative_continuity":3,"player_engagement":3,"safety":1,"pace":0}}' --repeats 1` : 4 séquences,
36 tours par profil, 1,12 $, aucune écriture. Notes : Δ par tour −0,16 (dans le bruit, seuil 0,30), Δ séquence −0,29.
Conseils GM (`gmGuidanceOut`, 18 par profil) : quasi identiques, de la forme « X doit continuer à raconter… » ; aucun
mot de rythme ou de clôture dans les deux profils ; continuité 5 vs 2 mentions, engagement 3 vs 0, sur de très petits
nombres. **Conclusion : la différence n'est pas visible dans les conseils sur ce corpus** (5 tours, loin de la clôture ;
le conseil de tour est dominé par « continuer le fil »). Le plan prévoyait de réduire à 3 crans dans ce cas : non fait,
car supprimer un cran n'ajouterait pas d'effet (le levier est faible, pas trop fin). Le texte compilé diffère bel et bien
(tests, aperçu), et l'effet attendu se situe plutôt dans la clôture, les recadrages et les décisions du GM, que ce corpus
ne sollicite pas. Pistes : séquence longue jusqu'à la clôture, corpus de dérapages, ou recette humaine sandbox ; décision
de garder 4 crans, passer à 3 ou rendre les consignes plus directives à prendre par Ulrich après recette.

## Ordre et livraison

A → C → B → D, chaque lot = branche, PR, CI verte sur HEAD à jour, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via `github-delivery-exec`). STORY / CHANGELOG / HANDOFF /
`docs/etat_courant.md` mis à jour dans la branche ; prompt de reprise du lot suivant écrit avant push. Production non
publiée (go Ulrich requis). Pour le lot D, la migration est collée dans le chat Lovable après fusion.

## Fichiers clés

`src/components/GameMasterSettingsTab.tsx`, `src/services/gameMasterPromptBuilder.ts`,
`src/services/experienceOrchestration.ts`, `src/types/index.ts`, `src/agents/gameMasterPRD4.ts`,
`src/services/prd4Orchestrator.ts`, `src/services/gmSpeechGuidance.ts`, `src/pages/IndexPRD4.tsx`,
`src/agents/maxAgent.ts`, `src/agents/maxOptimizedPromptCompiler.ts`, `src/components/CharacterRuntimeSettingsTab.tsx`,
`src/components/admin/SessionsTab.tsx`, `src/services/sessionMarkdownExport.ts`, `src/services/experienceDirector.ts`.

## Vérification

- Tests unitaires : registre (fragment par valeur), normalisation (anciennes configs → nouveaux champs, textes
  identiques à l'existant pour les valeurs par défaut), compilation runtime y compris `builtin://`, modes off/light/full
  dans `prd4Orchestrator.test.ts` (GM non appelé en off), validation `character_state_delta` (bornes, pas, tardif).
- Qualité locale + tests de garde du dépôt, CI `regression-gates` verte.
- Navigateur (dev local) : réglages → aperçus de fragments ; radar éditable ; historique des sessions affiche
  « GM → personnage » et l'état par tour.
- Recette humaine sandbox (Ulrich + Romed) : ≥ 3 appels par personnage et par mode GM, mêmes scénarios que le protocole
  #203 ; la livraison technique ne vaut pas validation artistique.
