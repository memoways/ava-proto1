# Prompt autonome — Ava, A4R : intégration E0 et recette humaine

Reprendre uniquement le reste A4, sans lancer un nouveau chantier de code.
Checkout unique `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote unique
`https://github.com/memoways/ava-proto1`. Lire AGENTS.md, le document partagé
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`,
les deux plans existants et leur bilan A4. Un seul agent, aucun sous-agent,
clone ou worktree. La préparation de ce prompt ne lance pas A4R.

## Première action et état à vérifier

Exécuter `git fetch --prune`, statut, `git log origin/main`, branches et PR
ouvertes ; lire CHANGELOG et le bilan de livraison de la PR A4 avant `git pull`.
Le lot A4 part de `1b0fcd4340f79b4c8184c7100b0e96840bf4c938` (#80) ;
ne jamais revenir à cette base. Le SHA de fusion A4, ses runs exacts et l'état
Lovable doivent être repris du bilan GitHub, sans substituer la CI A3.
La branche propre A4 doit avoir été nettoyée après livraison ; traiter tout
blocage de livraison signalé avant d'ouvrir une branche concurrente.

À l'ouverture A4, #24 `agent/test-gap-invitation-validity-multi-use` et 16
branches locales étrangères existaient. Elles sont hors périmètre, à préserver
avec leurs SHA ; vérifier l'activité réelle et les fichiers avant toute écriture.

## Réalisé et autorisé

- Le champ app `character_runtime_profiles.opening_line` conserve une seule phrase
  de référence, compatible avec les clients déjà publiés. Le répertoire approuvé
  est du contenu app A4 lié à cette référence exacte et à sandbox-ulrich ; une
  édition ultérieure du profil prime et désactive ces alternatives. Choix stable par appel, sans répétition immédiate quand une autre
  alternative existe ; premier transfert et retour restent distincts et gardent
  leurs répertoires, la provenance et les mémoires isolées.
- Ulrich a explicitement validé dans le chat A4 du 26 octobre les quatre textes
  ci-dessous, **seulement pour sandbox-ulrich**. Lire le bilan A4 et la DB native
  Lovable avant toute écriture : ne pas réappliquer une modification déjà faite.
  Les deux phrases de référence ont été sauvegardées et relues exactement par
  MCP Lovable le 26 octobre à 08:41:44.724487 UTC ; autres champs des profils
  et profils prod inchangés. Ne pas stocker les deux choix dans `opening_line` :
  les anciens clients les prononceraient tous les deux.

Max, deux choix app (seulement la première ligne dans `opening_line`) :

```text
Allô. Max à l’appareil. Je vous écoute.
Oui, c’est Max. Qu’est-ce qui vous amène ?
```

Emma, deux choix app (seulement la première ligne dans `opening_line`) :

```text
Allô… c’est Emma. À qui je parle ?
Oui… je suis là. Vous vouliez me parler ?
```

- Ouverture initiale verrouillée avant ses attentes, signal d'annulation et
  barrières après chaque attente ; aucun accueil depuis une fiche arrivée après
  raccrochage. Premier son horodaté sur le callback, pas à la fin de l'audio.
- Reçus prudents des accueils : livré seulement après lecture complète ; en cas
  de lecture partielle sans alignement, toute la phrase commencée reste incertaine.
  Aucun état de parole inventé pour une ligne scriptée, aucun nouveau LLM/GM.
- Cache mémoire REST explicite, 16 entrées / 8 Mio, indexé sur texte/personnage/
  environnement/fournisseur/voix/modèle/réglages/intention/stitching. Échec,
  annulation et résultat après reset non conservés. Rejeu identifié `cache`,
  sans fausse mesure de génération fournisseur. WS conserve A2, sans cache ni
  capture live nouvelle ; le cache WAV du banc A3 reste isolé.
- Qualité locale A4 : lint/types/build, 66 régressions, 1 019 unitaires et
  41 intégrations verts après correction de compatibilité. Premier passage complet :
  81 E2E verts sans retry (12,8 minutes), puis 3 E2E A4 ciblés verts sur le format
  compatible et revalidation complète lancée ; résultat final et CI exactes dans
  le bilan de livraison de la PR #81, à lire avant reprise. Fournisseurs simulés ; aucun gain
  acoustique, latence matérielle ou acceptation humaine déduit des tests.

## Reste E0 : sources et intégration

Notion Ava est TOUJOURS **Gamilab**, sans redemander le choix. Le connecteur
exposé pendant A4 annonce Ulrich `377e8583-7838-4c05-9f76-8833a450f304` :
mauvais routage pour Ava. La connexion native Gamilab est configurée et activée
dans Codex, mais ses outils ne sont pas exposés dans cette session. La connexion
Ulrich n'a permis aucune lecture ciblée ni capitalisation
Gamilab. Vérifier le workspace via MCP natif avant de lire ou écrire ; réutiliser
la connexion Gamilab si disponible. Ne pas relancer OAuth ni conclure à un défaut
de partage, expiration ou synchronisation sur ce seul constat. Aucun navigateur
Notion ni déplacement des sources vers Ulrich. Gami DigiDouble reste exclu.

Sources : base Caractères AVA `30362322e59580bbb7b8dd49d516b341`, Max
`3f762322-e595-81ba-8241-c7f6b28f31fd`, Emma
`3f762322-e595-81f9-880f-e309adec7075` ;
`docs/tache_notion_parole_incarnee_personnages.md` pour les propositions E0.
Les champs sont annoncés synchronisés par Ulrich au 25 octobre ; ne pas inventer
un retard depuis un refus d'accès. Aucune nouvelle édition E0 approuvée n'était
fournie dans A4. L'approbation des accueils app ne valide pas ces propositions.

Dès que Gamilab est exploitable, lire les sources actuelles et l'édition
réellement approuvée. Distinguer E0 approuvé/proposé. Si une validation manque,
préparer le diff par champ dans le plan existant, puis demander uniquement cette
décision indispensable. L'édition des fiches appartient à Ulrich ; aucune
réécriture automatique. Intégrer les seuls champs approuvés, synchronisation
ciblée sandbox par la chaîne existante, source/copie/prompt final et versions
relus. Aucun rebuild RAG, aucune sync ou réécriture de prompts Cloud automatique.

Lovable est l'unique chaîne, projet `1265958d-b74e-40f2-917d-182fe05163fc`.
SQL seulement par MCP Lovable de ce projet, jamais Supabase générique. Vérifier
la cible avant toute intervention. Ne pas modifier d'autres champs de profils,
voix ou réglages en sauvegardant les accueils ; CAS et readback exact requis.

## Recette humaine après intégration

Preview Lovable authentifiée déjà ouverte : réutiliser le navigateur connecté,
sans transférer de cookies ni modifier ses protections. Vérifier le SHA annoncé
par MCP, la source synchronisée et la preview affichée séparément. Aucun appel
audio fournisseur automatique : les écoutes réelles se font avec Ulrich.

Parcours court : premiers contacts Max/Emma, sujet concret, rupture et reprise,
éclair clair/espoir/fatalisme, puis Max → Emma → Max et Emma → Max → Emma.
Pas de double lecture, pas de confidence initiale forcée, pas de visite physique
ni conférence inventée. Juger les mots et pauses séparément du timbre. Une pause
ne prouve ni souffle ni sanglot ; si le timbre reste détaché, proposer au plus
deux voix alternatives en audition isolée, sans changer les voix de jeu.
Mesurer premier son, silences voulus et durée totale séparément ; déclarer les
limites de mesure. Écoute acceptée seulement sur décision humaine explicite.

## Invariants, livraison et clôture

Conserver A1/A2/A3/A4, séparation mots/contrôles, états validés propres,
delivered/uncertain/private, samples et reprise sans rejeu après son, setup avant
premier segment et récupération préalable unique bornée. Aucun changement de
capture/STT, `handsFreeVoice.ts`, `experienceFrame`, gardes de transfert,
modèles/températures/voix de jeu, budgets 220 personnage / 950 GM, buffers ou
délais. Rendu par état conservé en production ; pauses expérimentales/auditions
sandbox seulement, tags Gradium fermés partout. Activation live sandbox seulement
après écoute et accord explicite. Aucun backend, secret, hébergeur ou publication
production nouveau.

Une reprise purement éditoriale ne justifie pas de rejouer les suites lourdes.
Si une correction de code est indispensable : une branche depuis main à jour,
tests ciblés puis `npm run test:quality` et E2E complets séquentiels, PR attachée
au chat, CI verte sur HEAD exact avant squash puis CI main verte sur fusion,
E2E compris ; Lovable au même SHA et preview vérifiée. Nettoyer seulement sa
branche locale/distante, préserver tout travail étranger.

Actualiser les deux plans, CHANGELOG et STORY avec les faits vérifiés. Distinguer
local, GitHub, staging, production, livraison technique et recette humaine.
Si bloqué, dire A4 incomplet, enregistrer la reprise exacte et donner une seule
action humaine précise. Capitaliser dans l'entrée Gamilab existante seulement
après relecture, conserver Source, actualiser Last updated by et vérifier l'écriture.

À chaque clôture où un reste ou prochain lot est identifié, enregistrer dans le
même tour `docs/prompt_reprise_<sujet>_lot_<id>.md` : état vérifié, sources,
périmètre, invariants, validations, livraison et première action exécutable.
Actualiser le plan et donner ses liens directs, celui de la PR et du prompt.
Transmettre cette obligation, sans lancer le lot suivant ; sinon dire explicitement
qu'aucun lot suivant n'est identifié.
