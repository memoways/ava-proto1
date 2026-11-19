# Prompt de reprise — Courbe d'expérience du GM : cadrage (lot E)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : cadrer, sans code, une « courbe d'expérience » que le GM peut suivre : interrupteur courbe ouverte / dirigée,
directions à atteindre. Chantier E du plan [réglages GM](plan_reglages_gm_lisibles_gradues.md) (validé le 19 novembre 2026),
à lancer après le lot D (radar d'état) ou en parallèle du cadrage si Ulrich le demande.

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début
du CHANGELOG, puis le plan (« Lot E ») et la [tâche Notion des triggers narratifs](https://app.notion.com/p/2083482bf92f477aa47b66cf473fac25).

État vérifié : modes GM (lot C), priorités en curseurs (lot B) et registre unique des réglages (lot A) livrés ; le radar
d'état (lot D) est livré ou en cours (lire `docs/etat_courant.md`). La clôture d'appel à 80 % du temps et les décisions de
fin relèvent du GM (`src/agents/gameMasterPRD4.ts`, `src/services/prd4Orchestrator.ts`).

Livrable : `docs/cadrage_courbe_experience_gm.md` (document de cadrage, pas de code) :
- interrupteur courbe **ouverte** (comportement actuel) / **dirigée** ;
- **directions** à atteindre (pas des phases chronométrées), avec critères de choix de la direction courante ;
- indications à porter par les fiches personnages (Romed) : proposition seulement, la base Caractères Notion reste en
  lecture seule ;
- articulation avec le radar d'état du lot D, la clôture à 80 % et les triggers narratifs ;
- options, risques, mesure d'effet (rejeu J3 : `npm run eval:judge:sequences`, snapshots `--reference-json` /
  `--candidate-json`), lots de réalisation proposés.

Limites : aucun code, aucune migration, aucune publication production, aucun appel IA ajouté, base Caractères en lecture
seule. Tâche Notion [5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) mise à jour (tâches
uniquement).

Première action : lire la tâche Notion des triggers narratifs (Gamilab, `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) et le code
de clôture ; rédiger le cadrage ; le présenter à Ulrich avant tout lot de code.

Livraison : branche de lot, PR documentaire (pas de seconde campagne CI complète : exception « lot purement
documentaire », relire contenu, liens et diff, citer la dernière CI verte), fusion par la garde
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`.

Clôture : si le cadrage identifie des lots de code, livrer le prompt de reprise du premier dans `docs/` avec cette même
obligation ; sinon le dire explicitement.
