# Reprise — protéger le présent canonique de Max/Emma et poursuivre le développement

Décision d’Ulrich du 28 octobre 2026 : **aucun gel de la démo ; continuer à
améliorer le projet**. Les anciennes consignes de gel sont historiques. Priorité :
empêcher le compilateur d’effacer la situation d’aujourd’hui, puis qualifier la
cohérence narrative. Ne pas redemander ce choix ni refaire les validations acquises.

## Première action exécutable

**Correctif repris et fusionné dans main par PR #104** :
`9adabdce5b5a4f9be6f6fdc6545868659cb4120a`, après CI PR verte sur HEAD exact
`8f4ddff` et 109 E2E. CI main 40661278202 verte, 109 E2E ; Lovable ready au même
SHA et source du compilateur relue identique. La suite est la
[recette courte F4](prompt_reprise_present_canonique_lot_f4_recette.md),
à proposer à Ulrich. Aucun support à contacter pour débloquer le lot.

### Reprise par accès CLI — historique de ce lot

**Accès alternatif rétabli à la demande explicite d'Ulrich le 28 octobre.**
`gh api user`, lecture du dépôt exact et des PR, `git fetch --prune` et
`git pull --ff-only` réussissent depuis le contexte système autorisé avec
la session existante `Ulrfis`. La GitHub App n'est pas configurée sur ce poste.
Ne pas changer les identifiants ni refaire login/refresh. Le défaut natif
ci-dessous persiste, mais il ne bloque plus le lot : Ulrich autorise ce repli.
[Erreurs exactes, version de l'app et commandes vérifiées](diagnostic_github_connecteur_2026-10-28.md).
La seule PR ouverte au contrôle est #24, historique ; la préserver. Branche
du correctif : `codex/protect-character-present`, créée depuis main c7df835
après mise à jour. Lire la dernière section du plan d'optimisation avant reprise.

### Historique du retest natif bloquant

**Retest du 28 octobre 2026, 09:17 Europe/Paris : blocage confirmé.**
Dans cette session, les appels natifs `github.get_profile`, `github.get_repo`
(`memoways/ava-proto1`) et `github.search_prs` (`is:open`, même dépôt)
renvoient tous `-32001: Unknown tool`. L'inventaire natif des plugins réussit
et annonce GitHub `installed=true`, `status=ENABLED` : présence et activation
ne prouvent donc pas l'exécution des outils. Notion Gamilab répond à get-self
avec l'ID attendu. Aucun élément nouveau ne démontre une expiration OAuth.

Le redémarrage effectif de l'app entre les deux essais n'est pas établi dans
ce chat. Ne pas présenter un redémarrage comme un remède garanti ni répéter
une réinstallation déjà tentée sans nouveau diagnostic. Intervention à demander :
signaler au support de l'app le défaut d'exécution des trois outils ci-dessus,
avec plugin installé/activé et réparation native déjà tentée. Après correction,
la première action de l'agent reste leur retest réel, puis l'inventaire des PR.
Aucun correctif Emma, fetch, push, PR, CI ou publication exécuté lors de ce retest.

État local relu : branche `main`, HEAD `c7df835446c7e4876b91a9c752062207e3a374bd`,
remote unique conforme. Trois documents déjà modifiés et patch candidat non suivi,
seize branches locales historiques en plus de main, préservées. Le distant et ses
PR restent non vérifiés dans cette session ; ne pas les présenter comme à jour.

### Historique de la réparation précédente

Réparation native tentée le 28 octobre 2026 : réapplication réussie de
`github@openai-curated-remote` version `0.1.13-77c10e110b37`, avec le CLI intégré
à `/Applications/ChatGPT.app` (`0.165.0-alpha.1.2`), sans désinstallation ni
changement d’identifiants. Dans un processus de contrôle neuf, `plugin/reconcile`
réussit sans échec et `config/mcpServer/reload` répond ; cela ne démontre pas le
rechargement du processus qui héberge ce chat. La découverte native neuve expose
les outils GitHub. Le diagnostic hors sandbox confirme l’accès HTTP et WebSocket
aux services OpenAI ; les échecs réseau du premier diagnostic en sandbox ne
prouvaient pas une panne réseau de la machine. Les appels get_profile/get_repo
de ce chat renvoient toujours `Unknown tool` après ces opérations : **réparation
fonctionnelle non confirmée**. Intervention alors proposée : quitter
complètement l’app avec ⌘Q, la rouvrir et reprendre ce même chat. Puis retester
les appels ci-dessous ; ne pas présenter ce redémarrage comme une garantie ni
attribuer la cause au seul cache sans preuve. L’outil Computer Use interdit le
contrôle de l’app Codex ; ne pas contourner ce blocage par AppleScript.

Vérifier que le connecteur GitHub natif exécute réellement get_profile/get_repo
et search_prs sur memoways/ava-proto1. Au diagnostic, ces trois outils renvoient
Unknown tool alors que le plugin est annoncé installé/activé. Il s’agit d’un
problème d’exposition/routage, sans preuve d’une expiration OAuth. Conserver
les identifiants. Ne pas contourner ce blocage avec gh ou le navigateur ; ne pas
ouvrir une branche sans pouvoir vérifier les PR concurrentes. Après rétablissement,
lire AGENTS.md, faire git fetch --prune, git status, git log origin/main -6,
lister les PR/branches et mettre le checkout canonique à jour avant toute écriture.
Projet : /Users/ulrich/CodeProjects/memoways/ava-proto1, remote unique
https://github.com/memoways/ava-proto1, un seul agent ; PR #24 historique préservée.

Lire le résumé courant de docs/plan_changement_interlocuteur_manuel.md puis
le diagnostic du 28 octobre en tête de docs/plan_optimisation_payload_max.md.
Le plan et le patch candidat sont locaux/non committés au contrôle de clôture
si le connecteur n’a pas été rétabli ; le code applicatif reste inchangé.

## Sources et état vérifié

- Main local/distant vérifié par git fetch et Lovable : c7df835446c7e4876b91a9c752062207e3a374bd.
  Dernière CI code connue : bf24b3765733d555fabdac88aed02d02827800e7,
  CI main 40578598650 verte, 109 E2E sans retry, après une relance d’une assertion
  asynchrone préexistante du tableau de latence ; aucune CI lancée pour ce diagnostic.
- Notion Gamilab natif : vérifier get-self = 7e1a9a09-09cb-4deb-a306-83a29b831bc2.
  Tâche existante https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f ;
  Max actif ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9,
  Emma active dfcc15f8-9d37-45f7-8c84-d0c24a4288cf.
  Conserver Source, Last updated by=Codex et vérifier chaque écriture.
- Lovable seul : projet Ava 1265958d-b74e-40f2-917d-182fe05163fc, workspace
  Memoways 5glbtPltldwz9tgNwIi4. SQL/Cloud via MCP Lovable ; pas de Supabase générique.
- Essai du 28 octobre : session 0f88fbde-5f9a-4e27-ba0f-0644e2682dc3,
  07:36:42 Paris. Emma affirme dès sa première réponse générée que Max est parti
  avec Anne à l’hôtel ce matin, et répète trois fois ce fait. Le souvenir est J−2.
  Notion et copie Cloud disent Lausanne, cuisine/salon, retour hier ; version
  d’Emma épinglée = 26 octobre 15:45:14 UTC. Pas de retard de sync démontré.
- Aucun snapshot de la requête réelle : diagnostic_trace_enabled=false, zéro
  trace causale. Ne pas inventer les souvenirs RAG exacts ou les paramètres
  réellement résolus. Le défaut de compilation est reproduit indépendamment.
- Même expérience Emma puis Max : deux callStart distincts, appel Emma fermé
  07:40:46, Max ouvert 07:40:53, même budget restant 722 s, handoff_count=0.
  Le joueur dit lui-même à Max qu’il vient de parler à Emma ; aucune fuite privée
  ne peut être déduite de cette seule référence.

## Boucle de reproduction et correction candidate

optimized_v3 réserve 4 500 caractères statiques (marge 320). Parole + moteur
intime d’Emma prennent déjà 3 816 caractères. La timeline est sélectionnée avant
les autres champs required ; ce mot ne garantit pas leur présence. Tous les
paragraphes situation_summary peuvent être omis pour budget, sans erreur.

Le replay local de trois formulations du premier message d’Emma est rouge.
Prototype : situation_summary entière protégée en premier, hors pertinence/
déduplication, réserve statique 5 500 avec plafond global conservé à 11 000,
et assertion de conservation intégrale avant génération. Le patch est
`docs/patch_present_canonique_candidate.patch` : **candidat non appliqué à src**,
à revoir et réduire avant implémentation. Aucun fait Lausanne/Anne codé en dur.
24 replays avec les fiches Cloud : Max/Emma × trois questions × historique
0/1 800 × avec/sans souvenir ancien. Avant : 24 omissions ; prototype : zéro,
zéro dépassement de contexte. Les copies temporaires complètes ont été nettoyées ;
reconstituer une fixture synthétique minimale et relire les seules sources nécessaires.

Après contrôle de concurrence GitHub, une seule branche depuis main à jour :
1. Reproduction rouge au vrai seam de buildOptimizedPromptAssembly, avec fixture
   synthétique chargée de la même façon ; tests des faits actuels et de la parole
   éditoriale, pas une assertion qui copie l’implémentation.
2. Revoir le patch et la réservation : conserver le présent entier et les unités
   éditoriales protégées, plafonds et traçabilité explicites, aucun gonflement
   caché du contexte ; erreur avant modèle si les faits obligatoires disparaissent.
3. Cas Max/Emma, souvenir passé correct, correction utilisateur, contexte long et
   limite, changements d’appel ; vérifier le chemin de requête effectif et le GM.
4. Qualité locale, replays ciblés, code/tests/plan/prompt figés avant premier push,
   CI PR verte sur HEAD exact, fusion, CI main verte, suppression branche propre,
   synchronisation Lovable prouvée. Aucun workflow ou contrat CI modifié dans ce lot.
5. Nouvelle écoute courte sur le défaut après livraison sur main. Protéger le
   prompt ne prouve pas à lui seul l’absence générale d’hallucinations ; distinguer
   ce contrôle de compilation d’une future validation narrative avant TTS.

## Invariants et clôture

Voix Max Gradium b5ioHAR7JuHVLskk, Emma JReEQbhiZbfpeMYy. Garder prompts Notion,
prosodie, fournisseur et réglages acceptés. Mains libres acoustic_confirmed,
bargeIn=false, endOfSpeechMs=2000, hesitationExtraMs=700, incremental=false.
Ava/Léo inactifs. Continuité d’entrée acceptée le 27 octobre session 373833d0 et
passage Max → Emma accepté session 043712a6 : preuves conservées. Capsule livrée
par #102, trois états distincts ; ne pas la redessiner pour résoudre ce défaut.
Aucun transfert automatique, quatre échanges complets, accord + GM + reçu + clic.
Même expérience par grille, budget suspendu, souvenirs privés par personnage.

Aucun gel demandé. Continuer les améliorations ciblées ; optimisation CI,
auditions et qualification exhaustive sont séparées. Aucune publication ni
opération Cloud implicite ; production sur autorisation distincte seulement.
À chaque clôture, actualiser plan et tâche Notion, Source/Last updated by et
preuves, CHANGELOG/STORY si livraison ; vérifier état GitHub/Lovable réellement
accessible. Distinguer local, GitHub, preview et production. Si bloqué, le dire
en tête et fournir une seule action précise, sans annoncer le lot terminé.
Livrer dans le même tour le prompt autonome du prochain lot ou de finalisation,
avec lien, sans le lancer, et conserver cette obligation dans ce prompt.
Gami DigiDouble exclu. Ne conserver ni secrets ni transcript complet.
