# Prompt de reprise — Réglages : séparer les tests, couper la vidéo par personnage, compacter Réglages personnages (lot 1)

À copier dans un nouveau chat Ava. Origine : retour d'Ulrich du 27 novembre 2026, pendant la mesure du lot 4 latence ([plan latence](plan_latence_conversationnelle_llm_tts.md), section « Lot 4 »).

**Objectif** : que les réglages d'Ava se lisent sans piège. (1) Les réglages de test ponctuel sont séparés des réglages durables. (2) La vidéo se coupe par personnage, et l'interrupteur global « Voix » coupe vraiment la vidéo. (3) Réglages personnages range l'audio et la vidéo dans des blocs repliables. Ce lot seulement.

## Ce qui s'est passé (diagnostic du 27 novembre, vérifié en base)

- Ulrich a mis Technique avancée › sortie sur « Voix » (`ava_output_settings.mode = "tts"` sur `sandbox-ulrich`, 10 h 00). Ses deux sessions de 9 h 59 et 10 h 02 ont pourtant ouvert **Tavus** : `voice_turn_events.output_stream = { output: "tavus", mode: "feed" }` sur les 15 tours.
- Cause : `ava_streaming_avatar_settings.characterLinks.max = { provider: "tavus" }` (posé à 8 h 46). Par conception (`src/services/callVideoRouting.ts`, règle 2, décision du 25 novembre), **un lien de personnage passe avant l'interrupteur global**. Rien ne l'indique dans l'écran ; Ulrich a cru que Max « suivait le réglage global ».
- **Décision d'Ulrich (27 nov.)** : l'interrupteur global « Voix » doit couper la vidéo pour tout le monde. Quand la vidéo est activée, chaque personnage peut être mis en « Pas de vidéo » sans toucher au global.
- Réglages GM et Orchestration mêlent réglages durables et réglages de test, avec des libellés de chantier (« (mesure) », « (prototype) », « Lot T7 », « Canary ») :
  - Orchestration › Conversation vocale mains libres : « Sortie vocale progressive » (canary P1 Gradium), « Voix seule : réponse parlée en cours de génération (mesure) » (lot 4 latence), « Détection d'interruption » (canary acoustique).
  - Streaming Avatar Config › Tavus : « Réponse parlée en cours de génération (prototype) » (T7) ; › Anam : « Réponse parlée en cours de génération (mesure) » (lot 4).
  - Réglages › LLM › Agent Max : « Routage OpenRouter : fournisseur le plus rapide » (lot 3, désormais adopté sur `sandbox-ulrich`).
- Bloc « Transcription du joueur » sans interrupteur : il remplace depuis le 14 octobre (PR #43, `95d061d4`) l'ancien interrupteur `VOICE_ONLY_UI` ; le comportement est fixe et le bloc n'est qu'un texte. Le réglage `VOICE_ONLY_UI` existe encore dans `GameplaySettings` sans écran.
- Défaut de télémétrie vu au passage : en flux, l'appel LLM est enregistré une fois par morceau reçu (15 entrées `llm:…:sse` par tour), ce qui remplit `services` (plafond 16) et chasse les entrées `tts` et `video`. À corriger : une seule observation LLM par appel.

## Sources à lire

- `src/services/callVideoRouting.ts`, `src/services/callOutputMode.ts` (`resolveCallOutputMode`) et leurs tests ; `src/services/streamingAvatar/types.ts` (`CharacterVideoLink`, `characterLinks`) ; `applyCharacterVideoLink` dans `src/services/streamingAvatar/settings.ts`.
- `src/components/admin/CharacterVideoLinkEditor.tsx` (option « Suivre le réglage global ») et `src/components/CharacterRuntimeSettingsTab.tsx` (carte personnage : accueil, fournisseur TTS, Voice ID, service vidéo, rugosité).
- `src/components/GameMasterConfigTab.tsx` (Orchestration), `src/components/StreamingAvatarConfigTab.tsx`, `src/components/LLMConfigTab.tsx`, `src/services/adminNavigation.ts`.
- `docs/plan_avatar_video_par_personnage.md` (règles du 25 novembre) ; invariants vidéo, passage de personnage et mains libres en fin d'AGENTS.md.
- L'endroit où `ResponseOutputTurnContext.onServiceObserved` reçoit l'observation LLM en flux (`src/services/openRouterLLM.ts`, ≈ l. 172).

## Périmètre

1. **Vidéo par personnage** : dans le service vidéo d'un personnage, trois choix lisibles : « Suivre le réglage global », « Pas de vidéo (voix seule) », un fournisseur. Nouvelle forme stockée additive dans `characterLinks` (par exemple `{ provider: "none" }`), relue sans perte par les anciennes valeurs. Règles : interrupteur global sur « Voix » → aucune vidéo, lien ou pas ; global sur « Vidéo » → « Pas de vidéo » donne un appel voix seule, un fournisseur ouvre ce fournisseur, « Suivre » suit le global (Max) ou reste en voix (autres personnages, règle actuelle). Un appareil réglé sur voix reste en voix. L'écran indique ce que donnera le prochain appel (« Vidéo Tavus », « Voix seule, car le réglage global est sur Voix »…). Mettre à jour le plan vidéo par personnage.
2. **Réglages de test séparés** : un bloc repliable « Réglages de test (temporaires) », fermé par défaut, sur chaque page concernée (ou une page dédiée si c'est plus simple). Chaque réglage de test dit en une phrase ce qu'il change et son état (« en mesure », « adopté »), sans numéro de lot dans le libellé. Les réglages durables restent au premier niveau avec des libellés compris sans contexte. Classer au minimum ceux de la liste du diagnostic ; un réglage adopté (routage OpenRouter rapide) peut redevenir durable avec un libellé simple. Aucune valeur enregistrée ne change.
3. **Bloc « Transcription du joueur »** : le supprimer ou le changer en simple note de comportement hors de la liste des réglages, pour ne plus ressembler à un réglage sans interrupteur. Ne pas toucher au comportement.
4. **Réglages personnages compacts** : chaque carte garde au premier niveau le nom, l'activation et l'accueil. « Audio » (fournisseur TTS, Voice ID, rugosité) et « Vidéo » (service vidéo et ses champs) passent dans des blocs repliables, avec un résumé sur une ligne quand ils sont fermés (« ElevenLabs · voix de Max », « Pas de vidéo »). Les champs vidéo ne s'affichent que si un fournisseur est choisi.
5. **Télémétrie** : une seule observation LLM par appel en flux, pour que `services` garde aussi `tts` et `video`. Test.

**Hors périmètre** : logique des sorties et du flux (lot 4 latence), fiches Notion, nouveaux fournisseurs, production.

## Invariants et limites d'autorisation

- Sandbox uniquement ; la production n'est pas publiée et ses réglages ne sont pas modifiés.
- Aucune valeur enregistrée n'est réécrite automatiquement. Ne pas toucher aux réglages de `sandbox-romed`, `sandbox-benoit` ou `sandbox-julien`.
- Aucune migration attendue (`admin_settings` en JSON). Si une colonne était nécessaire, elle passe par Lovable et reste additive.
- Base Caractères Notion en lecture seule. Gami DigiDouble exclu.
- Passage de personnage, cinématiques et interruption inchangés ; un passage vers un autre personnage repasse toujours en voix.

## Validations

- Tests du routage : global Voix + lien Tavus → voix ; global Vidéo + « Pas de vidéo » → voix ; global Vidéo + lien → fournisseur ; anciennes valeurs relues à l'identique ; appareil en voix → voix.
- Tests d'écran : bloc de test fermé par défaut ; résumés des blocs repliés ; option « Pas de vidéo » enregistrée et relue.
- `npm run typecheck`, lint, `npm run test:quality` et `npm run test:delivery` verts avant le push. CI de la PR verte, avec `regression-gates`. Si `PeriodCostLines.test.tsx` échoue localement sur « 1'500 », c'est la locale ICU de Node ; la CI fait foi.
- Vérification dans le navigateur (aperçu Lovable, `sandbox-ulrich`) : les trois pages se lisent, et un appel avec le global sur Voix reste en voix même avec le lien Tavus de Max.

## Livraison

Branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, puis fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier sur origin/main (arbre et parent), supprimer notre branche, synchroniser en local et sur Lovable. Mettre à jour `docs/etat_courant.md`, le CHANGELOG et `docs/plan_avatar_video_par_personnage.md`.

**Première action exécutable** : lire `callVideoRouting.ts`, `callOutputMode.ts` et leurs tests, et écrire les cas de routage du point 1 en tests qui échouent avant de changer le code.

**Clôture obligatoire** : avant le push, s'il reste un travail identifié, écrire `docs/prompt_reprise_reglages_tests_et_video_personnage_lot_2.md` avec l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture ; sinon le dire. Donner le lien direct dans le compte rendu. Ne pas lancer de lot suivant.
