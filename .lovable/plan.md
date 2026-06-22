
# Audit de la mécanique RAG ↔ champs personnage ↔ validateur

## 1. État actuel (constats, fichier par fichier)

### A. Construction du RAG (`supabase/functions/sync-notion/index.ts`)
- Pour chaque page de la base "Caractères AVA" :
  - `fetchPageContent(page.id)` récupère **uniquement le corps de la page Notion** (blocs).
  - Les champs éditoriaux (Identité, Qui tu es, Sujets sensibles…) sont extraits séparément (`extractPromptFields`) et écrits dans `character_prompts` — **ils ne sont PAS chunkés ni embedés**.
  - Un `situation_summary` (100-150 mots) est généré par LLM depuis le corps de page et stocké dans `character_prompts.situation_summary` (pas d'embedding).
  - Les chunks du corps sont insérés dans `embeddings` avec `character_id = charRow.id`.
- ✅ Conforme à ta règle : « RAG = pages Notion uniquement, pas les champs ».

### B. Cloisonnement par personnage
- La fonction SQL `match_embeddings_voyage(..., p_character_id)` filtre déjà : `character_id IS NULL OR character_id = p_character_id`.
- **MAIS** dans `conversationOrchestrator.ts` (l.133) et `getRAGContext`, l'appel `queryRAG(...)` n'envoie **jamais** `characterId`. Résultat : pendant une conversation avec Max, le RAG peut renvoyer des chunks d'Ava, Léo, Emma. 🔴 **Pollution inter-personnages avérée.**
- L'onglet "RAG Test" (Admin.tsx l.274) n'envoie pas non plus de `character_id` et n'affiche que `source_table` + similarité — pas le nom du personnage source. 🟠

### C. Bouton "Resync Notion" dans le panneau Personnage (`CharacterPromptEditorPanel.tsx`)
- Appelle `sync-notion` avec `only_notion_id`.
- Côté Edge Function, ce mode refait **tout** pour ce personnage : re-fetch page, re-chunk, re-embed (RAG), regénère `situation_summary`, et upsert des 7 champs éditoriaux.
- 🔴 Pas conforme à ta règle : tu veux que ce bouton ne refasse **que** les champs (pas le RAG).

### D. Injection dans Max (`maxAgent.ts` → `buildMaxSystemPrompt`)
Ordre actuel du system prompt :
1. `characters.system_prompt` (DB)
2. `GAMEPLAY_RULES` constants (hard-codé)
3. Sections des 7 champs Notion (`buildCharacterPromptSections`)
4. `INTERLOCUTEUR` (rôle PRD4)
5. `SOUVENIRS DE LA SESSION`
6. `HISTORIQUE RÉCENT`
7. `CONTEXTE AUTORISÉ DU TOUR` (faits/souvenirs/hypothèses/interdits) — toujours présent
8. `CONTEXTE NARRATIF` brut (seulement si pas de knowledgeContext structuré)
- ✅ Champs personnage **et** contexte RAG sont bien envoyés dans **le même** message system → l'LLM voit les deux d'un coup.
- 🔴 `GAMEPLAY_RULES` contient en dur : *« Tu poses des questions à l'interlocuteur pour jauger sa sincérité »*. Et `buildFastPreTurnBrief` ajoute `style_instructions: ["… poser une question simple"]`. C'est **pourquoi Max pose une question à chaque tour**, même si la fiche Notion dit l'inverse : la règle hard-codée contredit le champ éditorial.

### E. Validateur anti-hallucination (`conversationOrchestrator.ts` l.289-399)
- Fonctionne : appel LLM séparé (`LLM_MODEL_GM`, temp 0.1, 350 tok) après chaque réponse Max, juge JSON `{compliant, violations…}`, 1 retry si non-compliant puis fallback message générique *« Je ne peux pas l'affirmer avec certitude… »*.
- Garde-fous : fail-open sur timeout 4 s ou erreur.
- 🟠 Parasitage potentiel :
  - +1 appel LLM par tour → coût et latence (visible dans `t_validator_ms`).
  - Quand le RAG est faible, le validateur juge "non compliant" et impose un fallback plat qui rend Max insipide.
  - Aucun toggle UI pour le désactiver alors qu'il est très sensible.

## 2. Corrections proposées

### Étape 1 — Cloisonner le RAG par personnage à l'exécution
- Propager `characterId` jusqu'à `queryRAG`. Dans `processConversationTurn`, résoudre l'`characters.id` du personnage courant (paramètre `characterName`, à ajouter), le passer en `options.characterId`.
- Idem pour `getRAGContext` côté Max test.
- Dans l'onglet **RAG Test**, ajouter un sélecteur "Personnage" (ou "Tous"), passer `character_id`, et afficher pour chaque résultat le **nom du personnage source** (join `embeddings.source_id` → `characters.name`).

### Étape 2 — Découpler les deux boutons de sync
- Edge Function `sync-notion` : ajouter un flag `mode: "fields_only" | "rag_only" | "full"` (défaut `full` pour rétrocompat).
  - `fields_only` : extrait `extractPromptFields` + `situation_summary`, upsert `character_prompts`. **Aucun** `embeddings.delete` ni `insert`.
  - `rag_only` : re-fetch page, re-chunk, re-embed, écrit `characters.backstory`. **Ne touche pas** à `character_prompts`.
- Bouton "↻ Resync Notion" du panneau personnage → `mode: "fields_only"` + `only_notion_id`. Met à jour le toast en conséquence (« Champs éditoriaux resyncés »).
- Bouton global "Sync Notion" de l'onglet Contenu Notion → `mode: "rag_only"` (+ videos) par défaut, et un bouton secondaire "Sync complète" pour `mode: "full"`.

### Étape 3 — Rendre Max obéissant aux instructions Notion
- Retirer la règle « tu poses des questions » de `GAMEPLAY_RULES`. Garder uniquement les invariants techniques (1ère personne, pas de narration, oral concis, pas d'invention).
- Retirer `"poser une question simple"` du `style_instructions` par défaut de `buildFastPreTurnBrief`.
- Inverser l'ordre dans `buildMaxSystemPrompt` : injecter les **sections champs Notion AVANT** `GAMEPLAY_RULES`, et ajouter un préambule explicite :
  > « Les sections ci-dessous priment sur toutes les règles génériques. Si une instruction de personnage contredit une règle générique, suis l'instruction de personnage. »
- Ajouter une instruction dynamique : si le champ "Dynamique de la conversation" contient « ne pose pas de question » (ou flag), l'orchestrateur force `style_instructions` à exclure la consigne de question.

### Étape 4 — Rendre le validateur optionnel et moins intrusif
- Ajouter dans `admin_settings` une clé `VALIDATOR_ENABLED` (bool, défaut `false`) + `VALIDATOR_MODE` (`off | observe | enforce`).
  - `off` : skip total, zéro latence.
  - `observe` : tourne en parallèle (non bloquant), log violations dans la trace, **n'altère pas** la réponse diffusée.
  - `enforce` : comportement actuel (retry + fallback).
- Exposer le toggle dans l'onglet "🛡️ Validateur" avec explication. Par défaut passer en `observe` pour ne plus parasiter pendant qu'on stabilise la voix de Max.

### Étape 5 — Vérifications après modifications
- Re-sync Notion (mode full) une fois pour reconstruire les embeddings propres par personnage.
- Tester dans l'onglet RAG : requête générique (« Ava »), vérifier que ne sortent que les chunks de Max quand on filtre Max.
- Conversation : confirmer que Max ne pose plus systématiquement de question et qu'il respecte le champ "Dynamique" / "Ce que tu ne fais jamais".
- Vérifier l'overlay Latence : `t_validator_ms = 0` quand `VALIDATOR_MODE=off`.

## 3. Détails techniques

### Fichiers à modifier
- `supabase/functions/sync-notion/index.ts` : ajout du paramètre `mode`, branchement conditionnel autour des blocs RAG (embeddings) et fields.
- `src/components/CharacterPromptEditorPanel.tsx` : envoyer `mode: "fields_only"`.
- `src/pages/Admin.tsx` : nouveau bouton secondaire "Sync complète", défaut `rag_only`. Onglet RAG Test : sélecteur personnage + affichage nom source.
- `supabase/functions/query-rag/index.ts` : déjà OK (accepte `character_id`).
- `src/services/ragService.ts` : signature de `queryRAG`/`getRAGContext` reçoit déjà `characterId` — rien à changer.
- `src/services/conversationOrchestrator.ts` : accepter `characterName`, résoudre l'`id`, passer en `options.characterId`. Lire `VALIDATOR_MODE` et brancher `observe`/`off`.
- `src/agents/maxAgent.ts` :
  - réécrire `GAMEPLAY_RULES` (retirer la consigne de question).
  - réordonner `buildMaxSystemPrompt` (champs perso AVANT règles, avec préambule de priorité).
- `src/services/settingsService.ts` + `AntiHallucinationValidatorTab.tsx` : ajouter `VALIDATOR_MODE` + toggle UI.

### Schéma data inchangé
Aucune migration SQL nécessaire : `character_id` existe déjà sur `embeddings`, `match_embeddings_voyage` accepte déjà le filtre.

### Out of scope
- Pas de changement UI conversationnelle.
- Pas de migration d'URLs Notion.
- Pas de refactor du Game Master agent post-tour.
