# AVA — Reprise autonome du switching, lot 4 seulement

Travaille uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`, en français. Aucun clone ni worktree ajouté.
Lovable / Lovable Cloud est l'unique chaîne de compilation et de publication ;
son Supabase est fourni par Lovable. Aucun hébergeur ou Supabase externe.
Cette demande autorise uniquement le lot 4, après vérification et finalisation
de tout défaut restant du lot 3. Ne lance aucun autre chantier ni nouveau chat.

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
  que CHANGELOG/STORY/plan et ce prompt ; vérifier son merge et la CI post-fusion
  sur le main réel. CI main technique `39667347427` démarrée au relevé, pas une
  preuve de succès tant que sa conclusion n'est pas contrôlée.
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
2. Préparer dans sandbox-ulrich uniquement un brouillon issu de la v6 pour la
   recette bidirectionnelle : maximumHandoffsPerSession=8, seuil 4 et pause 2
   conservés. Décrire le changement concret, sa version et sa portée avant
   activation via le flux admin/Lovable Cloud. Ne modifier ni la production
   narrative par défaut ni une session en cours ; les sessions épinglent leur version.
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
