# Prompt autonome — Ava, A4R : intégration E0 et recette humaine

État revérifié le 26 octobre 2026, après redémarrage de Codex par Ulrich.
La livraison technique A4 est faite ; E0 et la recette humaine restent ouverts.
Reprendre uniquement ce reste A4, sans lancer un nouveau chantier de code.
Checkout unique `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote unique
`https://github.com/memoways/ava-proto1`. Lire AGENTS.md, le document partagé
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`,
les deux plans existants et leur bilan A4. Un seul agent, aucun sous-agent,
clone ou worktree. La préparation de ce prompt ne lance pas A4R.

## Première action et état à vérifier

Exécuter `git fetch --prune`, statut, `git log origin/main`, branches et PR
ouvertes ; lire CHANGELOG et le bilan de livraison de la PR A4 avant `git pull`.
La base de code livrée A4 est `26cfc2caf5812e1907d3a2d4db1730ed8f8948ec`,
[#81 fusionnée](https://github.com/memoways/ava-proto1/pull/81),
[bilan exact](https://github.com/memoways/ava-proto1/pull/81#issuecomment-6412874906).
La [CI PR](https://github.com/memoways/ava-proto1/actions/runs/40296314456) est
verte sur `4e35dc70f1d025776f04764aa3fa481bbfcde0e5` ; la
[CI main](https://github.com/memoways/ava-proto1/actions/runs/40298606848) est
verte sur le SHA de fusion, qualité et E2E compris. Lovable a été relu à ce même
SHA après redémarrage : projet Ava, `ready`, `agentFinished=true`.
Le main de reprise peut contenir la clôture documentaire ultérieure : le lire
et l'intégrer, sans revenir à A3 ou au SHA A4. Aucune suite lourde à relancer
pour cette seule documentation. La branche propre A4 est supprimée localement
et à distance ; vérifier également la livraison de la clôture documentaire.

À l'ouverture A4, #24 `agent/test-gap-invitation-validity-multi-use` et 16
branches locales étrangères existaient. Elles sont hors périmètre, à préserver
avec leurs SHA ; vérifier l'activité réelle et les fichiers avant toute écriture.
Le dernier contrôle GitHub conserve seulement `main` et cette branche distante ;
#24 est inchangée depuis le 11 octobre et ne recoupe pas les documents A4.

## Prérequis Notion natif : ne pas confondre redémarrage et restauration

Après le redémarrage signalé par Ulrich, le connecteur Notion exposé a répondu
à `fetch("self")` : **Ulrich**, workspace
`377e8583-7838-4c05-9f76-8833a450f304`. C'est un connecteur utilisable pour ce
workspace personnel, pas pour les sources Ava. Les namespaces natifs Gamilab
et Ulrich Fischer n'étaient toujours pas exposés dans le chat.

Le contrôle indépendant via le client Codex natif a retourné `notLoggedIn` et
zéro outil pour **les deux connexions configurées** `notion_gamilab` et
`notion_ulrich_fischer`. Cela ne permet pas d'annoncer tous les workspaces
restaurés. Le workspace Gamilab réel doit encore être identifié via `self` ;
ne pas déduire son ID du nom du serveur ou d'une page.

Réparation globale déjà effectuée hors dépôt Ava : CLI 0.164.0, coordination
du renouvellement active, stockage OAuth dans le Trousseau, deux serveurs
explicitement activés et attente de chargement des catalogues. Aucune copie
de jeton en clair. Un renouvellement natif Gamilab antérieur a atteint le
retour local, puis a échoué à l'écriture sécurisée macOS (« The user name or
passphrase you entered is not correct. »). Le Trousseau annoncé déverrouillé
n'a pas suffi. Ce bilan ne prouve pas une nouvelle expiration après redémarrage.

Première vérification locale exécutable, sans relancer OAuth :

```bash
python3 /Users/ulrich/.codex/scripts/notion-native-check.py
```

Cet outil ne sort que noms/statuts/nombres d'outils ; il ne vérifie pas à lui
seul l'identité des workspaces. S'il réussit, charger les connecteurs natifs et
lire `get-self` ou `fetch("self")` pour chacun avant tout accès ciblé. Confirmer
Gamilab pour Ava et l'ID personnel ci-dessus pour Ulrich. Vérifier la persistance
sur deux démarrages indépendants, puis la disponibilité effective dans le chat.

Si le blocage persiste, lire le diagnostic local existant
`/Users/ulrich/.codex/diagnostics/notion-native-20261026.json`, vérifier le client
et la configuration actifs, sans afficher de secret. Ne pas répéter les flux
OAuth depuis le même contexte en échec. L'intervention humaine préparée utilise
le skill wizard et le client officiel dans Terminal :

```bash
/Users/ulrich/.codex/scripts/restaurer-notion-native.command
```

Ce parcours renouvelle Gamilab puis Ulrich dans le Trousseau et contrôle deux
démarrages ; il ne garantit pas la réussite d'une écriture que macOS refuse.
L'utilisateur valide les éventuelles demandes système, jamais en donnant son
mot de passe au chat. Ne pas recréer les identifiants, supprimer l'historique,
basculer les jetons vers un fichier, ni ajouter des workspaces par supposition.
Inventorier les connexions effectivement enregistrées si d'autres sont annoncées,
et vérifier chacune séparément. Aucun navigateur pour lire les données Notion.

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
  compatible. Le code applicatif compatible a finalement passé les 81 E2E sans
  retry (12,9 minutes). Les deux CI finales relues sont liées ci-dessus.
- CI A4 : téléchargements APT Azure ralentis avant les E2E, un rejeu du même HEAD
  puis correction du miroir vers archive.ubuntu.com, sans changer les paquets,
  contrôles, trois navigateurs ou plafond 20 minutes. Concurrence, cache npm Node 22
  et exception documentaire appliqués ; CI PR/main conservées (dépôt public).
  Résultat des runs finaux dans le bilan de livraison ; ne pas confondre un run
  annulé avant E2E avec une validation. Fournisseurs simulés ; aucun gain
  acoustique, latence matérielle ou acceptation humaine déduit des tests.

## Reste E0 : sources et intégration

Notion Ava est TOUJOURS **Gamilab**, sans redemander le choix. Le contrôle après
redémarrage et le prérequis de restauration sont consignés ci-dessus. Aucun
accès ciblé ou capitalisation Gamilab effectué par le connecteur Ulrich.
Vérifier le workspace via MCP natif avant de lire ou écrire ; réutiliser Gamilab
si disponible. Ne pas conclure à un défaut de partage ou de synchronisation
depuis le mauvais routage. Aucun navigateur Notion ni déplacement des sources
vers Ulrich. Gami DigiDouble reste exclu.

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

La preview authentifiée a été vérifiée lors de la livraison #81. Inventorier les
onglets actuels avant de supposer qu'elle est encore ouverte ; réutiliser le navigateur connecté,
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
