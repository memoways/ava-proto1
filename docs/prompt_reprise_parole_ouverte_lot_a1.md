# Prompt autonome — Ava, A1 : laisser la pensée ouverte

Exécute et livre **uniquement le lot app A1**, dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`. Lis AGENTS.md et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Implémentation, tests et livraison complète sont attendus ; ce prompt n'est pas
une demande de nouveau plan. Un seul agent sur le dépôt, aucun sous-agent,
clone ou nouveau worktree. Réutilise l'identité GitHub configurée.

## 1. Reprendre sans perdre le travail préparé

La base de code vérifiée le 25 octobre 2026 est main
`147cdfff893555ede4f903158c5506dcf586e116` (#76). Le passage entre personnages
fonctionne à nouveau, confirmation d'Ulrich. Ne refais pas le chantier de
transfert. Les protections éditoriales des compilateurs (#75) et la récupération
sûre (#76) sont déjà livrées ; naturel vocal et nouveaux effets audio ne sont
pas encore acceptés.

Le lot est préparé sur **`codex/parole-ouverte-a1`**, avec un commit documentaire
qui préserve les instructions Gamilab, le plan complet et ce prompt. Vérifie
l'état réel avant de le reprendre ; ne crée pas une seconde branche si cette
branche porte déjà la préparation d'A1. Si elle a été fusionnée ou si main a
avancé, lis le bilan du plan et les commits avant de décider ce qui reste.

Commence par `git fetch --prune`, derniers commits, statut, branches et PR
ouvertes. Préserve la PR étrangère #24 et toutes les branches étrangères.
Une activité étrangère récente ou un recoupement de fichiers impose de traiter
ce conflit selon AGENTS.md. Les documents de préparation sont du travail
autorisé : conserve-les et livre-les avec A1. N'absorbe pas d'autres changements
inconnus. Mets la branche à jour sans effacer les documents ni écraser du travail.

Sources du lot, à lire dans cet ordre :

1. [Plan opérationnel, A1 et dépendances](plan_lot_b_rendu_vocal.md#exécution-coordonnée-notion--app--25-octobre-2026).
2. [Direction de jeu et diagnostic établi](plan_parole_incarnee_personnages.md#direction-après-écoute--25-octobre-2026).
3. [Huit cas communs](tache_notion_parole_incarnee_personnages.md#corpus-commun--huit-cas-proposés-non-canoniques),
   comme exemples de calibration proposés, jamais comme répliques à injecter.
4. [Invariants voix et mains libres](plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2).

## 2. Coordination : Ulrich travaille dans Notion

**Ulrich met à jour lui-même les champs prompts des personnages dans Notion.**
A1 traite leur consommation par l'app, pas leur réécriture. Utilise les fiches
déjà synchronisées pour les replays. Garde un snapshot de test cohérent par
version ; des exemples d'une fixture ne deviennent jamais le canon futur.

- La source éditoriale Ava est **Gamilab**, toujours. Le workspace personnel
  Ulrich ne valide pas l'accès Ava. La connexion Gamilab existe déjà ; le dernier
  test après redémarrage renvoyait encore « OAuth authorization required » dans
  le contexte MCP de ce chat. Aucune expiration n'est démontrée. Réutilise une
  connexion native exploitable si elle est disponible ; sinon signale seulement
  la limite et poursuis A1, qui n'en dépend pas. Pas de nouvelle enquête OAuth
  ou de login/logout pour commencer ce lot.
- **Aucune écriture dans les fiches Notion, aucun écrasement des prompts Cloud,
  aucune synchronisation automatique ni rebuild RAG dans A1.** Ulrich garde la
  main sur l'édition et le moment d'intégration. L'absence d'accès MCP n'est pas
  un défaut de sync. Une lecture de base nécessaire passe exclusivement par
  MCP Lovable, projet `1265958d-b74e-40f2-917d-182fe05163fc`.
- Conserve le contenu, les moteurs intimes et les états de chaque fiche. Le
  code n'ajoute pas une direction d'acteur ou un catalogue de styles concurrent.
  Les noms d'état restent résolus depuis la fiche courante, pas une ancienne
  liste codée en dur. Les modifications éditoriales d'Ulrich seront intégrées
  et recettées distinctement, avant l'acceptation finale A4.

## 3. Résultat observable

Une prise de parole peut rester intentionnellement inachevée, par exemple :
« Moi, ça va. Non. J'en sais rien. Mais elle… ».
L'app doit permettre cette fin volontaire sans exiger une explication qui
résout la pensée. Une réponse pratique très nette doit rester possible aussi.

Il faut distinguer **fin technique normale du tour** et **pensée achevée**.
Un vrai flux tronqué, une citation ouverte ou une identité étrangère restent
refusés. Le mot « Bloqué » dans une intention ne prouve pas le jeu entendu.
A1 ne garantit ni souffle, ni silence acoustique précis, ni voix étranglée.

## 4. Diagnostic borné et corrections

Réutilise les constats déjà établis. Examine les prompts finaux des quatre
variantes et la chaîne réellement appelée, puis corrige les contradictions
techniques avec les champs Notion :

- `src/services/responseIntentStream.ts` : le contrat demande « achève ta
  réponse » tout en autorisant fragments et suspensions. Clarifie l'obligation
  de terminer correctement le flux, en laissant la pensée ouverte. Conserve
  brièveté, budget et en-tête privé compact ; aucun nouvel appel LLM.
- `src/agents/maxAgent.ts`, `maxPromptCompiler.ts`, `maxRichPromptCompiler.ts`,
  `maxOptimizedPromptCompiler.ts` : vérifie les contraintes réellement injectées.
  La variante sandbox enregistrée était optimized_v3, avec généralement une
  à trois phrases ; les règles 1–2 phrases d'autres variantes n'expliquent pas
  directement cet essai. Le contrat doit fonctionner avec les quatre variantes,
  sans évincer les unités éditoriales réservées ni augmenter leurs plafonds.
- `src/services/speechRugosity.ts` : le niveau 3 du directeur privilégie les
  états bloqués. Le réglage doit moduler les possibilités de la fiche et
  laisser ses déclencheurs décider, pas enfermer le personnage dans un état.
  Examine aussi l'effet de `selectSpeechState` sur les répétitions ; aucune
  rotation forcée ni relabellisation artificielle d'une déclaration livrée.
  Ne change un filtre que si un cas concret prouve qu'il contredit ce contrat.
- Le parseur accepte déjà une suspension terminale ou un tiret volontaire à
  EOF. **Privilégie les corrections de contrat.** N'assouplis pas la validation
  pour régler un problème seulement textuel. Toute modification du parseur
  exige un cas autorisé non couvert, reproduit avant correction, et ses négatifs.

Rugosité enregistrée : Max 3 / Emma 2 ; mapping sandbox version
`2026-10-25T11:39:32.000Z`. Ces réglages ne sont pas à augmenter ou sauvegarder
dans A1. Ne change ni modèle, température, budget 220 personnage / 950 GM,
timeout, voix, fournisseur, mapping ou versions d'orchestration publiées.

## 5. Vérification utile, avec critères de sortie

Ajoute seulement la couverture manquante et garde les contrôles existants :

1. Prompts finaux Max et Emma, dans les quatre variantes : champs propres
   conservés dans les budgets ; fin volontaire permise ; aucune phrase exemple
   ou nouvelle psychologie commune ajoutée en dur.
2. Pipeline de parole : fragment volontaire connu accepté à toutes les
   frontières SSE pertinentes ; complet ou fragment, les mots sont conservés.
   Vrais length/error/abort, fermeture parasite hors conditions autorisées,
   citation ouverte, structures privées et identité étrangère restent refusés.
3. Rugosité/états : 0 garde son chemin existant, niveaux 1–3 compatibles avec
   les déclencheurs de la fiche. Aucun état inconnu inventé, aucune variété
   mécanique imposée, aucune déclaration invalidée requalifiée en état joué.
4. Régression de passage dans les deux sens : accord courant réellement livré
   exploitable ; refus, rétractation, différé, référence invalide et résultat
   tardif toujours bloqués. Conserve preuve, gardes, persistance/CAS et clic.
5. Reçus delivered / uncertain / private exacts, aucun rejeu après premier son,
   récupération préalable existante toujours unique et bornée.

Un test de présence de consigne ne prouve pas une amélioration de jeu. Utilise
les outils de replay/banc existants pour une petite comparaison textuelle si
disponible, en distinguant sorties simulées et véritables sorties modèle.
N'ajoute pas d'infrastructure d'évaluation, de matrice massive ou d'appels audio
automatiques. L'écoute humaine et la calibration avec les nouveaux champs
Notion restent distinctes ; leur attente ne bloque pas la livraison technique.

Exécute les tests ciblés pertinents, puis `npm run test:quality` et les E2E
requis sur le code final. Réutilise les suites existantes de parseur, prompts,
speech states, orchestrateur, GM et handoff ; vérifie leurs chemins via `rg`.
Ne répète pas une suite verte sans nouvelle modification ou doute précis.

## 6. Limites du lot et livraison

Les lots A2 (pauses Gradium), A3 (réglages/banc) et A4 (accueils/intégration)
restent dans le plan. Dans A1, ne modifie ni la préparation TTS/Gradium, ni
l'admin vocal, ni les accueils, ni la capture ou les décisions mains libres.
Préserve experienceFrame et l'isolation des mémoires. Lovable / Lovable Cloud
restent l'unique chaîne ; aucun Supabase direct, migration ou hébergeur ajouté.

Actualise le plan opérationnel, le plan de direction, CHANGELOG et STORY avec
les constats, résultats et limites. Préserve la tâche éditoriale prête ; Ulrich
travaille déjà dans Notion, ne crée pas une tâche doublon ni ne lui attribue
une acceptation humaine implicite.

Commit/push/PR du seul lot A1, CI verte sur le HEAD exact avant squash,
CI main/E2E vérifiée selon le contrat du dépôt, synchronisation Lovable et
preview vérifiées. Attache la PR au chat. Supprime uniquement la branche A1
locale/distante après fusion ; conserve toutes les branches étrangères.
**Aucune publication production.**

Bilan final : changement concret, contrôles et limites ; lien du plan,
PR, SHA main, CI, checkout, branches restantes, états GitHub / Lovable / preview /
production. Une qualité de voix ou une recette humaine non mesurée n'est pas
acquise. Si une étape technique est bloquée, dis-le sans déclarer le lot terminé
et donne une seule action humaine précise. N'attends pas un accès Notion pour
livrer les corrections app indépendantes qui sont déjà autorisées.
