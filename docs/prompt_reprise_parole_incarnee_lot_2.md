# Prompt autonome — Ava, lot 2 : parole incarnée, texte et Gradium

Exécute le lot 2 dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`. Implémentation et livraison complète,
pas seulement un plan. Lis AGENTS.md, le contexte personnel Notion canonique et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Un seul agent actif, aucun clone ni nouveau worktree. Préserve la PR étrangère
#24 et ses branches ; vérifie d'abord activité, branches, PR et main à jour.
Réutilise l'identité GitHub existante sans login/refresh/logout.

## Résultat du lot 1 à vérifier avant de travailler

Le lot du 25 octobre 2026 corrige le rejet d'un JSON GM historique valide quand
`next_speech_state` manque : valeur null, autres décisions conservées. Le contrat
technique porté par `src/services/gameMasterContract.ts` est ajouté après tout
prompt éditorial effectif, y compris le publié sandbox v7
`98145fe3-96f1-4525-84c2-0e0a1cc5c6da`. Versions publiées et snapshots inchangés.
Les exemples et champs requis partagent cette définition ; un seul appel GM,
modèle, budget et timeout conservés. Diagnostics : syntaxe JSON, schéma incomplet,
état inconnu et preuve refusée, sans nouveau stockage brut systématique.
Version GM : `gm-2026-10-25-compatible-contract`, depuis main
`f77ad835db6b3ea2c765d0f9a781b1c775f5ca41`. Contrôles locaux du lot : test:quality
vert (62 régression, 859 unitaires, 41 intégration, lint/typecheck/build) et
72 E2E verts, dont les deux séquences v7 dans les deux sens.
Les preuves et gardes du passage manuel sont conservées. « Je vais lui demander »
reste différé ; une parole seule ne déclenche aucun transfert.

Références vérifiables : entrée « Lot 1 — compatibilité GM » de CHANGELOG.md et
STORY.md ; section datée du 25 octobre dans
`docs/plan_changement_interlocuteur_manuel.md` ; historique GitHub de
`codex/gm-compat-handoff-lot-1` (branche supprimée après fusion), PR liée à ce
changement et ses checks `regression-gates`. Relis ces preuves et les derniers
commits : aucune CI ni synchronisation Lovable n'est acquise par ce prompt seul.
Les tests sont simulés ; la nouvelle recette vocale humaine reste à faire.
Aucune publication de production n'est autorisée par ce prompt.

## But et périmètre

Max et Emma, environnement `sandbox-ulrich`, texte et Gradium uniquement.
Protéger « Manière de parler », le moteur intime et les cinq états EXACTS propres
à chaque fiche dans tous les compilateurs effectifs ; conserver fragments
volontaires, reprises, suspensions et non-dit sans rendre une réponse incomplète
ou étrangère prononçable. Aucun catalogue commun inventé ni réécriture des fiches.

Intention explicite d'Ulrich : la peur de Max concerne surtout la transformation
d'Emma et Ava, son amour, le couple et ses repères d'identité. Elle doit
transparaître sans être parfaitement analysée ni expliquée dès le début.

Lis et actualise les plans existants sans doublon :
- `docs/plan_parole_incarnee_personnages.md`
- `docs/plan_lot_b_rendu_vocal.md`
- `docs/plan_optimisation_latence_voice_to_voice.md` (invariants, pas de nouveau chantier mains libres).

## Diagnostic ciblé puis corrections

Le champ est déjà sélectionné : `characterPromptService.ts`,
`maxRichPromptCompiler.ts` (plafond 1 800 caractères, réserve 1 000),
`maxOptimizedPromptCompiler.ts` (score 850). Sa présence dans le code ne prouve
pas sa conservation intégrale après sélection, déduplication et budgets.
Reproduis les pertes dans les prompts réels et protège moteur intime + cinq
états, pour chaque personnage, sans contaminer l'un avec la fiche de l'autre.
Ne présente pas une ancienne omission de sélection déjà corrigée comme actuelle.

Vérifie la déclaration privée `parole`, le filtrage des états inconnus, les reçus
livrés et la variété. Ne déduis pas un état joué de la seule suggestion GM.
Contrôle séparément l'échec de lecture des réglages et le repli neutre par tour.

Le mapping existe sous `ava_speech_performance` : suggestions locales et lecture
ne prouvent ni sauvegarde Cloud ni activation. Diagnostique le rendu trop lisse,
ajuste seulement en sandbox, sauvegarde et relis via le chemin autorisé.
Vérifie la propagation batch/incrémentale Gradium, la version appliquée, diction,
pauses et reprises, sans modifier les voix de production. Les tags émotionnels
Gradium restent fermés tant que la capacité et le format ne sont pas établis par
la documentation officielle ; aucun tag spéculatif.

## Vérification et livraison autorisées

Lovable/Lovable Cloud sont la seule chaîne : projet
`1265958d-b74e-40f2-917d-182fe05163fc`, SQL exclusivement par son MCP Lovable.
Aucun projet Supabase direct ni hébergeur externe. Préserve experienceFrame,
mémoires privées, capture, interruptions, décisions mains libres, budget GM et
l'autorisation de passage par preuve + gardes + clic.

Tests ciblés avant/après : conservation intégrale aux budgets réels, deux fiches
et cinq états exacts, états déclarés/livrés, fragments volontaires sûrs, reprise
et fallback, sauvegarde/lecture sandbox, mapping Gradium batch et streaming.
Exécute `npm run test:quality` et les E2E requis. Vérifie la synchronisation de
main et la preview Lovable. Fais une recette au casque Max/Emma avec Ulrich :
texte effectivement prononcé, états variés, reprises, pauses, naturel, diction et
latence ; distingue tests simulés, écoute réelle et acceptation humaine.

Mets à jour plan, CHANGELOG et STORY. Branche unique depuis main, commit, push,
PR, CI verte sur son HEAD exact avant squash, puis CI de main/E2E vérifiée.
Supprime seulement ta branche locale/distante et rapporte les branches étrangères
restantes. Livrer jusqu'au bout est autorisé sans redemander ; publier en
production reste une décision distincte. Si bloqué, poursuis l'indépendant et
indique une seule action humaine précise. Bilan : PR, SHA main, liens CI, checkout,
branches, états local/GitHub/preview/production et recette restante.
