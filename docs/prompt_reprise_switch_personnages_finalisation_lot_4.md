# AVA — Finalisation autonome du switching, lot 4 seulement

Travaille uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`, en français. Aucun clone ni worktree ajouté.
Lovable / Lovable Cloud est l'unique chaîne de compilation et de publication ;
son Supabase est fourni par Lovable. Aucun hébergeur ou Supabase externe.
Cette demande autorise uniquement le lot 4, après vérification et finalisation
de tout défaut restant du lot 3. Ne lance aucun autre chantier ni nouveau chat.

## Relevé prioritaire — reprise du 22 octobre 2026 à 19 h

**Lot 4 incomplet, aucune nouvelle publication produit.** La recette au casque
`2b30d900-b597-42c2-8fe9-6982a9dda51d`, 19:19:06–19:24:10 Europe/Paris, est
clôturée user_hangup, Emma, compteur 0, v7, film vu, rôle/posture null,
diagnostic complet. Ulrich confirme accords entendus, son parfait/stable au
casque et aucune pastille. Ne pas déduire une cause acoustique exclusive de la
comparaison avec les haut-parleurs. Aucun nouvel appel ouvert en attente.

#64 fusionnée dans `56f6b6220316d6a71eb0016ba1a4b4c2af4dcd30` après CI
`39781012004` verte sur le HEAD exact `90d443af10c6d6381a9528f4936afe8f4f08e1c2`,
753 unitaires / 41 intégrations / 48 régressions et 65 E2E (10,2 min), deux
revues indépendantes sans constat. Main propre après fetch/pull, Lovable même
SHA ready/agentFinished, workspace Memoways vérifié. CI post-fusion
`39821136410` : tentative 1 interrompue à vingt minutes sur les téléchargements
Ubuntu Azure, avant E2E ; relancée au même SHA, résultat final à relire.

Défaut reproduit de la recette : demande T7 interrompue sans réponse délivrée ;
T8/10/11 reçoivent tous openRequest=null. Le GM invente pourtant une origine
T7 puis T8, en citant un autre message. Au T11 l'accord est complet et délivré,
GM accept/max, mais request_unresolved est le refus correct d'une preuve invalide.
Ne pas rallonger la borne de deux messages, restaurer une ancienne demande,
réparer les identifiants/citations ou forcer une offre.

Complément source **`0cba219`**, en validation sur
`codex/character-handoff-lot-4-finalisation`, base `56f6b62` :
currentUserMessage associe texte/turnId/turnIndex exacts dans le
contexte du même appel GM. Instructions : seules sources player_request =
message courant ou openRequest non null ; une confirmation courante peut porter
l'intention de poursuivre le transfert, selon l'analyse sémantique du GM,
sans mot de passe ni oui hors contexte. Les propositions dites par le personnage
restent admissibles au tour courant. Aucun validateur/garde/CAS/capture/provider/
voix/budget/modèle/timeout modifié. GM_CODE_VERSION actualisée.
Baseline 102 verts, deux tests de données de contexte rouges, puis 115 ciblés
verts. Qualité complète **756 unitaires / 41 intégrations / 48 régressions**,
lint/typecheck/build verts ; **65/65 E2E locaux sans retry en 10,2 min**.
Deux revues indépendantes : Standards sans constat, ambiguïté Spec sur la portée
player_request corrigée puis revalidée sans constat. CI exacte encore requise avant
fusion, puis main propre/CI post-fusion/Lovable à vérifier. Les commits
documentaires suivent `0cba219` : relever le HEAD réel avant toute action.
Ces tests prouvent les données/instructions, pas la prochaine sortie du modèle.

Fichiers du complément : `src/agents/gameMasterPRD4.ts` et test handoff,
`src/services/gameMasterPromptBuilder.ts`, `src/services/characterHandoff.test.ts`,
CHANGELOG/STORY/plan et ce prompt. Vérifier HEAD, diff local et PR réels ; ne
restaurer aucune ancienne révision. Le relevé ci-dessous et les obligations
complètes en fin de document restent applicables, sauf états remplacés ici.
Après livraison vérifiée dans Lovable, reconfirmer disponibilité d'Ulrich au
casque puis nouvel appel Emma diagnostiqué et aller-retour. Publication produit
uniquement après résultat observable accepté ; sinon conserver cette reprise.
Arrêter après ce seul lot 4.

## Relevé historique — après la recette de 13 h du 22 octobre 2026

**Le lot 4 n'est pas terminé : recette humaine échouée, aucune nouvelle publication
produit.** Reprendre uniquement sa finalisation, sans lot 5 ni nouveau chat.

### Code et livraison à vérifier d'abord

- Checkout canonique ; branche documentaire de reprise
  `codex/character-handoff-lot-4-handoff`, basée sur le main technique
  **`1d967ed465d9bc93b5d48088d917c78937e36d37`**. Aucun correctif source local
  restant. Les commits documentaires suivent ce SHA : relever le HEAD réel,
  le statut/diff local, les PR et les CI avant toute action. Aucun travail
  étranger au relevé ; ne pas restaurer d'ancien main, stash, clone ou worktree.
- [PR #63](https://github.com/memoways/ava-proto1/pull/63) **fusionnée** dans
  `1d967ed465d9bc93b5d48088d917c78937e36d37` le 22 octobre 2026 à **14:29:48
  Europe/Paris**, après [CI 39776598519](https://github.com/memoways/ava-proto1/actions/runs/39776598519)
  verte sur le HEAD exact **`03f517e489b09a6fc1ae6025493a0e9ba1eea7eb`**,
  65 E2E réussis en 10,9 min. Révision source du complément :
  `6d9af383b55aaa43d571504d5ac55a40d5b7de38`.
  CI post-fusion [39778810723](https://github.com/memoways/ava-proto1/actions/runs/39778810723) **verte sur le SHA exact 1d967ed465d9bc93b5d48088d917c78937e36d37**, avec 65 E2E réussis en 10,3 min.
- #62 est fusionnée dans `019c6b5e7f044ce29f7defe538bca5aa1bc61e7f`, après
  [CI 39742163075](https://github.com/memoways/ava-proto1/actions/runs/39742163075)
  verte sur `e44e924305b750b5fad4bdd026ffc5e422f60ac3` exact.
  [CI post-fusion 39770267137](https://github.com/memoways/ava-proto1/actions/runs/39770267137)
  verte à la tentative 2 sur 019c6b5 ; première tentative interrompue pendant
  l'installation Playwright, qui ne vaut pas validation.
- Lovable **`1d967ed465d9bc93b5d48088d917c78937e36d37`**, projet ready,
  agentFinished=true, workspace Memoways vérifié. Preview rechargée à l'accueil,
  bundle DOM **`index-9btHN-X9.js`**, sans appel actif. Le complément est
  synchronisé en preview ; aucune nouvelle publication produit.
- Les CI précédentes de #63 sur 0829e77 et ea6feea sont historiques. Toute
  nouvelle fusion, y compris documentaire, exige sa propre CI verte sur le
  HEAD exact, puis main propre, contrôle post-fusion et synchronisation Lovable.
  Vérifier le statut de la PR documentaire de reprise ; ne pas la supposer fusionnée.

### Recette échouée et correctifs du même lot

Session **98c8a4c4-b2c9-474b-8d83-d6db2e599393**, 13:41:12–13:51:07
Europe/Paris, v7 Sandbox Ulrich, diagnostic complet, film vu, rôle/posture null.
**Clôturée user_hangup**, Emma, compteur **0**, preview à l'accueil et micro fermé.
Ulrich confirme cinq échanges, variations de volume/coupures difficiles à comprendre,
absence de pastille et erreur de finalisation de la réponse. Aucun retour réussi.

- **Règle produit confirmée par Ulrich : chacun reste de son côté ; seul l'appel
  est transmis.** Aucun rapprochement physique, présence à côté, écoute de la
  conversation opposée ou conférence. La procédure partagée personnage/GM est
  prioritaire sur une guidance contraire et injectée dans chaque variante du
  prompt personnage, même sans demande nommée ni guidance GM. Le cadre éditorial
  reste construit uniquement par experienceFrame, aucun lieu inventé ou déplacé.
- **T7 :** JSON GM complet, 686 tokens sur 950 au diagnostic. GM accept/max,
  mais targetEvidence ne cite que « lui » ; moteur **request_unresolved**, aucune
  offre. La réponse « Je peux lui demander » reste sémantiquement différée ;
  une mauvaise classification GM accept n'est pas un veto déterministe nouveau.
  Ne pas assouplir les preuves ou forcer l'accord pour obtenir une pastille.
- **T8 :** reçu persistant failed, delivered vide, 0 sample joué/planifié ; texte
  ponctué suivi de `\n</speech>`. Génération completed, **61 tokens** : pas de
  troncature établie. Erreur exacte **Incomplete response sentence or quote**.
  Le complément consomme uniquement cette fermeture de protocole terminale
  optionnelle avant les gardes existantes. Aucun tag transmis au TTS ; phrases,
  citations incomplètes, identité étrangère, structures ou texte après fermeture
  restent refusés. Aucun nouveau modèle/appel/budget/provider/voix/capture.
- **Volume : limite non résolue.** Nombreux candidats acoustiques atténués puis
  rejetés/repris ; T7 suspension 5 811 → 7 091 ms. Ce mécanisme peut produire une
  coupure, sans établir la cause acoustique exclusive ou une mesure de niveau.
  Lire le plan latence §3 avant toute modification de capture/interruption ;
  ne pas déplacer les décisions hors de handsFreeVoice. Ulrich confirme une
  écoute **sur haut-parleurs** : le retour acoustique est plausible, non prouvé.
  Comparer au casque pendant la prochaine recette avant tout réglage.

### Preuves de validation

Trois tests rouges (fermeture terminale et deux sens de séparation), puis huit
assertions de présence inconditionnelle rouges dans les quatre variantes.
Après correction : **118 ciblés verts**, y compris quatre variantes avec
**guidance GM contraire**, parsing fragmenté et consommateurs. Qualité complète
finale : **753 unitaires, 41 intégrations, 48 régressions**, lint/typecheck/build
verts ; avertissements hooks/bundle préexistants. **65/65 E2E locaux sans retry en 10,3 min**.
Deux revues indépendantes du complément : Standards sans constat, contrôle Spec
supplémentaire de guidance contraire ajouté et vert ; revalidation finale requise
sur tout nouveau changement. La CI verte de #63 porte bien sur le HEAD exact livré.
L'ancien échec future-video reste conservé dans le plan, non reproduit et sans
cause exclusive prétendue corrigée ; son composant/test sont inchangés.

### Prochaine action et clôture

D'abord relire la livraison réelle et la PR documentaire de reprise : CI exacte,
main propre et Lovable synchronisé. La v7 Sandbox Ulrich existante reste
publiée (**quota 8, seuil 4, pause 2**), v6 archivée ; production narrative v1 à
quota 1. Ne recréer ni republier une configuration de recette sans changement.

Quand Ulrich confirme être prêt, **nouvel appel Emma** depuis admin preview →
Sandbox Ulrich → Tester moi-même, diagnostic=full. Échanges naturels puis une seule
demande nommant Max après le minimum narratif ; inspecter JSON brut complet,
preuve et accord réellement entendu, offre/clic/sonneries/Max audible. Retour Emma
après pause et nouvel accord ; même session/timer/film/rôle/posture, compteur réel,
profils/voix et mémoires privées. Ulrich parle et confirme le son, l'agent vérifie
événements/persistance par Lovable natif. Ne pas répéter après refus ni injecter
une parole synthétique. Fermer chaque contrôle ; aucun appel ouvert en attente
de disponibilité. Publier uniquement après résultat observable accepté, via
Lovable, puis vérifier le frontend servi sans redéploiement de sondage.

Si défaut : baseline → rouge → correction minimale → ciblés → qualité/E2E complets,
deux revues Standards/Spec indépendantes et CI **du HEAD exact avant chaque fusion**.
À la fin, actualiser **CHANGELOG.md, STORY.md et le plan**, puis ce prompt si le
lot reste incomplet ou `docs/prompt_cloture_switch_personnages.md` s'il est terminé.
Inclure branche/commit réels, modifications locales, PR/CI, Lovable, fait/restant,
contexte/fichiers/critères ; rafraîchir après fusion. Appliquer
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

Notion canonique : vérifier workspace par connecteur natif, relire avant édition,
réutiliser la mémoire AVA existante, préserver Source, Last updated by=Codex,
vérifier chaque écriture. Aucun transcript complet, secret, état temporaire,
préférence personnelle inventée, écriture Conare, lecture Gami DigiDouble ou animal.
Donner résultat/liens/contrôles, états local/GitHub/preview/production et prompt prêt
à copier ; une seule action précise si Ulrich doit intervenir.
**Arrêter après ce seul lot 4, sans lot 5 ni nouveau chat automatique.**

Les relevés suivants sont historiques ; ce relevé prioritaire prévaut.

## Relevé historique avant cette reprise — 22 octobre 2026

**Le lot 4 n'est pas terminé.** Ulrich demande de continuer dans un nouveau chat
frais. Aucun appel de recette ne reste actif ; preview à l'accueil, micro fermé.

- Checkout canonique sur `codex/character-handoff-lot-4-closeout`.
  **Révision du dernier correctif : `453f39a2e7182a6ef306174af81edf2a251391f9`.**
  Une sauvegarde documentaire de cette reprise suit cette révision ; relever le
  HEAD réel avec git et le comparer au HEAD distant de la [PR #62](https://github.com/memoways/ava-proto1/pull/62).
  Les modifications ont été commitées pour la reprise ; vérifier propreté après
  fetch. Ne restaurer ni ancien main ni stash ; continuer cette PR non fusionnée.
- Main vérifié : `180e018714f1916ffe32df9a94df1906b1ee209b`, correctif #61.
  [CI post-fusion 39735148175](https://github.com/memoways/ava-proto1/actions/runs/39735148175)
  **verte**. Lovable est synchronisé sur ce main, ready/agentFinished.
  **Les nouveaux correctifs de #62 ne sont pas encore servis dans Lovable.**
- [CI 39736840084](https://github.com/memoways/ava-proto1/actions/runs/39736840084)
  **rouge** sur ancien HEAD documentaire `89c8d3c` (64/65 E2E), cause de fixture
  reproduite par trace et corrigée localement : attendre l'offre visible/persistée
  avant de désactiver Max. Trois répétitions ciblées vertes. Cette CI ancienne
  ne valide pas le nouveau code ; lire la nouvelle CI du HEAD exact après push.
- **140 tests ciblés finaux verts**, six fichiers, 1,55 s : contrat personnage,
  GM, mémoire, validateur, état, persistance. Deux revues finales source sans constat.
  Rouge→vert conservé pour format complet/téléphone, exemple d'action réellement
  nettoyé, relation absente et JSON tronqué. Les null/objets relationnels explicites
  invalides restent rejetés ; le refus T6 garde sa priorité sur defer.
- **Qualité finale non verte** : dernière commande `/tmp/ava-lot4-quality-final-compact.log`
  = 742/744 unitaires, 48 régressions vertes, intégration/build non exécutés après
  l'échec. Un test T6 attendait à tort defer plutôt que le refus prioritaire :
  assertion corrigée et ciblés verts. L'autre échec est `LatencyBlockingTab.test.tsx`
  « shows the measured video provider and avatar in comparisons and evolution »
  (`future-video` absent). Ce fichier est inchangé ; **cause non établie**, ne pas
  qualifier automatiquement de flaky ni masquer l'échec. Un contrôle précédent a
  eu un timeout pagination ; fichier isolé 8/8 vert, puis qualité intermédiaire
  739 unitaires/41 intégrations/48 régressions verte avant les derniers changements.
- **E2E complets du nouveau code à relancer** : exécution intermédiaire arrêtée
  après nouveaux constats, 44 passent, un interrompu, 20 non exécutés (7,4 min),
  `/tmp/ava-lot4-e2e-final.log`. Aucun succès complet final revendiqué.
  Les 65 E2E locaux/CI verts cités plus bas concernent le correctif #61.
- Fichiers du dernier correctif : `src/services/characterConversation.ts` et test,
  `src/services/gameMasterPromptBuilder.ts`, `src/agents/gameMasterPRD4.ts` et test
  handoff, `src/services/characterHandoff.test.ts`,
  `tests/e2e/prd4-happy-path.spec.ts`, CHANGELOG, STORY, plan et cette reprise.
  Aucun provider, voix, capture, Edge Function, migration, secret ou réglage de
  production changé. V7 Sandbox reste publiée ; ne pas en créer un doublon.

**Prochaine étape technique** : inspecter/reproduire l'échec future-video sans
modifier de code étranger, terminer `npm run test:quality`, puis les 65 E2E complets
sans affaiblir les assertions. Revalider les deux revues sur tout changement.
Actualiser la PR #62 et ses preuves. **Fusion uniquement après CI verte sur son
HEAD exact**, puis main local/distant propre, CI post-fusion et synchronisation
Lovable. Ensuite seulement, quand Ulrich est prêt, nouvel appel diagnostiqué
Emma → Max → Emma ; vérifier le JSON brut complet et l'accord réellement entendu.
Aucune nouvelle publication produit avant cette validation humaine acceptée.

Les relevés ci-dessous gardent la chronologie ; celui-ci prévaut pour l'état actuel.

## Relevé vérifié du 22 octobre 2026 — lot 4 incomplet

- Lot 3 et clôture #60 vérifiés sur `f01532be27840025836aee44316da5d50518defd`,
  CI pré/post vertes, checkout propre et Lovable synchronisé.
- Correctif du contrat effectif GM livré par [#61](https://github.com/memoways/ava-proto1/pull/61),
  merge `180e018714f1916ffe32df9a94df1906b1ee209b` à 08:37:51 Europe/Paris.
  [CI 39733628039](https://github.com/memoways/ava-proto1/actions/runs/39733628039)
  verte sur HEAD exact `0562abe37599618a39d93a4c8333b7bdf8b5d7c5`.
  Qualité : 736 unitaires, 41 intégrations, 48 régressions, lint/typecheck/build.
  65 E2E locaux sans retry en 10,0 min, CI 65 E2E en 10,2 min ; deux revues sans constat.
- Main local/distant `180e018` propre après fusion ; Lovable même SHA,
  ready/agentFinished. [CI post-fusion 39735148175](https://github.com/memoways/ava-proto1/actions/runs/39735148175)
  à relire dans GitHub au départ, avec la CI de clôture documentaire.
- Branche de clôture `codex/character-handoff-lot-4-closeout`, base `180e018`.
  PR #62 : CHANGELOG, STORY, plan, cette reprise et préparation du test E2E de
  révocation ancienne. CI `39736840084` rouge sur `89c8d3c` (64/65) : trace
  confirmant la désactivation Max par la fixture avant création de l'offre.
  Attente explicite de l'offre visible/persistée ajoutée avant la panne simulée,
  sans affaiblir les assertions. Vérifier la revalidation et la CI du nouveau HEAD.
  Vérifier sa fusion et sa CI exacte après fetch ; le départ
  reste le main réel, jamais une ancienne révision à restaurer. Aucun travail étranger.
- V7 sandbox-ulrich `98145fe3-96f1-4525-84c2-0e0a1cc5c6da` publiée depuis v6
  `9217fd34-321a-45c7-8363-6a8cf0b0157c` : quota 8, seuil 4, pause 2.
  Seuls le quota JSONB et sa mention textuelle passent de 1 à 8 ; reste identique
  à v6. V6 archivée, ses 21 sessions conservées. Production narrative v1 à quota 1.
- Première recette `18e7d9f8-e65b-425e-bc69-ca58ca6cb231`, 08:11:15–08:16:53,
  clôturée user_hangup, Emma/v7, compteur 0, film vu, player_role null. Ulrich
  confirme voix et accord entendu ; aucune pastille, GM accept/max, action none,
  contrat nettoyé null, assessment_missing. Échange pronominal sans Max nommé.
  Aucune cause exclusive ni réussite du transfert prétendue.
- Correction : extension runtime prioritaire sur schéma historique fermé, clé
  handoff_assessment à la racine et requise avec contexte ; accept courant
  distinct d'une suggestion future. Parseur, preuves/gardes, modèle, 950 tokens,
  timeout et voix conservés. Deux tests rouges puis 114 ciblés verts.
- Deux E2E preview isolés non concluants : login Lovable avant AVA. Brave déjà
  authentifié accède à la preview ; aucun cookie copié ni contournement.
- Décision durable sauvegardée et relue dans Notion AVA ; Source conservée,
  Last updated by=Codex. About et Conare inchangés.
- Contrôle diagnostiqué `81e5fdca-e3be-4fc8-b170-7c68672e9307`,
  08:39:45–08:47:51 Europe/Paris, **clôturé user_hangup**, aucun tour utilisateur,
  compteur 0, Emma/v7, film vu, player_role null, diagnostic_trace_enabled=true.
  Aucun prompt/JSON GM produit faute d'échange. Preview `index-Ch9HRnsK.js`
  laissée à l'accueil, micro fermé et aucun appel de contrôle actif.
- **Aucune nouvelle publication produit demandée ou effectuée.** La configuration
  sandbox publiée ne constitue pas une publication du frontend. Aucun succès
  humain après correction ni aller-retour réel n'est encore attesté.
- Troisième appel réel `ce05527f-a7f5-4a1c-b914-f82227fb5419`,
  09:08:31–09:21:55 Europe/Paris : v7, Emma, film vu, rôle/posture null,
  compteur 0 ; **clôturé user_hangup**, micro fermé. Ulrich confirme les réponses
  puis une demande unique nommant Max et aucune pastille. Emma répond sous
  condition ; JSON brut GM T10 incomplet, coupé dans handoff_assessment,
  938 tokens sur budget 950, invalid_json. Aucune autorisation ni transfert.
- Précision d'Ulrich : proposer de **passer l'appel au téléphone**, sans venue
  physique. #62 porte désormais les correctifs runtime en plus de la préparation
  E2E : contrat d'action partagé personnage/GM, exemple JSON complet compact,
  preuve avant mémoire, mémoire différentielle. Le nettoyeur préserve l'absence
  de proposition relationnelle ; toute proposition explicitement invalide reste
  rejetée. Même modèle/appel/950 tokens/timeout ; aucun provider, voix ou cadre
  éditorial partagé modifié. Vérifier sa CI exacte et son état de livraison.
- Limite sémantique : la condition « peut-être… à condition qu'il accepte »
  doit rester defer. La probe GM accept n'est pas un veto déterministe existant ;
  aucune regex générale n'a été ajoutée. Le test couvre GM defer comme T6/T9,
  sans prétendre garantir une mauvaise classification. Nouvelle recette brute
  nécessaire ; aucune réussite du correctif compact encore attestée.

## Prochaine action précise

Quand Ulrich confirme être prêt à parler, ouvrir **un nouvel appel Emma** via
admin preview → Sandbox Ulrich → Tester moi-même, avec diagnostic=full.
Ne pas réutiliser les appels clôturés ni lancer une session pendant une attente
de disponibilité. Échanges naturels, puis une seule demande **nommant Max**
après le minimum narratif ; vérifier prompt et JSON bruts via Lovable Cloud,
preuves/offre/clic/sonneries/connexion, puis retour après pause et nouvel accord.
Vérifier d'abord les correctifs #62 sur main et synchronisés dans Lovable.
Ulrich parle et confirme le son ; l'agent vérifie les événements et la persistance.
Ne pas répéter après refus ou présenter une parole synthétique comme réussite humaine.
Publier le produit uniquement via Lovable après résultat observable accepté,
puis vérifier ce qui est réellement servi, sans redéploiement de sondage.
Si la recette reste incomplète, actualiser cette finalisation ; sinon sauvegarder
la clôture autonome, sans inventer de lot 5 ni lancer de nouveau chat.

Le contrat complet et les références historiques ci-dessous restent applicables.
Le relevé ci-dessus décrit l'état plus récent ; contrôler la clôture documentaire
et le main réel avant reprise.

## Vérifier l'état réel avant toute modification

1. Lire `AGENTS.md` et les instructions applicables. Vérifier le workspace Notion
   canonique `377e8583-7838-4c05-9f76-8833a450f304` par le connecteur natif
   (`get-self` si exposé, sinon `fetch("self")`, puis `self.workspace.id`).
   Lire About `3f7511682fc3817ba383d01afbfd2ee0`, les règles de mémoire
   `400511682fc381baac1ad7c480fdbe70`, rechercher la mémoire AVA dans Memories
   `3f7511682fc38198a728fa2f0af72e76`, puis ses sources application/PRD/tâche.
   Une recherche vide impose la lecture directe de la base. Aucun accès à
   Gami DigiDouble ; aucun animal affiché. Ne pas contourner Notion par navigateur.
2. Lire intégralement la proposition du 19 octobre et les comptes rendus des lots
   1/2/3 dans `docs/plan_changement_interlocuteur_manuel.md`, les prompts de reprise
   des lots 1/2/3, les entrées récentes de CHANGELOG/STORY et ce prompt.
3. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`
   et `docs/plan_optimisation_latence_voice_to_voice.md` §3 avant tout changement
   de capture ou interruption. Ne pas refaire l'enquête Cloud de l'ancienne session.
4. Vérifier statut, branche, remote, main local/distant après fetch, PR et CI.
   Préserver les travaux étrangers. Branche dans le checkout canonique.
   Réutiliser l'identité GitHub déjà configurée ; pas de login/refresh/logout.
   Un refus de sandbox/réseau/trousseau n'est pas une expiration. Vérifier client,
   configuration App, environnement sans secrets et accès système avant d'en conclure
   qu'une reconnexion est nécessaire. Une configuration App présente invalide doit
   échouer explicitement ; aucune substitution silencieuse d'identité.
5. Vérifier le projet Lovable natif `1265958d-b74e-40f2-917d-182fe05163fc`,
   workspace Memoways `5glbtPltldwz9tgNwIi4`, Cloud Supabase
   `iralfqlslqndgvexixis`. Toute action Cloud doit rester dans ce projet Lovable,
   être explicitement décrite et vérifiée ; ne rien changer avant le contrôle du lot 3.

## État livré à relire après fetch

- Lot 1 : #54/#55, puis finalisation #56 (`a26d1e7`) avant le lot 2.
- Lot 2 : #57, merge `8ff0bad230a67123fb7f82d966a5ce1abfbeb06b` ; CI
  `39601205173` verte sur HEAD exact `d7c264348967664e747a69882536de1b8e22653c`.
  Clôture #58 dans `9f5a405d475d7f8c36f350515a7eae0a7a9b637f`.
- Lot 3 : [PR #59](https://github.com/memoways/ava-proto1/pull/59), merge
  `6860d1450f4df5db3a3d8213887d5d4bf19bc1f3`, le 21 octobre 2026 à 22:05:56
  Europe/Paris. CI `39665006628` verte sur le **HEAD exact
  `c0b15cbbf08406834618fe50f1227696b2f4306f`** avant fusion : qualité et 65 E2E.
- Qualité locale corrigée : 734 unitaires, 41 intégrations, 48 régressions,
  lint/typecheck/build verts ; avertissement hooks finishInputTelemetry préexistant.
  **65/65 E2E locaux sans retry**, un worker, 10,2 min. CI : 65 E2E réussis en
  11 min. Deux revues Standards/Spec finales sans constat. Preuves rouges/vertes
  et incidents de test conservés dans le plan. Le premier E2E de reprise sans
  tour persistant était non concluant ; la reproduction avec tour a bien été rouge.
- Relevé après fusion : main local/distant `6860d1450f4df5db3a3d8213887d5d4bf19bc1f3`,
  checkout propre. La clôture sur `codex/character-handoff-lot-3-closeout` ne porte
  que CHANGELOG/STORY/plan, ce prompt et le maintien explicite de l'assertion de
  visibilité du portrait pendant les sonneries, en plus du src runtime. Aucun
  code produit changé. Vérifier son merge et la CI post-fusion sur le main réel.
  CI main technique `39667347427` verte sur `6860d14`, avec 65 E2E réussis.
- Lovable natif après merge technique : même SHA `6860d1450f4df5db3a3d8213887d5d4bf19bc1f3`,
  projet ready, agentFinished=true, workspace Memoways vérifié. Code synchronisé,
  aucune nouvelle publication produit ni recette humaine. Aucun changement Cloud.
- Décision durable Notion du lot 3 sauvegardée et relue ; Source conservée,
  Last updated by=Codex. About inchangé ; aucune écriture Conare.

Départ : main réel après fetch, jamais une ancienne révision restaurée. Les
commits de clôture documentaire peuvent suivre le merge technique : contrôler
leurs PR et CI. Préserver toute modification étrangère. Aucun stash historique
ne doit être réappliqué ; le stash du lot 2 `7b42b9160e7672bfd2a45e3b505c3cd815a3d586`
est conservé, son contenu précède les corrections finales et n'est pas un reste à livrer.

## Socle existant

- Lots 1/2 : contrat GM optionnel et preuves exactes du texte délivré, refus
  prioritaires, demande bornée à deux messages, aucune demande seule autorisante.
  État v2 dans pending_handoff, révision unique ; CAS sur enveloppe précédente,
  session active, source, version et compteur. Tour/transcript/preuves/offre/salut
  protégés ensemble. Zéro ligne = conflit ; anciens stamps inéligibles.
- Même GM enrichi du tour/version/reçu, budget 950 tokens et timeout conservés,
  aucun nouvel appel LLM. Batch : preuve conservatrice après lecture complète.
- Clic puis décroché revalidés. Verrou synchrone PTT/HF pendant transport ;
  capture et sortie fermées avec les primitives existantes. Sonneries d'origine.
  Commit avant acteur visible ; échec avant commit conserve source, incident
  audio après commit conserve cible connectée, micro fermé et reprise explicite.
- Mémoires privées séparées, salut bref au retour, session/timer/film/rôle/posture
  préservés. Cadre partagé construit uniquement par experienceFrame et injecté
  identiquement chez GM/personnages. Film initial conservé après intro replay.
  Décisions HF exclusivement handsFreeVoice ; candidats réversibles et stratégie
  texte de retour arrière conservés. Aucun provider ni paramètre de voix changé.
- Lot 3 : pastille Appeler unique sous le personnage actif, portrait runtime cible,
  Rester révoque. Pas de carte basse. Boutons clavier natifs (Espace n'ouvre pas
  le micro), focus visible, annonce discrète, cibles >=44 px, pulsation 3 s seulement
  si mouvement autorisé. Échange possible avant appel ; nouvelle soumission révoque.
  Gardes mic_starting/parole/finalisation/transport maintenues. Portrait runtime
  dans la sonnerie, revalidé au clic. À la reprise, profil cible lu uniquement pour
  une offre restaurable, sans bloquer l'actif ; réponse périmée ignorée.
- Aides admin exactes : seuil aussi sur demande explicite, quota des transferts
  exécutés. Audit GM recommande / moteur autorise / offre / clic / connexion.
- v6 inchangée : seuil 4, quota 1, pause 2. Le quota 8 des fixtures ne modifie
  jamais le Cloud. Aucun nouveau réglage, migration ou produit publié aux lots 1–3.

## Objectif limité du lot 4

Recette coordonnée et livraison Lovable, sans réimplémenter le moteur ni élargir
le périmètre. Avant toute modification, actualiser le plan existant dans docs.
Vérifier la réalité du lot 3 avant de préparer la recette. Si un défaut subsiste,
le reproduire, le finaliser et le livrer avant de déclarer le lot 4 terminé.

1. Confirmer qualité complète, E2E contrôlés et synchronisation du main courant
   dans Lovable. Vérifier la pastille en preview et la présence des portraits
   runtime ; tests simulés et conversation humaine sont des preuves distinctes.
2. Préparation déjà effectuée : réutiliser la v7 publiée dans sandbox-ulrich,
   issue de v6, maximumHandoffsPerSession=8, seuil 4 et pause 2 conservés.
   Relire sa différence et sa portée via Lovable Cloud ; ne pas recréer ni
   republier un brouillon si aucun nouveau changement n'est nécessaire.
   Tout changement supplémentaire doit être décrit concrètement avant activation
   par le flux admin/Lovable Cloud. Ne modifier ni la production narrative par
   défaut ni une session en cours ; les sessions épinglent leur version.
   Ne pas assouplir silencieusement les gardes. Recharger les anciens onglets.
3. Recette humaine naturelle : admin → Sandbox Ulrich → Tester moi-même, nouvel
   appel avec Emma ; échanges narratifs, demande unique, accord effectivement
   entendu, décision GM, apparition de la pastille, clic, sonneries et réponse
   audible de Max. Puis retour vers Emma après pause et nouvel accord. Ne pas
   multiplier les demandes après un refus ni injecter une parole synthétique
   pour prétendre à une réussite humaine. Ulrich accomplit la parole et confirme
   l'expérience audible ; l'agent vérifie événements et persistance par outils natifs.
4. Prouver même session/timer/film/rôle/posture, portraits/fiches/voix cibles,
   compteur des transferts réellement exécutés et confidentialité des mémoires.
   Tester les états de refus, indisponibilité, interruption et récupération
   nécessaires sans dépasser ce lot. Clôturer proprement les sessions de contrôle.
5. Publication produit exclusivement Lovable après résultat observable accepté.
   Aucun déploiement autonome ni publication déduite d'une CI verte. Vérifier
   ensuite l'interface réellement servie et l'état publié, sans répéter un
   déploiement pour sonder son statut. En l'absence de validation humaine,
   conserver explicitement cette limite et ne pas annoncer publié/corrigé.

Fichiers principaux à vérifier selon le défaut réel : ConversationScreen et
CallingMaxScreen dans src/components/prd4, src/pages/IndexPRD4.tsx,
src/components/GameMasterSettingsTab.tsx, services characterHandoff,
characterHandoffState, sessionHandoff, experienceDirector, experienceOrchestration,
tests de reprise/concurrence et tests/e2e/prd4-happy-path.spec.ts.

## Contrôles et clôture obligatoires

- Baseline → test rouge → correction minimale si modification nécessaire ; ne
  masquer aucun échec ni affaiblir les assertions. Tests ciblés puis
  `npm run test:quality` et `npm run test:e2e` complets. Consommateurs, reprise,
  parseurs et callbacks inclus. Deux revues Standards/Spec indépendantes,
  correction des constats et revalidation sur le HEAD corrigé.
- Livrer seulement le lot autorisé par branche/PR. **Fusion exclusivement après
  CI verte sur le HEAD exact** ; vérifier ensuite main local/distant, propreté,
  CI post-fusion et synchronisation Lovable. Préserver travaux et identités existants.
- Actualiser **CHANGELOG.md, STORY.md et le plan** : faits, preuves, limites,
  raisons, dates et états préparé/branché/testé/synchronisé/publié distincts.
- Notion : relire puis actualiser uniquement les faits/décisions durables dans
  l'entrée AVA existante ; Source conservée, Last updated by=Codex, lecture de
  vérification après chaque écriture. Aucune préférence personnelle inventée,
  écriture Conare, secret, transcript complet, code copié ou état temporaire.
- Sauvegarder un prompt autonome suivant avec ces mêmes obligations. Si lot 4
  incomplet, préparer sa finalisation dans docs/prompt_reprise_switch_personnages_finalisation_lot_4.md.
  S'il est terminé, sauvegarder une clôture autonome, sans inventer un lot 5,
  dans docs/prompt_cloture_switch_personnages.md. Inclure contexte, objectif,
  branche/commit réels, modifications locales, PR/CI, Lovable, fait/restant,
  fichiers et critères. Rafraîchir après fusion.
- Donner résultat, liens et vérifications, états local/GitHub/preview/production,
  puis prompt autonome prêt à copier et lien vers sa version sauvegardée.
  Fournir une seule action précise si Ulrich doit intervenir.
  **Arrêter après le seul lot 4 ; aucun nouveau chat lancé automatiquement.**
