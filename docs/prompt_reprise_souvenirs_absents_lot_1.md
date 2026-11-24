# Prompt de reprise — souvenirs absents du prompt, lot 1 (place garantie, trace, alertes)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis
`main` à jour.

---

**Objectif.** Les souvenirs retrouvés par le RAG, le résumé de la conversation, le canon pertinent et l'état radar
arrivent réellement au personnage à chaque tour, y compris dans un appel long, sans rien retirer du noyau. Toute
éviction future devient visible. Lire d'abord `docs/etat_des_lieux_souvenirs_max_emma.md` (version simple) puis
`docs/audit_souvenirs_absents_20261124.md` (sections 2, 2 bis, comparaison Cursor, plan révisé).

**État vérifié (24 novembre, rejeu sur `sandbox-romed` des questions des sessions `5215c870…` et `783f4a09…`).**
- Le RAG retrouve le bon souvenir au rang 1 dans 4 cas sur 5 (J-5.01, J-3.08, J-3.11, S-3.01).
- `buildOptimizedPromptAssembly` (`src/agents/maxOptimizedPromptCompiler.ts`) les retient, puis la section
  `rag_context` tombe en `budget_contexte_epuise` dans 5 cas sur 5, **ainsi que** `conversation_memory` et
  `character_canon`. Système à la limite : règles 5 052 + noyau 7 173-7 435 + cadre 282 + directive 307-539 + état du
  tour 49-129, pour une limite `generatedContextChars` (13 900) − historique (≈ 700-1 000).
- L'aperçu admin sous-estime les règles (3 044) car il ne passe pas l'invariant d'identité.
- L'audit Cursor (souvenir non retrouvé, identifiants préposés dans `query-rag`) est écarté pour ce lot : la mesure le
  contredit, et il n'aurait aucun effet tant que la section entière tombe.
- Le rejeu a été fait par un script temporaire non versionné (`scripts/eval-judge/`, session `openEvalSession`,
  `resolveEvalCharacterContext`, `queryRAGDetailed`, `buildMaxSystemPrompt`) ; le recréer comme outil `eval`.

**Périmètre.**
1. Budget réservé par section dans `buildOptimizedPromptAssembly`, ordre inchangé : mémoire (1 200), canon
   (`minCanonChars` 650), état radar (900), souvenirs (3 entiers, plafond actuel 6 100). Relever
   `generatedContextChars` de la somme utile, calculée sur les fiches réelles et documentée. Une seule constante ou un
   réglage pour revenir en arrière. Le noyau et les faits établis ne perdent rien.
2. Trace légère toujours écrite dans `conversation_log[].pipeline` : sections incluses / évincées (clé, taille,
   raison) et identifiants des souvenirs envoyés. Aucun texte de prompt. Affichage dans Admin › Sessions › « Détail du
   tour ».
3. `budget.warnings` : `souvenirs_evinces`, `memoire_evincee`, `canon_evince`, affichés dans l'aperçu et
   `eval:judge:sheets`.
4. Aperçu « Ce que reçoit le personnage » : invariant d'identité inclus ; option « simuler un tour long » (historique
   ≈ 1 000, mémoire, transfert, question saisie, souvenirs réels).
5. Outil `npm run eval:replay:souvenirs` (ou nom proche) : rejoue des questions d'une session sandbox sans appel au
   modèle et affiche sections et souvenirs envoyés.
6. Tests de non-régression : fixture des fiches réelles Max/Emma (copie lecture seule, sans secret) ; tour long →
   noyau, mémoire, canon et ≥ 2 souvenirs présents ; un test échoue si une fiche plus longue refait tomber une section.
7. Mesures, avec bruit : rejeu des questions de Romed (avant/après) ; `eval:judge:sequences --focus factuality`
   (corpus `docs/eval/sequences_factuality_f.json`) avant/après sur sandbox-ulrich ; tokens d'entrée réels et latence
   `character_llm` / Max audible sur ≥ 10 tours. Rapport court dans `docs/eval/`, état courant, CHANGELOG.

**Effets de bord à vérifier.** Coût (≈ +40 % de tokens d'entrée attendus), latence, longueur et ton des réponses,
personnage qui récite ses souvenirs (la consigne d'usage est le lot 2 : la signaler si le rejeu le montre). Le GM, les
vidéos, la voix, les autres variantes de prompt (`legacy`, `rich_v2`, `compact_v1`) restent inchangés : le vérifier.

**Limites.** Fiches Notion et base Caractères en lecture seule. Pas de production, pas de publication Lovable. Pas de
changement de consigne d'usage des souvenirs ni d'activation du cadre (lot 2). Pas de modification de `query-rag`.
Un seul lot.

**Livraison.** Contrat Ava : `npm run test:quality` et `npm run test:delivery` verts, tout commité avant push, PR,
CI et `regression-gates` verts sur le HEAD exact, garde
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`,
nettoyage, SHA final dans le compte rendu. Finir par le prompt de reprise du lot 2 (consignes d'usage et cadre
bénévole), avec les chiffres mesurés ici.
