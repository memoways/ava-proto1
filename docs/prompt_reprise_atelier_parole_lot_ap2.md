# Ava — AP2 : retrouver les variantes et appréciations de l’atelier de parole

Exécute uniquement **AP2**, dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`,
remote unique `https://github.com/memoways/ava-proto1`. Ce prompt prépare le lot
suivant ; son enregistrement ne lance ni AP2 ni une écoute. Le périmètre AP2 est
cadré dans le plan courant, ne pas refaire la planification.

## Première action et contexte

Lire `git status`, AGENTS.md, `docs/etat_courant.md`, le début du CHANGELOG et
`docs/plan_lot_b_rendu_vocal.md`, section « Atelier de parole AP1–AP6 » et bilan
AP1. Vérifier les chats actifs, remote, branches et PR ; un seul agent Ava,
aucun sous-agent. Préserver #24 et les branches historiques ; aucun recouvrement
avec une PR étrangère. Faire `git fetch --prune`, lire les six derniers commits
de main, puis `git pull --ff-only` sur main propre avant la branche AP2.
Aucun clone ou worktree adjacent ; conserver `.vexp/` local et non versionné.
Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`
et `docs/adr_ci_complete_sur_pr.md` pour la livraison.

AP1 ajoute `/admin/experience/atelier-de-parole`, réutilise `SpeechAuditionBench`
et son propriétaire audio unique. A est un snapshot temporaire des valeurs
chargées ; B ne change qu’un contrôle vocal à la fois. Le premier essai compare
le padding courant à 0, ou à 0,2 si déjà nul. M1/M2 d’abord ; état choisi
explicitement pour chaque cas. REST direct si streaming sandbox désactivé ;
WebSocket et pauses A2 constituent une comparaison séparée. Preuves effectives,
repli, cache borné, arrêt et résultats périmés restent gérés par les services
existants. Le chargement de l’atelier est en lecture seule, y compris la
normalisation LLM. AP1 ne conserve pas variantes/avis après fermeture.

La base avant AP1 était `c425771d663978cf8ec3785d443969a04dfd24db` ; **ne pas la
restaurer**. Lire le SHA courant, la PR AP1 et son reçu de garde dans GitHub et
la tâche Notion : ce document est committé avant le futur squash d’AP1.
La livraison technique et les tests simulés ne valent pas acceptation vocale.
Aucune écoute humaine, génération fournisseur réelle ni publication dans AP1.

## Résultat observable et périmètre

Ulrich retrouve après fermeture/reconnexion ses variantes **nommées**, leurs
différences, appréciations, décision et export, dans la même sandbox. Conserver
la méthode Max : une hypothèse et deux variantes, séance de 10–15 minutes.

- Réutiliser le banc, ses snapshots et notes ; pas de second lecteur, moteur de
  préparation, paramètre de jeu, catalogue d’états commun ou juge LLM.
- Enregistrer des documents dédiés dans `admin_settings`, sans migration,
  nouveau droit, Edge Function ni secret. Types et version de schéma explicites,
  clé distincte des réglages live ; partition stricte par environnement.
- Stocker noms, hypothèse, A/B et provenance disponible, diff, cas/texte court
  d’audition édité explicitement, état propre choisi, paramètres/transport
  demandés, preuves de requêtes disponibles et appréciations séparées :
  mots/pensée, pauses/rythme, affect/timbre, clics/hoquets. Coût inconnu si non
  mesuré. Décision humaine (à réécouter / préférée / rejetée, par exemple) ne
  doit jamais appliquer la variante au jeu.
- Lecture sandbox stricte sans repli production ; écriture explicite avec
  détection de conflit (baseline/version, compare-and-swap) puis relecture DB
  exacte avant confirmation. Traiter absence, indisponibilité, conflit et
  échec de relecture distinctement. Préserver les autres entrées et champs.
- Recharger une variante prépare un brouillon : aucun appel audio automatique,
  aucune sauvegarde/activation live. Afficher la différence avec les références
  actuelles si elles ont changé ; garder les versions inconnues comme inconnues.
- Ne conserver ni audio durable, transcript complet, prompt personnage/GM
  intégral, secret ou jeton. Le cache audio exact reste mémoire seulement,
  16 écoutes / 16 Mio, capture WS bornée. Après fermeture, afficher clairement
  qu’une nouvelle écoute régénère et ne rejoue pas le son exact déjà entendu.
- Maintenir export lisible et JSON ; différencier résultats simulés, requêtes
  effectives et avis humains. Aucun bouton « retenir » ambigu avec l’application
  au jeu. Ne pas lancer AP3, conversation ou audition réelle automatiquement.

Points d’entrée : `src/components/SpeechAuditionBench.tsx`,
`src/services/tts/speechAudition.ts`, `speechWorkshop.ts`,
`speechPerformanceSettings.ts` et leurs tests. Le `saveSpeechPerformanceSettings`
existant montre CAS/readback mais sauvegarde le mapping live : ne pas l’utiliser
pour enregistrer une variante d’atelier.

## Invariants et cibles natives

Préserver mots, faits, présent canonique de l’appartement et souvenir J−2.
Max conserve ses propres états et leur évolution, sans tic, bégaiement ajouté,
cycle imposé ou état statique. Aucun changement de fiche Notion, prompt effectif
GM, modèle/température de jeu, voix, mapping live, budgets, capture/STT,
interruptions/mains libres ou transferts. Tags Gradium toujours fermés ;
`padding_bonus` est le rythme global, les pauses exactes demandent WS et les
gardes A2 ; le repli REST ne valide pas les pauses WS.

Notion natif **Gamilab** : confirmer avec get-self l’ID
`7e1a9a09-09cb-4deb-a306-83a29b831bc2`. Relire la tâche existante
https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d et, pour l’éditorial
seulement, le rapport https://app.notion.com/p/40462322e59580ca98a4d6148d8ce406.
Max actif `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9`, Emma active
`dfcc15f8-9d37-45f7-8c84-d0c24a4288cf`. Gami DigiDouble exclu.
Aucun navigateur Notion ni workspace personnel de substitution.

Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
`5glbtPltldwz9tgNwIi4`, seule chaîne Cloud/build/preview. Vérifier la cible native
avant Cloud. Toute inspection SQL par MCP Lovable, jamais Supabase générique.
GitHub natif prioritaire ; si Unknown tool, repli git/gh autorisé avec remote et
identité existante vérifiés en contexte système, sans login/refresh/logout.
Le navigateur sert à la validation visuelle ; aucun animal affiché.

## Vérifications et livraison

Couvrir : sauvegarde explicite, fermeture/reconnexion, isolation sandbox/admin,
refus prod et contexte étranger, migration de schéma locale si nécessaire,
conflit et readback, absence de changement live/audio automatique, export,
provenance inconnue et références devenues différentes. Conserver REST/WS/repli,
cache/rejeu exact dans la séance, arrêt et callbacks tardifs. Vérifier la preview
admin authentifiée, clavier et écran étroit ; fournisseurs simulés, écoute humaine
non revendiquée. Toute recette Cloud réelle utilise seulement des variantes
dédiées, jamais les réglages du jeu.

`npm run test:quality` et `npm run test:delivery` verts avant push. Code, tests,
plan actualisé, CHANGELOG et prompt **AP3 autonome** dans `docs/` committés avant
le premier push. Continuer la mesure CT2 (horodatages préparation, qualité,
premier push, run/job, installation navigateurs, E2E, retries/annulations,
fusion ; travail et attente distincts).

Une campagne complète sur PR/HEAD exact contenant main à jour, run **et** job
`regression-gates` success. Attendre sans déléguer à Ulrich. Fusion exclusivement
par `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
Vérifier arbre et parent fusionnés, main GitHub/local propre ; supprimer notre
seule branche distante et locale. **Aucune seconde campagne complète sur main.**
Vérifier Lovable synchronisé/ready ; aucune publication production implicite.

## Clôture et prompt suivant

Actualiser le plan existant avec résultat, preuves, limites et recette humaine.
Relire la tâche Gamilab puis capitaliser les faits durables datés/liés et le
reçu de garde, préserver Source, indiquer Last updated by : Codex et relire
chaque écriture. Si l’accès manque, signaler précisément le non-sauvegardé.

Le bilan fournit résultat/plan/PR, SHA main, CI/HEAD, arbre/parent, absence attendue
de campagne main, branches restantes et états local/GitHub/preview/production.
Fournir directement le lien du prompt enregistré
`docs/prompt_reprise_atelier_parole_lot_ap3.md`, sans attendre une demande.
AP3 organise la première écoute accompagnée Max ; sa préparation ne la lance
pas. Inclure cette même obligation de prompt suivant et de lien final dans AP3.
Si AP2 reste incomplet, enregistrer malgré tout une reprise exacte indiquant
les contrôles réellement faits et la seule action humaine indispensable.
