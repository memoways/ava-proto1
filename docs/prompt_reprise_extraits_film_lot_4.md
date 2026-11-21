# Prompt de reprise — Extraits du film « film pas vu », lot 4 (activation sandbox, écoute, recette)

À copier dans un nouveau chat Ava. Contexte : [plan](plan_extraits_film_pas_vu.md), [CHANGELOG](../CHANGELOG.md) (lot 3), [état courant](etat_courant.md).

---

Objectif : valider les extraits à l'écoute et en recette humaine avant toute activation en production. Décisions d'Ulrich acquises : mécanique séparée des cinématiques ; parlé/silencieux par « Dialogue » ; extrait parlé seulement avec « Transcription vérifiée » ; une seule bascule « Activer les extraits » (inactive par défaut).

État vérifié (21 novembre) : les 3 extraits (couteau et mauvaise conscience parlés, mort Peter silencieux) sont vérifiés par Romed et présents dans `video_triggers`. Le lot 3 a livré `npm run eval:extracts` (rejeu hors ligne, corpus `docs/eval/extraits_selection_corpus.json`) et corrigé la troncature du sélecteur (400 tokens) : rappel 100 % sur 12 cas, 0 faux positif, ~0,8 s. Jamais activé, jamais écouté, rien en production. Avant de coder : relire `video_triggers` (lecture anon) et `git log` pour voir si Romed a ajouté des extraits.

Périmètre : (1) avec Ulrich, activer la bascule dans l'admin de sandbox-ulrich seulement et jouer le parcours « film pas vu » ; mesurer en session réelle `prd4_extract_selection` (latence), `extract_*` (refus par motif), pertinence ; (2) écouter : parlé sans double parole, silencieux superposé, reprise du tour suivant, changement de personnage, interruption, média en erreur ; (3) corriger ce qui en sort, notamment le blocage de l'entrée du joueur pendant l'attente d'un extrait parlé s'il gêne ; (4) étendre le corpus du rejeu aux défaillances observées ; (5) préparer la recette avec des personnes n'ayant pas vu le film (pas Benoît) : à planifier avec Ulrich.

Limites : base Caractères Notion en lecture seule ; base Vidéos AVA : seules les propriétés existantes, aucune saisie de contenu éditorial ; aucune production ni activation en production sans autorisation d'Ulrich ; ne pas changer la signification des réglages des cinématiques ; Gami DigiDouble exclu ; pas de régression Anam / Tavus / LemonSlice / TTS seul.
Validations : lint, typecheck, `test:regression`, `test:delivery`, CI `regression-gates` verte sur le HEAD exact ; recette humaine signalée non faite tant qu'elle ne l'est pas.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
