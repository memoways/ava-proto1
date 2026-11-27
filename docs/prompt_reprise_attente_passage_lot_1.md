# Prompt de reprise — Attente de passage, lot 1 (tours lents quand Emma est nommée)

À copier dans un nouveau chat Ava. Origine : mesure iPhone du 27 novembre 2026 ([plan latence](plan_latence_conversationnelle_llm_tts.md), « Mesure iPhone »). Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

## Objectif

Supprimer ou borner l'attente de l'écriture du tour précédent (`pre_turn_handoff_prior_write`) avant de démarrer la réponse, sans affaiblir le passage de personnage. Ce lot seulement.

## État vérifié le 27 novembre (à revérifier)

- Session iPhone `0cd6f1f5…` (`sandbox-ulrich`) : tours 7, 8 et 10 retardés de 1,18, 1,76 et 1,97 s par `pre_turn_handoff_prior_write`, ajoutés avant la préparation du contexte. Premier son médian de ces trois tours : 4,16 s ; des cinq premiers : 2,66 s.
- Sur 62 tours `voice_turn_finished` du jour : 5 attentes de plus de 0,5 s, médiane 1,76 s, maximum 3,10 s.
- Règle actuelle (lot T2, [analyse Tavus](analyse_latence_tavus_20261119.md)) : `handoffFinalizationWritesSnapshot` garde l'attente si une demande est ouverte, si l'autre personnage est nommé (joueur ou réponse) ou si la réponse ressemble à un transfert. La finalisation attend le Game Master post-tour (2 à 4 s).
- Dans la session lue, Emma était nommée dans plusieurs répliques proches de ces tours. Que le simple nom déclenche chacune de ces attentes est **cohérent mais non prouvé** : à établir par tour avant de coder.

## Sources à lire

`src/services/handoffCoordinator.ts`, `src/pages/IndexPRD4.tsx` (`handoffWriteRef`, `pre_turn_handoff_*`), section « Lot T2 » de l'analyse Tavus, invariants de passage de personnage d'AGENTS.

## Périmètre

1. Diagnostic en lecture : pour chaque attente longue, quelle condition l'a déclenchée et ce que le Game Master a finalement décidé.
2. Proposer à Ulrich une correction (par exemple : n'attendre que si un consentement ou une préparation est réellement possible, ou démarrer la préparation en parallèle et n'attendre qu'avant la sortie), avec ce qu'elle peut casser. Ne coder qu'après son accord.
3. Réglage réversible si la garde change de comportement.

Hors périmètre : modèle, routage, voix, fin de parole, interruption douce, cinématiques, production.

## Invariants et limites d'autorisation

Un passage demandé ou accepté n'est jamais perdu ni exécuté sans preuve de consentement livrée. Sandbox uniquement, production non publiée. Aucune migration attendue. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Validations

Tests sur chaque branche de la règle (demande ouverte, offre, nom cité sans demande, consentement, tour interrompu), `npm run typecheck`, lint, `npm run test:quality`, `npm run test:delivery`, CI de PR avec `regression-gates`. Puis recette d'Ulrich avec un passage Max → Emma réussi et au moins 10 tours qui nomment Emma.

## Livraison

Branche de lot depuis main à jour, commit, push, PR, puis `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier arbre et parent, supprimer notre branche, synchroniser en local et sur Lovable, mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan.

## Première action exécutable

Lire en base (MCP Lovable, lecture seule) les tours dont `pre_turn_handoff_prior_write` dépasse 500 ms et les événements de passage correspondants.

## Clôture obligatoire

Avant le push, s'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Donner le lien direct dans le compte rendu. Ne pas lancer de lot suivant.
