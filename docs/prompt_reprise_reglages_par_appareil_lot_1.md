# AVA — Reprise réglages par appareil, lot 1 : les bons réglages partout et le résumé effectif

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison (MCP Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc` pour lire la base). Une action humaine à la fois.

Plan : docs/plan_reglages_par_appareil.md (lire « Diagnostic » et « Décisions proposées »). Base Caractères Notion en
lecture seule.

## État vérifié au départ (8 novembre, après #180)

- `src/pages/IndexPRD4.tsx` ne charge depuis `admin_settings` que STT, gameplay, cinématiques, sortie, Streaming
  Avatar, performance de parole et `ava_device_services`. LLM, ElevenLabs (`ava_tts_settings`), fournisseur TTS actif,
  Gradium, Fish, Inworld, Cartesia, catalogue de voix, contrôle du prompt de Max et validateur anti-hallucination ne
  sont lus que dans `localStorage`, rempli seulement par `hydrateAllSettings()` (Admin, atelier de parole).
- Preuve : sandbox-ulrich, tours smartphone en `google/gemini-2.5-flash` + `eleven_multilingual_v2` (défauts du
  code) ; poste admin en `openai/gpt-5.6-luna` + `eleven_v4_turbo` (valeurs en base).
- #180 a ajouté `src/services/deviceServices.ts` (`ava_device_services`, `resolveDeviceVoice`) et le panneau
  `src/components/admin/DeviceServicesPanel.tsx` dans Streaming Avatar ; il sera déplacé au lot 2, pas ici.

## Objectif du lot 1

1. **Chargement complet côté joueur.** Une fonction unique (par ex. `hydrateExperienceSettings()` dans
   `settingsService.ts`, lecture seule, environnement actif) charge tout ce qui pilote un appel : LLM, ElevenLabs,
   fournisseur TTS actif, Gradium, Fish, Inworld, Cartesia, catalogue de voix, contrôle du prompt de Max,
   anti-hallucination, plus ce qui est déjà chargé. Appelée au montage de l'expérience ; le premier appel
   (`prepareCall`) l'attend, avec un délai borné et un repli explicite (défauts + événement de télémétrie), jamais
   silencieux. Vérifier qu'aucun autre parcours joueur (reprise de session, passage à Emma, questionnaire
   conversationnel, `proxy-llm`) ne lit un réglage resté en `localStorage`.
2. **Résumé effectif partagé.** `describeEffectiveVoice({ device, character })` (pur, testé) dit ce qui sera joué :
   moteur, modèle, 2–3 curseurs principaux, voix et sa source (profil, catalogue, appareil, défaut), ou « voix de
   l'avatar Anam / HeyGen / source Tavus » si la sortie est un avatar. Affiché en une ligne à côté de chaque choix de
   moteur existant : Réglages personnages, Services par appareil, Streaming Avatar (voix HeyGen/Tavus), TTS Config
   (moteur actif). Même fonction que l'expérience, pour que l'affichage ne mente pas.
3. **Réglages effectifs par session.** Enregistrer au début de l'appel modèle LLM de Max et du GM, moteur et modèle
   TTS, voix, sortie, avatar et version/date des réglages (colonne JSON existante si possible, sinon migration à
   appliquer par Lovable) ; les montrer dans le détail de session admin.

Hors lot 1 : l'onglet Expérience › Appareils et le déplacement du panneau (lot 2).

## Validations

- `npm run test:quality` et `npm run test:delivery` verts ; E2E `@iphone` / `@ipad` ; un test qui prouve qu'un
  navigateur vierge (sans `localStorage`) utilise les valeurs de la base (LLM et ElevenLabs).
- Lecture base après livraison et une nouvelle session : `max_model` et `tts_model` attendus sur smartphone.
- Recette humaine iPhone (voix de Max) distincte : ne pas la présenter comme faite.

## Livraison

CHANGELOG, `docs/etat_courant.md`, plan (« Exécution lot 1 ») et prompt du lot 2 avant le push. Livrer par la garde
(`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`), vérifier arbre/parent sur main et la synchronisation Lovable.

## Première action

`git status`, `git fetch --prune`, main propre par `git pull --ff-only`, puis lire le plan et `IndexPRD4.tsx`
(montage et `prepareCall`) et `settingsService.ts` (`hydrateAllSettings`).
