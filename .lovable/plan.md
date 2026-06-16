
# Plan — Triggers vidéo synchronisés depuis Notion + déclenchement par le Game Master

## Source confirmée (Notion)
Base « 🎬 Vidéos AVA » (id `478685a5b31e45b5bc534bcf905b9124`, data source `009ca428-f888-43f4-a1ef-6c8dbefd6967`).
Propriétés réelles : `Titre de la vidéo` (title), `Contexte` (text), `Description` (text), `Priorité` (number), `Thèmes` (multi_select), `Type` (select: intro/interlude/mid_conversation), `Style de transition` (select), `URL Gumlet` (url).

## 1. Migration BDD (`video_triggers`)
- Ajouter colonnes `context text` (= Contexte Notion) et `description text`.
- `placeholder_text` devient inutilisé (gardé nullable pour ne rien casser, désaffiché dans l'UI).
- Pas d'autres changements de schéma.

## 2. Edge function `sync-notion`
- Étendre la requête : accepter `databases.videos` en plus de `databases.characters`.
- Pour chaque page de la base Vidéos AVA :
  - `upsert` dans `video_triggers` (clé `notion_id`) avec mapping :
    - `title` ← Titre de la vidéo
    - `context` ← Contexte
    - `description` ← Description
    - `priority` ← Priorité
    - `themes` ← Thèmes (array)
    - `type` ← Type
    - `transition_style` ← Style de transition
    - `video_url` ← URL Gumlet
    - `post_video_context` ← Contexte (back-compat pour le code legacy qui l'injecte dans Max)
- Rapport renvoyé : `videos_synced`, `per_video`.

## 3. Nouvelle edge function `update-notion-video`
- Inputs : `notion_id`, propriétés modifiées.
- PATCH `https://api.notion.com/v1/pages/{notion_id}` avec mapping inverse (titre, contexte, description, priorité, thèmes, type, style, url).
- Réponse : `{ ok: true, updated_at }` ou message d'erreur clair si 403 (« partagez la base avec l'intégration Notion »).
- Après succès, lance un mini re-sync de la ligne pour s'assurer que la BDD est cohérente.

## 4. Service front
- `src/services/ragService.ts` : ajouter `videos: '478685a5-b31e-45b5-bc53-4bcf905b9124'` dans `AVA_NOTION_DATABASES` et passer cet ID au sync.
- Nouveau `src/services/videoTriggerService.ts` : `listVideoTriggers()`, `updateVideoTrigger(id, patch)` qui appelle `update-notion-video` puis met à jour la ligne Supabase locale.

## 5. UI Admin

### Onglet « Contenu Notion » → nouveau sous-onglet `Vidéos`
- Liste simple (titre + chips thématiques, rien d'autre).
- Bouton « Re-sync vidéos » qui appelle `sync-notion` avec `databases.videos`.

### Onglet « Mécanique → Triggers vidéo » (`VideoTriggersEditor.tsx`)
- Supprimer le bouton « Ajouter ».
- Supprimer le bouton « Supprimer » par ligne (la source de vérité est Notion).
- Ajouter le champ éditable **Description** (textarea longue) + label « Contexte » (renommé depuis `post_video_context`).
- Renommer les champs visibles selon la nomenclature Notion : Titre, Contexte, Description, Priorité, Thèmes, Type, URL Gumlet, Style de transition.
- Supprimer `placeholder_text` et `duration_seconds` de l'UI.
- « Sauvegarder » appelle `updateVideoTrigger` → PATCH Notion → refresh ligne. Toast clair en cas d'erreur Notion.
- Wipe initial : `DELETE FROM video_triggers` au premier sync (les 3 fakes disparaissent automatiquement car remplacés par upsert sur `notion_id` ; on prévoit en plus un `DELETE WHERE notion_id IS NULL` lors de la sync vidéos pour purger les anciens exemples sans `notion_id`).

## 6. Décision du Game Master (déclenchement vidéo)

### 6a. Legacy (`gameMasterAgent.ts` + `conversationOrchestrator.ts`)
- Supprimer le dict `DEMO_TRIGGERS`.
- Charger les `video_triggers` actifs (cache 30 s) depuis Supabase ; passer au GM la liste `{id, title, themes, priority, already_triggered}`.
- Mettre à jour le prompt GM pour qu'il choisisse `trigger_video_id` parmi les vidéos disponibles uniquement si la thématique de la discussion recoupe `themes` (sinon `null`). Priorité = tie-break.
- Conserver « never trigger same video twice ».
- Le `post_video_context` (= Contexte Notion) reste injecté dans Max au tour suivant pour qu'il « ait vu » la vidéo.

### 6b. PRD4 (`gameMasterPRD4.ts` + `prd4Orchestrator.ts` + `IndexPRD4.tsx`)
- Ajouter dans la promesse post-turn GM un appel léger « video selector » (peut être combiné dans le même LLM call) qui renvoie `trigger_video_id | null` selon la même logique thématique.
- `processPRD4Turn` retourne `pendingVideoTrigger` dans `postTurnPromise`.
- Dans `IndexPRD4.tsx` :
  - Après que Max a fini de parler (TTS terminé), si `pendingVideoTrigger` est non null et non déjà joué : passer en phase `video_trigger`, monter `GumletVideoPlayer` en plein écran.
  - Activer les contrôles natifs Gumlet (play/pause/volume + skip déjà présent).
  - À la fin (`onComplete`) ou skip (`onSkip`) : injecter `context` comme system note dans l'historique pour le prochain tour de Max, puis revenir à l'écran conversation exactement dans l'état précédent (mic prêt, position d'historique inchangée).
- Aucun message n'est consommé par la vidéo : la discussion reprend au tour suivant côté utilisateur.

## 7. Documentation / mémoires
- Mettre à jour `CHANGELOG.md` + `STORY.md` (nouvelle source Notion `videos`, déclenchement vidéo PRD4).
- Mettre à jour `mem://logic/video-triggers`.

## Détails techniques
```text
Notion (Vidéos AVA)
  └─ sync-notion ──► public.video_triggers (notion_id, title, context, description,
                                            priority, themes[], type, transition_style,
                                            video_url, post_video_context=context)

Conversation tour N
  user ─► STT ─► Max ─► TTS ──┐
                              ├─► GM post-turn (parmi video_triggers non triggered,
                              │     choisit id si themes ∩ topics(discussion))
                              ▼
                       phase=video_trigger ─► GumletVideoPlayer
                              │
                              ▼ onComplete/onSkip
                       inject Contexte dans history (system note)
                              │
                              ▼
                       phase=conversation (tour N+1)
```

## Hors scope
- Pas de nouvelle table.
- Pas de modification du player Gumlet (déjà OK).
- Pas de création de vidéos depuis l'app (bouton Ajouter retiré).
- Pas d'embeddings sur la base vidéos.
