# Prompt Lovable — finaliser et publier le correctif des invitations « Plusieurs testeurs »

À coller dans le chat du projet Lovable Ava (`1265958d-b74e-40f2-917d-182fe05163fc`).

---

Tu reprends le correctif des invitations de test partagées d'Ava Proto 1.
Lis d'abord `AGENTS.md`, `CLAUDE.md` et la section « Correctif « Plusieurs
testeurs » — 27 octobre 2026 » de `docs/plan_invitations_periode_validite.md`.

## Contexte vérifié (27 octobre 2026)

- Symptôme : depuis Admin → Sandbox Ulrich → Invitations, une invitation générée
  avec « Plusieurs testeurs, plusieurs navigateurs » coché refuse son mot de passe
  unique (« Mot de passe incorrect ou invitation indisponible »).
- Cause reproduite en test : la migration `0001_external_test_invitations_multi_use`
  a changé `redeem_external_test_invitation` sans lever trois règles « un navigateur
  par invitation » : CHECK `external_test_invitations_check1`, unicité de
  `external_test_access_grants.invitation_id`, et `private.current_external_test_access()`
  qui exige `redeemed_by_user_id = auth.uid()`. La première saisie lève une erreur
  SQL que l'Edge Function `redeem-test-invitation` renvoie comme `{ ok: false }`.
- Correctif : PR GitHub memoways/ava-proto1#95, branche `claude/peaceful-hamilton-1zp0aa`.
  Fichiers : `drizzle/migrations/0011_external_test_invitations_shared_access.sql`
  (+ `meta/_journal.json`, `meta/0011_snapshot.json`), test d'intégration,
  texte d'aide de `src/components/admin/TestInvitationsTab.tsx`. Aucune Edge Function,
  aucun secret, aucun réglage modifié.

## Étapes

1. **Vérifier la source.** Confirmer que la PR #95 est fusionnée dans `main` et
   que le projet Lovable est synchronisé sur ce `main` (donner le SHA). Si la PR
   n'est pas fusionnée ou si Lovable n'est pas sur ce SHA : s'arrêter et le dire,
   sans recopier le code à la main.
2. **Lire l'état de la base avant toute écriture** (lecture seule) :
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'public.external_test_invitations'::regclass AND contype = 'c';

   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'public.external_test_access_grants'::regclass AND contype = 'u';

   SELECT position('multi_use' IN pg_get_functiondef('private.current_external_test_access()'::regprocedure)) > 0
     AS runtime_accepts_multi_use;
   ```
   Si la migration 0011 est déjà appliquée (contrainte
   `external_test_invitations_redemption_binding_check` présente, plus d'unicité sur
   `invitation_id`, `runtime_accepts_multi_use = true`), passer à l'étape 4.
3. **Appliquer la migration 0011** via le mécanisme de migration de Lovable Cloud,
   avec le contenu exact du fichier `drizzle/migrations/0011_external_test_invitations_shared_access.sql`
   de `main`, sans le modifier ni y ajouter autre chose. Elle est rejouable.
   Relancer ensuite les requêtes de l'étape 2 et montrer le résultat attendu :
   - `external_test_invitations` : `external_test_invitations_redemption_binding_check`
     présente, aucune autre CHECK mentionnant `redeemed_by_user_id` ;
   - `external_test_access_grants` : aucune contrainte UNIQUE sur `invitation_id`
     (index `external_test_access_grants_invitation_id_idx` présent) ;
   - `runtime_accepts_multi_use = true`.
   Préciser si cette base est celle du site publié comme de la preview.
4. **Contrôler les invitations existantes** sans afficher `code_hash` :
   ```sql
   SELECT id, environment_id, tester_label, multi_use, valid_from, expires_at,
          redeemed_at, revoked_at
   FROM public.external_test_invitations
   WHERE multi_use
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   Les invitations partagées non encore activées doivent avoir `redeemed_at` NULL :
   elles redeviennent utilisables sans être régénérées.
5. **Faire tester par Ulrich (preview).** Lui demander une seule action : ouvrir le
   lien d'invitation partagée de sa sandbox dans une fenêtre privée, saisir le mot
   de passe, puis faire de même dans un second navigateur. Attendu : entrée dans
   l'expérience dans les deux cas, badge sandbox-ulrich. Ne jamais demander ni
   afficher le mot de passe dans le chat. Vérifier ensuite en lecture :
   ```sql
   SELECT id, environment_id, context_type, tester_label, test_invitation_id, started_at
   FROM public.sessions
   WHERE test_invitation_id IS NOT NULL
   ORDER BY started_at DESC
   LIMIT 5;
   ```
   Attendu : `environment_id = 'sandbox-ulrich'`, `context_type = 'user_test'`.
   Si le refus persiste : consulter les journaux de `redeem-test-invitation`
   (limite de 5 essais par 10 minutes et par navigateur) et rapporter l'erreur
   exacte avant toute correction.
6. **Publier.** Ulrich a demandé le 27 octobre 2026 de finaliser et déployer ce
   correctif. Après les étapes 1 à 5 vertes, publier le frontend via Lovable
   uniquement, à partir du même SHA de `main`. Vérifier que le site public
   `https://proto1.parle-a-ava.com/` sert ce déploiement (HTTP 200 et identifiant
   de déploiement) et que l'onglet Invitations affiche le nouveau texte d'aide
   quand la case est cochée.

## Invariants

- Aucune autre migration, Edge Function, secret, réglage d'environnement, prompt
  ou fiche Notion modifié. Aucun hébergement ni projet Supabase hors Lovable Cloud.
- Les invitations à un seul navigateur gardent leur verrou : un second navigateur
  reste refusé.
- Un seul agent actif : ne pas toucher la PR memoways/ava-proto1#94 (Codex) ni
  d'autres branches.
- Distinguer dans le compte rendu : GitHub, Lovable Cloud (base), preview,
  production.

## Compte rendu attendu

SHA synchronisé, résultat des requêtes avant/après migration, résultat du test
humain (sans mot de passe), ID de session(s) observée(s), identifiant du
déploiement publié et contrôle HTTP. Si une étape est bloquée, l'écrire en tête
avec l'unique action à faire par Ulrich. S'il reste un lot à faire, livrer son
prompt de reprise autonome dans `docs/prompt_reprise_<sujet>_lot_<id>.md` avec la
même obligation ; sinon, dire explicitement qu'aucun lot ne suit.
