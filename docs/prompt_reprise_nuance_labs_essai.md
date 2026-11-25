# Reprise — Nuance Labs, essai réel

Lot précédent livré : Nuance est sélectionnable à côté de HeyGen, Tavus, Anam et LemonSlice. Le rapport est `docs/plan_nuance_labs.md`. Aucun essai avec une vraie clé n'a été fait. Ce prompt ne lance pas l'essai : il le décrit pour une prochaine demande.

## État vérifié

- Fournisseur `nuance` dans le registre, les réglages, l'admin (Streaming Avatar Config et Appareils), la voix réellement jouée et la consommation.
- L'Edge Function émet un jeton `POST https://api.nuancelabs.ai/session-tokens` avec `NUANCE_API_KEY`. La clé ne sort pas du serveur.
- Mode `verbatim` : la réplique d'Ava part dans `response.create.instructions`, préfixe « Say only this ». Le micro est muet pour la persona.
- Mode `native` : la réplique d'Ava n'est pas envoyée, Nuance répond au micro.
- Audio d'Ava impossible (`session.input_audio.append` refusé). Personas : `sam` (défaut), `sonia`, `mira`. Anglais seulement.
- Migration à appliquer : `supabase/migrations/20261125140000_streaming_avatar_provider_nuance.sql`.

## Avant l'essai

1. La migration est appliquée sur Lovable Cloud (la contrainte `sessions_streaming_avatar_provider_check` contient `nuance`).
2. Le secret `NUANCE_API_KEY` est dans Lovable Cloud. L'admin affiche Nuance comme configuré.
3. L'Edge Function déployée est celle de ce lot.

## Essai

Sandbox seulement. Admin › Streaming Avatar Config › Nuance Labs › Sam › Texte d'Ava. Un appel court :

- une réplique française : noter si la vidéo parle, si le texte dit est le nôtre, ou si l'appel bascule sur la voix d'Ava (`instructions_refused` dans le motif de repli) ;
- une phrase anglaise courte, si la française est refusée : noter si elle est dite telle quelle ou reformulée ;
- puis le mode Conversation Nuance, une minute : la persona répond-elle au micro, et la réplique affichée d'Ava diverge-t-elle.

Ne pas publier en production. Ne pas modifier les fiches Notion.

## Si l'essai montre un refus systématique du français

S'arrêter. Ne pas construire un faux mode « texte exact ». Le rapport dit déjà que la voix d'Ava ne peut pas animer Nuance. Le lot suivant, s'il y en a un, se décide après cet essai.

## Livraison

Un lot, puis stop. À la clôture : prompt de reprise du lot d'après, ou dire qu'il n'y en a pas.
