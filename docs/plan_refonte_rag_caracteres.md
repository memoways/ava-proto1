# Refonte RAG & system prompts — base unique « Caractères AVA »

> Document de référence pour la session 24 (juin 2026).
> Statut au 11 septembre 2026 : verrouillage Emma/Max implémenté et vérifié
> localement. Publication des migrations et Edge Functions en attente de l'accès
> au projet Lovable Cloud.
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

La table `characters` est conservée mais `system_prompt` n'est plus lu par aucune
variante de prompt (champ deprecated, conservé uniquement pour diagnostic historique).

La table `storyworld` reste en place (pas de drop) ; elle n'est plus alimentée
ni lue. Idem `gameplay_steps`, `video_triggers`.

## 3. Migration initiale

Migration historique appliquée avant le verrouillage de septembre 2026 :

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
- `wipe_all=true` et `wipe_all=false` préparent d'abord le corpus complet de
  chaque personnage. Le remplacement est ensuite exécuté dans une transaction
  SQL par personnage ; aucune suppression ne précède la préparation.
- Une erreur de lecture, d'embedding ou d'écriture conserve le corpus actif
  précédent du personnage concerné.

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
4. `chunkText(pageBody)` → embed Voyage chaque chunk avec préfixe
   `Personnage: <name> | Partie i/N\n<chunk>`.
5. Appeler `replace_character_embeddings(...)` avec le corpus complet. La RPC
   insère les nouveaux chunks puis retire l'ancien corpus dans la même transaction.

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

Dans le parcours public, `character_id` n'est jamais résolu depuis un prénom. Il
provient du profil d'exécution et de son lien explicite `notion_character_id`.

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

1. Migration préparée localement ; application Lovable Cloud encore à effectuer.
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

## 10. Audit et verrouillage d'identité Emma/Max — 11 septembre 2026

Cette section remplace les décisions historiques incompatibles des sections
précédentes.

### Défauts reproduits

- `optimized_v3` injectait « Tu es Max » avec la fiche d'Emma. Le défaut était
  reproductible sans RAG.
- Les recherches RAG acceptaient un identifiant absent et les extraits sans
  propriétaire, ce qui pouvait transformer une recherche de personnage en
  recherche globale.
- Les résumés étaient indexés seulement par session, étiquetaient toutes les
  réponses « MAX » et pouvaient donc être réinjectés après un changement de
  personnage.
- Le corps de page Notion était parcouru avec des arrêts silencieux et une
  profondeur limitée ; une reconstruction pouvait supprimer l'ancien corpus
  avant d'avoir préparé le nouveau.
- La fiche publique d'Emma contient une phrase de préambule copiée : « pour que
  Max puisse toujours situer l'événement ». Son récit reste correctement écrit
  du point de vue d'Emma.

### Contexte immuable d'un tour

Le parcours public résout maintenant une seule attribution avant l'appel et la
conserve pour chaque tour :

```ts
{
  characterKey,
  displayName,
  characterId,
  notionPageId,
  environmentId,
  promptUpdatedAt,
}
```

Les six valeurs doivent être présentes et cohérentes. `characterId` vient du
`notion_character_id` du profil actif. `notionPageId` vient de la ligne
`characters` liée. `promptUpdatedAt` identifie la version exacte de la fiche
éditoriale sélectionnée pour l'environnement. Ce contexte est transmis au
prompt, au RAG, au résumé, au Game Master et aux traces. Une fiche absente,
incomplète, attribuée à l'autre personnage ou d'une autre version arrête la
génération.

Les quatre variantes `legacy`, `compact_v1`, `rich_v2` et `optimized_v3`
commencent par un invariant d'identité non tronquable. Les propriétés
`character_prompts` issues de Notion sont leur seule référence éditoriale ;
`characters.system_prompt` n'est jamais réinjecté. Les interdits de la fiche sont
réservés avant les sections facultatives, y compris lorsque la fiche dépasse les
budgets habituels.

### Isolation RAG et synchronisation

- Le client et `query-rag` refusent un `character_id` absent ou invalide.
- `match_embeddings_voyage` et `match_embeddings_scoped` exigent simultanément
  le personnage et le profil d'index actif. Elles ne renvoient que
  `source_table='characters'`, `source_id=character_id` et
  `embeddings.character_id=character_id`.
- La provenance est contrôlée côté Edge Function avant reclassement, puis côté
  client avant formatage et injection. Les traces conservent source, propriétaire,
  profil, page Notion, environnement et version de fiche.
- Les évaluations administratives résolvent séparément un contexte exact pour
  Emma ou Max avant chaque recherche.
- La synchronisation suit toute la pagination et tous les enfants Notion, sans
  limite de profondeur. Elle extrait aussi les cellules de tableaux, légendes,
  titres, équations et URL textuelles. Une erreur intermédiaire ou un bloc texte
  non lu fait échouer la synchronisation avec son identifiant au lieu de produire
  silencieusement un corpus incomplet.
- `replace_character_embeddings` remplace le corpus complet d'un personnage et
  d'un profil dans une transaction. Une erreur annule l'opération et conserve
  l'ancien corpus. Le nettoyage des fiches devenues inactives intervient seulement
  après la réussite de toutes les fiches actives.

Emma peut toujours parler de Max lorsque le fait figure dans sa propre page. Le
RAG d'Emma ne reçoit aucun chunk dont la page source appartient à Max.

### Résumés, reprise et traitements tardifs

`session_summaries` porte désormais `character_key` et utilise la clé
`(session_id, character_key)`. Les anciennes lignes où `character_key IS NULL`
restent consultables pour diagnostic mais ne sont jamais utilisées dans le
contexte vivant. Le locuteur du prompt de résumé est Emma ou Max selon le tour.

L'historique transmis au modèle est découpé selon `spokenWith`. Une réponse
historique qui revendique explicitement l'identité de l'autre personnage est
exclue à la reprise. La mémoire structurée, la guidance, l'émotion, le contexte
post-vidéo et les résultats du directeur sont cloisonnés ou remis à zéro au
changement. Le changement annule le tour et la restitution en cours ; les retours
asynchrones obsolètes sont ignorés. Les mises à jour mémoire utilisent le
personnage capturé par le tour, pas un identifiant proposé par le modèle.

### Contrôle déterministe avant diffusion

Chaque texte généré et chaque réplique d'ouverture passe dans un contrôle local
avant sous-titre, voix, avatar, Game Master et résumé. Il bloque les revendications
explicites telles que « je suis Max », « je m'appelle Max », « ici Max » ou
« en tant que Max » lorsque le personnage actif est Emma, et l'inverse pour Max.
Les citations, mentions et négations légitimes restent autorisées. Un blocage
produit immédiatement « C’est bien Emma. Reprenons. » ou son équivalent Max,
sans second appel LLM. Les dérives narratives moins explicites restent évaluées
après réponse par le directeur et apparaissent dans les traces.

### Couverture et état de livraison

Les tests ajoutés couvrent :

- Emma et Max dans les quatre variantes, avec fiche complète, absente,
  incohérente et volumineuse ;
- les deux phrases exactes des captures, sans second appel LLM ;
- les citations, négations et formes courantes de changement d'identité ;
- les extraits Emma, Max et sans propriétaire avant et après reclassement ;
- les résumés par personnage et l'exclusion des anciens résumés globaux ;
- le passage Max → Emma, la mémoire privée, les réponses tardives et la reprise ;
- la pagination, les tableaux, l'imbrication profonde, les blocs non lus et les
  erreurs intermédiaires Notion ;
- les contraintes SQL d'attribution et le remplacement transactionnel du corpus.

### État de livraison Lovable Cloud — 11 septembre 2026

Projet ciblé : `iralfqlslqndgvexixis` (Lovable Cloud, unique chaîne de livraison).

- Migration `20260911080000_lock_character_identity_and_rag.sql` **appliquée**.
  Objets vérifiés : `session_summaries.character_key`, index unique
  `session_summaries_session_character_key`, `match_embeddings_voyage`,
  `match_embeddings_scoped`, `replace_character_embeddings`,
  `get_character_runtime_readiness_for_environment`.
- Edge Functions **publiées** : `query-rag`, `summarize-session`, `sync-notion`
  (avec `_shared/notionPageContent.ts`). Les réglages `verify_jwt = false` et les
  gardes `enforceGameRequest` / `requireAdmin` sont inchangés.
- Profil RAG actif : `voyage-4-realtime` (Voyage, 1024, actif).
  Chunks actifs : Emma 8, Max 99. Tous les chunks personnage respectent
  `source_table='characters'`, `source_id = character_id`, `character_id` non nul.
- Provenance vérifiée avec et sans reranking : aucune fuite croisée.
  `query-rag` refuse un `character_id` absent ou invalide (HTTP 400).
- 36 anciens résumés `character_key IS NULL` conservés pour diagnostic ; deux
  résumés distincts (max / emma) peuvent coexister pour une même session.
- Un appel invalide à `replace_character_embeddings` échoue sans modifier le
  nombre d'extraits (244 avant et après).
- Contrôle déterministe d'identité vérifié par tests : les deux phrases
  d'inversion sont bloquées avant sous-titre, voix, avatar et mémoire, sans
  second appel LLM ; les mentions et citations légitimes de Max restent permises.

**Synchronisation Notion/RAG en attente de la correction Notion.** Le préambule
de la page Emma contient encore « pour que Max puisse toujours situer
l'événement dans le temps ». Le corpus actif est donc conservé intact et aucune
reconstruction n'a été lancée. Après correction en « pour que tu puisses toujours
situer », lancer la reconstruction complète des personnages depuis Lovable Cloud
(base `30362322e59580bbb7b8dd49d516b341`, `mode: "full"`, `wipe_all: true`).

**Readiness encore incomplète** : dans les réglages personnages (prod), les cases
« tests qualitatifs validés » (Max et Emma) et « isolation des connaissances
validée » (Emma) ne sont pas cochées, donc `ready = false` pour les deux.
