# Plan — Pilotage émotionnel TTS (intentions de jeu)

Date : 2026-08-25
Statut : implémenté

## Objectif

Les personnages doivent transmettre une émotion **liée à ce qui est dit**, via
les paramètres par tour des APIs TTS — pas seulement une bonne diction à plat.

## Décisions

- Intent canonique `PerformanceIntent` (provider-agnostique), dérivé du texte
  parlé + personnage + mémoire GM du tour N−1. **Pas de 2e LLM** (latence).
- Le GM pré-tour live n'existe plus (`prd4Orchestrator`) : on ne s'appuie pas
  sur `emotional_state` du brief.
- Hume `description` et Inworld `instruction` sont les meilleurs leviers
  existants. ElevenLabs : sliders ; tags `[angry]` seulement si `eleven_v3`.
- Gradium : pas d'émotion nommée → `temp` / `padding_bonus`.
- Cartesia : speed/volume toujours ; `emotion` **omis en français**.
- Deepgram Flux TTS : hors périmètre (anglais, axe calm/animated, pas d'émotion
  nommée, figé à l'ouverture du stream).

## Injection

`IndexPRD4.renderResponseText` → `LocalTTSOutput` → `TTSQueue` →
`TTSGenerateContext.performance` → adapter du provider.

## Secret Cartesia

Edge function `proxy-tts-cartesia` lit `CARTESIA_API_KEY` (Lovable Cloud).

## Audition admin (TTS Config)

Les puces d'émotion **sélectionnent** une intention ; elles ne jouent pas l'audio.
Pour entendre une différence : **Écouter Hume** ou **Écouter Inworld**.

| Provider | Intention utilisable ? | Ce qui est envoyé |
|---|---|---|
| Hume | Oui, audible | `description` NL (baseline admin + `actingNl`) + `speed` |
| Inworld | Oui, audible | `instruction` + `deliveryMode=CREATIVE` si intensité ≥ 2 |
| ElevenLabs | Faible (sauf `eleven_v3`) | offsets style/stability/speed ; tags `[angry]` seulement en v3 |
| Gradium | Très faible | `temp` / `padding_bonus` — pas d'émotion nommée |
| Cartesia | Volume/vitesse en FR | `generation_config.speed/volume` ; `emotion` **omis si langue ≠ en** |

Cartesia `Failed to fetch` : la fonction `proxy-tts-cartesia` n'est pas encore
déployée sur Lovable (sync GitHub), CORS, ou réseau. Le client affiche ce cas
explicitement.
