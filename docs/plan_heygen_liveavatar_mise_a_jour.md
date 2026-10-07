# Plan — Mise à jour connexion HeyGen (dépréciation v1/v2)

Date : 2026-10-10. Source : https://developers.heygen.com/endpoint-version-comparison

## État des lieux

- La page HeyGen annonce la fin des endpoints REST vidéo v1/v2 (`api.heygen.com`) au 31 octobre 2026, au profit de la v3.
- Notre intégration d'avatar en direct utilise **LiveAvatar** (`api.liveavatar.com/v1/sessions/token` et `/sessions/stop`), un produit HeyGen distinct documenté sur docs.liveavatar.com. Ses endpoints restent en v1 et ne sont **pas** dépréciés.
- Seul appel `api.heygen.com` du projet : la sonde de diagnostic `probe=1` (`heygenCore`), hors chemin de production.
- SDK navigateur `@heygen/liveavatar-web-sdk` : 0.0.18 → 0.0.19 disponible (2026-09-16).

## Changements appliqués

1. **SDK 0.0.19** : rupture d'interface — `voiceChat: false` n'existe plus ; le micro s'active par défaut non muet. Remplacé par `voiceChat: { defaultMuted: true }` dans `src/services/streamingAvatar/providers/heygen.ts` pour garantir que le micro n'est jamais publié vers HeyGen (le micro appartient au pipeline STT d'Ava).
2. **Sonde de diagnostic** : `https://api.heygen.com/v2/avatars` → `https://api.heygen.com/v3/avatars` dans `supabase/functions/streaming-avatar-session/index.ts` (la v2 disparaît le 31/10/2026).

## Vérifications

- `bunx tsgo --noEmit -p tsconfig.app.json` : propre.
- `bunx vitest run src/components/prd4/ConversationScreen.streamingAvatar.test.tsx` : 4/4 verts.
- Edge Function `streaming-avatar-session` redéployée sur Lovable Cloud.

## Hors périmètre / non requis

- Aucune migration v3 des endpoints REST vidéo : le projet n'utilise ni génération de vidéos, ni traduction, ni templates HeyGen.
- Tavus (v2) : non concerné par cette dépréciation HeyGen.
- Aucun déploiement Production.
