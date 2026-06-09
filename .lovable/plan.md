## Étape 0 — Documentation

Créer `docs/plan_refonte_rag_caracteres.md` : version longue et détaillée du plan ci-dessous (objectifs, schéma DB complet avec SQL, contrats edge function, mapping Notion ↔ DB ↔ UI, structure nav admin, étapes de migration des données, plan de test, hors-scope GM/niveaux). Ce document sert de référence persistante.

## Étape 1 — Migration DB

Nouvelle table `public.character_prompts` (1 ligne / personnage) :
- `character_id` uuid PK FK → `characters.id` ON DELETE CASCADE
- `identite_fondamentale text`, `qui_tu_es text`, `ce_que_tu_ne_fais_jamais text`, `ce_que_tu_sais_utilisateur text`, `dynamique_conversation text`, `sujets_sensibles text`, `profondeur_par_niveau text`
- `situation_summary text` (résumé court pour le GM, généré au sync)
- `created_at`, `updated_at` + trigger `update_updated_at_column`
- GRANT SELECT/INSERT/UPDATE/DELETE authenticated, GRANT ALL service_role
- RLS activée, policies : SELECT à tous authenticated, mutations via service_role/admin
- On laisse `characters.system_prompt` en place (deprecated, non lu)

## Étape 2 — Edge function `sync-notion` refactor

- Retirer entièrement les branches `storyworld`, `gameplay_steps`, `video_triggers` du payload accepté et de la logique
- Seule entrée : `databases.characters`
- Pour chaque page Caractères :
  1. Upsert dans `characters` (nom, archétype, page body comme backstory)
  2. Extraire les 7 nouvelles propriétés rich_text et upsert dans `character_prompts`
  3. Générer `situation_summary` via OpenRouter (`LLM_MODEL_GM` par défaut, prompt court : "résume la situation actuelle du personnage en 100-150 mots, factuel" — input = corps de page)
  4. **Wipe puis ré-insérer** les embeddings du personnage : `DELETE FROM embeddings WHERE character_id = <id>`, puis chunker uniquement le **corps de page** (pas les propriétés) avec un préfixe header, embed (Voyage), insert avec `source_table='characters'` et `character_id=<id>` non-null
- Avant la boucle, si flag `wipe_all=true` dans la requête : `DELETE FROM embeddings` global
- Réponse enrichie : nb chunks par personnage, longueur situation_summary

## Étape 3 — Service settings refactor

`src/services/settingsService.ts` :
- Marquer `MaxPromptControlSettings` deprecated (laisser le code mais non utilisé)
- Nouveau module `src/services/characterPromptService.ts` :
  - `CharacterPrompt` interface (7 champs + situation_summary + character_id/name)
  - `loadCharacterPrompt(characterId): Promise<CharacterPrompt | null>`
  - `saveCharacterPrompt(characterId, partial): Promise<void>`
  - `listCharacterPrompts(): Promise<CharacterPromptWithName[]>` (join `characters`)
  - Cache mémoire simple + `clearCharacterPromptCache(characterId?)`
- `AVA_NOTION_DATABASES` dans `ragService.ts` : ne garder que `characters`

## Étape 4 — Agents

`src/agents/maxAgent.ts` :
- `buildMaxSystemPrompt` charge `character_prompts` pour le personnage actif (par nom) et compose le prompt avec sections nommées exactement : `## IDENTITÉ FONDAMENTALE`, `## QUI TU ES`, `## CE QUE TU NE FAIS JAMAIS`, `## CE QUE TU SAIS DE L'UTILISATEUR`, `## DYNAMIQUE DE LA CONVERSATION`, `## SUJETS SENSIBLES`, `## PROFONDEUR PAR NIVEAU`
- `GAMEPLAY_RULES` conservé
- RAG `## CONTEXTE NARRATIF` injecté comme source de vérité
- Cache invalidable via `clearSystemPromptCache()`
- Tous les appels RAG forcent `characterId` non-null (vérifier call sites dans `prd4Orchestrator`, `conversationOrchestrator`, `maxTestPipeline`)

`src/agents/gameMasterAgent.ts` et `gameMasterPRD4.ts` :
- Charger `character_prompts.situation_summary` et l'injecter dans le system prompt GM (section `## SITUATION ACTUELLE DU PERSONNAGE`)
- Avant chaque évaluation : `queryRAG(userMessage, recentContext, 2, undefined, { characterId })` et injecter les 2 extraits dans le user prompt du GM (section `## EXTRAITS NARRATIFS PERTINENTS`)

## Étape 5 — Admin UI

Réorganiser `TAB_GROUPS` dans `src/pages/Admin.tsx` :
```
📊 Données        : Sessions, Questionnaires
📚 Contenu Notion : Sync Notion, Embeddings, RAG Test
🎭 Personnages    : sélecteur (Max / Ava / Léo / Emma) → onglet éditorial unique
🎮 Mécanique      : Game Master, Validateur, Métriques hallu., Pipeline, Test Max
🔧 Technique      : LLM, TTS, STT, Consommation LLM, Consommation Voix, Latence, Latences PostHog
```

Nouveau composant `src/components/CharacterEditorTab.tsx` :
- Sélecteur de personnage (dropdown alimenté par `listCharacterPrompts`)
- 7 textarea pour les champs éditoriaux + 1 textarea read-only pour `situation_summary` (avec bouton "Régénérer" qui rappelle l'edge function pour ce personnage)
- Bouton "Resync depuis Notion" (déclenche sync pour ce personnage)
- Preview du system prompt final généré (read-only)
- Pas de bouton "Sauvegarder dans Notion" — l'édition Notion reste maître ; les modifs locales sont possibles mais écrasées au prochain sync (toast d'avertissement)

Onglet `Sync Notion` :
- Bouton "Wipe & rebuild RAG (toutes les pages Caractères)" → POST `sync-notion` avec `{ wipe_all: true, databases: { characters: <id> } }`
- Bouton "Sync incrémental" → sans `wipe_all`
- Retirer les sections storyworld/gameplay/video du rapport

Supprimer / déplacer :
- `MaxPromptControlTab` → remplacé par `CharacterEditorTab` (le fichier reste dans le repo mais n'est plus utilisé ; suppression possible si plus aucune route ne le référence)
- Onglet "Personnages" actuel (édition `system_prompt` brut) → masqué (la source devient `character_prompts`)

## Étape 6 — Validation manuelle

1. Lancer la migration DB (approbation utilisateur)
2. Sync Notion incrémentale → vérifier qu'une ligne `character_prompts` existe pour Max et que les 7 champs sont remplis
3. Wipe & rebuild RAG → vérifier que `embeddings` ne contient que `source_table='characters'` avec `character_id` non-null
4. Tester une session vocale Max via `/` (PRD4) → vérifier dans la console que le system prompt contient bien les 7 nouvelles sections et que le GM reçoit la situation_summary

## Hors scope (prochaine mise à jour)

- Donner plus de poids au Game Master pour orchestrer les niveaux à partir de `Profondeur par niveau` (lecture par niveau) et déclencher des vidéos entre les niveaux.

## Prérequis utilisateur côté Notion

Ajouter / renommer dans la base **Caractères AVA** les 7 propriétés rich_text avec les noms exacts ci-dessus, et les remplir pour Max. Le corps de la page Max contient le récit (film + post-film) qui ira au RAG.
