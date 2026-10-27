# Invitations de test — période de validité

- Formulaire : nom/pseudonyme + deux sélecteurs de date (début, fin incluse).
- Base : colonne `valid_from` (défaut now()); `expires_at` = fin de période.
- `redeem_external_test_invitation` refuse avant `valid_from` et après `expires_at`; l'accès activé dure jusqu'à `expires_at` (remplace les 4 h fixes).
- Statut « Programmée » avant le début. Période max 1 an, fin > début, validée côté serveur.
- Case « Plusieurs testeurs » (`multi_use`) : lien et mot de passe partageables, aucun verrou par navigateur; seules les dates ouvrent/ferment l'accès.

## Correctif « Plusieurs testeurs » — 27 octobre 2026

Symptôme (Ulrich, sandbox-ulrich) : invitation générée avec « Plusieurs testeurs »
coché, le mot de passe unique est refusé (« Mot de passe incorrect ou invitation
indisponible »).

Cause reproduite (banc PGlite) : `0001_external_test_invitations_multi_use` a
changé `redeem_external_test_invitation`, mais pas les règles historiques
« un navigateur par invitation » de `20260910121943_external_test_invitations.sql` :

1. la contrainte CHECK `external_test_invitations_check1` exige un
   `redeemed_by_user_id` dès que `redeemed_at` est rempli : la première saisie
   d'un mot de passe partagé lève une erreur SQL, que l'Edge Function
   `redeem-test-invitation` renvoie comme `{ ok: false }` ;
2. `external_test_access_grants.invitation_id` est UNIQUE : un second navigateur
   serait refusé de la même façon ;
3. `private.current_external_test_access()` exige `redeemed_by_user_id = auth.uid()` :
   même déverrouillé, un testeur partagé n'aurait pas pu créer de session sandbox.

Le correctif avait été identifié dans la PR brouillon #24 (11 octobre) sans être
fusionné ni appliqué. Il est porté dans
`drizzle/migrations/0011_external_test_invitations_shared_access.sql` (rejouable) :
CHECK remplacée par `external_test_invitations_redemption_binding_check`
(liaison obligatoire seulement hors `multi_use`), unicité de `invitation_id`
retirée (index simple), accès runtime accepté pour `multi_use`. Les invitations
mono-navigateur gardent exactement leur verrou. Texte d'aide de l'onglet admin
ajusté selon la case cochée.

Test : `src/integration/environmentsMigration.integration.test.ts` charge les
migrations Drizzle 0000/0001/0011 ; nouveau scénario rouge avant (contrainte
`check1`), vert après : refus avant `valid_from`, deux testeurs acceptés,
réglages sandbox visibles, session attribuée, révocation effective.

Livraison : la migration doit être appliquée par Lovable Cloud (aucune
connexion Supabase directe). Les invitations partagées déjà générées
redeviennent utilisables après application, sans régénération.

Prompt Lovable de finalisation et publication :
[prompt_lovable_invitations_multi_testeurs.md](prompt_lovable_invitations_multi_testeurs.md).
