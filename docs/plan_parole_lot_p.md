# Plan — lot P : parole guidée par le juge (générateur PRÉSENT)

Date : 9 novembre 2026. Prompt d'origine : [prompt_reprise_parole_lot_p.md](prompt_reprise_parole_lot_p.md).
Feuille de route : [lot 3, « P »](feuille_de_route_jeu_personnages.md). Juge : [plan J1/J2](plan_llm_as_judge.md).

## Question

Max et Emma parlent-ils davantage depuis leur vécu, avec une chronologie juste, si l'on change (a) le texte
PRÉSENT généré à la synchro, puis (b) la consigne « livre d'abord le contenu » du contrat de flux ? Chaque
changement est mesuré par le juge J2 contre `optimized_v3` actuel, séparément, avant toute écoute.

## Constat de départ (code lu le 9 novembre)

- `generateSituationSummary` (`supabase/functions/sync-notion/index.ts`) : Gemini 2.5 Flash, T 0,3, 260 tokens,
  3e personne, « faits denses », « OBLIGATION DE COUVERTURE ». La timeline lui arrive en bloc : les jours n'y sont
  que des titres de section, que le modèle mélange. Résultat sandbox pour Max : « Il y a deux jours, Peter a été
  tué, et Agotha et Philippe sont morts » alors que la timeline range ces morts sous « Hier, jour 4 ».
- Le texte est stocké par environnement (`character_prompts.situation_summary`) et injecté tel quel par
  `optimized_v3` sous « REPÈRES — CE QUE TU SAIS ». Le rejeu du juge (`runIsolatedEvalTurn` →
  `processPRD4Turn` → `simulateMaxResponse` → `buildMaxSystemPrompt`) relit la copie de l'environnement.
- Le contrat de flux (`buildResponseStreamContract`, `src/services/responseIntentStream.ts`) est bien ajouté au
  tour rejoué (historique d'états de parole présent) : sa reformulation est mesurable par le même rejeu.

## Décisions

1. **Pas de run témoin supplémentaire.** Deux mesures indépendantes de la même référence `optimized_v3` existent
   déjà : J1 `690eaf20` (5,10) et J2 `b12b2d34` (5,02), écart 0,08 pour un bruit entre passages de ± 0,57. Elles
   servent de témoin ; économie d'environ 2 $. Lecture SQL (Lovable, lecture seule) des notes `overall` de la
   référence dans ces deux runs, question par question : |Δ| moyen **0,53**, maximum 2,33 (« Et Max, il tient le
   coup ? »), 1,34 et 1,33 ensuite ; « Et Peter… » reste à `canon_timeline` 0 dans les deux. Seuils retenus :
   un Δ global < 0,3 est du bruit ; une question isolée ne compte qu'au-delà de |Δ| 1,3 ; un effet se lit sur
   les critères agrégés et sur le sens partagé par plusieurs questions des deux personnages.
2. **Générateur partagé et versionné** : `supabase/functions/_shared/situationSummaryPrompt.ts`, importé par
   l'Edge Function et par l'app. `v1_coverage` reproduit mot pour mot la consigne actuelle ; `v2_second_person`
   est la candidate : 2e personne, sans obligation de couverture, « repères, pas inventaire », un paragraphe par
   jour, chronologie extraite de la timeline et **rangée par jour** avant d'être donnée au modèle (fonction pure
   `recentTimelineDays`), règles explicites : un fait reste sous son jour, une mort se date par son jour, la
   montagne (chalet, hôtel J−2) n'est jamais l'appartement d'aujourd'hui.
3. **Comparaison en mémoire, sans resynchro.** Le PRÉSENT candidat est généré une fois par personnage au début
   du run (même modèle et même température que la synchro, appel `proxy-llm`, coût < 0,01 $), puis transmis à
   chaque tour par `evaluationOverrides.situationSummary`. Il est stocké avec les configurations du run
   (`eval_runs.ofat_config`, table d'évaluation) et imprimé dans le rapport : un run se relit et se reprend à
   l'identique. Une fois figé, l'instantané se rejoue par `--candidate-json @fichier`. Rien n'est écrit dans
   `character_prompts` ni dans `admin_settings`. Pourquoi pas la resynchro `fields_only` de sandbox-ulrich :
   elle remplacerait la référence elle-même (plus de comparaison dans un même run), dépend du redéploiement de
   l'Edge Function par Lovable et mélangerait une éventuelle évolution des fiches Notion depuis le 29 octobre.
4. **Repère du juge inchangé** : le juge reçoit le même extrait canon pour les deux configurations (fiche
   synchronisée, timeline des derniers jours en entier). Le PRÉSENT stocké, fautif pour Peter, y figure encore ;
   la timeline complète des derniers jours reste la source de date. Changer la grille est hors périmètre.
5. **Contrat de flux candidat** : variante `lived_v2` de `buildResponseStreamContract`, choisie en mémoire par
   `evaluationOverrides.streamContract` (instantané `streamContract`). Mesurée contre `optimized_v3` seul, pas
   cumulée au PRÉSENT candidat, pour isoler les effets. Adoptée en jeu après mesure (voir Résultats).
6. **Adoption** : seule une variante qui gagne sans recul de `canon_timeline` ni de `must_not` est proposée.
   Pour le PRÉSENT, l'adoption change la version active du générateur ; elle ne prend effet qu'après
   redéploiement Lovable de `sync-notion` puis resynchro `fields_only` explicite, d'abord `sandbox-ulrich`.
   Jamais `prod` depuis ce lot. Écoute AP5 par Ulrich ensuite, distincte de la livraison technique.

## Étapes

1. Module partagé du générateur + tests (`v1` identique à l'actuel, `v2` : 2e personne, sans couverture,
   chronologie par jour ; extraction des jours sur les fixtures sandbox Max et Emma).
2. Edge Function : appel du module partagé, comportement `v1` inchangé tant que la mesure n'a pas tranché.
3. Rejeu : `evaluationOverrides.situationSummary` et `streamContract` (orchestrateur → `simulateMaxResponse` →
   `buildMaxSystemPrompt` / `buildResponseStreamContract`) ; instantané `situationSummaries` /
   `streamContract` validé par `parseSnapshotOverrides` ; libellés de configuration lisibles.
4. Script J2 : `--candidate-present v2_second_person` (génère et injecte le PRÉSENT candidat, visible en
   `--dry-run` avant toute dépense) ; `--reference-json` / `--candidate-json` acceptent `@fichier`.
5. Contrat de flux `lived_v2` + tests.
6. Runs réels sur sandbox-ulrich (plafond 3 $ chacun) : P1 PRÉSENT `v2` contre référence ; P2 contrat `lived_v2`
   contre référence. Rapports dans `docs/rapport_parole_lot_p_*.md`.
7. Décision, CHANGELOG, état courant, feuille de route, tâche Notion ; livraison par la garde.

## Hors périmètre

Plusieurs tours (J3), grille du juge, fiches et champs Notion (base Caractères en lecture seule), STT/TTS,
production, resynchro `prod`.

## Résultats (9 novembre 2026)

[Rapport complet](rapport_parole_lot_p_sandbox_20261109.md).

- **P1, PRÉSENT `v2_second_person`** (run `b38e4266`, 1,86 $) : −0,27, `canon_timeline` −0,42. Non retenu. La
  chronologie par jour corrige Peter chez Max (`canon_timeline` 0 → 2,5), mais sans obligation de couverture le
  texte perd « la police ne peut plus arrêter » et ne dit plus qui a tué Agotha et Philippe (Emma invente un
  meurtre). Le PRÉSENT n'explique pas l'énumération (`not_meta`, `lived_impact` inchangés). Générateur actif :
  `v1_coverage`, inchangé.
- **P2, contrat `lived_v2`** (run `837feca1`, 1,69 $) : **+0,33**, `lived_impact` +0,32, `canon_timeline` +0,22,
  `not_meta` +0,16, longueur +0,48, aucun recul ; Max +0,54, Emma +0,05. **Adopté en jeu**
  (`ACTIVE_RESPONSE_STREAM_CONTRACT`) selon la décision 6 ; le juge garde `v1` en option. Max énumère encore à
  « … à la montagne ? », en plus court.
- **Écart au plan** : le PRÉSENT candidat de la consigne finale a été tiré trois fois à l'essai à blanc ; le tirage
  joué est le seul sans erreur de date (instantané `docs/eval/`). Gemini Flash reste instable sur ce texte : à
  surveiller avant toute adoption d'une nouvelle consigne.
- **Fiabilité** : limite `proxy-llm` de 60 appels/min par compte atteinte pendant P2 ; reprise sur 429 ajoutée au
  rejeu (attente 65 s, 3 fois au plus) et réplique de secours jamais notée.
- **Suite** : écoute AP5 en sandbox (Ulrich) ; candidate PRÉSENT « couverture + chronologie par jour » à mesurer
  avant resynchro ; lot J3 ([prompt](prompt_reprise_llm_juge_lot_j3.md)).
