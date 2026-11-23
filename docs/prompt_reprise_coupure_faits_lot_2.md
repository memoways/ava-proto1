# Prompt de reprise — coupure des faits établis, lot 2 (correction + mesure)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis
`main` à jour.

---

**Objectif.** Corriger la coupure destructrice des « faits établis » dans le prompt de Max et Emma, rendre visible
tout retrait du bloc, puis mesurer l'effet avant/après. Tâche Notion :
https://app.notion.com/p/a5a62322e59583969fff016553449c09 (Gamilab, get-self `7e1a9a09-…`).

**État vérifié (23 novembre, `main` à `72a4322e`, voir `docs/audit_chaine_notion_prompt_20261123.md`).**
- `src/services/establishedFacts.ts` coupe le paragraphe « Ce qui est vrai aujourd'hui » à 1 200 car.
  (`ESTABLISHED_FACTS_MAX_CHARS`, `capAtSentence`), puis `withoutEstablishedFacts` retire le paragraphe entier de
  l'identité : 4 phrases perdues (Max 309 car., Emma 313), dont « où ton père l'a mise ».
- `protectedCharacterSections` (`src/agents/maxOptimizedPromptCompiler.ts`) supprime en silence tout le bloc s'il ne
  tient pas dans `staticChars` 7 000. Simulation : limite 1 500 → fin présente chez les deux ; 1 700 et 2 000 → bloc
  d'Emma supprimé.
- Variante `optimized_v3` sur prod et toutes les sandboxes. Champ Notion « Ce que tu sais aujourd'hui » vide.

**Périmètre.**
1. Les faits établis passent en entier (plus de `capAtSentence` destructeur), ou bien rien n'est retiré de
   l'identité. Les liens de famille et la phrase de chronologie restent optionnels.
2. Si le bloc ne tient pas : priorité faits > canon pertinent, puis manière de parler ; sinon avertissement visible
   dans la trace (« Voir ce que reçoit le personnage ») et dans `eval:judge:sheets`, jamais de retour silencieux.
3. Tests du compilateur : paragraphe 800 / 1 150 / 1 250 / 1 600 / 2 000, fait clé en dernière phrase ; fiches réelles
   de sandbox en fixture si utile.
4. Mesure sandbox-ulrich : `eval:judge:sequences --focus factuality` (corpus `docs/eval/sequences_factuality_f.json`)
   avant/après, sans GM puis avec GM ; tokens d'entrée réels et latence sur ≥ 10 tours. Indiquer le bruit.
5. Rapport court dans `docs/eval/`, état courant, CHANGELOG ; mise à jour de la tâche Notion (pas des fiches).

**Limites.** Ne pas modifier la base Caractères AVA ni les fiches (lecture seule). Pas de production. Pas de nouveau
champ. Les arbitrages éditoriaux (champ « Ce que tu sais aujourd'hui », ordre des faits) restent à Romed. Un seul lot.

**Livraison.** Contrat Ava : qualité locale, commit, push, PR, CI verte, garde
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `github-delivery-exec`, nettoyage, SHA final dans le
compte rendu. Finir par le prompt de reprise du lot suivant (écoute Romed), ou dire que rien ne reste.
