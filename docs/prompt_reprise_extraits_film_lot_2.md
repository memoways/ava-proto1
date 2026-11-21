# Prompt de reprise — Extraits du film « film pas vu », lot 2 (sélection, lecture, bascule du pool)

À copier dans un nouveau chat Ava. Contexte : [plan](plan_extraits_film_pas_vu.md), [tâche Notion](https://app.notion.com/p/10162322e59583bbb825816717ee18ca) (cahier des charges complet), [plan superposition](plan_cinematiques_interruption_superposition.md).

---

Objectif : faire fonctionner les extraits comme réponses vidéo du parcours « film pas vu » : sélection contextuelle, lecture parlée (son propre, sans double parole) ou silencieuse (superposée à la voix), reprise cohérente, réglages propres, et retrait des extraits du pool des cinématiques en une seule bascule. Décisions d'Ulrich déjà prises : mécanique séparée des cinématiques ; parlé/silencieux par la propriété Notion « Dialogue » ; extrait parlé utilisable seulement avec « Transcription vérifiée ».

État vérifié (21 novembre) : lot 1 livré (propriétés Notion créées et vides, `sync-notion` lit Transcription/Dialogue/Transcription vérifiée, onglet Admin › Extraits, `ExtractSettings` stockés et inactifs, `extractTranscriptStatus`). Le lot 1b (transcription IA sur demande, [prompt](prompt_reprise_extraits_film_lot_transcription_ia.md)) est conseillé avant celui-ci : il fournit les transcriptions à relire. **Avant de coder, vérifier** : migration `20261121150000_video_triggers_extract_transcription.sql` appliquée via le chat Lovable (colonnes présentes) et resynchro faite ; sinon le dire à Ulrich comme unique action. Vérifier aussi dans Notion quels extraits sont « En ligne », avec Dialogue et transcription renseignés par Romed (tâche « Exporter les extraits de scènes du film », dépendance) : sans donnée, coder et tester sur fixtures, sans présumer qu'un extrait adéquat existe.

Périmètre : voir plan, section Lot 2. Lire le cycle réel de sélection/lecture avant de coder (`experienceDirector`, `overlayVideoSelector`, `cinematicTransition`, `ConversationScreen`, GM asynchrone) : une décision tardive ou rattachée au mauvais tour, personnage ou appel n'est pas appliquée, aucune attente artificielle.

Limites : base Caractères Notion en lecture seule ; la base Vidéos AVA : seules les propriétés déjà créées, aucune saisie de contenu éditorial ; aucune production ; ne pas changer la signification des réglages des cinématiques ; Gami DigiDouble exclu ; pas de régression Anam / Tavus / LemonSlice / TTS seul.
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact ; recette humaine (personnes n'ayant pas vu le film) à signaler comme non faite.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
