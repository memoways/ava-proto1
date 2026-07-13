# Phase 4 — confidentialité et protections pré-public

Date : 13 juillet 2026
Statut : **code prêt, activation Lovable/Supabase incomplète, release gate fermée**

## Résultat recherché

Cette phase pose les protections nécessaires avant les tests utilisateurs de septembre sans rendre le projet public et sans modifier la mécanique narrative ni la durée. `TIMEOUT_SECONDS`, édité par le slider admin, reste l'unique source de durée de session.

## Protections déjà versionnées

- le panneau d'information et de choix final est conservé derrière `VITE_PRIVACY_NOTICE_ENABLED=true` ;
- pendant les tests internes, ce flag reste absent ou à `false` : le panneau est masqué et les mesures techniques PostHog/Grain sont actives par défaut ;
- PostHog n'utilise ni cookie persistant, ni autocapture, ni replay, ni profil personne ;
- les transcriptions, réponses libres et réponses brutes sont retirées des événements PostHog ; les erreurs techniques restent disponibles après caviardage des secrets ;
- le SDK Gamilab n'est plus exécuté au chargement de la page : il est préchauffé au démarrage du teaser ;
- hCaptcha est prêt de manière conditionnelle : tant que `VITE_HCAPTCHA_SITE_KEY` est absent, le parcours actuel ne change pas ;
- `/auth` ne propose plus d'inscription admin publique ;
- une page `/confidentialite` permet de modifier le choix analytics.

## Activation Lovable/Supabase — ordre sans coupure

L'ordre est important. Ne pas activer la vérification CAPTCHA côté Supabase avant d'avoir publié le frontend qui sait envoyer sa preuve.

1. Garder le projet Lovable privé/interne.
2. Créer un site hCaptcha limité au domaine de test déployé.
3. Ajouter la **site key publique** au frontend Lovable sous `VITE_HCAPTCHA_SITE_KEY`. Cette valeur n'est pas un secret.
4. Publier ce frontend, toujours en visibilité privée/interne.
5. Vérifier que le widget apparaît et que le bouton reste bloqué avant validation.
6. Dans Supabase Auth, configurer hCaptcha avec la **secret key**, exclusivement dans la console serveur. Ne jamais créer de variable `VITE_*` contenant cette clé.
7. Activer la protection CAPTCHA d'Auth, puis tester une nouvelle session anonyme dans une fenêtre privée.
8. Dans Supabase Auth, désactiver l'inscription email publique (« Allow new users to sign up »). Créer les futurs admins par invitation contrôlée et conserver le contrôle `user_roles.role = admin`.
9. Exécuter le smoke test ci-dessous. En cas d'échec d'identité anonyme, désactiver d'abord CAPTCHA côté Auth ; le frontend conditionnel reste compatible.

## Smoke test obligatoire

- en mode interne, aucun panneau affiché et démarrage direct avec requêtes PostHog visibles ;
- `turn_latency`, `audio_latency`, `voice_turn_completed`, `voice_error` et `prd4_persistence_result` visibles dans PostHog et/ou les tables internes correspondantes ;
- pour la recette finale, activer `VITE_PRIVACY_NOTICE_ENABLED=true`, puis vérifier le blocage avant information et l'opt-in analytics séparé ;
- widget CAPTCHA exigé dans une nouvelle fenêtre privée ;
- création de session Supabase, trois tours STT → RAG → LLM → TTS, questionnaire et clôture ;
- Deepgram puis Gamilab testés séparément ; pour Gamilab, le SDK doit se charger pendant le teaser et non au premier affichage ;
- `/auth` ne permet que la connexion ; un participant anonyme n'est pas redirigé vers l'admin ;
- durée modifiée dans le slider admin puis reflétée dans le compteur, sans valeur fixe dans le frontend.

## Rétention : préparation avant test externe

La page d'information annonce une **cible** de 30 jours, pas une purge déjà active. Avant toute invitation externe :

1. faire un inventaire des tables liées à `sessions` et vérifier leurs contraintes `ON DELETE` ;
2. compter, sans supprimer, les sessions et identités anonymes dépassant 30 jours ;
3. sauvegarder la base ou utiliser une branche Supabase isolée ;
4. tester la purge sur cette branche et vérifier les tableaux admin ;
5. seulement ensuite créer un Job Supabase quotidien, journalisé et alerté ;
6. exclure explicitement les comptes non anonymes et les comptes admins.

Requêtes de contrôle non destructives à adapter au schéma déployé :

```sql
select count(*) as sessions_over_30_days
from public.sessions
where started_at < now() - interval '30 days';

select count(*) as anonymous_users_over_30_days
from auth.users
where is_anonymous is true
  and created_at < now() - interval '30 days';
```

Aucun `DELETE` automatique n'est livré dans cette phase : l'état des dépendances de production doit être attesté avant toute suppression.

## Analytics et hébergement

- confirmer que le projet PostHog utilise la région UE et que la capture d'IP est désactivée dans sa console ;
- ne pas réactiver autocapture, replay, surveys ou profils utilisateurs ;
- vérifier dans l'onglet Réseau que seuls les événements techniques prévus partent ; en mode final, ils ne doivent partir qu'après opt-in ;
- documenter les sous-traitants STT, RAG, LLM et TTS retenus pour les tests ;
- le token portail Gamilab est encore consommé par son SDK navigateur : obtenir de Gamilab un mécanisme éphémère officiellement supporté avant une ouverture large.

## Headers de sécurité

Les headers doivent être réglés au niveau de l'hébergement Lovable/CDN puis vérifiés sur l'URL réellement servie. Baseline attendue :

- `X-Content-Type-Options: nosniff` ;
- `Referrer-Policy: no-referrer` ;
- protection anti-iframe avec `frame-ancestors 'none'` dans la CSP ;
- `Permissions-Policy` refusant caméra, géolocalisation, paiement et USB, tout en autorisant le microphone sur l'origine ;
- CSP d'abord en `Content-Security-Policy-Report-Only`, avec les origines Supabase, Gumlet, hCaptcha et les fournisseurs réellement actifs, puis enforcement après observation.

Une CSP incomplète peut casser la vidéo, le STT ou hCaptcha ; elle n'est donc pas codée en dur dans `index.html`. Le document HTML applique déjà la politique de referrer sûre.

Contrôle indicatif :

```bash
curl -I https://URL-DE-TEST
```

## Dette supply-chain connue

Après la mise à jour ciblée de PostHog, `npm audit --omit=dev` est passé de **23 à 12 alertes de production** (4 modérées, 8 élevées). La chaîne PostHog/OpenTelemetry et les alertes protobuf associées ont disparu. Les chemins restants passent notamment par React Router, DOMPurify, Recharts/lodash et Supabase/ws.

Ne pas exécuter `npm audit fix` aveuglément. Traiter par petits lots, en commençant par React Router et les dépendances réellement chargées dans le navigateur, avec typecheck, suite complète et Playwright après chaque lot. Cette dette doit être qualifiée ou corrigée avant l'ouverture publique.

## Critères de sortie

La phase 4 n'ouvre pas la release gate. Elle est terminée uniquement lorsque :

- le code et ses tests sont verts ;
- le smoke test Lovable/Supabase est documenté ;
- CAPTCHA et fermeture des inscriptions sont attestés dans la console ;
- la purge 30 jours est testée puis planifiée ;
- les headers sont observés sur l'URL déployée ;
- un responsable valide le texte de confidentialité et la liste des sous-traitants.
- les alertes supply-chain exploitables dans le navigateur sont corrigées ou formellement acceptées.
