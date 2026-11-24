# Prompt de reprise — souvenirs absents du prompt, lot 1 (rendre visible et mesurer)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis
`main` à jour.

---

**Objectif.** Prouver sur les fiches réelles que les souvenirs RAG (et le canon pertinent) sont évincés du prompt de
Max et Emma par manque de place, et ne plus jamais le laisser silencieux. **Aucun changement de comportement en jeu**
dans ce lot : la réserve de place est le lot 2.

**État vérifié (24 novembre, `main` à `8cf58ee6`, voir `docs/audit_souvenirs_absents_20261124.md`).**
- Sessions Romed du 23 novembre (`5215c870…` Max→Emma, `783f4a09…` Emma→Max, orchestration `a9448fee`, trace
  diagnostique désactivée) : Max et Emma disent « je ne sais pas » sur des faits présents dans leurs souvenirs
  (J-5.01, S-3.01, S-3.02, J-7.01, J-3.11). Le RAG tourne à chaque tour (`rag_ms` ≈ 700 ms) mais rien n'enregistre
  ce qui est injecté.
- `buildOptimizedPromptAssembly` (`src/agents/maxOptimizedPromptCompiler.ts`) ajoute les souvenirs **en dernier**,
  dans la place restante de `generatedContextChars` (13 900) − historique. Contrat ≈ 3 044 + noyau ≈ 7 675 laissent
  ≈ 2 000 ; cadre (transfert), état radar ≈ 790 et mémoire ≤ 1 200 prennent le reste ; un souvenir (1 000 à 1 750
  car.) n'est injecté qu'entier → `budget_contexte_epuise`. Calcul, pas encore mesure.
- Aperçu admin `CharacterReceivedPreview.tsx` : compile sans tour, d'où « absent (section_vide) » ; canon pertinent
  208 car. même sans historique.
- Orchestration publiée : `frame.enabled = false` (texte « bénévole » jamais envoyé) — lot 3, ne pas toucher ici.

**Périmètre.**
1. Trace légère toujours enregistrée dans `conversation_log[].pipeline` : `prompt_sections` (`key`, `chars`,
   `omission`) et `rag` (`retrieved`, `injected`, `evicted_budget`, ids), depuis `trace.budget.sections` et
   `ragSelection`. Aucun texte de prompt, quelques centaines d'octets par tour. Construire là où `pipeline` est écrit
   (`src/services/prd4Orchestrator.ts` et son appelant) ; type à côté de `src/types/conversationTrace.ts`.
2. `budget.warnings` : code `souvenirs_evinces` quand des souvenirs récupérés ne sont pas injectés faute de place
   (et `canon_evince` pour le canon). Repris par l'aperçu et `eval:judge:sheets`.
3. Aperçu « Ce que reçoit le personnage » : option « simuler un tour long » (historique ≈ 1 200, mémoire ≈ 1 200,
   transfert d'appel, question saisie, souvenirs réels via `queryRAGDetailed`), place restante affichée, souvenirs
   évincés en rouge. Garder l'aperçu actuel par défaut ; renommer « section_vide » en « non simulé ici » dans ce mode.
4. Test du compilateur : noyau ≈ 7 675, contrat réel, historique 1 000, mémoire 1 200, transfert, 3 souvenirs de
   1 500 → documenter le nombre de souvenirs injectés aujourd'hui (attendu 0) et la présence de l'avertissement.
5. Mesure : rejouer les 8 questions du PDF de Romed (voir audit) sur sandbox-ulrich, avec un contexte long, et
   relever `rag.injected` par tour ; consigner le résultat dans l'audit (section « mesure »), état courant, CHANGELOG.

**Limites.** Base Caractères AVA et fiches en lecture seule. Pas de production. Pas de changement d'ordre ni de
plafond du prompt (lot 2, décision de coût d'Ulrich). Pas d'activation du cadre (lot 3). Un seul lot.

**Livraison.** Contrat Ava : qualité locale, commit, push, PR, CI verte sur le HEAD exact, garde
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `github-delivery-exec`, nettoyage de la branche,
SHA final dans le compte rendu. Finir par le prompt de reprise du lot 2 (réserver la place des souvenirs, avec les
chiffres mesurés ici), ou dire que rien ne reste.
