# Prompt de reprise — Extraits du film « film pas vu », lot 3 (données, activation en sandbox, recette)

À copier dans un nouveau chat Ava. Contexte : [plan](plan_extraits_film_pas_vu.md) (section Lot 2 livré), [tâche Notion](https://app.notion.com/p/10162322e59583bbb825816717ee18ca), [CHANGELOG](../CHANGELOG.md).

---

Objectif : rendre les extraits réellement utilisables et les valider avant toute activation : données Notion renseignées par Romed, activation en sandbox seulement, écoute et recette avec des personnes n'ayant pas vu le film (pas Benoît), corrections issues de la recette. Décisions d'Ulrich acquises : mécanique séparée des cinématiques ; parlé/silencieux par la propriété « Dialogue » ; extrait parlé seulement avec « Transcription vérifiée » ; une seule bascule (« Activer les extraits », inactive par défaut).

État vérifié (21 novembre) : lot 2 livré, inactif (voir plan). Migration `20261121150000` appliquée (colonnes présentes). Les 3 extraits en base (« mort Peter », « couteau », « mauvaise conscience ») ont `dialogue` NULL, transcription vide : statut `unknown`, jamais proposés. **Avant de coder** : relire dans `video_triggers` (lecture anon) quels extraits ont Dialogue et transcription renseignés par Romed (tâche « Exporter les extraits de scènes du film ») ; sans donnée, la seule action humaine est de les lui demander, et le travail se limite à ce qui n'en dépend pas.

Périmètre : (1) mesurer sur sandbox-ulrich, bascule activée dans l'admin sandbox seulement : latence de sélection (`prd4_extract_selection`), taux de sélection/refus par motif (`extract_*`), pertinence ; (2) vérifier à l'écoute : parlé sans double parole, silencieux superposé, reprise du tour suivant, changement de personnage, interruption, média en erreur ; (3) corriger ce qui sort de la recette (notamment le blocage de l'entrée du joueur pendant l'attente d'un extrait parlé, si gênant) ; (4) recette humaine à planifier avec Ulrich.

Limites : base Caractères Notion en lecture seule ; base Vidéos AVA : seules les propriétés déjà créées, aucune saisie de contenu éditorial ; aucune production ni activation en production sans autorisation d'Ulrich ; ne pas changer la signification des réglages des cinématiques ; Gami DigiDouble exclu ; pas de régression Anam / Tavus / LemonSlice / TTS seul.
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact ; recette humaine à signaler comme non faite tant qu'elle ne l'est pas.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
