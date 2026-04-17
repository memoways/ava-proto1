

# Plan d'implémentation — Prototype 2 (Phase 1)

Périmètre : **socle UX visible et A/B testable de bout en bout**, sans les onboardings GM voice-first complets (qui arrivent en Phase 2).

## 1. Modèle de données (migration Supabase)

Ajouts à la table `sessions` :
- `variante_onboarding` text — `"A" | "B"`
- `modalite_voix` text — `"micro_ouvert" | "push_to_talk"`
- `personnage_appele` text — `"max"` (extensible)
- `player_role` jsonb — futur (Phase 2), nullable
- `narrative_end` boolean — pour distinguer fin narrative vs timeout/modération

Mise à jour `admin_settings` (clé `voice`) pour ajouter `TTS_VOICE_ID_GM` (fallback = voix Max).

Nouvelles clés `gameplay` :
- `VAD_SILENCE_THRESHOLD_MS` (900)
- `PTT_RELEASE_GRACE_MS` (200)
- `MAX_SPEECH_DURATION_S` (30)

## 2. Nouveau flow de phases

Refactor `GamePhase` dans `src/types/index.ts` :
```
onboarding (legacy) → ab_choice → intro_video → 
character_select → ringing → conversation → 
video_trigger → questionnaire → thanks
```
La `gate` disparaît côté UI (trust reste métrique GM interne).

## 3. Nouveaux écrans

| Écran | Rôle |
|---|---|
| `ABChoiceScreen` | "Pilule bleue / Pilule rouge", choix A ou B, sans explication. Enregistre `variante_onboarding`. Attribue aléatoirement `modalite_voix`. |
| `OnboardingAScreen` (placeholder Phase 1) | Écran 0 "règle d'or" + 4 cartes (QUI/QUOI/QUAND/RÔLE) en fade-in, bouton "Continuer". Pas encore de séquence GM voice-first. |
| `OnboardingBScreen` (placeholder Phase 1) | Texte narrateur omniscient avec TTS lecture du texte (réutilise pipeline TTS Max). Bouton "Continuer". |
| `CharacterSelectScreen` | Grille 4 portraits (Max actif + Emma/Léo/Ava grisés "Coming later"). Bouton "Appeler" sous Max. |
| `RingingScreen` | Animation 3 sonneries + son, transition vers `ConversationScreen`. |

`ConversationScreen` mis à jour :
- Bouton **"Terminer l'expérience"** rouge discret coin haut-droit (visible uniquement après début 1er appel).
- Bouton **"Raccrocher"** discret bas → retour à `character_select`.
- Suppression du bouton mic visible en mode `push_to_talk` → bouton "Appuyer pour parler" en bas.
- En mode `micro_ouvert` : pas de bouton, micro auto au démarrage de la conversation, feedback minimal.
- Suppression de la jauge trust visible (devient interne au GM).
- 3 états visuels distincts : Écoute (onde discrète) / Réflexion (… qui pulse) / Parle (sous-titres).

## 4. Modalité voix

Modifier `DeepgramSTT` + `Index.tsx` pour supporter deux modes :
- **micro_ouvert** : comportement actuel + paramètres VAD configurables (silence threshold, max speech duration).
- **push_to_talk** : nouveau hook `usePushToTalk` — `mousedown/touchstart` → `stt.resume()`, `mouseup/touchend` → délai `PTT_RELEASE_GRACE_MS` puis `stt.pause()` et déclenchement final. Bouton avec états visuels (repos/appuyé).

## 5. Triggers vidéo dynamiques

Remplacer la lecture de `video_triggers` côté Game Master : au démarrage de session, charger tous les triggers depuis Supabase dans un cache. Le GM les voit déjà via `gameMasterAgent` (vérifier que `triggerLookupService` lit bien la DB et pas une constante hardcodée — créer ce service si manquant).

## 6. Questionnaire branché (Phase 1 critique)

Refonte complète de `QuestionnaireScreen.tsx` + `QuestionnaireData` type :
- Découpage en blocs (1 Global, 2 GM, 3A ou 3B selon variante, 4 voix + sous-bloc PTT, 5 latence, 6 legacy, 7 contact) — env. 50 champs.
- Navigation paginée par blocs (avec progress bar).
- Affichage conditionnel des blocs 3A/3B et sous-bloc PTT.
- Métadonnées auto (session_id, durée, trust final, raison fin, variante, modalité).

Mise à jour `sync-questionnaire` edge function : mapper les ~50 nouveaux champs vers la base Notion existante "Questionnaire prototype 1 AVA".

## 7. Game Master — extension fin narrative

`GameMasterResponse` ajout :
- `narrative_end: boolean`
- `narrative_end_message: string | null`

Côté `Index.tsx` : si `narrative_end`, jouer le message TTS du GM (voix `TTS_VOICE_ID_GM`) puis transition douce vers questionnaire.

System prompt GM mis à jour dans `admin_settings` (instruction sur `narrative_end`).

## 8. Voix Game Master

- Champ admin `TTS_VOICE_ID_GM` dans `VoiceConfigTab.tsx` (fallback voix Max si vide).
- `elevenLabsTTS.ts` : accepter un `voiceId` optionnel par appel.
- Helper `speakAsGM(text)` qui pousse dans la TTSQueue avec voice GM.

## 9. Rectify (snippet à intégrer)

Quand tu fournis le snippet : créer `src/services/rectify.ts` + bouton discret "Signaler un bug" en coin (icône feedback) visible pendant toute l'expérience.

## 10. PostHog & Grain — événements ajoutés

`ab_choice_made`, `voice_modality_assigned`, `character_called`, `call_hung_up`, `experience_terminated_by_user`, `narrative_end_triggered`, `questionnaire_block_completed`.

## Découpage en commits / tâches

1. Migration DB + types
2. ABChoiceScreen + nouveau routing de phases
3. CharacterSelectScreen + RingingScreen + bouton Terminer/Raccrocher
4. Onboardings A et B (placeholders cinématiques, pas de GM voice-first)
5. Push-to-talk + sélection modalité
6. Questionnaire branché + sync Notion étendu
7. Voix GM admin + extension `narrative_end`
8. Triggers vidéo dynamiques (vérification/refactor)
9. Tracking PostHog/Grain enrichi

## À faire en Phase 2 (après validation Phase 1)

- Séquence GM voice-first Variante A (3 mouvements de co-création + construction PlayerRole)
- Séquence narrateur Variante B + auto-description vocale 60s
- Injection PlayerRole dans prompts Max + RAG
- Backstage / sas GM avec ambiance abstraite
- Activation Emma / Léo / Ava
- Audiogami questionnaire vocal

## Clarifications restantes (à confirmer avant le build)

- **Visuels personnages** : as-tu déjà les 4 portraits (captures d'écran film) ou on met des placeholders ?
- **Sonnerie** : as-tu un fichier audio de sonnerie visio, ou on en cherche un libre de droits ?
- **Onboardings A et B en Phase 1** : OK pour des **placeholders narratifs cliquables** (texte cinéma + bouton Continuer), avec la couche GM voice-first repoussée en Phase 2 ?

