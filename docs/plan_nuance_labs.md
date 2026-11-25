# Nuance Labs — avatar temps réel

Lu le 25 novembre 2026 sur [docs.nuancelabs.ai](https://docs.nuancelabs.ai/) et sur les types du SDK `@nuancelabs/js-sdk` 0.40.0. L'API est en aperçu : les routes peuvent changer avant la 1.0.

## Ce que c'est

Nuance Live n'est pas un visage qui prononce notre texte. C'est une conversation vidéo : une persona (visage + voix) parle en direct dans une salle LiveKit. Notre serveur crée un jeton de session avec la clé API. La page rejoint la salle avec ce jeton. La clé ne va jamais dans le navigateur.

```
serveur Ava ──(NUANCE_API_KEY)──► POST /session-tokens ──► jeton st_…
page       ──(jeton st_…)──────► SDK ──► salle LiveKit ──► événements nuance_live
```

Le son et l'image arrivent sur les pistes de la salle. Ce ne sont pas des événements. `session.input_audio.append` est refusé : on ne peut pas envoyer notre audio.

## Personas

Trois visages, trois voix. On choisit avec `personality.persona_id` au moment du jeton.

| Id | Rôle |
| --- | --- |
| `sam` | Défaut. On ne l'écrit pas dans le jeton. |
| `sonia` | Autre visage et autre voix. |
| `mira` | Autre visage et autre voix. |

Tout autre id, y compris `max` ou `emma`, est refusé (`unknown_persona`). La persona ne fixe que l'apparence et la voix. Le nom et le caractère viennent de `personality.system_prompt`.

## Ce qu'on peut envoyer

Au jeton (`POST https://api.nuancelabs.ai/session-tokens`) :

| Champ | Effet |
| --- | --- |
| `personality.system_prompt` | Qui est la persona, et quand elle délègue un travail. |
| `personality.persona_id` | `sonia` ou `mira`. Absent = Sam. |
| `expressiveness` | Nombre de 0 à 2. 0 plus calme, 2 plus mobile. Défaut 1. |
| `interface_setup.delegation` | `client` (la page fait le travail), `responses` (un backend appelle nos outils), `none` (rien n'est délégué). Ava envoie `none`. |
| `interface_setup.video.input.camera` | `false` : la persona ne voit pas la caméra. Ava envoie `false`. |
| `interface_setup.runtime_tools` | `stay_quiet` (défaut allumé), `end_call` (défaut éteint), `call_time` (défaut éteint). `switch_identity: true` est refusé avec une clé API. Ava éteint `stay_quiet` pour qu'une ligne de test ne soit pas avalée. |
| `end_user_id` | Identifiant de la personne : lettres, chiffres, `_ . : -`, 128 caractères. Ava envoie l'id de session. |

Pendant l'appel, sur le sujet `nuance_live` :

| Événement | Effet | Plafond |
| --- | --- | --- |
| `response.create` | Demande à la persona de parler maintenant. `response.instructions` est une note pour cette réplique seulement, pas le texte exact. | 2 000 caractères |
| `session.instructions.append` | Une consigne. La persona y répond avec ses mots, dans un tour à elle. | 2 000 |
| `session.commentary.append` | Quelque chose à dire à la personne, avec les mots de la persona. | 2 000 |
| `session.thinking.append` | Contexte silencieux (ce qui vient de changer dans l'app). | 2 000 |
| `response.item.create` | Message tapé de la personne (`role: "user"`), puis `response.create` pour qu'elle réponde. Seulement en délégation `responses`. Ava n'utilise pas ce chemin. | 24 000 |
| `session.input_audio.mute` | La persona entend le micro comme du silence. La piste reste publiée. | — |
| `session.output_audio.interrupt` | Coupe la réplique en cours. | — |
| `session.floor.hold` | Empêche la persona de prendre la parole d'elle-même. | 1 à 3 600 s |
| `session.close` | Raccroche. | — |

On sait qu'une réplique est finie avec `session.output_audio.done`. Il n'y a pas d'événement `response.done` pour la parole. Le texte dit arrive en `session.output_transcript.delta`.

## Notre texte, notre voix

**Texte exact, comme HeyGen ou Tavus Echo : non.** Aucun champ ne dit « prononce exactement ceci ». Le plus proche est `response.create` avec `instructions`. La persona lit la note et formule sa réplique. Elle peut reformuler, ajouter, ou se taire. Ava envoie malgré tout `Say only this, with no extra words:` suivi de la réplique, pour mesurer l'écart.

**Audio d'Ava (ElevenLabs, Gradium, Fish, Cartesia, Inworld) : non.** L'audio de la persona est le sien. On ne choisit pas un `voice_id`, on n'envoie pas de PCM. HeyGen, lui, peut faire parler ElevenLabs. Nuance ne le peut pas.

**Français : non, d'après la doc.** La persona et la reconnaissance parlent anglais seulement. Un texte dans une autre écriture, une demande de parler une autre langue, une demande de nommer le modèle, ou une demande de se dire humain, est refusé (`instructions_refused`) et n'atteint pas la persona. Une réplique française d'Ava a donc de bonnes chances d'être refusée. Dans ce cas l'appel bascule sur la voix d'Ava, comme pour les autres avatars en échec, et la vidéo s'arrête pour la suite de l'appel.

## Deux modes dans Ava

Admin › Technique › Streaming Avatar Config › Nuance Labs.

- **Texte d'Ava** (`drive: verbatim`, défaut). Le micro est rendu silencieux pour la persona. Chaque réplique d'Ava part en consigne. C'est le pilotage le plus proche de HeyGen. Ce n'est pas une garantie.
- **Conversation Nuance** (`drive: native`). Le micro reste ouvert. Nuance répond elle-même. La réplique d'Ava s'affiche et n'est pas envoyée. Les deux textes peuvent différer. Sert à entendre Sam, Sonia ou Mira.

La caméra du joueur n'est pas envoyée.

## Clé et base

- Secret Lovable : `NUANCE_API_KEY` (forme `nk_…`). L'Edge Function `streaming-avatar-session` la lit. Le navigateur ne reçoit qu'un jeton `st_…`, valable pour une conversation, à utiliser dans la minute.
- Migration `supabase/migrations/20261125140000_streaming_avatar_provider_nuance.sql` : la colonne `sessions.streaming_avatar_provider` doit accepter `nuance`. Sans elle, la session ne peut pas être liée.

## Ce qui reste à mesurer

Avec la clé et la migration en place, sur un bac à sable : une réplique française en mode Texte d'Ava (refus ou reformulation), une phrase anglaise courte (est-elle dite telle quelle), et une minute en mode Conversation Nuance. Rien de cela n'est fait. Rien n'est en production.
