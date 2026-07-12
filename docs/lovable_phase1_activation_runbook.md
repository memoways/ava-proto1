# Déploiement Lovable sans interruption — restauration puis Phase 1

Date : 12 juillet 2026

## Objectif

Lovable reste l'unique gestionnaire du déploiement et des secrets. Aucun secret ne doit être ajouté à Git, au frontend ou à une capture. La Phase 1 est livrée désactivée par défaut : le premier déploiement restaure le parcours actuel sans imposer immédiatement la nouvelle authentification.

## A. Restaurer les fournisseurs maintenant

1. Dans Deepgram, créer une **nouvelle** clé API dotée au minimum de la permission **Member**. La route `/v1/auth/grant` utilisée pour émettre les jetons temporaires renvoie `403` avec une clé moins privilégiée.
2. Dans **Lovable > Project settings > Cloud/Secrets**, remplacer `DEEPGRAM_API_KEY` par cette nouvelle valeur. Ne pas mettre la clé dans une variable `VITE_*`.
3. Vérifier que `GAMILAB_PORTAL_ID` et `GAMILAB_API_KEY` existent toujours dans les secrets Lovable. Ne jamais copier leurs valeurs dans Git ou dans le chat.
4. Laisser `GAME_SECURITY_ENFORCED` absent ou à `false`. Laisser `VITE_GAME_SECURITY_ENABLED` absent ou à `false`.
5. Déployer le code, puis tester dans un aperçu interne : Deepgram, Gamilab, un appel LLM/RAG, chaque TTS utilisé, et trois tours complets.
6. Dans la console réseau, vérifier que Deepgram reçoit un jeton temporaire et non la clé permanente. Vérifier que les réponses de configuration STT portent `Cache-Control: no-store`.

Le SDK Gamilab actuel appelle `use_portal(portalId, token)` dans le navigateur. Le rétablissement du token est donc nécessaire à la compatibilité, mais il ne constitue pas la cible publique. Avant septembre, demander à Gamilab/Nicolas un jeton éphémère, un échange serveur ou une méthode SDK qui n'expose pas le secret portail.

## B. Préparer Phase 1 sans couper le prototype

Effectuer cette séquence sur une branche/duplication Lovable-Supabase. Si Lovable ne permet pas d'isoler la base, dupliquer le projet ou réserver une courte fenêtre contrôlée, sans testeur connecté.

1. Activer **Anonymous Sign-Ins** dans Supabase Auth géré par Lovable.
2. Appliquer uniquement la migration d'expansion `20260712165019_secure_public_game_sessions.sql`. Elle ajoute ownership et quotas tout en conservant temporairement le frontend anonyme historique.
3. Déployer le frontend avec `VITE_GAME_SECURITY_ENABLED=true`.
4. Garder `GAME_SECURITY_ENFORCED=false` et tester : création, lecture, trois tours, clôture et questionnaire dans deux navigateurs privés séparés.
5. Vérifier en base que les nouvelles sessions ont un `user_id` différent dans chaque navigateur et qu'aucun navigateur ne peut lire la session de l'autre.

À ce stade, le rollback frontend est simple : remettre `VITE_GAME_SECURITY_ENABLED=false`. Ne pas poursuivre si le smoke test échoue.

## C. Verrouiller Phase 1

1. Appliquer `20260712165020_enforce_public_game_security.sql`. Cette étape retire les policies et droits anonymes historiques.
2. Conserver `VITE_GAME_SECURITY_ENABLED=true`.
3. Définir le secret Edge `GAME_SECURITY_ENFORCED=true`, puis redéployer les Edge Functions.
4. Refaire le smoke test complet et confirmer : appel sans JWT → `401`, dépassement de quota → `429`, fournisseurs fonctionnels, isolation de deux sessions.
5. Consulter les Security/Performance Advisors et les logs Edge. Ne pas ouvrir le lien au public tant que la release gate reste fermée.

## Rollback après verrouillage

- Incident fournisseur ou garde Edge : remettre seulement `GAME_SECURITY_ENFORCED=false`, redéployer les fonctions et garder `VITE_GAME_SECURITY_ENABLED=true`. Les sessions restent privées et le parcours continue avec ses JWT.
- Ne jamais remettre le frontend à `VITE_GAME_SECURITY_ENABLED=false` après la migration de verrouillage : les écritures de session seraient refusées.
- Un retour complet au frontend historique nécessite d'abord une migration SQL explicite restaurant les anciennes policies. Cette opération doit être revue et testée ; elle n'est pas le rollback opérationnel recommandé.

## Avant les tests externes de septembre

- Repasser la publication Lovable en privé/interne tant que la gate n'est pas ouverte.
- Activer Turnstile/hCaptcha pour limiter la création automatisée d'utilisateurs anonymes.
- Remplacer le token navigateur Gamilab par un mécanisme éphémère ou serveur validé par le fournisseur.
- Exécuter le test de tenue 15 minutes, les seuils de latence et le scénario de perte/reprise réseau.
