# Prompt de reprise — Interruption douce, lot 1 (voix seule : finir le mot ou la phrase)

À copier dans un nouveau chat Ava. Origine : recette d'Ulrich du 27 novembre 2026, pendant la mesure du lot 4 de latence ([plan latence](plan_latence_conversationnelle_llm_tts.md), « Mesure du lot 4 »). Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

## Demande d'Ulrich

La conversation est réactive et fluide. Max lui a coupé la parole deux fois : pourquoi pas, il peut le faire. Mais quand Ulrich le recoupe à son tour, la voix ne doit pas s'arrêter net « comme si on lui enlevait la prise » : Max doit pouvoir finir son mot ou sa phrase. L'arrêt net suivi d'un silence sonne faux.

## Objectif

En voix seule, remplacer l'arrêt immédiat par un arrêt à la prochaine frontière naturelle, borné dans le temps. Ce lot seulement ; Max continue de pouvoir prendre la parole, la fin de parole (lot 5 de latence) n'est pas touchée.

## État vérifié le 27 novembre (à revérifier)

- `sandbox-ulrich` : mains libres, `endOfSpeechMs` 850, `hesitationExtraMs` 650, `bargeInMinWords` 3, `interruptionStrategy` `acoustic_confirmed`, sortie incrémentale Gradium éteinte, flux voix seule activé.
- La stratégie acoustique réversible (atténuation, pause, reprise) n'agit que si `streamedVoiceRef.current.reversibleOutput` existe (Gradium incrémental). Avec ElevenLabs, c'est la stratégie « texte » : trois mots reconnus, puis `interruptCharacter` (`IndexPRD4.tsx`) → `responseOutputRef.interrupt()` → `TTSQueue.cancel()` → `cancel()` du lecteur (`elevenLabsStreamPlayer.ts`, `elevenLabsPcmPlayer.ts`) : arrêt immédiat, sans fondu.
- Le silence qui suit est le nouveau tour : silence de fin (0,85 s) puis réponse (≈ 2,6 s en médiane).
- Tours lus (session `c2b976fd…`, 13 h 41-13 h 44 UTC) : trois coupures après le premier son, à 0,6 s, 1,1 s et 4,7 s. Les deux précoces correspondent probablement à Max qui démarre alors qu'Ulrich parle encore (déduit des jalons, non entendu par l'agent). Trois tours annulés avant tout son : continuation normale.
- `main` a reçu #302 (cohérence émotionnelle lot 1) le 27 novembre : `tts/queue.ts` et `IndexPRD4.tsx` ont changé.

## Sources à lire

`src/services/handsFreeVoice.ts`, `src/services/streamingAvatar/localTtsOutput.ts`, `src/services/tts/queue.ts`, les deux lecteurs ElevenLabs, `IndexPRD4.tsx` (`interruptCharacter`, reçu de livraison `persistReceipt`), [latence, section 3 interruptions](plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2), invariants de fin d'AGENTS.

## Périmètre proposé

1. Arrêt doux dans le lecteur et la file : les segments pas encore commencés sont abandonnés ; le segment en cours va jusqu'à la prochaine pause naturelle, avec un plafond, puis un fondu court.
2. Trouver la frontière : fin du segment si elle est proche, sinon creux d'énergie dans le PCM (mot) ; vérifier si ElevenLabs fournit des repères temporels utilisables avant de choisir.
3. Pendant la fin de la réplique, le joueur est écouté : sa parole ne doit être ni perdue ni confondue avec l'écho, et la réponse suivante ne chevauche pas la queue.
4. Le reçu de livraison et la mémoire reflètent le texte réellement entendu.
5. Réglage réversible, éteint par défaut.

Hors périmètre : sorties vidéo (leur commande d'interruption est celle du fournisseur), cinématiques, passage de personnage, arrêt par raccrochage ou fin de session (reste immédiat), seuils de détection, production.

## Invariants et limites d'autorisation

Sandbox uniquement, production non publiée. Aucune migration attendue ; aucune valeur enregistrée réécrite. Base Caractères Notion en lecture seule. Gami DigiDouble exclu. Les décisions de tour restent dans `handsFreeVoice.ts`.

## Validations

Tests : réglage absent = arrêt actuel ; frontière et plafond ; segments suivants abandonnés ; reçu = texte entendu ; interruption pendant le flux MP3 et PCM ; rien ne continue après raccrochage. `npm run typecheck`, lint, `npm run test:quality`, `npm run test:delivery`, CI de PR avec `regression-gates`. `PeriodCostLines.test.tsx` peut échouer localement sur « 1'500 » ; la CI fait foi. Écoute d'Ulrich sur ordinateur et iPhone.

## Livraison

Branche de lot depuis main à jour, commit, push, PR, puis `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier arbre et parent, supprimer notre branche, synchroniser en local et sur Lovable, mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan.

## Première action exécutable

Demander à Ulrich jusqu'où Max peut continuer après avoir été recoupé (une seule question) : la fin du mot, ou la fin de la phrase avec un plafond d'environ 2 secondes (recommandé).

## Clôture obligatoire

Avant le push, s'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Donner le lien direct dans le compte rendu. Ne pas lancer de lot suivant.
