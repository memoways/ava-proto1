# AVA — Lot 1 : contrat de consentement et tests de non-régression

Travaille dans le projet AVA, uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`. Réponds en français. Cette demande autorise la réalisation du **premier lot seulement**, jusqu’à sa livraison vérifiée sur `main`. Les lots suivants se feront dans de nouveaux chats.

## Contexte à lire avant de modifier

1. `AGENTS.md` et les instructions applicables aux fichiers touchés.
2. `docs/plan_changement_interlocuteur_manuel.md`, proposition du 19 octobre avant les archives : diagnostic, décisions et découpage des quatre lots.
3. `CHANGELOG.md`, les entrées récentes de `STORY.md`, et `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

Le diagnostic et la maquette ont été fusionnés par la PR #49, commit `464bd0205a7d68c0ed2ae182fad8eb4a5bfed833`. Vérifie le HEAD réel et les changements intervenus depuis ; ce commit est une référence historique, pas une révision à restaurer. Vérifie branche, statut, remote et CI ; préserve toutes les modifications étrangères au lot. Utilise une branche de travail dans le checkout canonique.

Session étudiée : Ulrich, 19 octobre 2026 à 13:32 Europe/Zurich, Emma, 11 tours, `user_hangup`, ID `2d6a3f7d-6680-479b-879a-5739a2ce6717`, `sandbox-ulrich`. Aux tours 10 et 11, le GM recommande `handoff → max` et classe `accept`, mais les filtres locaux rejettent les réponses d’Emma (« Je vais l’appeler » / « Je vais aller le chercher… »). Au tour 10, « lui » et « Matt » échappent aussi à la détection de demande. Au tour 11, la demande explicite vers Max est reconnue mais l’accord reste rejeté. Aucun transfert n’a eu lieu. Les extraits et limites de preuve sont dans le plan ; ne recommence pas l’enquête Cloud si ces sources suffisent.

## Objectif et frontière de ce lot

Construire et tester un **contrat structuré de consentement**, compatible avec les sorties historiques du GM, et un validateur pur. Ce socle prépare le branchement du lot 2 ; à la fin du lot 1, le switching réel n’est pas encore corrigé.

- Ajouter des fixtures minimales de la session et les tests pertinents avant l’implémentation. Montrer les échecs attendus sur le défaut actuel, puis les tests verts sur le nouveau contrat ; distinguer caractérisation de l’ancien comportement et validation du nouveau moteur.
- Définir la cible, l’origine de la demande/proposition, l’accord `accept|object|defer`, le tour/version/source et les preuves textuelles. Le GM fait l’analyse sémantique ; le validateur vérifie preuves présentes dans le texte réellement délivré, cohérence des identités/cibles, fraîcheur et refus explicites de transfert. Une citation affirmative isolée ne suffit pas si la réplique la contredit. Une inquiétude générale sur Max ne vaut pas refus.
- Étendre les types et le nettoyage JSON de façon additive. Une ancienne sortie reste exploitable par les consommateurs existants ; un champ absent, invalide ou sans preuve n’autorise aucune offre avec le nouveau validateur. Ne rends pas ce champ obligatoire dans le parseur GM existant.
- Préparer les instructions GM correspondantes sous forme testable, sans activer un nouveau prompt effectif dans les sessions actuelles ni publier un prompt/configuration Cloud. Préserver le budget et la latence de l’appel GM existant ; aucun nouvel appel LLM.
- Prévoir les raisons d’audit dans le résultat pur. La persistance des événements et le branchement runtime appartiennent au lot 2.

Points d’entrée à vérifier : `src/services/characterConversation.ts`, nouveau module `src/services/characterHandoff.ts` si nécessaire, `src/agents/gameMasterPRD4.ts`, `src/services/gameMasterPromptBuilder.ts`, `src/types/index.ts`, leurs tests. Ajuste au code réel et réutilise les abstractions existantes.

**Hors lot 1 :** branchement de la nouvelle autorisation dans `IndexPRD4`, modification des offres persistées/reprises, pastille et boutons, capture/STT/TTS/sonneries, paramètres narratifs, migrations, changements Cloud et publication produit. Si une dépendance déborde ce périmètre, documente-la pour le prochain lot ; termine une étape cohérente et testable.

## Cas de test indispensables

- T6 différé ; T9 encore ambigu ; T10/T11 acceptés seulement avec cible et preuves cohérentes dans leur contexte.
- « lui » / « Matt » ambigus : clarification, sans alias global `Matt → Max`.
- Refus avec et sans « ne », « plus tard », « Je vais lui demander s’il accepte », « Je vais l’appeler… enfin non », extrait affirmatif inclus dans un refus, oui hors contexte.
- Texte généré mais non entendu, accord coupé avant lecture, preuve absente/inventée, cible/source incorrectes, ancien tour/version, GM échoué ou résultat invalide.
- Ancien JSON GM, champs optionnels absents et usages existants inchangés. La souplesse de compréhension ne doit jamais transformer une demande seule en permission.

## Exécution et vérifications

Avance par petites étapes : baseline, tests ciblés, modification minimale, vérification. Actualise le plan dans `docs/` avant toute précision de périmètre. Réalise une revue du diff, en particulier des consommateurs et fixtures du parseur GM ; corrige les constats avant livraison.

Lance les tests ciblés existants et nouveaux, puis `npm run test:quality` et `npm run test:e2e` conformément au projet. Une défaillance déjà présente doit être isolée et signalée avec ses preuves, jamais masquée en affaiblissant les tests. Si un contrôle échoue, corrige dans le périmètre ; s’il reste bloqué, rapporte l’état réel sans déclarer le lot terminé ni fusionner. Vérifie une **CI verte sur le HEAD exact à fusionner**. Après fusion, vérifie `main` et son statut réel.

Conserve l’isolation des mémoires Max/Emma, session/timer/film/rôle, le cadre commun construit par `experienceFrame.ts`, les seuils/quota/pause et la stratégie de `handsFreeVoice.ts`. Lis le plan de latence si une dépendance touche la voix ; le comportement audio reste hors de ce lot.

Lovable/Lovable Cloud est l’unique chaîne de livraison. Réutilise les connecteurs natifs et l’identité GitHub existante selon `AGENTS.md`. Ne crée aucun autre checkout, hébergement ou Supabase. Synchronisation du code dans Lovable à vérifier ; aucune publication produit dans ce lot préparatoire. Un test unitaire ou une CI verte ne prouve pas une conversation humaine réussie.

## Clôture obligatoire de ce lot et de chacun des suivants

1. Mettre à jour **`CHANGELOG.md`, `STORY.md` et le plan** avec ce qui est réellement fait, les contrôles et leurs résultats, les limites et l’état de livraison. Distinguer préparé, branché, testé, synchronisé et publié. Ne jamais annoncer le chantier complet terminé à la fin d’un lot intermédiaire.
2. Livrer uniquement les changements du lot par branche/PR vers `main`, après vérifications et CI verte ; conserver hors commit les travaux non liés. Vérifier fusion, révision et propreté du checkout. En cas de blocage, consigner précisément l’état partiel.
3. **Créer le prompt autonome du prochain chat**, sauvegardé sous `docs/prompt_reprise_switch_personnages_lot_2.md` pour la suite normale. Il doit contenir : objectif limité au prochain lot, sources à lire, branche/commit réels de départ, modifications locales éventuelles, PR/CI et état Lovable vérifiés, travaux faits/restants, limites, fichiers concernés, critères de sortie et contrôles. S’il reste un défaut du lot 1, préparer une reprise de finalisation du lot 1 avant tout lot 2.
4. Le prochain prompt doit reprendre cette même obligation de mise à jour de `CHANGELOG.md`/`STORY.md`/plan et de génération du prompt suivant. Ne lance pas le lot suivant ni un nouveau chat automatiquement.
5. Terminer par le résultat, les liens des fichiers/PR, les vérifications, les états distincts local/GitHub/preview/production et le reste. Donner le **prompt du prochain chat prêt à copier**, avec un lien vers sa version sauvegardée. Rafraîchir ses références après la fusion sans annoncer à l’avance un hash ou un déploiement non vérifié.

Commence maintenant par la lecture du contexte et la baseline, puis réalise uniquement le lot 1.
