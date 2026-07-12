# Phase 1 — Sessions publiques et protection des fournisseurs

Date : 12 juillet 2026

## Résultat

Le contrat de sécurité est implémenté et validé localement sans ajouter d'étape visible au parcours. Son activation distante est volontairement protégée par deux flags et deux migrations successives : le code peut être déployé par Lovable sans interrompre les intégrations actuelles, puis verrouillé après smoke test.

La release gate reste fermée : le projet Lovable a été retrouvé et sa base Supabase est active, mais le connecteur Supabase refuse l'accès et le connecteur Lovable exige le scope `projects:write` même pour une requête SQL de contrôle. La migration et les fonctions n'ont donc pas été déployées à distance.

Lovable signale par ailleurs l'application comme publiée avec `publish_visibility: public`. Cela contredit le statut métier « interne uniquement » et doit être corrigé ou explicitement justifié avant tout autre partage.

## Architecture retenue

- Authentification anonyme Supabase transparente, réutilisée pendant la navigation.
- RLS `sessions` fondée sur `user_id = auth.uid()` ; aucun `SELECT USING (true)`.
- Anciennes sessions sans propriétaire conservées et visibles uniquement par les admins.
- Trigger empêchant un participant de changer `user_id`, `started_at`, `name` ou `admin_note`.
- Garde JWT/quota activable avec `GAME_SECURITY_ENFORCED=true` ; la gateway reste compatible avec l'authentification anonyme Supabase.
- Quotas par utilisateur et par fournisseur dans `private.game_rate_limits`.
- Contrôle d'appartenance supplémentaire pour `summarize-session` et `sync-questionnaire`.
- Deepgram ne retourne qu'un jeton temporaire de 60 secondes. Le SDK navigateur Gamilab exige encore le token portail : ce secret reste une dette bloquante avant diffusion externe.

## Quotas initiaux

| Famille | Quota |
|---|---:|
| STT | 30 appels/minute/utilisateur |
| LLM | 60 appels/minute/utilisateur |
| TTS | 120 segments/minute/utilisateur |
| RAG | 120 appels/minute/utilisateur |
| Réécriture de requête | 60 appels/minute/utilisateur |
| Résumé de rôle | 10 appels/10 minutes/utilisateur |
| Résumé de session | 5 appels/10 minutes/utilisateur |
| Sync questionnaire Notion | 5 appels/heure/utilisateur |

Ces valeurs protègent les quotas fournisseurs tout en restant largement au-dessus du débit normal d'une conversation. Les réponses bloquées utilisent HTTP `429` et `Retry-After`.

## Validation locale

- TypeScript : OK.
- Build de production : OK.
- Vitest : 20 fichiers, 58 tests verts.
- PostgreSQL 17 isolé : clé `anon` refusée, séparation de deux utilisateurs, champs protégés, quota atomique et side effects liés au propriétaire.
- Playwright Chromium : parcours PRD4 de trois tours vert avec authentification anonyme et JWT exigé sur chaque appel Edge.
- ESLint sur les nouveaux fichiers : OK.
- Deno : garde partagée et 15 Edge Functions vérifiées statiquement.

## Déploiement sûr — ordre obligatoire

La procédure détaillée, réversible et adaptée aux secrets Lovable est dans `docs/lovable_phase1_activation_runbook.md`. Les points essentiels sont : déployer d'abord en mode compatible, appliquer la migration d'expansion, activer l'auth frontend et la tester, puis seulement appliquer la migration de verrouillage et activer la garde Edge.

## Limites restantes

- Activation distante non effectuée faute d'autorisation SQL/déploiement sur le projet Lovable/Supabase.
- Publication Lovable actuellement déclarée publique, à repasser en privé/interne.
- CAPTCHA non activé : il nécessite une site key et une secret key propres au domaine de test.
- La durée de 15 minutes et les tests de soak appartiennent à la Phase 2.
- Les tables de télémétrie et de coûts conservent des policies historiques à traiter séparément sans perturber le hot path.
