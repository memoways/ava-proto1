# Release gate — ouverture publique AVA

Statut : **FERMÉE**
Environnement autorisé : développement et aperçu interne uniquement
Premiers tests utilisateurs externes visés : septembre 2026

## Règle

Le projet n'est pas public. Aucun lien d'aperçu ou de production ne doit être diffusé à des testeurs externes tant que cette gate n'est pas explicitement passée à `OUVERTE` après revue.

## Critères obligatoires avant ouverture

- [ ] Build, typecheck, tests unitaires, test RLS et test E2E verts dans une installation propre.
- [ ] Création, mise à jour, clôture et questionnaire d'une session vérifiés avec un client anonyme sur une branche Supabase isolée.
- [ ] Impossible pour une session de lire ou modifier une autre session.
- [ ] Proxys payants protégés par un jeton de session et des quotas.
- [ ] Parcours de 15 minutes validé sans désordre de tours ni croissance non bornée du contexte.
- [ ] Consentement/information micro et analytics validés.
- [ ] Headers de sécurité contrôlés sur l'URL réellement servie.
- [ ] Seuils de latence et de rollback définis et observables.

## Commandes de contrôle Phase 0

```bash
npm ci
npx tsc --noEmit
npm run build
npm test
npm run test:rls
npm run test:e2e
```

Le test E2E simule localement Gumlet, Supabase, Deepgram, le LLM et le TTS. Il ne consomme aucun quota fournisseur et ne modifie aucune donnée distante.

## Blocage RLS confirmé

Le test `src/integration/sessionsRls.integration.test.ts` reproduit les policies versionnées dans PostgreSQL 17 isolé :

- `INSERT ... RETURNING id` est rejeté sans policy `SELECT` ;
- `UPDATE sessions ... WHERE id = ...` affecte zéro ligne sans policy `SELECT`.

Ce test est une caractérisation du stop-ship, pas une acceptation du comportement. La phase 1 devra introduire une propriété de session vérifiable côté serveur ou déplacer les mutations derrière une Edge Function. Une lecture anonyme globale de `sessions` est explicitement interdite.

## Procédure d'ouverture

1. Exécuter la checklist sur une branche propre et une branche Supabase dédiée.
2. Joindre les résultats au rapport de stabilisation.
3. Faire relire sécurité, confidentialité et budget fournisseur.
4. Modifier le statut uniquement après décision explicite du responsable projet.
