# Plan — Setup Matt Pocock skills

## Objectif

Configurer ce dépôt pour que les skills d'ingénierie de Matt Pocock utilisent des conventions explicites et partagées.

## Décisions approuvées

- Utiliser GitHub Issues comme issue tracker du dépôt.
- Conserver les cinq labels de triage par défaut.
- Utiliser une documentation métier `single-context`.
- Déclarer cette configuration dans `CLAUDE.md`, conformément à la priorité définie par le skill lorsque `CLAUDE.md` existe.

## Mise en œuvre

- Ajouter le bloc `Agent skills` à `CLAUDE.md`.
- Documenter l'issue tracker dans `docs/agents/issue-tracker.md`.
- Documenter les labels dans `docs/agents/triage-labels.md`.
- Documenter la structure métier dans `docs/agents/domain.md`.

## Contraintes

- Aucun changement de build, de déploiement, de Supabase ou de Lovable Cloud.
- Les pull requests ne font pas partie de la surface de triage.
