# Audit — Pourquoi Max invente / esquive « Lausanne »

> Session 31 — 2026-06-22
> Déclencheur : test utilisateur. Question « Où habites-tu ? » → Max esquive (« je ne suis pas encore revenu chez moi », « je préfère ne pas en parler ») alors que le RAG Test admin remonte clairement « *Vous habitez dans un vieil appartement plein de charme à Lausanne en Suisse.* » (score 0.797).

## Constat
- **RAG Test (admin)** : la réponse est dans la base. Embedding bien tagué `character_id`.
- **Conversation live** : Max n'utilise PAS cette info et invente / esquive.
- Donc le problème est dans le pipeline **entre** la recherche RAG et le prompt envoyé au LLM.

## Causes racines (par ordre de gravité)

### 🔴 0. BUG CRITIQUE — Mismatch de nom : `"Max"` vs `"Max Lorenzo"`
La DB stocke le personnage sous le nom complet **`Max Lorenzo`** (table `characters`). L'orchestrateur appelle `simulateMaxResponse` avec `characterName: "Max"`.

Conséquences en chaîne :
- `getCharacterSystemPrompt("Max")` → `.eq("name", "Max").maybeSingle()` → `null` → `FALLBACK_SYSTEM_PROMPT` (1 ligne générique). **Les 4547 caractères de `characters.system_prompt` ne sont JAMAIS injectés.**
- `loadCharacterPromptByName("Max")` → idem `.eq("name", "Max")` → `null` → **aucune fiche Notion (champs identite_fondamentale, qui_tu_es, etc.) n'est injectée**.
- `resolveCharacterIdByName("Max")` → `.ilike("name", "Max")` (sans wildcard = exact, insensible à la casse) → `null` → `characterId = null` → `match_embeddings_voyage(p_character_id := NULL)` retombe sur **tous les personnages** (l'isolation RAG ne fait rien).

→ Max parle actuellement avec un prompt système d'**une seule ligne** + des bouts de RAG (tronqués, voir ci-dessous) provenant de **tous les personnages**. Aucune cohérence garantie.

### 🔴 1. Le `ragContext` brut n'est jamais injecté dès qu'il y a un match
`buildMaxSystemPrompt` (`maxAgent.ts:323`) :
```ts
if (ragContext && !hasStructuredKnowledge) { /* inject CONTEXTE NARRATIF */ }
```
Or `buildKnowledgeContextFromRAG` produit TOUJOURS des `allowedFacts` dès qu'il y a ≥1 match → `hasStructuredKnowledge = true` → le bloc « CONTEXTE NARRATIF — SOURCE DE VÉRITÉ » n'est **jamais** ajouté en production. Max ne voit que la version tronquée et étiquetée.

### 🔴 2. Troncature destructrice à 300 caractères
`MAX_KNOWLEDGE_ITEM_CHARS = 300`. Les chunks RAG font ~1000 chars (« Partie 2/98 »). Le mot « Lausanne » est en milieu de chunk → coupé. Dans le RAG Test admin on voit le chunk complet, on croit que l'info est là, mais le LLM ne reçoit que ~300 chars du début.

### 🔴 3. Le RAG est étiqueté « hypothèse » + interdits qui bloquent Lausanne
`buildKnowledgeContextFromRAG` :
- Tout match `similarity < 0.55` → injecté comme `[H1] Piste partielle seulement: …`
- Toujours ajouté :
  - `SUJETS INTERDITS = "Toute information absente des faits autorisés du tour"`
  - `ASSERTIONS BLOQUÉES = "Ne jamais inventer de détail concret (date, lieu, action, intention)"`

→ Même quand un fait correct est dans F1, l'instruction « ne jamais affirmer de lieu » est en parallèle. Le modèle joue safe → esquive.

### 🟠 4. `situation_summary` jamais utilisé
La sync Notion génère un résumé factuel 100-150 mots (« Max, 55 ans, vit à Lausanne avec Emma… ») stocké dans `character_prompts.situation_summary`. `buildCharacterPromptSections` ne l'inclut pas. L'info la plus dense ne remonte jamais au LLM.

### 🟡 5. Comportement de retenue dans la fiche Notion
Max a des champs Notion qui invitent à la retenue. Combiné aux causes 0-3 (aucun fait canonique injecté + interdits absolus), ça produit l'esquive systématique.

---

# Plan de correction

## Étape 1 — Réparer la résolution de nom de personnage
Fichier : `src/services/characterPromptService.ts` et `src/agents/maxAgent.ts`.

Faire en sorte que `"Max"` retrouve `"Max Lorenzo"` (et symétriquement pour Ava/Emma/Léo si besoin futur) :

1. `getCharacterSystemPrompt` : remplacer `.eq("name", name)` par une lookup en cascade :
   - exact (case-insensitive),
   - puis `ilike(`${name} %`)` (nom commence par),
   - puis `ilike(`${name}%`)`.
2. `loadCharacterPromptByName` : même cascade.
3. `resolveCharacterIdByName` : même cascade (déjà ilike mais sans wildcard → ajouter `%`).
4. Logger un warn explicite si aucun match (pour détecter ce genre de bug à l'avenir).

## Étape 2 — Toujours injecter le RAG comme SOURCE DE VÉRITÉ
Fichier : `src/agents/maxAgent.ts` (`buildMaxSystemPrompt`).

1. Supprimer la condition `!hasStructuredKnowledge` (ligne 323) : **toujours** injecter `## CONTEXTE NARRATIF — SOURCE DE VÉRITÉ` quand `ragContext` existe.
2. Réécrire le préambule : *« Les informations du CONTEXTE NARRATIF sont des faits canoniques sur ta vie. Tu peux les énoncer librement comme si tu t'en souvenais. Tu n'inventes que si la question concerne un fait absent de ce contexte. »*

## Étape 3 — Stop à la troncature destructrice et au label « hypothèse »
Fichier : `src/services/ragService.ts`.

1. `MAX_RAG_CONTEXT_CHARS` 420 → **1200**.
2. `MAX_KNOWLEDGE_ITEM_CHARS` 300 → **900**.
3. `formatRAGContext` : top-3 → **top-5**.
4. `buildKnowledgeContextFromRAG` :
   - **Supprimer la branche « hypothèses »** (similarity < 0.55).
   - Remplacer `blockedAssertions` par défaut : seulement *« ne pas inventer de personnages ou d'événements absents du contexte »* (ne plus bloquer dates/lieux/actions concrets — ils sont dans le RAG).
   - `forbiddenTopics` par défaut : vide (laisser la fiche Notion gérer).

## Étape 4 — Injecter `situation_summary` dans le prompt
Fichier : `src/services/characterPromptService.ts` (`buildCharacterPromptSections`).

Ajouter en tête : `## SITUATION ACTUELLE (canon)\n${prompt.situation_summary}` quand non vide.

## Étape 5 — Aperçu du prompt système dans l'admin
Fichier : `src/pages/Admin.tsx` (onglet RAG Test).

Ajouter sous le bouton « Chercher » un bouton **« 🔍 Aperçu prompt Max »** qui :
1. Exécute la même requête RAG.
2. Construit le prompt système EXACT qui serait envoyé au LLM pour ce message.
3. Affiche le texte complet (avec longueur en chars) dans un `<pre>` repliable.
4. Met en surbrillance la présence/absence d'un mot-clé saisi (ex. « Lausanne »).

→ Permet de diagnostiquer rapidement les régressions futures.

## Étape 6 — Vérifications
1. Recharger l'app, lancer une conversation, demander « Où habites-tu ? » → Max doit répondre « À Lausanne, dans un vieil appartement… »
2. Onglet RAG Test → Aperçu prompt Max : vérifier que `Lausanne` apparaît dans le prompt.
3. Vérifier qu'aucun chunk d'autre personnage n'apparaît (cloisonnement OK après fix étape 1).

## Fichiers modifiés
- `src/services/characterPromptService.ts` (étapes 1 & 4)
- `src/agents/maxAgent.ts` (étape 2 + fallback name lookup)
- `src/services/ragService.ts` (étape 3)
- `src/pages/Admin.tsx` (étape 5)
- `CHANGELOG.md`, `STORY.md` (entrée 0.34.0)

## Hors scope
- Pas de changement de schéma DB.
- Pas de migration.
- Pas de modification de la sync Notion.
- Pas de modification du validateur anti-hallucination (déjà `off` par défaut).
