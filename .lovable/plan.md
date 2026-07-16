# STT Config — Dictionnaire visible + réglages API par service

## Contexte

Le dictionnaire custom existe déjà (section "Dictionnaire custom (mots-clés)" dans `STTConfigTab`, stocké dans `admin_settings.ava_stt_dictionary`) mais est peu visible : situé sous la grille des providers, sans indication par-provider de qui l'utilise. Aucun réglage API par provider n'est actuellement exposé — seul le provider actif est configurable.

## Objectif

1. Rendre évident où éditer le dictionnaire et quels providers l'utilisent.
2. Exposer, par provider, les réglages API pertinents.

## 1 — Visibilité du dictionnaire

- Sur chaque carte provider dans la grille : badge **"Dictionnaire ✓"** ou **"Dictionnaire ✗"** (couleur secondaire vs muted) + tooltip texte court expliquant la méthode utilisée (`keyterm` / `keyterms_prompt` / `prompt` / non supporté).
- Ajouter un champ `supportsDictionary: boolean` + `dictionaryMethod?: string` dans `STTProviderDefinition` (`src/services/stt/registry.ts`).
- Déplacer la section "Dictionnaire custom" **au-dessus** de la grille providers (position plus proéminente) et lui donner un titre h3 plus visible avec le nombre de termes et un lien d'ancre.

## 2 — Réglages API par provider

Nouvelle structure : `admin_settings.ava_stt_provider_settings` = `{ deepgram: {...}, assemblyai: {...}, openai_whisper: {...}, gradium: {...}, gamilab: {...} }`, chargée/sauvée via un nouveau service `src/services/stt/providerSettings.ts` (miroir de `tts/providerSettings.ts`).

Réglages exposés (uniquement ceux réellement utilisés par le code existant + quelques knobs API standard) :

**Deepgram** (streaming WS)
- `model` (nova-3, nova-2, nova-2-general) — défaut nova-3
- `language` (fr-FR, en-US, multi) — défaut fr-FR
- `smart_format` bool
- `punctuate` bool
- `interim_results` bool
- `endpointing` ms (0-2000, défaut 300)
- `utterance_end_ms` (1000-3000, défaut 1500)
- `vad_events` bool

**AssemblyAI** (v3 streaming)
- `format_turns` bool
- `min_end_of_turn_silence_when_confident` ms (200-2000)
- `end_of_turn_confidence_threshold` (0.1-1.0)

**OpenAI Whisper** (batch)
- `model` (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe)
- `language` (fr, en, auto)
- `temperature` (0.0-1.0)

**Gradium** (batch STT)
- `language` (fr, en, auto)
- + note "réglages STT limités"

**Gamilab** — pas de réglages API exposés (aucun paramètre SDK à ce jour → section grisée "Aucun paramètre configurable").

Chaque provider affiche ses réglages dans un bloc dépliable (`<details>`) sur sa carte, avec un bouton **"Sauver réglages"** par provider (pas un save global — évite d'écraser les autres).

## 3 — Câblage runtime

- `deepgramSTT.ts` : `buildDeepgramWebSocketUrl` accepte déjà `keyterms` — lui passer aussi `model`, `language`, `smart_format`, `punctuate`, `interim_results`, `endpointing`, `utterance_end_ms`, `vad_events` depuis les settings chargés.
- `assemblyaiSTT.ts` : ajouter les 3 paramètres de turn detection à l'URL WS.
- `openaiWhisperSTT.ts` + `proxy-stt-whisper` : forwarder `model`, `language`, `temperature` dans le FormData.
- `gradiumSTT.ts` : passer `language` au proxy Gradium STT (si le proxy l'accepte — sinon ajouter).

Aucune migration DB : réutilise `admin_settings` (clé `ava_stt_provider_settings`).

## Détails techniques

```text
src/services/stt/
├── registry.ts                (+ supportsDictionary, dictionaryMethod)
├── providerSettings.ts        (NEW — load/save/reset per-provider)
├── providers/
│   ├── assemblyaiSTT.ts       (edit — lire settings)
│   ├── openaiWhisperSTT.ts    (edit — envoyer settings au proxy)
│   └── gradiumSTT.ts          (edit — langue)
├── deepgramSTT.ts             (edit — knobs URL WS)
src/components/
├── STTConfigTab.tsx           (refactor — dictionnaire en tête, badges, blocs réglages)
└── stt/                       (NEW dossier)
    └── ProviderSettingsPanel.tsx   (composant par-provider)
supabase/functions/
└── proxy-stt-whisper/index.ts (edit — accepter model/language/temperature)
```

## Hors scope

- Réglages Gamilab (aucune API publique documentée pour le SDK)
- Filler tokens Whisper avancés / autres modèles STT
- Preview de transcription à chaud dans l'admin
