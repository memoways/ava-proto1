# Phase 0 — Stabilisation pré-public

Date : 12 juillet 2026

## Résultat

La baseline locale est de nouveau constructible et testable sans toucher à la logique narrative. Le parcours navigateur de trois tours est couvert avec des fournisseurs simulés. Le risque RLS signalé par l'audit est désormais reproduit automatiquement dans un PostgreSQL 17 isolé.

La release gate reste **fermée**, conformément au rôle de la phase 0 : produire des preuves avant le hardening de phase 1.

## Changements réalisés

- Lockfile npm resynchronisé avec les dépendances déjà déclarées `@gumlet/player.js` et `hls.js`.
- Ajout de Playwright et d'un test E2E PRD4 : accueil, teaser, posture vocale, appel Max et trois tours.
- Tous les appels externes du test E2E sont simulés ; aucune donnée distante et aucun quota payant ne sont utilisés.
- Tests unitaires STT, TTS, Gumlet et orchestrateur remis en cohérence avec le runtime actuel.
- Ajout d'un test RLS PGlite reproduisant les policies anonymes `sessions`.
- Statut « interne uniquement » et critères d'ouverture documentés.

## Preuve RLS

Le test isolé confirme le comportement documenté par Supabase : un `UPDATE` RLS exige une policy `SELECT`. Dans le modèle actuel :

- la création avec retour de l'ID échoue ;
- une mise à jour anonyme touche zéro ligne.

Aucune correction dangereuse de type `SELECT USING (true)` n'a été appliquée. Le choix d'architecture — jeton de session serveur ou mutations via Edge Function — appartient à la phase 1.

## Limite d'environnement

Le projet Supabase référencé par l'application est géré par Lovable et n'est pas visible dans les projets accessibles au connecteur Supabase de cette session. Il n'a donc pas été possible de créer une branche distante ni d'y rejouer le test sans nouvelle autorité/configuration. Le test PostgreSQL local fournit la preuve sémantique, mais ne remplace pas le smoke test sur branche exigé avant ouverture.

## Matrice de validation finale

| Contrôle | Résultat | Observation |
|---|---:|---|
| Installation reproductible (`npm ci`) | ✅ | 548 paquets installés depuis le lockfile |
| TypeScript (`npx tsc --noEmit`) | ✅ | Aucune erreur |
| Build de production (`npm run build`) | ✅ | Build généré ; bundle principal encore volumineux |
| Tests unitaires et d'intégration (`npm test`) | ✅ | 49/49 tests |
| Caractérisation RLS (`npm run test:rls`) | ✅ | 2/2 preuves du défaut actuel |
| Parcours navigateur (`npm run test:e2e`) | ✅ | 1/1 scénario, trois tours, 16 s |
| ESLint ciblé sur les fichiers touchés | ✅ | Aucune nouvelle erreur |
| ESLint global (`npm run lint`) | ❌ dette existante | 128 erreurs et 12 avertissements à résorber progressivement |
| Audit des dépendances de production | ❌ dette existante | 23 avis npm : 14 modérés, 9 élevés |

Les échecs globaux ne sont pas masqués : ils maintiennent la release gate fermée. Une mise à jour automatique massive (`npm audit fix`) ou une correction mécanique des 128 erreurs n'a pas été tentée, afin d'éviter des changements fonctionnels non maîtrisés.

## Commandes

```bash
npm run build
npx tsc --noEmit
npm test
npm run test:rls
npm run test:e2e
```
