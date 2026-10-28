# CT1 — contexte proportionné et livraison contrôlée

Date : 28 octobre 2026. Ulrich a approuvé les trois décisions du rapport.
Base vérifiée : `a9f5c72d357d09daedb0d09b0801a7eb766623b5`.

## Dans le dépôt

- [Contrat commun](../AGENTS.md), adaptateur CLAUDE et template PR alignés :
  une campagne complète sur PR/HEAD exact contenant main, puis garde et comparaison
  de l'arbre/parent fusionnés. Le second passage complet sur main est retiré.
- [ADR](adr_ci_complete_sur_pr.md), [état courant court](etat_courant.md),
  [plan actualisé](plan_audit_contexte_travail.md), garde et tests versionnés.
- Config vexp dans `.codex/config.toml`, limitée au checkout canonique Ava.
  Le binaire et son installation locale sont ceux déjà présents sur ce poste.
- Aucun changement de src, tests vocaux, prompts personnages, base, migrations,
  Cloud, secrets ou production. Lovable reste l'unique chaîne de livraison.

## Sur le poste d'Ulrich

Ces changements sont locaux ; la PR ne les installe pas sur un autre poste.

- Le point d'entrée Codex partagé (`~/.codex/AGENTS.md`, lien vers les presets)
  et l'adaptateur `~/.claude/CLAUDE.md` chargent l'état courant court, les historiques
  à la demande, le diagnostic borné et le repli GitHub authentifié autorisé.
- `~/.agents/skills/visual-plan` est l'unique copie active ; la copie identique de
  `~/.codex/skills/visual-plan` est archivée, récupérable. Visual-plan, canvas et
  research ont une description précise et une politique d'invocation explicite
  pour Codex (`allow_implicit_invocation: false`) et Claude (`disable-model-invocation`).
- Confidence-check devient une vérification de préparation adaptée au risque,
  sans score obligatoire, métriques de précision invérifiables ni exemple OSS exigé.
- Le vexp global est désactivé et perd args/cwd/env visant carte-chalet. L'override
  projet est activé pour Ava ; `codex mcp get vexp --json` résout bien cette cible.
  Les outils déjà démarrés dans un chat peuvent encore porter l'ancienne cible :
  aucune utilisation de leur résultat ; le prochain démarrage charge la config.
- `~/CodeProjects/_shared/scripts/git-ship` délègue à la garde pour Ava seulement,
  puis vérifie la suppression de notre branche avant nettoyage local. Identités
  GitHub App/personnelle et comportement des autres dépôts préservés.

Sauvegarde récupérable : `~/.codex/backups/ct1-2026-10-28/`. Les originaux modifiés
et le doublon sont conservés ; pour la config globale, seule l'ancienne section
vexp est sauvegardée, sans identifiants ni secrets. Pas de login/refresh/logout.

## Vérifications effectuées avant push

- 23 cas de garde verts : attente queued/in_progress, run absent/ancien/rouge,
  job skipped, mauvais dépôt/base/HEAD, base déplacée avant et pendant la fusion,
  arbre différent, documentation seule et contrôle sans mutation.
- Un dépôt Git temporaire démontre que le squash d'un HEAD contenant la base
  conserve son arbre ; une base avancée n'est plus son ancêtre.
- Transports simulés de git-ship : l'original appelle directement `/merge`, sans
  attendre de garde ; la version corrigée appelle la garde avec le SHA complet
  et s'arrête sur son refus, sans fusion ni nettoyage. Aucun merge réel utilisé
  pour reproduire le défaut.
- `npm run test:quality` vert : lint sans erreur (un warning préexistant dans
  IndexPRD4), typage, 71 régressions, 1 115 unitaires, 42 intégrations, build.
  Le warning de taille de bundle existant reste hors périmètre.
- Bash valide, TOML global/projet valides, métadonnées YAML des quatre skills et
  workflow valides. Le validateur Python officiel ne démarre pas sans PyYAML sur
  le Python système ; parsing YAML réalisé avec js-yaml déjà installé, sans ajout
  de dépendance. Le chargement effectif des skills se confirme dans un nouveau
  chat ; aucune simulation de vitesse Claude/Codex n'est revendiquée.

## Preuve finale et mesure

La preuve de fusion (PR, HEAD, run, SHA main, arbre/parent) est donnée par le reçu
de la garde dans le compte rendu et les sources Notion existantes. Ce document
est commité avant push : il ne prétend pas connaître son futur SHA de fusion.
Vérifier aussi la synchronisation Lovable et l'absence de campagne qualité main.
Les branches étrangères sont signalées, jamais supprimées pour prétendre « main seul ».

Le lot supprime une répétition, sans accélérer les E2E eux-mêmes. #104 reste une
référence historique (46 min 42 s de jobs) ; un lot CT1 sans changement fonctionnel
ne constitue pas un benchmark comparable de développement. La mesure complète
d'un lot comparable et les éventuels tests de sélection des skills sont préparés
dans [CT2](prompt_reprise_contexte_travail_lot_ct2.md), sans lancement automatique.

Sources : [audit](audit_contexte_travail_2026-10-28.md),
[documentation officielle des skills](https://learn.chatgpt.com/docs/build-skills),
CLI local vexp/codex, lectures GitHub/Lovable, demande d'Ulrich du 28 octobre.
