# Contrat anti-régression — expérience cœur

Ce contrat transforme les incidents récurrents en invariants exécutables. La CI GitHub l'applique sur chaque pull request et chaque push sur `main`.

## Invariants STT

- La façade `src/services/stt` reste l'unique point d'entrée des providers.
- Deepgram utilise le modèle et la langue renvoyés par le proxy ; en leur absence, la source de vérité partagée impose `nova-3` et `fr`.
- Un tour Deepgram conserve le préfixe finalisé et la dernière queue interim, puis attend la réponse à `Finalize` dans une fenêtre bornée.
- Les règles de reconstruction et de filtrage des ellipses Gamilab restent testées séparément ; elles ne modifient pas la sélection ni les métadonnées Deepgram.
- Le texte utilisateur complet reste visible puis devient le message transmis à Max.

## Invariants vidéo/audio

- Aucun écran d'activation sonore ni contrôle Play n'est rendu.
- Le clic initial « Commencer » active immédiatement le teaser préchargé et conserve la demande `play → volume 100 % → unmute → play` jusqu'au `ready` du player.
- Les cinématiques HLS suivantes sont en autoplay, sans contrôles et avec `muted=false`, volume `1`.
- Seul un identifiant Gumlet hexadécimal complet de 24 caractères peut être converti en manifeste HLS.
- « Passer » coupe, met en pause et remet à zéro avant la transition ; l'iframe est détruite/rechargée et le HLS est détaché afin que l'arrêt ne dépende pas d'une commande asynchrone.

## Invariant réponse Max

- Le délai RAG dégradé ne peut plus réduire la fenêtre normale de Max à moins de huit secondes.
- Un LLM qui répond en 3,5 secondes après un RAG bloqué doit être conservé ; le fallback ne doit pas accuser à tort la ligne ou le STT.

## Gates

- `npm run test:regression` : contrats critiques STT, audio, vidéo et orchestration.
- `npm run test:unit` : suite unitaire sans dépendance distante.
- `npm run build` : compilation de production.
- `npm run test:e2e` : parcours navigateur multi-tours, transcription visible, TTS, vidéo intercalée et contrats d'état autoplay/skip pour iframe et HLS.
- `npm run test:quality` : gate locale avant commit/push.
