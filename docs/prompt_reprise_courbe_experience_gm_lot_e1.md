# Prompt de reprise — Courbe d'expérience du GM, lot E1 (moteur de directions)

À copier dans un nouveau chat Ava. **À ne lancer qu'après validation du cadrage par Ulrich** (catalogue de directions,
option B).

---

Objectif : réaliser le lot E1 de [cadrage_courbe_experience_gm.md](cadrage_courbe_experience_gm.md) : un moteur pur et
testé qui détermine la direction courante, sans branchement dans le GM ni appel IA.

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début
du CHANGELOG, le cadrage, `src/services/characterState.ts`, `src/config/experienceRuntime.ts`.

État vérifié à rappeler : cadrage livré le 19 novembre 2026 ; lot D en code (migration `state_profile` et validation des
axes avec Romed à vérifier dans `docs/etat_courant.md`) ; clôture à 80 % inchangée.

Périmètre : `src/services/experienceDirection.ts` (types, catalogue de directions, `resolveExperienceDirection` pure :
radar, palier relationnel, signaux, fraction du temps → direction + raison) et ses tests ; aucun changement de prompt,
d'orchestrateur ni de base. Préconditions : jamais « faire peser » sans palier suffisant ; jamais « conclure » avant
80 % ; suspension en cas de détresse, hors-sujet, hostilité.

Limites : aucune migration, aucune production, aucun appel IA, base Caractères Notion en lecture seule.

Validations : qualité locale, tests unitaires, tests de garde, CI `regression-gates` verte sur le HEAD exact.

Livraison : branche de lot, commit, push, PR, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, sync locale ; mettre à jour STORY/CHANGELOG/HANDOFF et
`docs/etat_courant.md` ; écrire le prompt de reprise de E2 avant push et reprendre cette obligation de clôture.
