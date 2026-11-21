# Plan — extraits du film dans le parcours « film pas vu »

Date : 2026-11-21. Tâche Notion : [Intégrer les extraits du film AVA dans le parcours « film pas vu »](https://app.notion.com/p/10162322e59583bbb825816717ee18ca) (cahier des charges dans la tâche). Décisions d'Ulrich (21 novembre) : commencer par les fondations ; parlé/silencieux par une propriété Notion « Dialogue » ; les extraits sortent du pool des cinématiques (mécanique séparée), au lot 2.

## Constat avant lot 1

- Les médias de « 🎬 Vidéos AVA » sont déjà synchronisés dans `video_triggers` avec `nature = extract | transformed` (lot de sélection 1). Les extraits y sont traités comme des cinématiques : `selectEligibleVideos` les propose avant les vidéos transformées dans le parcours `unseen` (`MIN_EXTRACTS_BEFORE_CINEMATIC`).
- Aucune transcription ni indicateur de dialogue n'existait. Le GM ne lit que `context`, `description`, `ai_description`, thèmes.

## Lot 1 (livré) — données, back-office, réglages

| Élément | Choix |
|---|---|
| Notion | « Transcription » (texte), « Dialogue » (select Parlé/Silencieux), « Transcription vérifiée » (case) |
| Supabase | `transcription`, `dialogue` (`spoken`/`silent`/NULL), `transcription_verified` (défaut faux) ; migration additive, repli de la synchro tant qu'elle n'est pas appliquée |
| Statut | `extractTranscriptStatus` : `silent`, `spoken_verified`, `spoken_unverified`, `spoken_missing`, `unknown`. Seuls `silent` et `spoken_verified` sont fiables ; `unknown` n'est jamais silencieux |
| Back-office | onglet Extraits (`VideoTriggersEditor scope="extracts"`), cinématiques sans extraits, réglages `ava_extract_settings` inactifs |

## Lot 1b — transcription IA sur demande (à faire, indépendant du lot 2, à faire en premier)

Chaîne d'édition voulue par Ulrich (21 novembre) : **ajouter la vidéo dans Notion → la labelliser (Nature, Personnages, Dialogue, thèmes) → générer depuis l'application la « Description IA » et la « Transcription »**, puis relecture humaine (« Transcription vérifiée »). Même principe que la description IA existante (`describe-video`, Gemini, écrit une seule propriété Notion et la recopie dans Supabase).

- **Périmètre strict** : uniquement les extraits (`nature = extract`) dont « Dialogue » = Parlé. Jamais un extrait silencieux, un dialogue non renseigné ni une cinématique transformée.
- **Écriture** : seulement la propriété Notion « Transcription » (puis miroir `video_triggers.transcription`). Jamais « Description », « Description IA », « Dialogue » ni « Transcription vérifiée ». Une transcription générée reste **non vérifiée** ; une transcription déjà cochée « vérifiée » n'est jamais écrasée sans réanalyse explicite (et la case est alors décochée).
- **Point technique à traiter** : la rendition d'analyse actuelle est **sans son** (`pickAnalysisVariant`, MP4 vidéo seul). La transcription exige une rendition avec piste audio (ou l'audio extrait), dans la limite de taille Gemini (`MAX_VIDEO_BYTES`) ; à défaut, échec explicite, pas de transcription inventée.
- **Contenu** : paroles réellement dites, locuteurs identifiés lorsque possible (sinon « Voix 1 »…), passages inaudibles signalés, aucune interprétation ni complétion ; aucune parole détectée → rien d'écrit, l'extrait est signalé (« aucune parole détectée »).
- **Back-office** : dans l'onglet Extraits, bouton « Transcrire » par extrait parlé et « Transcrire les extraits parlés sans transcription (N) », case « Retranscrire les transcriptions existantes non vérifiées » ; progression, erreurs par vidéo ; texte visible avec son statut ; admin seulement.
- Prompt : [prompt_reprise_extraits_film_lot_transcription_ia.md](prompt_reprise_extraits_film_lot_transcription_ia.md).

## Lot 2 — sélection, lecture, bascule du pool (à faire)

1. **Bascule atomique du pool** : retirer les extraits de `selectEligibleVideos` / du GM cinématique et de `MIN_EXTRACTS_BEFORE_CINEMATIC` **au moment** où la sélection d'extraits est active ; garder la compatibilité de ce réglage (sa signification ne change pas silencieusement : le documenter).
2. **Sélection** : appel dédié et borné (modèle de `overlayVideoSelector.ts`) : question du joueur, contexte récent, personnage, description visuelle **et** transcription distinguées (`formatVideoCandidateLine`), extraits déjà montrés, apport complémentaire identifiable (un thème commun ne suffit pas), gardes `extractTranscriptStatus` fiable + `REQUIRE_VERIFIED_TRANSCRIPT`. Décision tardive, autre tour/personnage/appel → ignorée, aucune attente artificielle.
3. **Lecture** : parlé = fin de la réplique puis extrait avec son propre son (pas de double parole) ; silencieux = superposition (machine `cinematicTransition`, branche overlay) ; reprise avec la question initiale et le contenu réellement diffusé (`watchedVideos`) ; erreur, média absent, interruption, changement de personnage → poursuite sans blocage ni fausse annonce.
4. **Réglages** : brancher `ExtractSettings` (activation, fréquence) ; ne pas modifier ceux des cinématiques.
5. **Tests** : cas du cahier des charges (procès-verbal pertinent / thème sans apport, transcription absente, déjà montré, décision tardive, chevauchement) ; recette humaine avec des personnes n'ayant pas vu le film (pas Benoît).
