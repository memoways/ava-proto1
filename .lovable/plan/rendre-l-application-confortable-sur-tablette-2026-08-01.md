# Rendre l'application confortable sur tablette

Objectif : usage impeccable sur tablette (portrait ~820×1180 et paysage ~1180×820), côté expérience publique **et** côté admin. Le smartphone n'est pas une cible, mais rien ne doit casser en dessous.

## État constaté

- Aucun débordement horizontal global sur `/` en portrait ni paysage (scrollWidth = viewport).
- Les écrans publics (Accueil, Rôle, Conversation, Questionnaire) utilisent déjà `max-w-*` + points de rupture `md:` : ils tiennent sur tablette, restent à ajuster sur le confort (hauteur, zones tactiles, `min-h-screen` sur iPad Safari).
- L'admin est la vraie zone à risque : construite pour un grand écran (`max-w-7xl`), avec des éléments qui ne se replient pas :
  - `TabsList` des groupes « Mécanique » (8 onglets) et « Technique » (7 onglets) sur une seule ligne, sans défilement.
  - Tableaux larges (Consommation LLM, Voix, Streaming Avatar, Latence & blocage) : présents en `overflow-x-auto` par endroits, absents ailleurs.
  - Sélecteurs à largeur fixe (`w-[130px]`, `w-[200px]`, `w-[230px]`, `w-[190px]`) qui forcent des lignes de filtres trop longues.
  - Grilles qui passent de 1 à 3-4 colonnes dès `md:` (768px) : sur tablette portrait cela donne des colonnes de 180px illisibles (Latence & blocage `lg:grid-cols-3`, RAG Lab `xl:grid-cols-4`, colonnes `md:grid-cols-[260px_1fr]`).
  - `ScrollArea h-[70vh]` en portrait : hauteur correcte, mais colonne détail juxtaposée trop étroite.

## Travail à faire

### 1. Socle
- Ajouter un point de rupture explicite tablette dans la config Tailwind (`tablet: 820px` / `tablet-landscape: 1100px`) pour éviter d'empiler des `md:`/`lg:` ambigus.
- Utiliser `min-h-[100svh]` en complément de `min-h-screen` sur les écrans plein écran (barre d'URL iPad Safari).
- Zones tactiles : porter les boutons/onglets/déclencheurs de l'admin à 40px de haut minimum.

### 2. Expérience publique (retouches ciblées, pas de refonte)
- Conversation : garder la vidéo/photo en `object-cover` plein cadre, remonter le bloc sous-titres pour qu'il ne soit pas collé au bord en paysage, agrandir le bouton micro sur tablette.
- Accueil / Rôle / Questionnaire : élargir les conteneurs sur tablette (`max-w-2xl` → `max-w-3xl` à partir de 820px), agrandir les cases à cocher et curseurs pour le doigt.
- Sélection de personnages : 2 colonnes en portrait, 4 en paysage (aujourd'hui 4 dès 768px, donc vignettes serrées en portrait).

### 3. Admin
- **Navigation** : rendre les deux barres (groupes et onglets) défilables horizontalement avec indicateur de bord, sans réduire la taille du texte. Sur portrait, un menu déroulant d'onglets en repli si la barre dépasse.
- **Tableaux** : wrapper `overflow-x-auto` systématique + entêtes collantes ; largeur minimale pour éviter l'écrasement des colonnes.
- **Filtres** : remplacer les largeurs fixes par `w-full sm:w-auto min-w-[...]` dans un conteneur `flex-wrap`.
- **Grilles** : décaler les seuils — 1 colonne en portrait, 2 en paysage, 3-4 seulement à partir du desktop, pour les onglets Latence & blocage, RAG Lab, Traces Max, Métriques, Consommation (LLM / Voix / Avatar), STT/LLM/TTS/Streaming Avatar Config.
- **Vues maître-détail** (Embeddings, Éditeur personnage, Laboratoire RAG, Sessions) : passage en pile verticale en portrait (liste puis détail), côte à côte en paysage.
- **Zones de texte de prompts** : hauteur relative au viewport plutôt que fixe, pour rester utilisables en paysage.

### 4. Vérification
- Captures Playwright sur `/` et `/admin` (chaque groupe d'onglets) en 820×1180 et 1180×820, contrôle `scrollWidth == viewport` et absence de texte tronqué.
- Rejouer `npm run test:quality` et la suite e2e existante (les contrats média Chromium/Firefox/WebKit ne doivent pas bouger).

## Risques et régressions possibles

| Risque | Détail | Mitigation |
| --- | --- | --- |
| Contrats anti-régression média | `docs/core_experience_regression_contract.md` fige le comportement du lecteur vidéo et de l'audio ; toucher au conteneur de `ConversationScreen` peut faire échouer les tests e2e | Ne modifier que les classes de mise en page hors chaîne `<video>`/hls.js, ne pas remonter/démonter l'élément vidéo, relancer `test:e2e` |
| Anti-flash avatar | Le figeage d'image repose sur un canvas superposé à la vidéo ; changer les tailles/positions peut réintroduire des flashs | Conserver la superposition exacte (`absolute inset-0`, `object-cover`), tester avec le panneau « Tester l'avatar » |
| Tests de composants existants | `ConversationScreen.streamingAvatar.test.tsx`, `LatencyOverlay.test.tsx`, `PipelineSchema.test.tsx`, `PipelineTraceTab.test.tsx` s'appuient sur la structure rendue | Éviter d'ajouter/supprimer des nœuds ; ne changer que les `className`. Corriger les tests si un wrapper est indispensable |
| Régression desktop | Repousser les seuils de colonnes peut appauvrir l'affichage sur grand écran | Ajouter les nouveaux seuils **en plus** des `lg:`/`xl:` existants, jamais en remplacement |
| Barres d'onglets défilables | Un onglet actif hors champ devient invisible | Défilement automatique vers l'onglet actif à la sélection |
| Confort tactile vs densité | Agrandir les cibles allonge les pages admin denses | Agrandissement limité aux points de rupture tablette |
| Aucun changement métier | Le pipeline STT/LLM/TTS, les Edge Functions, la base et les secrets ne sont pas touchés | Chantier strictement présentation (JSX/classes + config Tailwind) |

## Détails techniques

- Fichiers concernés côté socle : `tailwind.config.ts`, `src/index.css`.
- Écrans publics : `src/components/prd4/*.tsx` (Welcome, RoleCapture, PostureCapture, Conversation, Questionnaire, CharacterSelect, RoleSummary, EndSession), `src/components/CharacterSelectScreen.tsx`, `src/components/SubtitleOverlay.tsx`.
- Admin : `src/pages/Admin.tsx` (barres de navigation), `src/components/admin/*.tsx`, `src/components/{LatencyBlockingTab,LatencyTelemetryTab,RAGLabTab,PipelineTraceTab,HallucinationMetricsTab,AntiHallucinationValidatorTab,STTConfigTab,LLMConfigTab,TTSConfigTab,StreamingAvatarConfigTab,GameMasterConfigTab,CharacterEditorTab,VideoTriggersEditor}.tsx`.
- Aucune migration SQL, aucun redéploiement d'Edge Function.
