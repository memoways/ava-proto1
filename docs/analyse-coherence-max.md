# Analyse — Cohérence et intérêt de la conversation avec Max

> Document d'analyse (session 2026-07-16). **Aucune modification de code** : diagnostic des causes probables du manque de cohérence de Max, hypothèses avec avantages/inconvénients, et recommandations d'action.
> Périmètre : parcours **live PRD4** (`src/pages/IndexPRD4.tsx` + `src/services/prd4Orchestrator.ts`), le seul câblé en production (`src/App.tsx`).
>
> **Mise à jour 2026-07-17 — Phases 1 & 2 implémentées** (S1, S2, S3, unification de style, canon documentaire) : voir `docs/implementation-coherence-max.md` pour le détail quoi/pourquoi/comment et les vérifications restantes (fiche Notion notamment).

---

## 1. Résumé exécutif

La plainte — « Max confond beaucoup de choses : il oublie qu'il est le père d'Ava, qui il est, le déroulé des actions ; la temporalité ne fonctionne pas ; il pose une question à la fin de chaque réponse ; il n'a pas de *drive* propre » — se décompose en **deux familles de problèmes** :

1. **Des bugs de contexte qui font perdre la mémoire à Max** (symptôme « il se perd »). Le plus grave est avéré dans le code : depuis une migration de sécurité de juillet 2026, **le résumé de session n'est plus jamais lu en production**. Combiné à une fenêtre de conversation de 10 messages seulement, cela explique précisément pourquoi Max reste cohérent au début puis **décroche après ~5 échanges** (symptôme confirmé par l'observation terrain).

2. **Une absence d'architecture narrative** (symptôme « il n'a pas de drive, la discussion n'est pas intéressante »). Max est purement **réactif** : il n'a ni présent explicite (temps écoulé, où en est l'histoire), ni objectif propre, ni direction. Le Game Master, censé porter cette logique, est **passif en production** : il observe et note chaque tour mais **ne réinjecte rien** dans le personnage. Le GM « actif » qui piloterait Max existe dans le code mais est débranché du parcours joueur.

**Recommandation d'ensemble (détaillée au §5)** : traiter d'abord les bugs de mémoire et de temporalité (Phase 1 — sans quoi tout le reste est vain), puis **rendre le Game Master actif « en boucle légère »** en réutilisant des données déjà calculées et jetées aujourd'hui (Phase 2), enfin donner à Max un *drive* éditorial et une structure en actes (Phase 3).

---

## 2. Méthodologie et limites

- Analyse **statique** du dépôt (code, migrations SQL, docs) au commit courant, complétée par trois explorations ciblées du pipeline LLM, du Game Master et des prompts du personnage.
- **La source de vérité runtime du comportement de Max n'est pas dans le dépôt.** Le prompt vivant est chargé depuis Notion vers les tables Supabase `characters` (colonne `system_prompt`, ~4500 caractères) et `character_prompts` (champs éditoriaux). Ces contenus n'ont **pas pu être lus** depuis cet environnement : l'accès à la base est bloqué par la politique réseau du proxy (403 sur `*.supabase.co`). Les affirmations sur l'identité « père/frère » qui dépendent de Notion sont donc **à confirmer par l'équipe** — les requêtes de vérification sont fournies en annexe (§6).
- Les références sont données sous forme `fichier:ligne` pour être vérifiables.

---

## 3. Diagnostic — causes probables

Chaque cause indique : le mécanisme, les preuves, le symptôme qu'elle explique, et un **degré de certitude**.

### Cause 1 — La mémoire de session est cassée en production *(certitude : élevée — bug avéré)*

**Mécanisme.** Le résumé compressé des tours anciens (table `session_summaries`) est censé être injecté dans le prompt de Max sous le bloc `## SOUVENIRS DE LA SESSION` (`src/agents/maxAgent.ts:309-311`). Mais la migration `supabase/migrations/20260712150404_….sql:159-161` a restreint le **SELECT** sur cette table aux administrateurs :

```sql
CREATE POLICY "Admin read session_summaries"
  ON public.session_summaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

Or, en jeu, le joueur est **anonyme**, et `fetchSessionSummary` (`src/services/sessionMemoryService.ts:20-24`) lit via le client Supabase anon. La politique RLS renvoie **0 ligne sans erreur** → la fonction retourne `null` silencieusement (avalé par `.catch(() => null)`, `prd4Orchestrator.ts:93`).

**Conséquences.**
- Le bloc `## SOUVENIRS DE LA SESSION` **n'est jamais présent** dans le prompt d'un vrai joueur. Toute la mémoire au-delà de la fenêtre récente est perdue.
- Effet secondaire coûteux : `lastSummarizedTurn` vaut toujours `0` (`prd4Orchestrator.ts:210`), donc la condition `turnIndex - 0 >= 4` déclenche une **re-summarisation LLM à chaque tour** dès le tour 4, au lieu de tous les 4 tours — dépense OpenRouter inutile et répétée.

**Symptôme expliqué.** *Exactement* « cohérent au début, se perd après ~5 échanges » : voir Cause 2 pour la fenêtre courte qui prend le relais quand le résumé manque.

> Le commentaire de la migration (`:156`, « runtime creates summary at end of session ») suggère que l'auteur pensait que le résumé n'était écrit qu'en fin de session et jamais relu par tour — d'où l'oubli d'une policy de lecture runtime. Le durcissement RLS était légitime ; il manque juste une lecture cadrée (par `session_id`, ou via Edge Function service-role comme pour l'écriture — cf. `summarize-session/index.ts:49`).

### Cause 2 — Fenêtre de contexte très courte, sans filet *(certitude : élevée)*

**Mécanisme.** Seuls les **10 derniers messages** sont envoyés à Max comme historique de chat : `MAX_RECENT_CONVERSATION_MESSAGES = 10` (`src/config/experienceRuntime.ts:44`), appliqué par `selectRecentConversation` → `conversation.slice(-10)` (`src/services/conversationMemory.ts:4-10`). 10 messages ≈ **5 échanges** utilisateur/Max.

Tant que la conversation tient dans ces 5 échanges, Max « se souvient ». Au-delà, le début sort de la fenêtre — et le filet censé compenser (le résumé) est cassé (Cause 1). Le Game Master voit une fenêtre encore plus étroite : 6 messages (`gameMasterPRD4.ts:128`) voire 4 (`gameMasterLabelPRD4.ts:92`).

**Symptôme expliqué.** L'apparition des confusions **après ~5 échanges** — le seuil correspond directement à la taille de fenêtre. C'est la conjonction Cause 1 + Cause 2 qui produit l'amnésie observée.

### Cause 3 — Max n'a aucun repère temporel ni état narratif *(certitude : élevée)*

**Mécanisme.** Le prompt de Max (`buildMaxSystemPrompt`, `maxAgent.ts:283-333`) est assemblé uniquement à partir de : prompt personnage (Notion), fiche Notion, règles techniques, rôle du joueur, résumé de session (cassé), contexte RAG, garde-fous, contexte post-vidéo. Il **ne contient ni le temps écoulé, ni le numéro de tour, ni la phase de la session**. Ces informations existent — mais ne sont fournies **qu'au Game Master** (`gameMasterPRD4.ts:145`), jamais à Max.

Il n'existe par ailleurs **pas de state machine narrative**. Les « phases » (`useExperienceState.ts:19` : `welcome → teaser → … → conversation_max → …`) sont des écrans d'onboarding, pas des actes d'histoire. Le « présent » du personnage (depuis quand Ava a-t-elle disparu ? que faisait Max avant l'appel ? quelle heure est-il dans la fiction ?) repose entièrement sur le champ `timeline` de la fiche Notion, ajouté tardivement (migration `20260706182614`) précisément parce que « le passé et le présent étaient plats dans le prompt ».

**Symptôme expliqué.** « La gestion de la temporalité ne fonctionne pas », « il oublie le déroulé des actions ». Max ne peut pas raisonner sur une chronologie qu'on ne lui donne jamais, et n'a aucune notion de progression au fil de l'appel.

### Cause 4 — Le Game Master est passif : aucune boucle GM → Max *(certitude : élevée)*

**Mécanisme.** En production, le GM tourne deux fois par tour :
- un **label pass** en parallèle de Max (`gameMasterLabelPRD4.ts`), qui extrait `{themes, topics, intentions}` du dernier message ;
- un **évaluateur post-tour** en fire-and-forget (`gameMasterPRD4.ts:167`), qui produit `engagement_delta`, `confusion_detected`, `role_usage_quality`, `transition_recommended`, `next_turn_guidance`, `end_recommended`…

Mais **rien de tout cela n'est réinjecté** dans le prompt de Max au tour suivant. `prd4Orchestrator.ts:150-159` ne compose le `MaxAgentInput` qu'avec RAG, résumé (cassé), rôle joueur et contexte post-vidéo. Le champ `next_turn_guidance` est calculé puis **jeté** (il n'est relu que par l'affichage admin, `SessionsTab.tsx:486-488`).

Le GM **actif** — celui qui cadrerait vraiment Max avant qu'il réponde, avec `response_mode`, `openness_level`, `reveal_budget`, `forbidden_topics`, `blocked_assertions` — existe entièrement dans `gameMasterAgent.ts:159` (`planGameMasterTurn`) mais est **débranché du hot path live** (`CHANGELOG.md:736` : « GM pré-tour retiré du hot path live… son brief n'était pas injecté dans la génération Max »). Il ne survit que dans le banc d'essai admin.

De même, aucun **score de confiance cumulatif** n'est calculé en PRD4 : `engagement_delta` est une note ponctuelle jamais additionnée. Les sliders admin `TRUST_THRESHOLD`, `MIN_QUESTIONS_BEFORE_GATE`, `MAX_INSULT_TOLERANCE` sont persistés mais **inertes** en live.

**Symptôme expliqué.** « Rendre le GM plus actif rendrait la discussion plus intéressante et cohérente » — l'intuition est correcte : aujourd'hui le GM n'a **aucun pouvoir de recadrage** sur Max. La cohérence tour-à-tour repose entièrement sur le prompt personnage + RAG, sans chef d'orchestre.

### Cause 5 — Des couches de prompt contradictoires (identité et style) *(certitude : moyenne — dépend de la fiche Notion, à confirmer)*

**Identité « père » vs « frère ».** Le dépôt contient deux versions incompatibles :

| Source | Référence | Version |
|---|---|---|
| Vision d'origine | `STORY.md:35` | Frère — développeur, 28 ans |
| Résumé projet | `CLAUDE.md:8` | Frère — « sa sœur Ava » |
| Persona code | `src/services/settingsService.ts:586` | **Père d'Ava** |
| Faits validateur | `src/services/settingsService.ts:644` | **Père d'Ava** |
| Guide éditorial | `documents/guide_game_master_contenus_et_tests.md:183,221` | **Père** (« père inquiet ») |
| Canon Notion (cité) | `docs/plan_max_hallucinations_audit.md:43` | **Père** — 55 ans, Lausanne, avec Emma |

Le canon réel semble être **père (~55 ans, Lausanne, avec Emma)**. `CLAUDE.md:8` et l'ouverture de `STORY.md:35` sont **restés bloqués sur le pitch initial** (« frère développeur 28 ans / pandémie mondiale ») et n'ont jamais été resynchronisés.

> Nuance importante : les textes « père » de `settingsService.ts` sont en partie **vestigiaux**. Le persona de `MaxPromptControlSettings` n'est consommé que par l'onglet admin `MaxPromptControlTab.tsx`, **jamais injecté** dans `buildMaxSystemPrompt`. Les `authorizedFacts` ne servent qu'au validateur anti-hallucination, dont le mode par défaut est `off` (`settingsService.ts:643`) et que **le parcours PRD4 n'appelle même pas**. Donc, en live, la relation Max/Ava vient **exclusivement de la fiche Notion**. Si cette fiche est correcte, l'identité tient ; si elle est ambiguë ou si le RAG remonte des fragments contradictoires, Max dérive. **À vérifier en base** (§6).

**Règle sur les questions.** La directive « ne pose pas systématiquement de questions » existe bien (`maxAgent.ts:24-28`), mais elle est **contredite par au moins trois autres couches** qui valorisent les « questions de contrôle » :
- `responseStyle` : « …et les questions qui testent l'autre » (`settingsService.ts:590`) ;
- `objectives` : « tester la sincérité de l'interlocuteur » (`settingsService.ts:587`) ;
- exemple du planner GM : `style_instructions: ["…", "poser une question de contrôle"]` (`settingsService.ts:525`).

Le problème est **déjà documenté et « résolu » une fois** (`CHANGELOG.md:417` : « Max trop assistant — posait une question à chaque tour… règles hardcodées qui surchargeaient Notion »). Sa réapparition suggère que la fiche Notion elle-même contient probablement une incitation aux questions, ou que la hiérarchie de priorité (« la fiche prime ») joue contre l'intention si la fiche n'interdit pas explicitement les questions.

**Longueur incohérente.** « 1-2 phrases / 45 mots max » (`maxAgent.ts:20`) vs « 2 à 3 phrases » (`settingsService.ts:590`) — deux consignes de longueur qui coexistent.

**Symptôme expliqué.** « Il pose une question à la fin de chaque réponse », « il oublie qui il est ». Un LLM soumis à des instructions contradictoires suit celle qui est la plus saillante/répétée — ici, les questions sont valorisées plus souvent qu'interdites.

### Cause 6 — Contraintes temps réel qui dégradent le contexte silencieusement *(certitude : moyenne)*

- **Modèle Max potentiellement rétrogradé à l'insu de l'admin** : `SLOW_LIVE_MODEL_FALLBACKS` (`settingsService.ts:103`) force le modèle Max live sur `gemini-2.5-flash` même si l'admin a choisi Qwen-72B, Llama-70B ou Gemini-2.5-Pro (le GM, lui, garde le modèle choisi). Le modèle réel de Max peut donc différer du modèle configuré.
- **Espace de réponse très réduit** : `max_tokens` recapé à 220 (`settingsService.ts:91`) et consigne « 45 mots max » — peu de place pour de la profondeur ou de la nuance.
- **Deadlines serrés qui abandonnent le contexte** : résumé 600 ms (`SUMMARY_FETCH_DEADLINE_MS`), RAG 2 s (`RAG_DEGRADED_MODE_DEADLINE_MS`), Max 8 s. En réseau lent, RAG et/ou résumé sont abandonnés → Max répond **sans contexte narratif ni mémoire**, voire renvoie un fallback générique (`MAX_FALLBACK_RESPONSE`, `prd4Orchestrator.ts:75`).

**Symptôme expliqué.** Variabilité de la cohérence d'une session à l'autre (« parfois ça marche, parfois non »), difficile à reproduire.

### Cause 7 — Absence de *drive* et de programme propre à Max *(certitude : moyenne — transversale)*

Aucune couche (fiche, GM, code) ne donne à Max un **agenda intérieur** : ce qu'il veut obtenir de l'appel, ses peurs, ses lignes rouges, un arc émotionnel (méfiance → test → confidence), des battements narratifs à atteindre. Le prompt le cadre en *réaction* (réponds bref, ne mens pas, ne pose pas de questions) mais ne lui donne aucune *intention*. Résultat : une conversation qui suit passivement les questions du joueur, sans tension ni direction — d'où le sentiment qu'« elle n'est pas intéressante ».

**Symptôme expliqué.** « Les caractères doivent avoir leur propre drive et programme, que là le caractère n'a pas. » C'est la cause la plus qualitative, et celle sur laquelle un GM actif + une fiche enrichie ont le plus d'effet.

---

## 4. Pistes de solutions (avantages / inconvénients)

### S1 — Réparer la mémoire de session *(traite Causes 1 et partiellement 2)*
Ajouter une politique RLS de **lecture cadrée par `session_id`** sur `session_summaries` (ou lire le résumé via une Edge Function en service-role, comme l'écriture) ; corriger en parallèle le re-résumé à chaque tour.

- **Avantages** : correctif ciblé, rapide, traite le symptôme dominant (« se perd après ~5 échanges ») ; supprime aussi un coût LLM récurrent.
- **Inconvénients** : ne crée aucun *drive* ; attention à ne pas ré-ouvrir la table trop largement (la migration de durcissement avait une raison de sécurité) — préférer un scope `session_id` ou une Edge Function.

### S2 — Donner un présent explicite à Max *(traite Cause 3)*
Injecter dans le prompt de Max le **temps écoulé**, le **numéro de tour** et un **ancrage temporel canonique** (date fictive, délai depuis la disparition d'Ava) tiré de la fiche.

- **Avantages** : déterministe, **zéro appel LLM supplémentaire**, traite directement la temporalité ; réutilise des données déjà disponibles côté orchestrateur.
- **Inconvénients** : allonge le prompt ; exige de **définir éditorialement** le « présent canonique » (aujourd'hui implicite).

### S3 — Game Master actif « en boucle légère » *(traite Causes 4 et 7)* — **recommandé**
Réinjecter au tour N+1 le `next_turn_guidance` (et un cumul léger : `topics_covered`, tendance d'engagement) **déjà produits** par l'évaluateur post-tour du tour N, sous un bloc dédié du prompt de Max.

- **Avantages** : rend le GM actif **sans aucun appel LLM ni latence supplémentaires** — la donnée existe déjà et est aujourd'hui jetée ; incrémental, réversible, faible risque.
- **Inconvénients** : la guidance a un tour de retard ; sa qualité dépend du prompt GM ; risque de « sur-pilotage » à doser (garder la guidance courte et non prescriptive sur le contenu).

### S3b — Rebrancher le planner pré-tour legacy *(alternative plus lourde à S3)*
Réactiver `planGameMasterTurn` (`gameMasterAgent.ts:159`) pour cadrer Max **avant** qu'il réponde (mode de réponse, budget de révélation, sujets interdits).

- **Avantages** : contrôle narratif maximal, **déjà entièrement codé**, réutilise le catalogue des modes de parole (`speechModes.ts`).
- **Inconvénients** : **+1 appel LLM bloquant par tour** → latence (raison exacte de son retrait), coût, complexité de la boucle temps réel. À ne considérer qu'après avoir mesuré que S3 ne suffit pas.

### S4 — Refonte éditoriale de la fiche Notion *(traite Causes 5 et 7)*
Une identité unique et sans ambiguïté ; un présent canonique ; un ***drive* explicite** (ce que Max veut de cet appel, ses peurs, ses lignes rouges) ; une règle unique et sans contradiction sur les questions ; une longueur unique.

- **Avantages** : **sans code**, éditable par l'équipe, très fort levier sur le « caractère » et le *drive* ; corrige à la racine les contradictions de style.
- **Inconvénients** : travail éditorial ; contenu **hors dépôt** (non versionné, à gouverner) ; le `situation_summary` auto-généré par LLM peut dériver de la bible écrite à la main et doit être surveillé.

### S5 — Colonne vertébrale narrative (actes / beats) *(traite Causes 3 et 7)*
Structurer la session en 3-4 actes pilotés par le temps écoulé et les labels GM ; chaque acte injecte à Max un objectif de scène.

- **Avantages** : donne direction et sens, matérialise un vrai « programme » ; rend les fins de session naturelles.
- **Inconvénients** : chantier plus conséquent ; risque de *railroading* (couloir trop rigide) ; nécessite un vrai travail de design narratif.

### S6 — Modèle plus capable pour Max *(traite Causes 5 et 6)*
Lever le fallback silencieux et tester un modèle plus fort (Claude, GPT-4o) sur la tenue du persona et le respect des consignes (notamment « pas de questions »).

- **Avantages** : meilleure obéissance aux instructions et constance d'identité ; souvent le levier le plus rapide sur la « qualité perçue ».
- **Inconvénients** : latence et coût à mesurer — le fallback vers Flash existe pour de bonnes raisons de temps réel. À traiter comme un test A/B, pas un changement aveugle.

---

## 5. Recommandation — feuille de route en 3 phases

**Principe directeur : sans mémoire ni temporalité réparées, tout Game Master actif est vain** (il piloterait un personnage amnésique). D'où l'ordre.

### Phase 1 — Réparer les fondations *(préalable, effort faible)*
- **S1** : réparer la lecture du résumé de session (RLS par `session_id` ou Edge Function service-role) + corriger le re-résumé par tour.
- **S2** : injecter présent explicite (temps écoulé, tour, ancrage temporel canonique) dans le prompt de Max.
- **Unifier les règles de style** : une seule consigne de longueur, une seule règle sur les questions ; auditer la fiche Notion pour retirer les incitations aux « questions de contrôle » (Cause 5).
- **Corriger les docs** : `CLAUDE.md:8` et l'ouverture de `STORY.md:35` pour refléter le canon réel (père, ~55 ans, Lausanne, Emma) — après confirmation en base (§6).

### Phase 2 — Rendre le Game Master actif *(effort moyen)*
- **S3** : boucler `next_turn_guidance` (+ cumul de session léger) du tour N vers le prompt de Max au tour N+1. Enrichir le contexte du GM avec un cumul de session pour une guidance cohérente dans la durée.
- Réévaluer **S3b** uniquement si S3 se révèle insuffisant (mesurer la latence avant).

### Phase 3 — Drive et direction *(effort moyen à élevé)*
- **S4** : refonte éditoriale de la fiche pour doter Max d'un agenda propre.
- **S5** : structure en actes pour donner une direction à la session.
- **S6** : test A/B d'un modèle plus capable une fois les fondations et le GM en place.

---

## 6. Annexe — vérifications à effectuer par l'équipe

L'accès direct à la base étant bloqué depuis l'environnement d'analyse, ces contrôles restent à faire côté équipe (SQL admin ou onglets admin).

**A. Confirmer que la lecture du résumé est bien cassée pour l'anon.**
```sql
-- Lister les policies de SELECT sur session_summaries
select policyname, roles, cmd, qual
from pg_policies
where tablename = 'session_summaries' and cmd = 'SELECT';
-- Attendu (bug) : une seule policy admin-only, aucune lecture anon/session_id.
```
Vérifier aussi en console navigateur pendant une partie : absence du log `[SessionMemory]` de lecture réussie, et présence répétée d'appels `summarize-session` à chaque tour au-delà du tour 4.

**B. Auditer la fiche live de Max (source de vérité runtime).**
```sql
select name, length(system_prompt) as len, left(system_prompt, 800) as head
from characters where name ilike 'Max%';

select identite_fondamentale, qui_tu_es, ce_que_tu_ne_fais_jamais,
       dynamique_conversation, timeline, situation_summary
from character_prompts
where character_id = (select id from characters where name ilike 'Max%' limit 1);
```
Points à contrôler dans ces champs :
- La relation est-elle sans ambiguïté « **père d'Ava** » ? Y a-t-il des traces résiduelles de « frère » / « 28 ans » / « pandémie » ?
- `dynamique_conversation` contient-il une **incitation aux questions** (à retirer) ?
- `timeline` / `situation_summary` définissent-ils un **présent clair** (délai depuis la disparition, où est Max, ce qu'il vient de faire) ?

**C. Échantillonner le journal GM pour objectiver la confusion.**
```sql
select turn_index, confusion_detected, engagement_delta,
       role_usage_quality, next_turn_guidance
from (
  select jsonb_array_elements(gm_post_turn_log) as e
  from sessions where gm_post_turn_log is not null
  order by created_at desc limit 20
) s, lateral (
  select (e->>'turn_index')::int as turn_index,
         (e->>'confusion_detected')::bool as confusion_detected,
         (e->>'engagement_delta')::int as engagement_delta,
         e->>'role_usage_quality' as role_usage_quality,
         e->>'next_turn_guidance' as next_turn_guidance
) x
order by turn_index;
```
Attendu si le diagnostic est bon : `confusion_detected` qui devient vrai et `engagement_delta` qui chute autour du tour 5-6, avec une `next_turn_guidance` pertinente mais **jamais appliquée** (elle n'atteint pas Max).

---

*Fin de l'analyse. Aucune correction n'a été appliquée : ce document est destiné à être relu avant décision sur les phases à engager.*
