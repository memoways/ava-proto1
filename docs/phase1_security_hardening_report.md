# Phase 1 — Sessions publiques et protection des fournisseurs

Date : 13 juillet 2026

## Résultat

Le contrat de sécurité est désormais activé sur l'environnement Lovable/Supabase sans ajouter d'étape visible au parcours. Le frontend sécurisé, les 17 Edge Functions, la migration d'expansion et la migration de verrouillage ont été appliqués dans l'ordre prévu. `VITE_GAME_SECURITY_ENABLED=true` et `GAME_SECURITY_ENFORCED=true` sont actifs.

Les contrôles distants confirment qu'une clé publique seule est refusée (`401`), qu'une identité anonyme peut créer une session propriétaire et que les fournisseurs principaux restent fonctionnels. La release gate publique reste néanmoins fermée : CAPTCHA, mécanisme Gamilab éphémère, soak de 15 minutes et revue de visibilité doivent encore être traités avant septembre.

Lovable indique toujours que le site est visible par « Anyone with the URL ». Cette publication technique sert aux contrôles internes ; le lien ne doit pas être diffusé à des testeurs externes tant que la release gate reste fermée.

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

## Validation locale et distante

- TypeScript : OK.
- Build de production : OK.
- Vitest : 20 fichiers, 59 tests verts.
- PostgreSQL 17 isolé : clé `anon` refusée, séparation de deux utilisateurs, champs protégés, quota atomique et side effects liés au propriétaire.
- Playwright Chromium : parcours PRD4 de trois tours vert avec authentification anonyme et JWT exigé sur chaque appel Edge.
- ESLint sur les nouveaux fichiers : OK.
- Edge : garde partagée incluse dans 17 Edge Functions redéployées sur Lovable Cloud.
- Domaine live : bundle sécurisé présent, ancien écran de dictée absent, parcours Playwright de trois tours vert.
- RLS distant : clé publique seule refusée (`401`), session authentifiée créée (`201`) avec `user_id` lié.
- Quota distant : 61 appels concurrents sur une limite de 60 donnent exactement 60 autorisations et 1 refus ; l'appel Edge suivant retourne `429` avec `Retry-After`.
- Fournisseurs réels après enforcement : Deepgram `200` avec jeton 60 s, Gamilab configuré, LLM `200`, RAG Voyage `200`, TTS ElevenLabs `200` avec audio.

## Latences de smoke test distant

| Appel minimal | Latence observée |
|---|---:|
| Configuration STT + quota | 870 ms |
| Deepgram, émission du jeton temporaire | 1 470 ms |
| LLM, réponse de 3 tokens | 1 829 ms |
| RAG Voyage, 1 résultat | 1 631 ms |
| TTS ElevenLabs, « Test. » | 1 405 ms |

Ces mesures incluent le réseau et le fournisseur. Elles valident l'absence de régression bloquante, mais ne remplacent pas les percentiles P50/P95 ni le soak de 15 minutes prévu en Phase 2.

## Déploiement sûr — ordre obligatoire

La procédure détaillée, réversible et adaptée aux secrets Lovable est dans `docs/lovable_phase1_activation_runbook.md`. Les points essentiels sont : déployer d'abord en mode compatible, appliquer la migration d'expansion, activer l'auth frontend et la tester, puis seulement appliquer la migration de verrouillage et activer la garde Edge.

## Limites restantes

- Publication Lovable actuellement déclarée publique, à repasser en privé/interne.
- CAPTCHA non activé : il nécessite une site key et une secret key propres au domaine de test.
- La durée de 15 minutes et les tests de soak appartiennent à la Phase 2.
- Les tables de télémétrie et de coûts conservent des policies historiques à traiter séparément sans perturber le hot path.
- Le scan Lovable conserve trois warnings génériques : policies anonymes d'insertion, fonction `SECURITY DEFINER` exécutable par les utilisateurs authentifiés et policy `WITH CHECK (true)`. Ils correspondent aux écritures de télémétrie et au limiteur contrôlé par `auth.uid()` ; ils doivent rester documentés et être revus avant l'ouverture, pas corrigés automatiquement.
- Les Security/Performance Advisors natifs n'ont pas pu être lus via le connecteur (`permission denied`) ; le scan Lovable a servi de contrôle de remplacement.
