# Réglages par appareil — plan

Demande d'Ulrich (8 novembre 2026, après #180) : le smartphone ne joue pas le réglage ElevenLabs voulu
(`eleven_v4_turbo` et ses curseurs), et les réglages sont répartis entre trop d'endroits. Il veut un réglage
centralisé **par appareil** (smartphone, tablette, desktop) dans **Expérience**, puis, dans chaque appareil, les
réglages **par personnage**, avec à chaque choix de moteur un résumé de ce qui sera réellement utilisé.

## Diagnostic (8 novembre, lecture seule)

**Cause racine : l'expérience joueur ne charge pas la plupart des réglages admin depuis la base.**

- Les réglages `admin_settings` se lisent côté client de façon synchrone dans `localStorage`
  (`readEnvironmentStorage`). Seul `hydrateAllSettings()` les recopie depuis la base, et il n'est appelé que par
  `src/pages/Admin.tsx` et l'atelier de parole.
- `src/pages/IndexPRD4.tsx` ne charge que : STT, gameplay, cinématiques, sortie et Streaming Avatar, performance de
  parole, et (depuis #180) services par appareil. **Jamais** : LLM (`ava_llm_settings`), ElevenLabs
  (`ava_tts_settings`), fournisseur TTS actif, Gradium, Fish, Inworld, Cartesia, catalogue de voix
  (`ava_tts_character_voices`), contrôle du prompt de Max, validateur anti-hallucination.
- Conséquence : un appareil qui n'a jamais ouvert l'admin dans cet environnement (iPhone d'Ulrich, **et tous les
  testeurs externes**) joue les valeurs par défaut du code.
- Preuve (sandbox-ulrich, 5 derniers jours, `voice_turn_events.voice_turn_completed`) :
  - 22 tours smartphone : Max sur `google/gemini-2.5-flash`, TTS `eleven_multilingual_v2` (défaut du code) ;
  - tours du poste d'Ulrich (admin ouvert) : Max sur `openai/gpt-5.6-luna`, TTS `eleven_v4_turbo`.
  - `admin_settings` sandbox-ulrich : `ava_tts_settings.modelId = eleven_v4_turbo`, stabilité 0,38, style 0,38 ;
    `ava_llm_settings.LLM_MODEL = openai/gpt-5.6-luna`.
- La voix (`VK9GO2Vntd9rcY7Tg6wl`) était juste : elle vient de `character_runtime_profiles` (lu par RPC), pas du
  `localStorage`.

**Où se règle quoi aujourd'hui** (source d'ambiguïté signalée par Ulrich) :

| Réglage | Endroit admin | Clé / table |
|---|---|---|
| Moteur + voix du personnage | Expérience › Réglages personnages | `character_runtime_profiles.tts_provider`, `tts_voice_id` |
| Voix de chaque personnage chez chaque moteur | Technique › TTS Config | `ava_tts_character_voices` |
| Modèle et curseurs ElevenLabs (un seul jeu) | Technique › TTS Config | `ava_tts_settings` |
| Réglages Gradium (par personnage), Fish, Inworld, Cartesia | Technique › TTS Config | `ava_tts_settings_*` |
| Moteur TTS « actif » (repli quand le profil n'en a pas) | Technique › TTS Config | `ava_tts_active_provider` |
| STT (Deepgram / Gamilab) | Technique › STT Config | réglages STT |
| Voix seule / Avatar vidéo (global) | interrupteur en tête de l'admin | `ava_output_settings` |
| Fournisseur d'avatar, voix Anam / HeyGen (dont un modèle ElevenLabs HeyGen) / source Tavus | Technique › Streaming Avatar | `ava_streaming_avatar_settings` |
| Sortie, avatar, moteur, voix par appareil | Technique › Streaming Avatar › Services par appareil (#180) | `ava_device_services` |
| Rugosité, états de parole | Atelier de parole / Réglages personnages | `character_speech_runtime` |

Note : le 8 novembre à 16 h 42, `ava_device_services` sandbox-ulrich a été sauvegardé avec smartphone =
« Suivre l'interrupteur » : le smartphone suit désormais l'interrupteur global (avatar si « Avatar vidéo »).

## Décisions proposées (à valider par Ulrich au début du lot 2)

1. **Les réglages viennent toujours de la base pour le joueur.** Au démarrage de l'expérience, chargement en lecture
   seule de tous les réglages qui pilotent un appel, pour l'environnement actif, avant le premier appel. Le
   `localStorage` reste un cache, jamais la source.
2. **Une seule hiérarchie, lisible :** Appareil → Personnage → Moteur. Expérience › nouvel onglet **Appareils** :
   pour chaque appareil, sortie (appel vocal / avatar), fournisseur d'avatar, STT (affiché, réglé dans STT Config),
   puis pour Max et Emma le moteur de voix. La voix vient du catalogue TTS Config (plus de saisie libre d'ID).
   Le panneau « Services par appareil » quitte Streaming Avatar.
3. **Technique avancée garde les réglages fins** de chaque moteur (modèle, curseurs, formats), sans choix de
   personnage ni d'appareil.
4. **Chaque choix de moteur affiche un résumé de ce qui sera joué**, calculé par la même fonction que l'expérience :
   « ElevenLabs · eleven_v4_turbo · stabilité 0,38 · style 0,38 · voix VK9G… (catalogue) », « Anam · voix de l'avatar
   (Lab Anam) », « Tavus · voix Ava ». Dans Appareils, Réglages personnages et Streaming Avatar.
5. **Chaque session enregistre les réglages effectifs** (modèle LLM, moteur, modèle TTS, version des réglages) pour
   que l'admin Sessions montre ce qui a réellement tourné.

## Lots

- **Lot 1 — les bons réglages partout + résumé effectif.** Chargement complet côté joueur (décision 1),
  `describeEffectiveVoice()` partagé (décision 4) affiché à côté des choix de moteur existants, réglages effectifs
  dans la session (décision 5). Corrige à lui seul la voix et le modèle de Max sur smartphone et chez les testeurs.
- **Lot 2 — onglet Expérience › Appareils.** Décisions 2 et 3 : déplacement et refonte de « Services par appareil »,
  moteur par personnage et par appareil, voix du catalogue, migration de `ava_device_services` sans perte.

Prompt du lot 1 : [prompt_reprise_reglages_par_appareil_lot_1.md](prompt_reprise_reglages_par_appareil_lot_1.md).
