# Plan — Textes en blanc pur (lisibilité)

Date : 2026-08-25

## Problème

Sur fond quasi noir, les textes secondaires (descriptions, consignes, labels
inactifs) passent par `--muted-foreground` à 50 % de luminosité, plus des
opacités Tailwind (`text-muted-foreground/80`, `text-white/60`, etc.). Le
résultat est un gris peu lisible dans le back-office **et** dans l’expérience
joueur.

## Décision

Un seul levier thème, pas un remplacement fichier par fichier :

1. Tous les tokens de texte (`--foreground`, `--muted-foreground`,
   `--card-foreground`, `--popover-foreground`, `--secondary-foreground`,
   `--sidebar-foreground`, `--subtitle-user`) passent à `0 0% 100%` (#FFFFFF).
2. Un utilitaire CSS force le blanc pur sur les classes à alpha
   (`text-muted-foreground/70`, `text-foreground/80`, `text-white/60`) et
   sur les placeholders, pour que l’opacité ne regrisaille pas le texte.
3. Les couleurs sémantiques restent (primary rouge, amber, emerald,
   destructive) — ce ne sont pas du « texte secondaire gris ».

## Hors scope

- Fond, bordures, overlays, états disabled (`disabled:opacity-50`).
- Couleurs d’alerte et de statut.
