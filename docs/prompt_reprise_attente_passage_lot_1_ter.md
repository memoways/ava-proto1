# Prompt de reprise — Attente de passage, lot 1 ter (réplique interrompue)

À copier dans un nouveau chat Ava. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « Attente de passage, lot 1 bis : mesure ». Ce lot seulement.

## Objectif

Quand le joueur interrompt une réplique en voix au fil de l'eau (`feed`), le Game Master ne doit plus considérer comme entendu le texte jamais joué : ni mémoire, ni confidence, ni passage tirés de la partie non entendue.

## État vérifié au 27 novembre (à revérifier sur origin/main)

- Session `8cd27ab0` (`sandbox-ulrich`), tours 7 et 9 : reçus `cancelled`, `delivered` vide, post-tour pourtant écrit avec la fin des répliques ; confidence `max_disclosure` `sourceTurn: 9` probablement non entendue.
- Survie du post-tour confirmée (11 tours sur 11, 4 chevauchements) : ne pas la casser.
- Cause lue dans le code : `streamedOutputSink.ts` résout `delivery` avec le texte généré complet ; l'écouteur `abort` de `IndexPRD4.tsx` résout `handoffDelivery` avec `undefined` avant le reçu ; `runPostTurn` (`prd4Orchestrator.ts`) retombe sur `streamControl.delivery`.

## À faire

1. Reproduire par un test rouge : sortie `feed`, génération terminée, interruption pendant la lecture.
2. Vérifier ce que la sortie `feed` sait de la partie jouée (voix HTTP en flux, Tavus, Anam). Choix par défaut, sûr : sans partie entendue confirmée, rien de la réplique n'est crédité au personnage. Si un préfixe entendu fiable existe, l'utiliser.
3. Arbitrage à poser à Ulrich avant de coder s'il n'y a aucun préfixe fiable : soit aucun post-tour pour ce tour (comme la voix lue en bloc, le tour manque au journal), soit un post-tour sur le seul message du joueur, réplique vide.
4. Couvrir aussi la voix lue en bloc, la voix progressive Gradium et la préparation de passage (inchangées).

## Limites

Aucune migration ni réglage modifié sans demande. Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu. Les conseils écartés après interruption et la numérotation en double de la télémétrie sont hors lot.

## Livraison et clôture obligatoire

Livraison selon AGENTS. Consigner dans le plan, `docs/etat_courant.md`, CHANGELOG et STORY ; écrire la recette d'Ulrich. S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
