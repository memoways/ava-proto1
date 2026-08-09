# Plan — dashboard PostHog interactif

## Objectif

Transformer l’onglet **Qualité → Latences PostHog** en outil de diagnostic lisible : filtrer les données avec des choix existants, comprendre l’évolution des latences, identifier les étapes et les tours problématiques, puis ouvrir le projet PostHog concerné.

## Périmètre

- Conserver PostHog comme source distante explicite et Supabase comme source interne séparée.
- Rester dans la chaîne Lovable / Lovable Cloud existante ; aucune configuration ou publication externe.
- Réutiliser React, shadcn/Radix, Recharts et l’Edge Function `posthog-latency-stats` déjà présents.

## Étapes

1. Remplacer les champs texte `personnage`, `modèle`, `STT`, `TTS` et `browser` par des menus déroulants alimentés par les répartitions PostHog, avec remise à zéro et application explicite.
2. Enrichir l’agrégation de l’Edge Function avec une série temporelle et les tours les plus lents, sans exposer la clé PostHog au navigateur.
3. Réorganiser la synthèse en indicateurs hiérarchisés et visualisations interactives : évolution, décomposition p50/p95, blockers, providers et actions d’expérience.
4. Ajouter un tableau de diagnostic des tours lents avec détails sélectionnables.
5. Faire pointer l’action externe vers `https://eu.posthog.com/project/137897/dashboard`.
6. Préserver la comparaison PostHog/Supabase et la décision canary existantes.
7. Vérifier les types, les tests pertinents, le build Lovable-compatible et le rendu au format desktop du screenshot.

## Critères d’acceptation

- Les cinq filtres sont des listes déroulantes fonctionnelles et accessibles au clavier.
- Les filtres actifs sont visibles et réinitialisables.
- Les p50/p95 sont comparables visuellement par étape et dans le temps.
- Les blockers, providers et actions ne sont plus présentés comme des paragraphes compacts.
- Les tours lents permettent d’identifier au minimum l’heure, le tour, la latence, le blocker, le modèle et le TTS.
- Le lien PostHog ouvre le dashboard du projet `137897` dans un nouvel onglet.
- Les états chargement, erreur et absence de données restent explicites.

## Statut d’exécution — 09/08/2026

- [x] Filtres transformés en menus déroulants alimentés par les providers observés.
- [x] Agrégation enrichie avec chronologie p50/p95 et top 25 des tours lents.
- [x] KPI, décomposition des latences, blockers, répartitions et actions visualisés.
- [x] Tableau des tours lents avec détail sélectionnable.
- [x] Lien du dashboard PostHog `137897` appliqué.
- [x] Comparaison sans fusion et canary préservés.
- [x] Build Vite, lint ciblé, 239 tests unitaires et QA visuelle validés.

Le contrôle `deno check` local n’a pas pu être exécuté car le binaire Deno n’est pas installé dans cet environnement. L’Edge Function reste conforme au style TypeScript/Deno existant et devra être compilée par la chaîne Lovable Cloud avant publication.
