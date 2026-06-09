# Refonte RAG & system prompts — base unique « Caractères AVA »

> Document de référence pour la session 24 (juin 2026).
> Statut : approuvé, en cours d'implémentation.
> Auteur : Lovable + Ulrich.

## 1. Objectif

Recentrer toute la mémoire narrative de l'expérience sur **une seule base Notion** :

- ✅ Base **Caractères AVA** — `30362322e59580bbb7b8dd49d516b341`
- ❌ Base Storyworld AVA — abandonnée
- ❌ Base Gameplay Steps — abandonnée
- ❌ Base Video Triggers — abandonnée (les triggers vidéo restent gérés localement)

La page Notion de chaque personnage devient la **source unique** de :

1. **Le récit du personnage** (corps de page Notion) — ce que le visiteur a pu voir dans le
   film + ce qui s'est passé depuis la fin du film jusqu'à l'expérience. Ces faits
   alimentent le **RAG**.
2. **Le cadrage éditorial** (7 propriétés Notion) — identité, posture, interdits,
   profondeur par niveau. Ces propriétés alimentent un **system prompt structuré**
   injecté à chaque tour.
3. **Une situation actuelle résumée** (générée automatiquement à partir du corps
   de page) — injectée dans le system prompt du **Game Master** pour qu'il
   connaisse la situation du personnage et puisse orchestrer.

Conséquence : **isolation stricte par personnage** dans le RAG. Aucun fait d'un
personnage ne peut fuiter vers un autre.

## 2. Mapping Notion ↔ Base de données ↔ UI

### Propriétés Notion attendues (page Caractère)

À ajouter / renommer côté Notion, en `rich_text` :

| Propriété Notion (exacte)           | Colonne DB                       | Section system prompt             |
|--------------------------------------|----------------------------------|-----------------------------------|
| `Identité fondamentale`              | `identite_fondamentale`          | `## IDENTITÉ FONDAMENTALE`        |
| `Qui tu es`                          | `qui_tu_es`                      | `## QUI TU ES`                    |
| `Ce que tu ne fais jamais`           | `ce_que_tu_ne_fais_jamais`       | `## CE QUE TU NE FAIS JAMAIS`     |
| `Ce que tu sais de l'utilisateur`    | `ce_que_tu_sais_utilisateur`     | `## CE QUE TU SAIS DE L'UTILISATEUR` |
| `Dynamique de la conversation`       | `dynamique_conversation`         | `## DYNAMIQUE DE LA CONVERSATION` |
| `Sujets sensibles`                   | `sujets_sensibles`               | `## SUJETS SENSIBLES`             |
| `Profondeur par niveau`              | `profondeur_par_niveau`          | `## PROFONDEUR PAR NIVEAU`        |

Propriétés conservées (existantes) : `Nom du caractère` (title), `Archétype narratif`,
`Genre`, `Type MBTI`, `Résumé`.

Le **corps de la page** Notion (récit complet du personnage) → embeddings RAG.

### Schéma DB

Nouvelle table créée par migration (voir §3) :

```sql
public.character_prompts(
  character_id uuid PK FK → characters.id,
  identite_fondamentale text,
  qui_tu_es text,
  ce_que_tu_ne_fais_jamais text,
  ce_que_tu_sais_utilisateur text,
  dynamique_conversation text,
  sujets_sensibles text,
  profondeur_par_niveau text,
  situation_summary text,   -- généré au sync, lecture seule côté UI
  created_at, updated_at
)
```

RLS activée. SELECT public. Mutations réservées au `service_role` (edge functions).

La table `characters` est conservée mais `system_prompt` n'est plus lu (champ
deprecated, gardé pour fallback historique).

La table `storyworld` reste en place (pas de drop) ; elle n'est plus alimentée
ni lue. Idem `gameplay_steps`, `video_triggers`.

## 3. Migration

Migration appliquée :

```sql
CREATE TABLE IF NOT EXISTS public.character_prompts (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  identite_fondamentale text NOT NULL DEFAULT '',
  qui_tu_es text NOT NULL DEFAULT '',
  ce_que_tu_ne_fais_jamais text NOT NULL DEFAULT '',
  ce_que_tu_sais_utilisateur text NOT NULL DEFAULT '',
  dynamique_conversation text NOT NULL DEFAULT '',
  sujets_sensibles text NOT NULL DEFAULT '',
  profondeur_par_niveau text NOT NULL DEFAULT '',
  situation_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ... TO authenticated;
GRANT SELECT ON public.character_prompts TO anon;
GRANT ALL ON public.character_prompts TO service_role;
ALTER TABLE public.character_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "character_prompts_read_all" FOR SELECT USING (true);
CREATE POLICY "character_prompts_service_write" FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE TRIGGER trg_character_prompts_updated_at BEFORE UPDATE ...
```

## 4. Edge function `sync-notion`

### Contrat

Requête :

```json
{
  "databases": { "characters": "30362322e59580bbb7b8dd49d516b341" },
  "wipe_all": true
}
```

- Seule clé acceptée : `databases.characters`. Les autres bases sont ignorées
  silencieusement (compat ascendante).
- `wipe_all=true` : `DELETE FROM embeddings` global **avant** la boucle (utilisé
  par le bouton « Wipe & rebuild RAG »).
- `wipe_all=false` : pour chaque personnage, on supprime uniquement
  `embeddings WHERE character_id=<id>` puis on ré-insère.

Réponse :

```json
{
  "success": true,
  "characters_synced": 1,
  "per_character": [
    {
      "name": "Max",
      "id": "uuid",
      "page_chars": 4823,
      "chunks_created": 5,
      "summary_chars": 612,
      "prompt_fields_filled": 7
    }
  ],
  "wiped_all": true,
  "total_embeddings_in_db": 5
}
```

### Étapes par page Caractère

1. `upsert(characters, { notion_id, name, backstory: pageBody, personality, branch })`
   (on n'écrit plus dans `system_prompt`).
2. Extraire les 7 propriétés `rich_text` → `upsert(character_prompts, { character_id, ... })`.
3. Générer `situation_summary` via OpenRouter (`google/gemini-2.0-flash-001`,
   temperature 0.3, max_tokens 220, prompt court factuel). Input = corps de page
   tronqué à ~6000 caractères.
4. `DELETE embeddings WHERE source_table='characters' AND character_id=<id>`.
5. `chunkText(pageBody)` → embed Voyage chaque chunk avec préfixe
   `Personnage: <name> | Partie i/N\n<chunk>` → INSERT avec
   `source_table='characters'`, `character_id=<id>` non-null.

### Garanties

- Aucun écrit dans `embeddings` sans `character_id`. La fonction
  `match_embeddings_voyage(..., p_character_id)` filtre déjà sur ce champ →
  isolation stricte.
- Le corps de page seul est embeddé (pas les propriétés éditoriales).

## 5. Services frontend

### Nouveau : `src/services/characterPromptService.ts`

```ts
export interface CharacterPrompt {
  character_id: string;
  name?: string;
  identite_fondamentale: string;
  qui_tu_es: string;
  ce_que_tu_ne_fais_jamais: string;
  ce_que_tu_sais_utilisateur: string;
  dynamique_conversation: string;
  sujets_sensibles: string;
  profondeur_par_niveau: string;
  situation_summary: string;
  updated_at?: string;
}

loadCharacterPrompt(characterId): Promise<CharacterPrompt | null>
loadCharacterPromptByName(name): Promise<CharacterPrompt | null>
saveCharacterPrompt(characterId, partial): Promise<void>
listCharactersWithPrompts(): Promise<Array<CharacterPrompt & { name }>>
clearCharacterPromptCache(characterId?)
```

Cache mémoire simple keyed par `character_id` ET `name` (pour lecture rapide
depuis `maxAgent`).

### Modifié : `src/services/ragService.ts`

```ts
export const AVA_NOTION_DATABASES = {
  characters: '30362322e59580bbb7b8dd49d516b341',
};
```

(retirer storyworld, gameplay_steps, video_triggers).

### Modifié : `src/services/settingsService.ts`

`MaxPromptControlSettings` et son tab `MaxPromptControlTab` deviennent
**deprecated**. Le code reste en place pour ne rien casser, mais Admin ne
l'expose plus dans la nav.

## 6. Agents

### `src/agents/maxAgent.ts`

`buildMaxSystemPrompt(...)` charge `character_prompts` par nom et compose :

```
<characters.backstory ou fallback>

## RÈGLES DE JEU (inchangées)
...

## IDENTITÉ FONDAMENTALE
<identite_fondamentale>

## QUI TU ES
<qui_tu_es>

## CE QUE TU NE FAIS JAMAIS
<ce_que_tu_ne_fais_jamais>

## CE QUE TU SAIS DE L'UTILISATEUR
<ce_que_tu_sais_utilisateur>

## DYNAMIQUE DE LA CONVERSATION
<dynamique_conversation>

## SUJETS SENSIBLES
<sujets_sensibles>

## PROFONDEUR PAR NIVEAU
<profondeur_par_niveau>

## INTERLOCUTEUR (PRD4 userRoleSummary, si présent)
## SOUVENIRS DE LA SESSION (résumé)
## HISTORIQUE RÉCENT DU TOUR
## CONTEXTE AUTORISÉ DU TOUR (allowed_facts / hypotheses / forbidden / blocked)
## CONTEXTE NARRATIF (RAG brut, fallback si knowledgeContext vide)
## APRÈS LA VIDÉO (si applicable)
```

Le character_id est résolu depuis le nom avant chaque appel pour pouvoir scoper
le RAG.

### `src/agents/gameMasterAgent.ts` + `gameMasterPRD4.ts`

Le system prompt GM se voit ajouter une section dynamique :

```
## SITUATION ACTUELLE DU PERSONNAGE (<name>)
<situation_summary>
```

Avant chaque évaluation, le GM exécute aussi :

```ts
const ragMatches = await queryRAG(userMessage, recentContext, 2, undefined, {
  characterId,
});
```

et injecte les 2 extraits dans le user prompt sous `## EXTRAITS NARRATIFS
PERTINENTS`.

Le caractère actif est passé en paramètre à `callGameMaster` / `planGameMasterTurn`
via un nouveau champ optionnel `characterName?: string`. Si absent (rétro-compat),
le GM fonctionne comme avant (cas test, pipeline).

## 7. UI Admin

Réorganisation `TAB_GROUPS` :

```
📊 Données        : Sessions, Questionnaires
📚 Contenu Notion : Sync Notion, Embeddings, RAG Test
🎭 Personnages    : Éditeur personnage (sélecteur Max/Ava/Léo/Emma)
🎮 Mécanique      : Game Master, Validateur, Métriques hallu., Pipeline, Test Max,
                    Latence & blocage, Latences (PostHog)
🔧 Technique      : LLM, TTS, STT, Consommation LLM, Consommation Voix
```

### Nouveau composant `CharacterEditorTab`

- Dropdown personnage (alimenté par `listCharactersWithPrompts`).
- 7 textarea (champs éditoriaux) éditables.
- 1 textarea `situation_summary` en lecture seule + bouton « Régénérer ».
- Bouton « Resync depuis Notion » (sync incrémentale pour ce personnage).
- Preview du system prompt final compilé (read-only).
- Avertissement : les modifs locales seront écrasées au prochain sync Notion.

### Onglet `Sync Notion` refait

- Bouton « ⚠️ Wipe & rebuild RAG » (envoie `wipe_all=true`)
- Bouton « Sync incrémental »
- Rapport simplifié : par personnage (chunks, longueur résumé).

### Tabs retirés

- « Max Prompt » (global) → remplacé par éditeur personnage.
- « Personnages » (éditeur brut `system_prompt`) → masqué (legacy).

## 8. Plan de test

1. Migration appliquée ✅.
2. Côté Notion : ajouter / remplir les 7 propriétés rich_text pour Max.
3. Admin → Sync Notion → « Wipe & rebuild RAG ».
4. Admin → Embeddings : vérifier que seuls des chunks `source_table='characters'`
   subsistent, tous avec `character_id` non-null.
5. Admin → Personnages → Max : vérifier que les 7 champs sont remplis et que
   `situation_summary` est non vide.
6. Lancer une session PRD4, vérifier dans la console (`?debug`) :
   - le system prompt Max contient les 7 sections nommées,
   - le GM reçoit `## SITUATION ACTUELLE DU PERSONNAGE`,
   - les requêtes RAG portent `character_id=<id Max>`.

## 9. Hors scope (prochaine mise à jour)

- Donner plus de poids au Game Master pour orchestrer les niveaux à partir
  de `Profondeur par niveau` (lecture par niveau actif), avec la possibilité
  de déclencher des vidéos entre niveaux.
- Ajout des personnages Ava, Léo, Emma (mêmes structures Notion).
