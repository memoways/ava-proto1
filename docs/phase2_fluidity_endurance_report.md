# Phase 2 — Fluidité et endurance sur la durée configurée

Date : 13 juillet 2026
Statut : **implémentation locale validée — activation et recette réelle Lovable à effectuer**

## Objectif

Garantir qu'une conversation puisse rester fluide pendant toute la durée choisie dans l'interface admin, notamment pour le scénario cible de 15 minutes, sans croissance non bornée du contexte, mélange de tours, blocage de l'interface ou cascade de latence lorsqu'un fournisseur devient lent ou indisponible.

La phase 2 ne change ni les fournisseurs configurés ni les secrets. Elle ajoute des bornes, de l'annulation et des chemins de récupération autour du pipeline existant.

## Contrat runtime

- Durée nominale : valeur `TIMEOUT_SECONDS` enregistrée par le slider admin, bornée entre 2 et 30 minutes. La valeur de secours locale est 10 minutes uniquement si le réglage distant est absent ou invalide.
- Clôture Game Master interdite avant **80 % de la durée configurée** (12 minutes pour une session réglée à 15 minutes).
- Budget de réponse conversationnelle : **5 secondes** avant réponse de repli.
- Watchdog avant première voix : **15 secondes** avant annulation et restitution du contrôle à l'utilisateur.
- Une fois la voix démarrée, la lecture va jusqu'à l'événement média `ended` ; seul un blocage sans progression pendant 15 secondes l'interrompt.
- RAG : soft timeout à **2 secondes** ; un échec ne bloque pas la réponse de Max.
- Historique récent envoyé au LLM : **10 messages maximum**, complété par un résumé persistant compact.
- Lecture du résumé : soft timeout à **600 ms**.

## Changements livrés

### Mémoire et contexte

- La fenêtre récente est bornée et testée ; elle ne grossit plus avec la durée de la session.
- Le résumé de session est chargé en parallèle du RAG, puis injecté dans le contexte de Max.
- Les mises à jour de résumé ne retraitent que les échanges non encore résumés.
- L'historique n'est plus dupliqué dans le prompt système et dans la liste de messages OpenRouter.

### Ordonnancement et annulation

- Chaque tour possède un identifiant de séquence et un `AbortController`.
- Une réponse devenue obsolète ne peut plus modifier l'interface ou déclencher un TTS.
- Démarrer un nouveau tour annule le travail fournisseur restant du tour précédent.
- Le watchdog annule un LLM/TTS qui n'a pas réussi à démarrer et rend le bouton de parole utilisable.
- Le watchdog est désarmé au premier son : une réponse longue n'est jamais tronquée par une limite absolue de tour.
- La file TTS annule aussi bien la génération distante que la lecture audio locale.

### Tolérance aux pannes et latence

- Le RAG est fail-soft : timeout, déconnexion ou erreur fournisseur n'empêchent pas Max de répondre.
- Le LLM reçoit uniquement le budget restant du tour ; une réponse locale de repli évite un écran figé.
- Le résumé mémoire est hors du chemin critique lorsqu'il dépasse son budget.
- Le compte à rebours reflète exactement la durée chargée depuis l'admin avant le début de la conversation.

## Incident réel découvert pendant le soak

Le test navigateur de longue durée a révélé une course dans le push-to-talk : le timer de fermeture différée d'un ancien enregistrement pouvait fermer une nouvelle session STT démarrée rapidement après la précédente. Le timer est désormais détenu par référence, annulé au début du tour suivant et ne peut agir que sur l'instance STT qu'il a créée.

Cette correction protège Deepgram, Gamilab et les autres implémentations conformes au même contrat STT.

## Validation automatisée

- TypeScript : `npx tsc --noEmit` vert.
- Build de production : `npm run build` vert.
- Tests unitaires et d'intégration : suite Vitest complète verte.
- Endurance orchestrateur : **30 sessions × 35 tours = 1 050 tours** simulés, ordre stable et contexte borné.
- Playwright : parcours de 3 tours et soak accéléré de **35 tours** verts.
- Le soak navigateur injecte un RAG déconnecté, une erreur LLM `503`, des erreurs TTS et un trigger vidéo ; le parcours termine les 35 tours.
- ESLint des fichiers touchés par la phase 2 : vert.

Le lint global conserve une dette historique dans des fichiers non modifiés par cette phase. Elle ne bloque pas l'activation de la phase 2, mais devra être résorbée avant l'ouverture publique.

## Activation Lovable

Après le push sur `main` :

1. laisser Lovable reconstruire et publier le frontend ;
2. redéployer uniquement l'Edge Function `summarize-session`, dont le prompt ne suppose plus une durée fixe ;
3. ne modifier aucun secret fournisseur ;
4. vérifier un tour Deepgram ou Gamilab, une réponse LLM/RAG et un TTS ;
5. régler le slider admin sur la durée de recette souhaitée, exécuter la session réelle complète et relever les p50/p95 par étape dans le dashboard existant.

Rollback : republier le commit précédent pour le frontend et redéployer la version précédente de `summarize-session`. Aucune migration de base n'est requise par cette phase.

## Critère de sortie

La partie code de la phase 2 est terminée. La release gate reste fermée jusqu'à une session réelle sur l'environnement déployé, réglée à 15 minutes pour le test cible et utilisant les fournisseurs réels, confirmant :

- aucun mélange ou saut de tour ;
- aucune perte durable du bouton de parole ;
- fin de session correcte à la valeur du slider admin ;
- p95 compatible avec la fluidité attendue ;
- absence de croissance progressive de la latence.
