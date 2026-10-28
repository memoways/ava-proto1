# Ava — AP1 : comprendre les réglages et comparer fidèlement la parole de Max

Exécute et livre **le lot AP1** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote unique
`https://github.com/memoways/ava-proto1`. Le lot a été cadré avec Ulrich le
28 octobre 2026 : implémentation, vérifications et livraison sont attendues,
sans refaire la planification ni redemander l'accord sur ce périmètre.
Ce fichier prépare le lancement ; sa création ne lance pas AP1.

## Première action exécutable et sources

Lire `git status`, le remote, AGENTS.md et `docs/etat_courant.md`. Vérifier les
chats actifs, branches et PR ouvertes, puis, sans autre agent actif sur Ava,
`git fetch --prune`, `git log origin/main -6 --oneline` et
`git pull --ff-only` sur main propre. Créer la branche AP1 depuis ce main.
Un seul agent ; aucun sous-agent, clone ou worktree adjacent. Préserver #24 et
les branches historiques ; aucun recouvrement avec une PR ouverte. Conserver
les fichiers générés `.vexp/`, index local non versionné, sans les livrer.

Lire ensuite le début du CHANGELOG et seulement :
- `docs/plan_lot_b_rendu_vocal.md`, section courante « Atelier de parole AP1–AP6 » ;
- `docs/plan_parole_incarnee_personnages.md`, direction actuelle ;
- `docs/adr_ci_complete_sur_pr.md` et
  `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

Base observée pendant la préparation : CT1 #107 fusionné,
main `10e1bfaeff6c3ed1007c2d55c91c73c21ba00a07`,
CI PR 40683839668 verte, HEAD `29e247d23ead2e5fc244c1c67671bc34d690ac7c`.
GitHub et Lovable concordaient. Relever l'état réel, sans restaurer cette base.

## Résultat observable et limites du lot

Ulrich doit pouvoir trouver **Expérience → Atelier de parole**, comprendre les
réglages et écouter deux variantes de Max sur le même texte, avec la différence
et les capacités réellement appliquées clairement affichées.

Réutiliser le banc actuel, ses services et lecteurs. AP1 ajoute la lisibilité
et une comparaison fidèle ; AP2 ajoutera la persistance des variantes/avis,
AP3 la première écoute accompagnée, AP4 les conversations guidées, AP5 les
ajustements de Max et AP6 Emma. Ne pas absorber ces lots dans AP1.
Ne pas générer d'audio réel ni lancer de conversation humaine automatiquement.

## Implémentation

1. Ajouter une entrée admin « Atelier de parole », chemin
   `/admin/experience/atelier-de-parole`. Réemployer `SpeechAuditionBench` ;
   conserver l'accès TTS Config et éviter deux propriétaires audio actifs.
   Les autres fournisseurs et Emma restent disponibles par l'accès existant ;
   le parcours guidé AP1 se concentre sur Max avec son fournisseur actuel.
2. Parcours : objectif → préparer A/B → écouter → apprécier. Présenter cinq
   familles : fiche Notion (jeu/déclencheurs), rugosité (place des ruptures),
   GM (orientation du prochain tour), LLM (production des mots), synthèse
   (restitution). Les quatre premières sont des références en lecture seule
   dans AP1 ; liens directs vers leurs écrans existants. Ne pas exposer de
   contrôle app sans effet comme une capacité active du fournisseur.
3. Afficher environnement, personnage, version de fiche/copie disponible,
   variante du compilateur, rugosité, orchestration publiée, modèle et réglages
   LLM, mapping, voix et paramètres TTS. Distinguer inconnu, repli et valeur
   effectivement chargée ; ne pas inventer de version ni affirmer que les
   réglages affichés ont été entendus avant preuve de requête.
4. A = snapshot temporaire des réglages actuels ; B = copie modifiable avec
   les contrôles vocaux existants. Afficher le diff, proposer une seule
   variation à la fois. Premier essai proposé : `paddingBonus` de Max actuel
   contre 0, si la valeur actuelle diffère ; sinon proposer un pas de 0,2
   dans les bornes existantes. Cela reste un brouillon d'audition et une
   hypothèse, jamais un réglage recommandé comme meilleur ou sauvegardé live.
5. Première comparaison sur M1 et M2 du corpus existant ; autres cas ensuite
   sélectionnés explicitement. Montrer leurs contextes proposés, les états
   nommés de la fiche et le texte éditable. Ne plus attribuer silencieusement
   le premier état à tous les cas : sélection explicite avant l'écoute.
   Même texte, état, voix, rugosité et transport pour une paire A/B.
6. Transport par défaut = configuration actuelle de la sandbox : REST si
   streaming désactivé, WS sinon. Le banc force actuellement WS avec un
   snapshot d'audition : introduire un choix explicite à cette frontière,
   réutilisant `generate` ou `createStreamingPlayback` selon le choix.
   Indexer le cache par transport demandé et conserver le transport effectif.
   WebSocket expérimental et pauses A2 constituent une comparaison séparée ;
   un repli REST est visible et ne valide jamais les pauses WS. Aucun réglage
   de streaming ou de pauses du jeu n'est changé.
7. Gradium : `padding_bonus` = rythme global ; les pauses explicites nécessitent
   WS et les gardes A2 ; émotion/delivery/instruction/débit relatif ne sont pas
   présentés comme un acting Gradium appliqué. Garder les tags fermés.
   Preuves et JSON repliés, explications et valeurs lisibles au premier niveau.
8. Garder appréciations et export actuels, temporaires. Dire qu'ils ne sont
   pas conservés après fermeture ; la sauvegarde dans le back-office est AP2.
   Aucun bouton « retenir » ne doit laisser croire à une application au jeu.

Points d'entrée : `src/services/adminNavigation.ts`, `src/pages/Admin.tsx`,
`src/components/SpeechAuditionBench.tsx`, `src/services/tts/speechAudition.ts`,
`speechPerformanceSettings.ts` et `providers/gradium.ts`. Adapter les tests
existants ; aucun second lecteur ni moteur de préparation du texte.

## Invariants et accès

Max conserve ses états propres et leur évolution selon l'échange ; aucun cycle
imposé, état statique, tic ou bégaiement ajouté. Garder mots, faits, situation
actuelle canonique et distinction souvenir J−2 / présent. Ne modifier ni
fiches Notion, prompt effectif GM, modèles/températures de jeu, voix, budgets,
mapping enregistré, activations live, capture/STT/mains libres ou transferts.
Pas de migration, Edge Function, secret, backend externe ou publication.

Réutiliser snapshots d'audition isolés, cache borné (16 écoutes / 16 Mio),
capture WS bornée, arrêt et protection contre les callbacks périmés. Rejouer
le même audio depuis le cache sans nouvel appel ; après fermeture, ne pas
présenter une régénération comme le son exact déjà entendu. Zéro appel audio
au chargement ou au simple changement de réglage. Séparer TTS et voix-à-voix.

Notion natif **Gamilab**, vérifier get-self
`7e1a9a09-09cb-4deb-a306-83a29b831bc2` avant lecture/écriture. Tâche existante :
https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d ; rapport éditorial :
https://app.notion.com/p/40462322e59580ca98a4d6148d8ce406.
Max actif `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9`,
Emma active `dfcc15f8-9d37-45f7-8c84-d0c24a4288cf`.
Ne pas déduire une désynchronisation d'un refus d'accès. Aucun navigateur
Notion, workspace Ulrich de substitution ou lecture Gami DigiDouble.

Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
`5glbtPltldwz9tgNwIi4`, unique chaîne. Toute lecture SQL passe par ce MCP,
pas par Supabase générique. Vérifier la cible native avant action Cloud.
GitHub natif prioritaire ; si Unknown tool, réutiliser git/gh et l'identité
existante vérifiée, sans login/refresh/logout. Navigateur seulement pour
validation visuelle ou absence établie d'outil adapté ; aucun animal affiché.

Observations du 28 octobre, à relire sans les restaurer : sandbox-ulrich,
Max rugosité 3 / Emma 2, Gradium REST, pauses expérimentales inactives et
mapping `2026-10-25T11:39:32.000Z`. Prompt GM publié distinct du prompt de
base du code : seule une inspection de l'effectif permet de conclure.

## Vérifications, CT2 et livraison

- Tests ciblés : route et accès, lecture des références, A/B temporaire,
  sélection explicite d'état, fidélité affichage/requête, REST direct/WS/repli,
  état/voix propres, refus production et contexte étranger, absence de save
  live, cache exact/invalidation, arrêt et callbacks tardifs.
- Vérification visuelle de la preview authentifiée : explications, diff A/B,
  états et transports lisibles, absence d'audio automatique, clavier et écran
  étroit. Fournisseurs simulés pour les tests ; écoute humaine non revendiquée.
- `npm run test:quality` puis `npm run test:delivery` verts avant push.
  Tout le lot, plan, CHANGELOG et reprise AP2 committés avant le premier push.
- Mesure CT2 horodatée : début du travail, premier push, qualité locale, run/job,
  installation navigateurs, E2E, retries/annulations et fusion ; distinguer
  travail/attente et préparation documentaire. #104 : 22 min 26 s PR +
  24 min 16 s main, total 46 min 42 s dont 40 min 28 s E2E. Pas de moyenne
  hétérogène, promesse de vitesse du modèle ni parallélisation des E2E.
- Une CI complète sur PR/HEAD exact contenant main, run et job
  `regression-gates` verts. Fusion exclusivement par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
  Vérifier arbre et parent fusionnés, main GitHub puis checkout ; supprimer
  seulement la branche AP1 distante et locale. Aucune seconde campagne main.
- Vérifier Lovable synchronisé, distinguer preview/staging et production ;
  aucune publication. Notion : relire la tâche, préserver Source, actualiser
  Last updated by avec Codex, faits datés/liés et reçu de livraison, puis relire.

## Clôture et reprise obligatoires

Actualiser le plan courant : périmètre réellement livré, critères vérifiés,
limites et recette humaine ouverte. Le bilan cite liens du résultat/plan/PR,
SHA main, CI/HEAD, arbre/parent, absence attendue de campagne main, branches
restantes et états local/GitHub/Lovable/production. Ne pas abandonner un lot
à l'ouverture de la PR ni déléguer l'attente de CI à Ulrich.

Dans ce même lot, préparer et enregistrer
`docs/prompt_reprise_atelier_parole_lot_ap2.md`, autonome avec état vérifié,
sources, périmètre, invariants, validations, livraison et première action.
Inclure dans AP2 la même obligation de prompt de reprise et de lien final.
**Donner son lien direct dès la clôture, sans attendre qu'Ulrich le réclame.**
La préparation de cette passation ne lance pas AP2 ni une séance d'écoute.
Si un blocage subsiste, décrire le lot incomplet et la seule action humaine
indispensable, en livrant néanmoins la reprise avec le reste exact.
