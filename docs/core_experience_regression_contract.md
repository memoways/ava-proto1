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
- Le teaser et toutes les cinématiques suivantes utilisent le même élément `<video>` natif persistant ; aucun iframe média cross-origin n'est autorisé dans ce parcours.
- Le clic initial « Commencer » applique synchroniquement `defaultMuted=false`, `muted=false`, `volume=1` puis `play()` au lecteur préchargé, avant toute attente réseau.
- Chaque source suivante est convertie vers le HLS direct Gumlet et démarre automatiquement sur ce même élément, sans contrôle navigateur et sans nouveau clic.
- Sur Chromium/Firefox, `Hls.isSupported()` est prioritaire sur `canPlayType(m3u8)` : le média doit utiliser le moteur `hls.js` et exposer une `currentSrc` en `blob:`. Le HLS natif n'est qu'un fallback lorsque MSE/hls.js est indisponible.
- L'accueil reste en « Préparation… » jusqu'à `MANIFEST_PARSED` (ou `canplay` pour une source native), afin qu'aucun `play()` ne parte avant qu'une source décodable soit attachée.
- Seul un identifiant Gumlet hexadécimal complet de 24 caractères peut être converti en manifeste HLS.
- « Passer » mute, met en pause et remet à zéro, détruit HLS et supprime la source avant d'appeler la transition parente. Toute promesse `play()` appartenant à une ancienne génération est ignorée.

## Invariant réponse Max

- Le délai RAG dégradé ne peut plus réduire la fenêtre normale de Max à moins de huit secondes.
- Un LLM qui répond en 3,5 secondes après un RAG bloqué doit être conservé ; le fallback ne doit pas accuser à tort la ligne ou le STT.

## Gates

- `npm run test:regression` : contrats critiques STT, audio, vidéo et orchestration.
- `npm run test:unit` : suite unitaire sans dépendance distante.
- `npm run build` : compilation de production.
- `npm run test:e2e` : six parcours Chromium (multi-tours, transcription, TTS, vidéo intercalée) plus les deux contrats média rejoués sous Firefox et WebKit ; Chromium/Firefox exigent explicitement le moteur `hls.js` et une source `blob:`.
- `npm run test:quality` : gate locale avant commit/push.
