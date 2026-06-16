
# Plan — Démarrage AVA pour installation GIFF

Objectif : nouveau parcours court (< 45s) entre "Commencer" et le premier échange avec Max, avec 3 variantes choisissables dans l'admin. L'ancien parcours long (création de personnage complète) reste accessible via un flag admin pour les tests internes. Questionnaire inchangé.

## 1. Nouveau flow court (par défaut)

```text
Welcome  →  FilmQuestion  →  [TeaserRappel si "non"/"rappel"]  →  PostureCapture  →  Conversation Max
```

- Tous les écrans nouveaux sont sobres, cinéma, texte court.
- Pas de présentation de Max. La transition vers la conversation est directe (pas d'écran "appel en cours").
- Posture saisie en push-to-talk (1 phrase max), avec bouton **Me laisser surprendre** qui ignore la posture.
- Chrono `onboarding_started_at` posé au clic "Commencer", `first_max_response_at` posé à la fin du premier TTS de Max.

## 2. Les 3 variantes (champ admin `active_start_variant`)

Toutes partagent le même flow, seule la "voix" du wrapper change. Pas de TTS pendant l'onboarding (cf. décision : variante A = texte uniquement).

- **gm_host** — chaque écran porte une mini-attribution « Game Master » (chip discret en haut) et utilise les textes `gm_host_intro_text` / `gm_host_handoff_text` configurables.
- **gm_invisible** — aucun marqueur GM, juste les textes neutres (`welcome_text`, `posture_question`).
- **voiceover_hybrid** — pas de GM visible, mais une phrase d'intro italique stylée « voix off » (`voiceover_intro_text`) en haut de l'écran d'accueil et de la posture.

## 3. Admin

Nouvel onglet **« Démarrage GIFF »** dans le groupe **🎮 Mécanique**.

Champs (stockés via `admin_settings` clé `ava_giff_start_settings`) :

```text
active_start_variant: "gm_host" | "gm_invisible" | "voiceover_hybrid"
use_giff_flow:        boolean   # true = nouveau flow court ; false = ancien flow long
max_start_duration_seconds: number (default 45)
welcome_text, promise_text
teaser_text_short
posture_question
allow_surprise_me: boolean
gm_host_intro_text, gm_host_handoff_text
voiceover_intro_text
```

Tous les textes ont des valeurs par défaut tirées du PRD §5. Bouton « Reset aux valeurs PRD ».

## 4. Données stockées par session

Étendre `sessions` (migration) avec colonnes nullables :

```text
ava_start_variant TEXT
has_seen_film     TEXT   ("vu" | "pas_vu" | "rappel")
teaser_shown      BOOLEAN
user_posture_raw  TEXT
user_posture_mode TEXT   ("voice" | "surprise")
onboarding_started_at   TIMESTAMPTZ
first_max_response_at   TIMESTAMPTZ
onboarding_duration_ms  INTEGER
```

Persistance via `prd4Session.updatePRD4Onboarding(...)` (nouvelle helper). Événements PostHog : `giff_onboarding_started`, `giff_film_answered`, `giff_posture_captured`, `giff_first_max_response` (avec `duration_ms` et `variant`). Affichés ensuite dans l'onglet Sessions de l'admin (colonne « Variante » + durée).

## 5. Implémentation technique

### Fichiers à créer
- `src/components/prd4/PostureCaptureScreen.tsx` — PTT 1 phrase + bouton "Me laisser surprendre", inspiré de `RoleCaptureScreen` mais radicalement allégé (pas de MIN_CHARS strict, pas de bullet list).
- `src/components/prd4/TransitionScreen.tsx` — léger fondu noir 800ms entre posture et conversation (remplace `CallingMaxScreen` dans le flow GIFF).
- `src/components/GMHostChip.tsx` / `VoiceoverLine.tsx` — wrappers visuels réutilisables pour les variantes.
- `src/components/admin/GiffStartTab.tsx` — éditeur des champs admin.
- `src/services/giffStartSettings.ts` — load/save (`admin_settings` + `localStorage` fallback, même pattern que les autres settings).
- `supabase/migrations/<ts>_add_giff_onboarding_to_sessions.sql` — ajoute les colonnes ci-dessus.

### Fichiers à modifier
- `src/types/index.ts` — ajouter `AvaStartVariant`, étendre `ExperiencePhase` avec `"posture_capture"` et `"transition_max"`, ajouter `userPosture` à `ExperienceState`, ajouter le payload `onboarding` au type questionnaire technique (déjà existant, on ajoute juste les nouveaux champs).
- `src/hooks/useExperienceState.ts` — nouvel `setUserPosture`, conserver les phases existantes (l'ancien flow continue de fonctionner).
- `src/pages/IndexPRD4.tsx` :
  - Au montage, lit `giffStartSettings`. Si `use_giff_flow` est `true`, redirige les transitions : Welcome → FilmQuestion → (Teaser si non/rappel) → PostureCapture → TransitionScreen → ConversationMax. Si `false`, comportement actuel inchangé.
  - Mémorise `onboardingStartedAtRef` au clic Start ; calcule `onboarding_duration_ms` à la première réponse Max ; appelle `updatePRD4Onboarding`.
  - Passe la `variant` aux écrans pour qu'ils affichent l'habillage adéquat.
- `src/components/prd4/WelcomeScreen.tsx`, `FilmQuestionScreen.tsx`, `TeaserScreen.tsx` — accepter `variant` + textes injectés (props), garder les valeurs par défaut actuelles si non fournis (rétro-compat).
- `src/pages/Admin.tsx` — ajouter l'onglet `giff-start` dans le groupe « Mécanique ».
- `src/services/prd4Session.ts` — `updatePRD4Onboarding(sessionId, payload)`.
- `src/services/posthogService.ts` (si nécessaire) — exposer les nouveaux event types.

## 6. Critères d'acceptation (depuis le PRD §8)

- [ ] Les 3 variantes sont choisissables dans l'admin et changent visuellement le démarrage.
- [ ] La question « As-tu vu le film ? » est présente avec 3 boutons (Oui / Non / Je ne m'en souviens pas bien).
- [ ] Rappel court affiché si « non » ou « rappel ».
- [ ] L'utilisateur définit seulement une posture rapide en PTT.
- [ ] Le bouton « Me laisser surprendre » saute la posture et marque `user_posture_mode = "surprise"`.
- [ ] Le premier échange avec Max démarre en moins de 45s sur le flow par défaut (mesuré et stocké).
- [ ] Max n'est pas présenté explicitement (aucune mention "avatar IA" ni présentation).
- [ ] Questionnaire existant inchangé.
- [ ] Variante + durée stockées en base et visibles dans l'onglet Sessions.
- [ ] Push-to-talk reste fonctionnel pendant la conversation.
- [ ] Le flag admin permet de revenir à l'ancien flow long sans déploiement.

## 7. Hors-scope (explicite)

- Pas de TTS Game Master pendant l'onboarding (décision : texte uniquement pour la variante A).
- Pas de modification du questionnaire post-session.
- Pas de nouveaux micro-événements Game Master en cours de conversation.
- Pas de suppression du code de l'ancien flow (RoleCapture, RoleSummary, CharacterSelect, CallingMax restent et restent atteignables via `use_giff_flow = false`).
