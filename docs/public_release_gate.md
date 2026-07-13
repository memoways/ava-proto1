# Release gate — ouverture publique AVA

Statut : **FERMÉE**
Environnement autorisé : développement et aperçu interne uniquement
Premiers tests utilisateurs externes visés : septembre 2026

## Règle

Le projet n'est pas public. Aucun lien d'aperçu ou de production ne doit être diffusé à des testeurs externes tant que cette gate n'est pas explicitement passée à `OUVERTE` après revue.

## Critères obligatoires avant ouverture

- [x] Build, typecheck, tests unitaires, test RLS et test E2E verts localement.
- [ ] Création, mise à jour, clôture et questionnaire d'une session vérifiés avec un client anonyme sur une branche Supabase isolée.
- [x] Isolation de deux identités et impossibilité de lire/modifier la session voisine prouvées dans PostgreSQL 17 isolé.
- [x] Proxys payants protégés par JWT anonyme et quotas atomiques, activés et testés sur l'environnement Lovable.
- [x] Anonymous Sign-Ins activé et vérifié sur l'environnement externe.
- [ ] CAPTCHA activé sur l'environnement externe.
- [ ] Publication Lovable repassée en privé/interne (`publish_visibility` est actuellement `public`).
- [ ] Parcours de 15 minutes validé sans désordre de tours ni croissance non bornée du contexte.
  - [x] Timer 15 minutes, clôture GM après 12 minutes minimum, contexte récent borné à 10 messages.
  - [x] Endurance automatisée : 30 × 35 tours côté orchestrateur et 35 tours dans le navigateur avec pannes injectées.
  - [ ] Session réelle déployée de 15 minutes avec fournisseurs réels et relevé p50/p95.
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

## Contrat RLS Phase 1

Le test `src/integration/sessionsRls.integration.test.ts` applique la migration Phase 1 réelle dans PostgreSQL 17 isolé et confirme :

- la clé publique seule ne peut plus créer de session ;
- une identité anonyme peut créer, relire et mettre à jour sa propre session ;
- une seconde identité ne peut ni lire ni modifier cette session ;
- les champs administratifs et les side effects liés à une session sont protégés ;
- les quotas fournisseurs sont atomiques.

Le smoke test distant du 13 juillet 2026 confirme `401` sans JWT, `201` avec identité anonyme propriétaire, isolation RLS et `429` après quota. Une lecture anonyme globale de `sessions` reste explicitement interdite.

## Contrat fluidité Phase 2

La Phase 2 borne la durée à 15 minutes, la mémoire récente à 10 messages, le RAG à 2 secondes et l'attente de la première voix à 15 secondes. Une lecture commencée va jusqu'à l'événement `ended`, avec récupération uniquement si sa position ne progresse plus pendant 15 secondes. Les travaux obsolètes sont annulés et les erreurs RAG/LLM/TTS restituent le contrôle à l'utilisateur. Les preuves et la procédure de recette sont détaillées dans [`phase2_fluidity_endurance_report.md`](phase2_fluidity_endurance_report.md).

## Procédure d'ouverture

1. Exécuter la checklist sur une branche propre et une branche Supabase dédiée.
2. Joindre les résultats au rapport de stabilisation.
3. Faire relire sécurité, confidentialité et budget fournisseur.
4. Modifier le statut uniquement après décision explicite du responsable projet.
