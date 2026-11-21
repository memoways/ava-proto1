# Prompt autonome — Ava, lot H : une seule hiérarchie, zéro contradiction

Tu exécutes et livres **uniquement le lot H** dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`
(remote `https://github.com/memoways/ava-proto1`). Lis AGENTS.md, `docs/etat_courant.md`,
[`docs/plan_juge_direction_rounds.md`](plan_juge_direction_rounds.md) (état des lieux, conflits, lot H),
[`docs/eval/juge_factualite_lot_f_20261121.md`](eval/juge_factualite_lot_f_20261121.md) (mesure du lot F) et le code cité
ci-dessous. Un seul agent ; préserve la PR #24 et le travail étranger ; `git fetch --prune`, main propre (le lot F est
fusionné : relis les six derniers commits de main, ils le montrent), branche du lot depuis main.

**Point de départ vérifié (21 novembre 2026, fin du lot F)**
- Une seule logique pour les faits : la fiche. Plus de réécriture de fiche dans le code ; garde-fou
  `findAwaitedCallSentences` ; `callPresentText` dans `ExperienceFrameConfig` (défaut = texte précédent).
- Mode factualité du juge : `npm run eval:judge:sequences -- --focus factuality --corpus docs/eval/sequences_factuality_f.json`
  (note séparée, style exclu, bruit mesuré : **1,37 point** entre passages). Référence factualité avant lot H : Max 5,6/10,
  Emma 6,2/10 (65 tours). **Le juge de factualité n'est pas calibré** : les dix réponses notées par Romed manquent.
- Erreurs de fait répétées 3 passages sur 3, **dues à la fiche, pas à la hiérarchie** (ne pas les attribuer au lot H) :
  Max nie que son père ait envoyé Mona au camp (le paragraphe « Ce qui est vrai aujourd'hui » dépasse le budget de 1 200
  car. et la coupe retire la phrase) ; Emma accepte « c'est vous qui avez contaminé Ava » et « Max a pris le fusil ».
  Décision attendue de Romed : champ dédié court ou paragraphe resserré (tâche Notion « Fiches Max et Emma… »).
- Le personnage reçoit six couches sans hiérarchie écrite (`src/agents/maxOptimizedPromptCompiler.ts`, assemblage
  autour des lignes 674-743) : cadre de l'appel, directive relationnelle GM, parole du tour, état radar
  (`src/services/characterState.ts`), fiche, RAG/mémoire.

**Objectif** : écrire une seule hiérarchie des consignes (faits de la fiche > cadre > état de l'app > parole du tour) et
retirer les contradictions entre fiche Notion et réglages app, sans toucher aux faits ni au style de la fiche.

**Travail** (voir « Lot H » du plan)
1. Hiérarchie écrite en tête du prompt personnage ; règle « le radar règle l'attitude, jamais la vérité ni le registre ».
2. Réécrire les textes du radar en attitudes vécues, sans cognition (supprimer « tu nommes les contradictions »,
   « tu cadres », « sans filtre » : `characterState.ts` lignes ~60, 68, 76) ; bornes par personnage (ex. Max lucidité ≤ 3,
   ouverture ≤ 4) ; **libellés à faire valider par Romed avant fusion en jeu** (réglage désactivé par défaut tant que non validé).
3. Sort des états de parole : une seule décision GM par tour, cohérente avec le radar.
4. Format/longueur : réglage app ; proposer à Romed de retirer ces phrases de l'identité (dans la tâche Notion, jamais dans la base).
5. Interrupteur d'évaluation « références intellectuelles hors runtime » (override mémoire, jamais `admin_settings`).
6. Back-office : « Voir ce que reçoit le personnage » avec la provenance de chaque couche (pendant de l'aperçu GM).
7. Mesure : rejouer le corpus factuel **avant/après** (même corpus, mêmes réglages, ≥ 3 passages, plafond ≤ 3 $ annoncé
   avant) ; la factualité ne doit pas baisser au-delà du bruit (1,37 pt) ; rapport daté dans `docs/eval/`.

**Limites** : base Caractères en lecture seule (interdiction formelle) ; aucune production ; aucune migration hors chat
Lovable ; `sync-notion` seulement avec `environment_id: "sandbox-ulrich"` explicite ; ne pas relancer de travaux de
factualité ni de style (rounds F, J4, J5) ; les overrides d'évaluation restent en mémoire.

**Validation** : tests de compilation du prompt (hiérarchie présente, textes radar), `npm run test:quality`,
`npm run test:delivery`, CI `regression-gates` verte sur le HEAD exact, rejeu factualité avant/après dans le bruit.

**Livraison** : `docs/etat_courant.md`, `CHANGELOG.md`, plan mis à jour ; commit, push, PR,
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` ;
vérifier origin/main ; tâche Notion du juge mise à jour avec le SHA ; **prompt de reprise du lot suivant (D2 : état
émotionnel qui évolue vraiment) écrit dans `docs/prompt_reprise_juge_lot_d2.md`** avec cette même obligation de prompt,
ou dire explicitement qu'aucun lot ne suit.
