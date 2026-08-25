# Plan — LLM as judge, tours isolés (lot 1)

> Statut : lot 1 implémenté — base Notion créée
> Objectif : banc d’essai texte (sans STT/TTS) dans Qualité, pour classer
> l’effet du **modèle Max**, de l’**échantillonnage** et du **RAG** sur la
> qualité d’une réponse, jugée par un LLM contre une cible Notion
> (texte d’or + grille).

## Décisions

- Unité : tours isolés (pas de mémoire entre questions). Continuité = lot 2.
- Cible : texte d’or + grille (must include / must not / ton / longueur).
- Runner : pipeline texte réel (RAG live → brief GM → Max → validateur).
- Leviers V1 : modèle Max, sampling, RAG. GM, validateur et prompt figés.
- Catalogue Max = **le même** que Technique → LLM Config (`listLlmConfigModels` /
  `OPENROUTER_MODELS`). Qualité ne tient pas de liste parallèle.
- Design : un facteur à la fois (OFAT), 3 passages par couple question × config.
- Corpus : rédigé dans Notion par l’équipe ; l’app sync et exécute.

## Architecture

- Sync Notion → `eval_items` via Edge Function `sync-eval-items` (admin).
- Orchestration du run **côté admin** (un tour après l’autre, persisté tout
  de suite) : un run OFAT ne tient pas dans une Edge Function.
- Overrides **en mémoire** uniquement — jamais `admin_settings`.
- `feature_key` `llm_as_judge` pour filtrer dans Consommation LLM.

## Base Notion

URL : [AVA LLM-as-judge — corpus Max](https://app.notion.com/p/gamilab-prov/746db7ce482d410ca45bb35f316c89a9?v=169e0f6c94324bd8870c37e656b1802a)
ID : `746db7ce482d410ca45bb35f316c89a9` (espace gamilab-prov, page Storygami Home).
Intégration AVA partagée sur la base (secret Lovable `NOTION_API_KEY`).

Colonnes : Question (title), Reponse visee, Must include, Must not, Ton
(select : retenu / ouvert / defle / factuel), Longueur max (number = phrases),
Categorie (select : factuel / piege / emotion / lore), Actif (checkbox),
Personnage (select, V1 = Max), Ordre (number), Notes juge.

L’ID est dans `AVA_NOTION_DATABASES.eval_items`. Surcharge possible dans
Qualité (`admin_settings.ava_eval_notion_database_id`).

## Hors périmètre lot 1

Session scriptée, variantes de system prompt / GM / validateur, STT/TTS,
grille cartésienne, rédaction des 15 questions par l’agent.
