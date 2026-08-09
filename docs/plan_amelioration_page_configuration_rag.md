# Plan — Amélioration de la page Configuration RAG

## Objectif

Rendre la page d’administration RAG compréhensible et sûre à utiliser à partir
des retours annotés du screenshot du 9 août 2026, sans modifier la chaîne de
livraison Lovable ni l’architecture Lovable Cloud / Supabase existante.

## Périmètre

1. Remplacer l’échantillon implicite des 200 derniers événements par des mesures
   historiques filtrables (`24 h`, `7 jours`, `30 jours`, `tout l’historique`).
2. Expliquer la source et le sens de chaque mesure, y compris l’état vide :
   l’absence de données n’est pas une valeur égale à zéro.
3. Transformer les contrôles RAG en brouillon local au composant : aucun réglage
   runtime n’est activé avant l’action explicite « Enregistrer les réglages ».
4. Expliquer les effets du reranking et de la troncature, notamment leur
   comportement quand ils sont désactivés.
5. Remplacer le choix opaque de variante Max par des cartes comparables indiquant
   l’usage, le niveau de maturité et le budget RAG de chaque variante.
6. Ajouter les tests unitaires nécessaires, vérifier lint/build/tests ciblés et
   effectuer une QA visuelle de la route d’administration.

## Contraintes et décisions

- Réutiliser `voice_turn_events`, déjà alimentée par la télémétrie live ; aucune
  nouvelle table, migration ou Edge Function.
- Conserver `legacy` comme valeur live prudente tant que la canary
  `optimized_v3` n’est pas validée selon le runbook Lovable.
- Conserver les actions de rebuild et d’activation de profil séparées de la
  sauvegarde des réglages de récupération.
- La publication reste exclusivement assurée par Lovable ; ce travail ne crée
  aucun déploiement autonome.

## Critères d’acceptation

- Changer un réglage ne modifie pas `localStorage` ni le runtime avant sauvegarde.
- Un état « modifications non enregistrées » est visible et l’action de
  sauvegarde est accessible en haut et en bas de la zone de réglages.
- Les métriques affichent la période et la source, avec un état vide explicite.
- Les options de reranking, troncature et variante Max décrivent leurs effets.
- Les tests ciblés et le build passent ; `design-qa.md` conclut `final result:
  passed` après comparaison visuelle.
