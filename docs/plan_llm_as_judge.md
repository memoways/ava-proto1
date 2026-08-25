# Plan — LLM as judge, tours isolés (lot 1)

> Statut : en cours d’implémentation
> Objectif : banc d’essai texte (sans STT/TTS) dans Qualité, pour classer
> l’effet du **modèle Max**, de l’**échantillonnage** et du **RAG** sur la
> qualité d’une réponse, jugée par un LLM contre une cible Notion
> (texte d’or + grille).

## Décisions

- Unité : tours isolés (pas de mémoire entre questions). Continuité = lot 2.
- Cible : texte d’or + grille (must include / must not / ton / longueur).
- Runner : pipeline texte réel (RAG live → brief GM → Max → validateur).
- Leviers V1 : modèle Max, sampling, RAG. GM, validateur et prompt figés.
- Design : un facteur à la fois (OFAT), 3 passages par couple question × config.
- Corpus : rédigé dans Notion par l’équipe ; l’app sync et exécute.

## Architecture

- Sync Notion → `eval_items` via Edge Function `sync-eval-items` (admin).
- Orchestration du run **côté admin** (un tour après l’autre, persisté tout
  de suite) : un run OFAT ne tient pas dans une Edge Function.
- Overrides **en mémoire** uniquement — jamais `admin_settings`.
- `feature_key` `llm_as_judge` pour filtrer dans Consommation LLM.

## Base Notion

Colonnes : Question (title), Reponse visee, Must include, Must not, Ton
(select), Longueur max (number = phrases), Categorie (select), Actif
(checkbox), Personnage (select, V1 = Max), Ordre (number), Notes juge.

L’ID de la base se colle dans l’onglet Qualité (persisté en
`admin_settings.ava_eval_notion_database_id`) et/ou dans
`AVA_NOTION_DATABASES.eval_items`.

## Hors périmètre lot 1

Session scriptée, variantes de system prompt / GM / validateur, STT/TTS,
grille cartésienne, rédaction des 15 questions par l’agent.
