# Plan — Ava multilingue (FR / EN / DE)

Date : 12 novembre 2026. Statut : **plan, aucun code**. Tâche Notion (Gamilab) :
[Multilingue AVA (FR/EN/DE)](https://app.notion.com/p/521102f199d34abdade41f1b84cd97ac).
Premier lot : [prompt de reprise M1](prompt_reprise_multilingue_lot_m1.md).

Objectif : une expérience **native** en français, anglais et allemand — interface, conversation
voix à voix, voix, avatars vidéo, vidéos — réglée depuis le back-office, traductions en base.
L'espagnol est une extension : rien dans l'architecture ne doit être limité à trois langues.

## 1. Décisions d'Ulrich (12 novembre 2026)

| Sujet | Décision |
| --- | --- |
| Choix de la langue | Sélecteur à l'accueil, prérempli par le navigateur, forçable par lien, invitation ou station de festival |
| En cours d'appel | **Langue fixe par session** ; le personnage réagit en jeu s'il ne comprend pas |
| Allemand | Hochdeutsch des deux côtés, consigne à l'écran ; pas de suisse allemand |
| Identité des personnages | Natifs, sans accent ; noms, lieux et faits du film inchangés |
| Connaissances | **Hybride** : faits, timeline et RAG restent en français (Notion, source unique) ; seuls les champs qui portent la voix sont adaptés par langue en base. À confirmer par le juge |
| Production des textes | Première version par LLM dans le back-office, **validation par un relecteur natif** ; une langue n'est publiable que si tout est validé |
| Voix | Une voix et un moteur par personnage **et par langue** ; décision à l'écoute (voix clonée multilingue contre voix native) |
| Extraits du film | Une vidéo, pistes de sous-titres EN/DE activées selon la session |
| Cinématiques | Sans voix : aucune adaptation |
| Vidéo d'introduction, teaser | **Refaits par langue** : une vidéo par langue en base |
| Avatars | Fournisseur et réglages **par langue** ; repli en appel vocal si aucun ne passe la recette |
| Analyse | Texte original + langue + traduction française automatique ; filtre « Langue » dans l'admin |
| Calendrier | **FR + DE publics à Soleure (janvier 2027)** ; l'anglais sert de langue pilote en sandbox et s'ouvre après sa propre recette |
| Stockage | Traductions **en base**, gérées dans le back-office ; Notion reste la source française. La base Caractères reste en lecture seule |

## 2. État des lieux (code lu le 12 novembre, main `f21be8d`)

Aucune notion de langue n'existe : ni sur la session, ni dans les réglages par environnement.

| Domaine | Constat | Fichiers |
| --- | --- | --- |
| Session | Pas de colonne langue ; `<html lang="fr">` | table `sessions`, `index.html` |
| Interface joueur | ~170 textes français en dur | `src/components/prd4/*`, `src/pages/IndexPRD4.tsx` (3 772 lignes), `Privacy.tsx`, portes d'accès |
| Textes d'expérience | Briefing du bénévole, cadre d'expérience, questionnaire, relances : français dans le code ou dans la configuration publiée | `volunteerBriefing.ts`, `experienceFrame.ts`, `prd4Questionnaire.ts`, `conversationalQuestionnaire*.ts`, `settingsService.ts` |
| STT | `"fr"` en dur dans AssemblyAI, Gamilab, Whisper ; Deepgram `fr` par défaut côté Edge ; dictionnaire unique | `src/services/stt/providers/*`, `deepgramSTT.ts`, `proxy-stt*`, `stt/dictionary.ts` |
| TTS | `languageCode: "fr"` par défaut ; Cartesia n'applique l'émotion qu'en anglais ; graphie « Ahva » propre au français ; nettoyage de texte français (`IA` → `I A`) | `settingsService.ts`, `tts/providers/*`, `tts/textPrep.ts`, `proxy-tts*` |
| Avatars | HeyGen `language: "fr"`, Tavus `languages: ["fr"]`, Anam en mode texte avec sa propre voix | `streamingAvatar/settings.ts`, `_shared/streamingAvatarRequest.ts` |
| Prompts personnages | Trois compilateurs à gabarit français ; contrats de flux, invariant de gravité, accroche en français | `src/agents/max*PromptCompiler.ts`, `maxAgent.ts`, `gravity.ts` |
| Fiches | Notion → `character_prompts` (12 champs) et `character_runtime_profiles.opening_line`, par environnement, français seulement | `sync-notion` |
| RAG | Embeddings Voyage sur le texte français ; la reformulation de requête écrit « en français » | `ragProfiles.ts`, `rewrite-query`, `query-rag` |
| Game Master | Prompt publié par environnement (versions) ; raisonne et cite en français | `experience_orchestration_versions`, `gameMasterPRD4.ts` |
| Règles du moteur | Passage Max→Emma, acceptation ou refus, gravité, identité, découpe en phrases : **expressions régulières françaises** | `characterConversation.ts`, `characterHandoff.ts`, `handoffCoordinator.ts`, `gravity.ts`, `characterIdentityGuard.ts` |
| Vidéos | `video_triggers` : une adresse, pas de sous-titres ni de variante par langue | `GumletVideoPlayer.tsx`, `sync-notion` |
| Juge | Corpus, grille et rapports en français | `evalJudge*` |
| Back-office | ~1 300 textes français ; réglages par environnement dans `admin_settings` (héritage prod → sandbox) et par appareil dans `ava_device_services` | `Admin.tsx`, `environmentContext.ts`, `deviceServices.ts` |

Deux acquis servent directement : le mécanisme de réglages par environnement et le modèle
« réglages par appareil » (sortie, avatar, STT, moteur et voix par personnage), que la langue
prolonge d'une dimension.

## 3. Architecture cible

### 3.1 Une langue de session, un seul point de lecture

- `sessions.locale` (`fr` par défaut, contrainte sur les codes connus), figée à la création.
  Recopiée sur chaque tour (télémétrie, PostHog) pour filtrer latences et qualité par langue.
- Résolution à l'accueil, dans cet ordre : lien `?lang=de` → invitation → réglage de la station
  → choix mémorisé → langue du navigateur → `fr`. Le sélecteur n'apparaît que si plus d'une
  langue est ouverte dans l'environnement.
- Module unique `src/services/locale/` : il produit un objet `LocaleRuntime` (code, STT, TTS,
  voix, avatar, lexique, catalogue de textes). **Invariant** : aucun module ne lit la langue
  ailleurs ; un test échoue si un `"fr"` en dur réapparaît hors de ce module.
- Statut par langue et par environnement : `fermée` → `sandbox` → `publique`. Le passage à
  `publique` est refusé tant que des textes ne sont pas validés (porte de publication).

### 3.2 Traductions en base, français de référence

Une seule table `translations` :

| Colonne | Rôle |
| --- | --- |
| `environment_id`, `locale` | Portée ; même héritage prod → sandbox que les réglages |
| `scope`, `entity_id`, `field` | `ui`, `experience`, `character`, `scripted`, `video`, `questionnaire`, `pronunciation` |
| `value` | Texte dans la langue |
| `source_text`, `source_hash` | Français traduit, pour détecter un texte **périmé** quand la source change |
| `status` | `brouillon` (LLM) → `relu` → `validé` ; `périmé` si la source a changé |
| `origin`, `reviewed_by`, dates | LLM ou humain, relecteur, horodatage |

- Le français reste la référence : textes d'interface dans un catalogue typé du code (clés
  stables, testées), contenus éditoriaux dans Notion. La base ne porte **que** EN, DE et les
  langues suivantes — pas de double source en français.
- Lecture : un seul appel au démarrage par langue, mis en cache ; RLS en lecture anonyme sur
  les seules lignes `validé` (et `relu` en sandbox). Texte manquant : français en sandbox avec
  alerte, jamais en production (la porte de publication l'empêche).
- Quand une synchro Notion change un champ français, les traductions liées passent à `périmé` :
  le jeu garde la dernière version validée, l'admin affiche la liste à revoir. Rien n'est écrit
  dans Notion.

### 3.3 Personnages : faits en français, voix dans la langue

- Restent en français (source unique) : identité, timeline, résumé de situation, sujets
  sensibles, politique relationnelle, souvenirs RAG, mémoire de session, conseil du GM.
- Adaptés par langue, en base : manière de parler et description des états de parole, phrase
  d'accueil, exemples de répliques, phrases scriptées (pause, secours, transfert), invariants
  de registre. Les **noms** des états de parole restent des identifiants français stables
  (prosodie TTS, émotions d'avatar, journal du GM en dépendent).
- Le compilateur ajoute un **contrat de langue non tronquable** : langue de sortie, registre
  (tutoiement ou équivalent), noms propres inchangés, aucun mot français. Les tournures
  « moins écrites » (hésitations, phrases cassées) vivent dans les champs traduits, pas dans
  le code : elles ne se traduisent pas, elles se réécrivent par langue.
- RAG : la question du joueur est reformulée **en français** par l'appel de reformulation déjà
  présent (pas d'appel supplémentaire), puis cherchée dans l'index français. Variante à
  mesurer : recherche directe dans la langue du joueur (Voyage est multilingue).
- Game Master : même prompt publié ; il reçoit la langue de session, cite le joueur
  **mot pour mot dans sa langue** et écrit ses conseils en français.
- Ces choix sont des hypothèses mesurées au lot M4 par le juge, avec un critère
  `native_language` (naturel, absence de calque et de mot français) et un corpus par langue.
  Si l'hybride ne suffit pas : gabarit du prompt traduit, puis en dernier recours fiches
  entièrement traduites — la table `translations` le permet sans changement de schéma.

### 3.4 Chaîne vocale et avatars par langue

`ava_locale_services` (réglage par environnement, même modèle que `ava_device_services`) :
par langue → fournisseur et modèle STT, code de langue, dictionnaire de noms propres ;
moteur TTS et voix par personnage ; fournisseur d'avatar et réglages ; repli. Priorité de
résolution : appareil × langue → langue → appareil → réglage global.

- STT : code de langue transmis par la façade `src/services/stt` (seule entrée), liste blanche
  côté Edge. Les décisions de tour restent dans `handsFreeVoice.ts`, indépendantes de la langue.
- TTS : code de langue, voix, prononciations (« Ava », « Protogyne ») et nettoyage de texte par
  langue ; cache des phrases d'accueil indexé par langue.
- Avatars : en audio envoyé par Ava (Tavus Echo, LemonSlice) la synchro labiale ne dépend pas de
  la langue ; Anam en mode texte et HeyGen dépendent de leur propre voix : à mesurer avec les
  mesures `avatar_av_sync` déjà en place, par langue.

### 3.5 Règles linguistiques du moteur

Les expressions régulières françaises sortent des services vers un **lexique par langue**
(`src/services/lexicon/{fr,en,de}.ts`, interface typée) : demande de parler à un autre
personnage, accord, refus, report, légèreté déplacée, usurpation d'identité, frontières de
phrase. Le français garde exactement son comportement (tests actuels inchangés) ; chaque langue
arrive avec son corpus de phrases, relu par le natif. Quand le lexique ne conclut pas, la preuve
du GM tranche, comme aujourd'hui.

### 3.6 Vidéos

- `video_triggers` : `subtitle_tracks` (langue → fichier VTT) et `localized_video_urls`
  (langue → adresse, pour l'introduction et le teaser). Champs saisis dans l'admin Vidéos et
  **préservés** par la synchro Notion.
- Le lecteur active la piste de la langue de session ; aucune piste en français.
- Cinématiques : inchangées. Titres et capsules (« Une vidéo arrive ») passent par `translations`.

### 3.7 Back-office

Nouvelle entrée **🧭 Expérience → Langues** (l'admin reste en français) :

1. **Langues** : statut par environnement, porte de publication, compteur validé / périmé.
2. **Services par langue** : STT, TTS, voix par personnage, avatar, repli ; ligne « Joué : … ».
3. **Traductions** : filtre par portée, statut et langue ; français à gauche, langue à droite ;
   « Générer un brouillon », « Marquer relu », « Valider » ; liste des textes périmés ; export
   et import pour un relecteur externe.
4. **Recette** : liste de contrôle par langue, dernier passage du juge, sessions de recette.

Ailleurs : filtre « Langue » dans Sessions, Questionnaires, Latences, Consommation ; la langue
dans l'export Markdown ; l'Atelier de parole prend une langue.

## 4. Lots

Chaque lot : une branche, une PR, CI complète, garde, prompt de reprise du suivant. Le français
ne change jamais de comportement : c'est le critère de non-régression de tous les lots.
L'anglais est la langue pilote en sandbox ; l'allemand suit dans le même lot dès que le
relecteur natif est disponible.

| Lot | Contenu | Dépend de | Recette humaine |
| --- | --- | --- | --- |
| **M1 — Socle** | `sessions.locale`, module `locale`, résolution (lien, navigateur, sélecteur masqué par défaut), statut par langue, onglet Langues (volet 1), télémétrie et filtre Sessions, test anti-`"fr"` en dur | — | Session `?lang=en` en sandbox : langue enregistrée, rien d'autre ne change |
| **M2 — Voix** | `ava_locale_services`, STT et TTS par langue, voix par personnage × moteur × langue, dictionnaire et prononciations par langue, Edge Functions, Atelier de parole par langue | M1 | **Écoute d'Ulrich** : voix clonée multilingue contre voix native, EN et DE ; relevé STT sur noms propres |
| **M3 — Textes** | Table `translations`, catalogue français typé, interface joueur externalisée (accueil, briefing, film, appel, fin, confidentialité, portes d'accès), éditeur Traductions, brouillons LLM, périmé, porte de publication | M1 | Parcours complet sans voix en EN et DE ; relecteur natif sur l'export |
| **M4 — Personnages** | Contrat de langue dans les trois compilateurs, champs de voix et phrases d'accueil traduits, phrases scriptées, reformulation RAG vers le français, langue transmise au GM, critère `native_language` et corpus EN/DE du juge, comparaison des variantes | M2, M3 | Dix échanges avec Max puis Emma par langue ; rapport du juge |
| **M5 — Règles du moteur** | Lexiques `fr` / `en` / `de`, passage Max→Emma, gravité, identité, découpe de phrases, parcours du questionnaire à la voix | M4 | Demander Emma, refuser, revenir, dans chaque langue |
| **M6 — Vidéos** | Pistes de sous-titres, introduction et teaser par langue, champs admin préservés par la synchro, titres et capsules | M3 | Extrait sous-titré, introduction dans la bonne langue, cinématique inchangée |
| **M7 — Avatars** | Fournisseur et réglages par langue, voix Anam et HeyGen par langue, repli vocal, mesure de synchro par langue | M2 | Synchro labiale EN et DE par fournisseur, sur ordinateur et iPad |
| **M8 — Analyse** | Questionnaire à la voix dans la langue, traduction française à côté de l'original, langue dans Notion (questionnaires), filtres et exports | M3, M4 | Un questionnaire DE lu en français dans l'admin et Notion |
| **M9 — Ouverture DE** | E2E par langue, juge par langue, supervision par langue, recette native complète, passage `sandbox` → `publique` | M1–M8 | **Recette native** ; publication production sur autorisation distincte |
| **M10 — Ouverture EN** | Même recette pour l'anglais | M9 | Recette native EN |
| **M11 — Espagnol** | Preuve d'extension : une langue ajoutée sans migration ni code hors lexique | M10 | — |

Chemin critique pour Soleure : M1 → M2 → M3 → M4 → M5 → M9, avec M6, M7 et M8 en parallèle
de M4–M5 une fois M3 livré. M2 vient tôt parce que ses écoutes décident des voix, et que les
enregistrements éventuels de comédiens ont le délai le plus long.

Migrations : `sessions.locale` (M1), `translations` (M3), colonnes de `video_triggers` (M6) —
appliquées par le chat Lovable, comme les précédentes.

## 5. Chantiers à venir déjà pris en compte

Lecture des 47 tâches ouvertes de la base Tâches Storygami, idées comprises (12 novembre).

| Tâche | Conséquence pour l'architecture |
| --- | --- |
| Dialogues moins écrits, rumination, parole sous le choc | La rugosité vit dans les champs de voix par langue ; le lot R (bloqué) s'écrira une fois en français puis s'adaptera, sans toucher au code |
| LLM juge (J1–J3), Core de Julien | Corpus et critère par langue ; la langue est un paramètre explicite du contrat de jeu, pas un état global, pour rester portable vers le Core |
| Hors Lovable Cloud (Coolify, Supabase autogéré) | Tables et SQL standards, aucun service de traduction propre à la plateforme |
| Avatars photoréalistes (Tavus prioritaire), Ava et Léo | Réglages par personnage × langue, sans liste de personnages en dur |
| Raccrochage par le GM, rappel sortant par Max | Dernières répliques et messages passent par `translations` (`scripted`) |
| Parcours d'appel après le film à Soleure (QR, smartphone) | Un QR par langue (`?lang=`), sans sélecteur |
| Supervision des incidents en festival | Alertes et pannes fournisseur ventilées par langue ; repli par langue |
| Extraits « film pas vu », 50 cinématiques | Sous-titres par piste ; cinématiques sans voix |
| Tests utilisateurs, base de tests | Langue sur la session et dans les exports Notion |
| Tableau de bord post-expérience, partage d'un extrait | Textes par le catalogue ; langue portée par la session |
| Chunking RAG, contexte spatial des scènes | Travail sur la seule source française : l'hybride évite de le refaire par langue |
| Triggers narratifs du GM | Thèmes décrits au sens (déjà le cas depuis le lot 3 vidéos), pas par mots-clés français |
| Landing page, making-of, teaser de communication | Hors application ; même convention de codes de langue |

## 6. Risques et points à vérifier

- **Qualité native non garantie par construction** : la tâche demande de ne rien promettre
  avant validation par langue. Seule la recette native (M9, M10) ouvre une langue.
- Capacités par langue à vérifier sur documentation et essais réels au lot M2, pas supposées :
  modèles ElevenLabs v3/v4, Gradium, Fish, Inworld, Cartesia (émotion en anglais seulement dans
  notre code), Deepgram, AssemblyAI, Gamilab STT (activation en production à valider avec
  Nicolas Goy), voix Anam et HeyGen.
- Noms propres français prononcés et reconnus en allemand et en anglais (Léo, Protogyne, Agotha).
- Latence : la reformulation traduit en plus de reformuler ; à mesurer par langue.
- Mélange de langues dans le prompt (faits français, voix étrangère) : mots français qui
  fuient ; c'est ce que mesure le critère `native_language`.
- Dérive : une fiche modifiée dans Notion périme ses traductions ; sans relecteur disponible,
  la langue reste sur l'ancienne version.
- Triple coût de recette : chaque changement de jeu se réécoute dans trois langues.

## 7. Budget : postes à chiffrer (dossier Cinéforom)

Aucun montant n'est avancé ici ; le lot M2 fournit les mesures.

- Initial : relecteurs natifs DE et EN (interface, voix des personnages, corpus du juge),
  voix (clonage multilingue ou comédiens par langue), vidéo d'introduction et teaser par langue,
  sous-titres des extraits, recettes natives.
- Récurrent : STT, TTS et avatar par minute et par langue, appels LLM de brouillon et de
  traduction d'analyse, relecture à chaque changement éditorial, passages du juge par langue.

## 8. Questions encore ouvertes (non bloquantes pour M1)

1. Qui sont les relecteurs natifs allemand et anglais, et quand sont-ils disponibles ?
2. Allemand : tutoiement (« du ») confirmé pour le bénévole et les personnages ?
3. Titre de l'expérience par langue (« Où est Ava ? »).
4. Les comédiens du film peuvent-ils enregistrer des échantillons dans chaque langue ?
5. Qui produit les fichiers de sous-titres et les introductions par langue, pour quelle date ?
6. Stations de Soleure : une langue par iPad ou sélecteur sur chaque station ?
7. Ava et Léo entrent-ils dans le périmètre avant Soleure ?
