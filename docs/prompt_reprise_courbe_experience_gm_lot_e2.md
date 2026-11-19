# Prompt de reprise — Courbe d'expérience du GM, lot E2 (réglage et consigne GM)

À copier dans un nouveau chat Ava. Option B validée par Ulrich le 19 novembre 2026 ; catalogue de directions encore
provisoire (à valider avec Romed, libellés éditables).

---

Objectif : brancher le moteur `src/services/experienceDirection.ts` (livré en E1, pur, testé, non branché) : interrupteur
courbe ouverte / dirigée dans le registre des réglages GM (lot A), section « ## DIRECTION DE L'EXPÉRIENCE » dans le prompt
GM, trace de la direction par tour dans `gm_post_turn_log`.

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début
du CHANGELOG, [cadrage](cadrage_courbe_experience_gm.md), `src/services/experienceDirection.ts`,
`src/services/characterState.ts` (`buildGmStateSection`), `src/agents/gameMasterPRD4.ts`, `src/services/prd4Orchestrator.ts`.

Périmètre : champ `experienceCurve.mode` (ouverte par défaut, anciennes configs inchangées) ; modes GM : off = ignoré,
light = direction transmise en texte seulement, full = direction + biais d'axes ; direction du tour précédent relue dans
le log (aucun nouveau stockage) ; signaux (détresse, hostilité, hors-sujet, clôture) tirés des labels et `closingSignals`
existants ; clôture à 80 % inchangée ; aucun appel IA ajouté.

Limites : aucune migration (sauf validation d'Ulrich), pas de production, base Caractères en lecture seule.

Validations : tests (mode ouverte = prompt identique à l'existant, dirigée, off/light/full), qualité locale, tests de
garde, CI `regression-gates` verte sur le HEAD exact.

Livraison : branche de lot, commit, push, PR, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, sync locale ; STORY/CHANGELOG/HANDOFF/`docs/etat_courant.md` ;
prompt de reprise de E4 (mesure J3 ouverte/dirigée) avant push, avec cette même obligation de clôture.
