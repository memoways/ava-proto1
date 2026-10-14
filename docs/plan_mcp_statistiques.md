# Plan — Serveur MCP de statistiques pour les assistants externes

## Objectif

Donner à un assistant externe (Codex) l'accès aux chiffres d'AVA Prototype 1
sans lui confier les identifiants de la base. Les accès directs à la base ne
sont pas disponibles sur Lovable Cloud ; c'est donc l'application elle-même qui
expose ses données, sous forme d'outils.

## Choix retenu

- Un serveur MCP (Model Context Protocol) publié par l'app, en lecture seule.
- Accès protégé par connexion (OAuth) : l'assistant se connecte avec un compte
  administrateur et voit exactement ce que ce compte voit dans le back-office.
- Aucune clé de service, aucune lecture anonyme, aucun accès public.
- Les conversations ne sont pas exposées : uniquement des compteurs, des
  sommes, des durées et des métadonnées de session.

## Ce qui a été livré

- `src/lib/mcp/index.ts` — serveur `ava-prototype-1` (« AVA Prototype 1 »),
  émetteur d'autorisation du projet, jetons acceptés pour les comptes
  authentifiés, 4 outils enregistrés.
- Outils, tous en lecture seule :
  - `get_usage_overview` — sessions jouées, durées (moyenne, p50, p90, p95),
    personnages appelés, film vu ou non vu, fins de partie, passages, modes de
    voix, par environnement et par jour ;
  - `get_llm_costs` — appels, jetons et coût par modèle, par fonction, par jour,
    avec répartition succès / erreur ;
  - `get_voice_latencies` — reconnaissance vocale, première octet et total de la
    voix synthétisée, lecture audio, et temps par tour (recherche, modèle,
    validation, tour complet) ;
  - `list_sessions` — dernières sessions en métadonnées seules.
- `src/lib/mcp/supabase.ts` — client backend portant le jeton de l'appelant,
  donc soumis aux mêmes règles d'accès que le back-office.
- `src/lib/mcp/stats.ts` — agrégations partagées (min, moyenne, percentiles,
  comptages, sommes).
- `src/pages/OAuthConsent.tsx`, route `/.lovable/oauth/consent` — page
  d'autorisation « Autoriser / Refuser ».
- `src/lib/oauth-return-path.ts` — contrôle strict du chemin de retour : les
  adresses externes sont rejetées.
- `src/pages/Auth.tsx` — la connexion admin respecte le chemin de retour au lieu
  de renvoyer systématiquement à `/admin`.
- `vite.config.ts` — branchement du plug-in qui génère la fonction backend
  `supabase/functions/mcp/index.ts`.
- Serveur d'autorisation activé sur le backend.

## Limites

- Lecture seule uniquement.
- Chaque outil plafonne les lignes lues (2 000 sessions, 5 000 lignes d'usage,
  3 000 échantillons de latence) et indique `cappedAt` pour signaler une
  éventuelle troncature.
- Les coûts des modèles ne portent pas d'environnement en base : pas de filtre
  d'environnement sur `get_llm_costs`.
- La fonction MCP n'est déployée qu'à la publication du site : elle n'est pas
  servie par la prévisualisation.

## Validation

- Typecheck propre, 13 tests (agrégats, validation du chemin de retour).
- Dans le navigateur : la connexion admin avec `?next=` revient bien à la page
  d'autorisation ; sans `next` l'admin retrouve sa dernière page ; la page
  d'autorisation affiche ses messages d'erreur.
- La fonction backend générée porte l'émetteur exact du projet.
- Vérifié le 14 octobre 2026 depuis Codex : les quatre outils du connecteur
  **MCP app Ava** répondent sur le Cloud `iralfqlslqndgvexixis`, OAuth admin.
  Usage, sessions et latences filtrés sur `sandbox-ulrich` ; coûts globaux
  puisque leur contrat ne porte pas l'environnement. Les deux timeouts GM P1
  ont été retrouvés via les spans V2 de cet outil.

## Utilisation

1. Publier le site depuis Lovable.
2. Copier l'adresse du serveur MCP depuis le panneau d'intégrations d'agents.
3. L'ajouter dans Codex comme serveur MCP distant, se connecter avec un compte
   administrateur et autoriser l'accès.
4. Demander les relevés : sessions et durées, personnages appelés, choix du
   film, coûts des modèles, latences de la voix.
