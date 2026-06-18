## Mise à jour CHANGELOG.md + STORY.md (session 30)

Documenter les changements de la session du 18 juin 2026, **sans migration des URLs Notion**.

### Entrée à ajouter

**Version**: `[0.32.0] - 2026-06-18 — Cache audio d'ouverture, avatar Max, mapping Notion "Qui t'appelle", autoplay vidéo HLS`

### Contenu

- **Cache audio d'ouverture Max** — `openingTTSCache.ts` pré-génère et cache le TTS de *« Hallo... à qui ai-je affaire ? »* pour éliminer la latence au démarrage de la conversation.
- **Avatar Max** — nouvelle image appliquée dans `CharacterSelect` et en fond de `ConversationScreen`.
- **Renommage Notion** — propriété `Ce que tu sais de l'utilisateur` → `Qui t'appelle` dans la base *Caractères AVA*. Sync, service `characterPromptService.ts` et UI admin alignés.
- **Player vidéo autoplay+son** — `GumletVideoPlayer` détecte les URLs `.m3u8` et bascule sur `<video>` + hls.js (autoplay forcé non-muté). Intro vidéo revenue à l'embed Gumlet (`play.gumlet.io/embed/...`) car le décodage HLS natif a échoué dans le preview. Les URLs `gumlet.tv/watch/{id}` de Notion restent inchangées (jouées via iframe).

### Fichiers modifiés

1. **CHANGELOG.md** — ajouter le bloc `[0.32.0]` en tête (Ajouté/Modifié/Corrigé/Notes selon Keep a Changelog).
2. **STORY.md** — mettre à jour le header (`Last Updated: 2026-06-18 — session 30`) et insérer un nouveau bloc « Feature Chronicle » daté 2026-06-18 avec Intent / Outcome / Validation / Time.

### Hors-scope

- **Aucune migration** des URLs Notion `gumlet.tv/watch/{id}` vers `.m3u8`.
- Aucune modification de code applicatif.
