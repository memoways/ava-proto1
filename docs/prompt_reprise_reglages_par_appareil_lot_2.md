# AVA — Reprise réglages par appareil, lot 2 : onglet Expérience › Appareils

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison (MCP Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc` pour lire la base). Une action humaine à la fois. Base Caractères Notion en
lecture seule.

Plan : docs/plan_reglages_par_appareil.md (« Décisions proposées » 2 et 3, « Exécution lot 1 »).

## État au départ (après le lot 1)

- Le joueur charge tous les réglages d'appel depuis la base (`src/services/experienceSettings.ts`,
  `hydrateExperienceSettings`, repli signalé `prd4_settings_fallback`).
- `describeEffectiveVoice()` (`src/services/effectiveVoice.ts`) dit ce qui sera joué ; ligne « Joué : … »
  (`src/components/admin/EffectiveVoiceSummary.tsx`) dans Services par appareil, Réglages personnages, Streaming
  Avatar et TTS Config.
- Chaque session enregistre `device_info.effective_settings` (modèles, moteur, modèle TTS, voix, sortie, version des
  réglages), visible dans le détail de session admin.
- « Services par appareil » (`src/components/admin/DeviceServicesPanel.tsx`, clé `ava_device_services`) est encore
  dans Technique › Streaming Avatar, avec une saisie libre d'ID de voix et un seul moteur par appareil.

## Première action : valider les décisions avec Ulrich

Avant tout code, présenter les décisions 2 et 3 du plan (une question à la fois) et noter la réponse dans le plan :
hiérarchie Appareil → Personnage → Moteur dans Expérience › Appareils ; voix prise dans le catalogue TTS Config ;
Technique avancée garde seulement les réglages fins de chaque moteur.

## Objectif du lot 2 (si validé)

1. Nouvel onglet **Expérience › Appareils** : pour smartphone, tablette, desktop : sortie (appel vocal / avatar),
   fournisseur d'avatar, STT affiché (réglé dans STT Config), puis pour Max et Emma le moteur de voix ; la voix vient
   du catalogue (`ava_tts_character_voices`), plus de saisie libre. Ligne « Joué : … » sous chaque choix
   (`EffectiveVoiceLine`, même fonction que l'expérience).
2. Le panneau quitte Streaming Avatar (un lien y reste). Nouveau format de `ava_device_services` avec un moteur
   **par personnage et par appareil** ; lecture tolérante de l'ancien format (aucune perte : moteur commun → même
   moteur pour Max et Emma, ID saisi → conservé s'il diffère du catalogue, signalé). `resolveDeviceVoice` et
   `describeEffectiveVoice` suivent le nouveau format ; le test d'accord entre les deux reste vert.
3. Technique › TTS Config ne garde que les réglages fins des moteurs (modèle, curseurs, formats) et le catalogue.

## Validations

- `npm run test:quality`, `npm run test:delivery`, E2E `@iphone` / `@ipad` et « navigateur vierge » verts ; test de
  migration de l'ancien `ava_device_services` (sans perte).
- Lecture base : ligne `ava_device_services` sandbox-ulrich relue après sauvegarde ; nouvelle session par appareil
  avec `device_info.effective_settings` attendu.
- Recette humaine iPhone (voix de Max) et iPad distinctes : ne pas les présenter comme faites.

## Livraison

CHANGELOG, docs/etat_courant.md, plan (« Exécution lot 2 ») avant le push. Livrer par la garde
(`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`), vérifier arbre/parent sur main et la synchronisation Lovable.

## Première commande

`git status`, `git fetch --prune`, main propre par `git pull --ff-only`, puis lire le plan,
`src/services/deviceServices.ts`, `src/services/effectiveVoice.ts` et `DeviceServicesPanel.tsx`.
