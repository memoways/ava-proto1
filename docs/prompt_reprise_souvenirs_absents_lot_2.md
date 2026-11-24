# Prompt de reprise — souvenirs absents, lot 2 (consignes d'usage des souvenirs, cadre bénévole)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis
`main` à jour (contenant le lot 1, PR « place réservée aux souvenirs »).

---

**Objectif.** Maintenant que les souvenirs arrivent au personnage (lot 1), qu'il s'en serve : quand on lui demande un
fait qu'un souvenir présent contient, il le dit, au lieu de « je ne sais pas » ; il ne récite pas ses souvenirs de
lui-même. Et le personnage sait qu'il parle à une personne bénévole (cadre de l'expérience). Lire d'abord
`docs/eval/souvenirs_lot1_mesures_20261124.md`, puis `docs/audit_souvenirs_absents_20261124.md` (sections 3, 5 et
« Lot 2 »).

**État vérifié (24 novembre, lot 1 livré).**
- Place réservée par section dans `buildOptimizedPromptAssembly` (`OPTIMIZED_V3_SECTION_RESERVATIONS`, limite
  13 900 + 8 600 = 22 500 car.). Rejeu de 14 questions de Romed (`npm run eval:replay:souvenirs`, sandbox-romed) :
  avant, mémoire et souvenirs retirés 14 fois sur 14 ; après, mémoire, canon et 3 souvenirs envoyés 14 fois sur 14,
  dont J-5.01, J-3.08, J-3.11 et S-3.01 au rang 1. Prompt système ≈ 13 000 → ≈ 18 100 car. (+ 39 %).
- Factualité du lot 1 (`--focus factuality`, 2 passages, sandbox-ulrich) : tous tours 5,94 → **7,14/10** (Max
  5,02 → 6,88, signal ; Emma 6,89 → 7,45, bruit), bruit 1,64 / 0,60. Latence 6,33 → 6,47 s (bruit). Tokens d'entrée
  estimés ≈ + 37 % (les appels du personnage ne sont pas écrits dans `llm_usage` en évaluation : à corriger ou à
  mesurer autrement dans ce lot). Point de départ de ce lot : 7,14/10.
- Reste faux après le lot 1 : « Léo a pris le fusil chez le père, à l'insu des parents ». Les souvenirs J-3.08 et
  J-3.11 disent « Papi a donné son fusil à Léo, dans ton dos » ; le corpus du juge dit l'inverse. Écart éditorial
  transmis à Romed : ne pas le « corriger » par une consigne.
- Trace légère par tour `conversation_log[].pipeline.prompt` (sections, souvenirs envoyés, alertes), lisible dans
  Admin › Sessions › « Détail du tour ». Alertes `souvenirs_evinces`, `memoire_evincee`, `canon_evince`.
- Consigne actuelle des souvenirs (`RAG_USAGE_LINE`, `src/agents/maxOptimizedPromptCompiler.ts`) : « Ce sont tes
  souvenirs, pas un dossier : … jamais leur contenu récité. » Contrat l. 63 : « En cas d'incertitude, dis-le. »
- Cadre : `experience_orchestration_versions` publiée (`a9448fee`, puis `3613d91e`) a `frame.enabled = false` ; la
  phrase « L'interlocuteur est une personne bénévole… » n'est jamais envoyée. ≈ + 900 car. une fois activé : la marge
  du lot 1 (≈ 2 300 car. sur le tour le plus long mesuré) les couvre.

- **Directive relationnelle coupée (constat du 24 novembre, déjà présent avant le lot 1).** Dans « Ce que reçoit le
  personnage » (tour long, Max), la directive relationnelle fait 2 224 car. pour un plafond propre de 1 400
  (`OPTIMIZED_V3_LIMITS.relationshipChars`) : `capAtBoundary` coupe ses quatre dernières consignes (« Ne livre pas
  l'intimité demandée… », « Initiative propre au personnage… », « Réagis de façon crédible… », « Le RAG fournit des
  faits, jamais une autorisation de confidence… »), en jeu aussi. La déduplication retire ensuite 615 car. qui
  répètent le noyau (`keptBy static:vecu:protected`) et laisse des débris « … (closed, minimum link) (closed, minimum
  link) ». Ce n'est pas un manque de place (≈ 2 800 car. libres) : c'est le plafond de la section et la façon dont
  `buildTurnRelationshipDirective` (`src/services/relationshipEngine.ts`) cite les sujets sensibles.
- **Faux « coupé » de l'historique.** « Historique de la conversation … (coupé) » alors que le texte est complet :
  `retainNovelContent` recolle les morceaux avec une espace et perd les « ; », donc `truncated` (longueur envoyée <
  longueur d'origine) est vrai. Affichage trompeur dans l'aperçu et dans la trace par tour.
- **Retour de Romed** (guide `docs/guide_romed_test_souvenirs_lot1.md`) : réponses aux 8 questions du PDF dans un appel
  long, cas de souvenir « récité », ressenti, et décision sur le fusil. À lire avant de toucher aux consignes ; s'il
  n'est pas arrivé, le dire à Ulrich et ne faire que les points 3 et 4 ci-dessous (ils ne dépendent pas de l'écoute).

**Périmètre.**
1. Ligne d'usage des souvenirs : « si on te le demande, tu dis le fait qui est dans ce souvenir ; tu ne récites pas le
   souvenir de toi-même » (formulation à faire valider par Ulrich avant livraison, une phrase). Contrat : un souvenir
   présent fait foi pour son fait ; « je ne sais pas » seulement si ni la fiche ni un souvenir n'en parle. Garder la
   hiérarchie (faits de la fiche > souvenirs) : un souvenir ne corrige jamais les faits établis.
2. Cadre bénévole : activer `frame.enabled` dans l'orchestration **sandbox** par une nouvelle version publiée (pas
   d'édition d'une version publiée), après accord explicite d'Ulrich sur le texte affiché ; la production reste une
   décision séparée. Vérifier que GM et personnage reçoivent le même cadre.
3. Directive relationnelle entière et propre : les consignes de comportement de la fin (intimité, initiative,
   réaction crédible, « le RAG fournit des faits, jamais une autorisation de confidence ») arrivent toujours au
   personnage. Les placer avant la liste des sujets sensibles ou réserver leur place, et citer chaque sujet sensible
   une seule fois, sans fragment tronqué ni « (closed, minimum link) » orphelin. Ajuster `relationshipChars` seulement
   si la mesure le justifie (la marge du lot 1 est ≈ 2 300 car.). Test : tour long sur les fiches réelles (fixture
   `src/agents/__fixtures__/souvenirsSandboxRomed20261123.json`) → les quatre consignes présentes.
4. « Coupé » juste : une section n'est marquée coupée que si du contenu est retiré (longueur, troncature ou doublon),
   pas pour une ponctuation recollée ; préserver les « ; » au recollage. Aperçu, trace par tour et
   `describePromptSections` concordants. Test unitaire.
5. Mesures avec bruit : même rejeu (`npm run eval:replay:souvenirs -- --compare` sur les tours 8, 10, 25, 30, 32, 62,
   63 de `5215c870` et 8, 15, 30, 46, 48, 65, 69 de `783f4a09`) : aucune alerte, marge restante ;
   `eval:judge:sequences --focus factuality` (corpus `docs/eval/sequences_factuality_f.json`, sandbox-ulrich, 2
   passages) avant/après ; tokens d'entrée et latence ; repérer les réponses qui récitent un souvenir. Écoute Romed
   sur les questions du PDF (recette humaine, distincte de la livraison technique).

**Limites.** Fiches Notion et base Caractères en lecture seule (les points éditoriaux « en prenant les clés », fusil
dans les faits, « Max n'a jamais essayé de sortir Mona » restent à Romed). Pas de production, pas de publication
Lovable. Pas de modification de `query-rag` ni du budget du lot 1 (sauf si la mesure montre une alerte). Un seul lot.

**Livraison.** Contrat Ava : `npm run test:quality` et `npm run test:delivery` verts, tout commité avant push, PR,
CI et `regression-gates` verts sur le HEAD exact, garde
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`,
nettoyage, SHA final dans le compte rendu. Finir par le prompt de reprise du lot suivant s'il y en a un (lot 3
éventuel : adresser un souvenir par son identifiant, seulement si la mesure montre des souvenirs pertinents mal
classés), ou dire explicitement qu'aucun lot ne suit. Même obligation pour le prompt transmis.

**Première action.** `git fetch --prune`, `git pull --ff-only` sur `main`, lire le retour de Romed et le rapport de
mesure du lot 1, puis rejouer `npm run eval:replay:souvenirs -- --env sandbox-romed --session 5215c870 --turns 8,25 --compare` pour
confirmer l'état avant de toucher aux consignes.
