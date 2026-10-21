# AVA — Reprise autonome du switching, lot 3 seulement

Travaille uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`, en français. Aucun autre clone/worktree.
Lovable / Lovable Cloud est l'unique chaîne de compilation et de publication ;
son Supabase est fourni par Lovable. Aucun hébergeur ou Supabase externe.

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
   1/2 dans `docs/plan_changement_interlocuteur_manuel.md`, les prompts de reprise
   des lots 1/2, les entrées récentes de CHANGELOG/STORY et ce prompt.
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
   `iralfqlslqndgvexixis`. Aucun changement Cloud ou publication dans ce lot.

## Références de livraison vérifiées le 21 octobre 2026

- Lot 1 : #54 et #55, `d89a68b5d004174ce731c1e9811387ec09e0d603`.
- Finalisation révélée par l'intégration : #56, merge
  `a26d1e7167da3c11d68cd3d66952c0db2bcb1250`. Refus « je préfère que tu restes
  avec moi » protégé sans inventer de refus dans un souhait nié. Deux revues
  sans constat ; 45 E2E locaux sans retry. CI `39594897594` verte sur le HEAD
  exact `970cea0d99774f4970b4a79a7a3ba38815e411f7` avant fusion. Lovable synchronisé.
- Lot 2 : [PR #57](https://github.com/memoways/ava-proto1/pull/57), merge
  `8ff0bad230a67123fb7f82d966a5ce1abfbeb06b`. Implémentation `bfb8f18`, corrections de revue `09bb35c` et `540738c` ;
  le HEAD final et ses contrôles sont décrits dans le plan et la PR.
- CI finale du lot 2 : `39601205173`, verte sur le HEAD exact `d7c264348967664e747a69882536de1b8e22653c`
  avant fusion. Qualité locale : 728 unitaires, 41 intégrations, 48 régressions,
  typecheck/lint/build verts ; avertissement hooks `finishInputTelemetry`
  préexistant. Suite locale complète : 61/61 E2E sans retry, avec un worker. Les preuves rouges/vertes,
  les incidents de test et les revues sont conservés dans le plan.
- Lovable au contrôle après fusion : `8ff0bad230a67123fb7f82d966a5ce1abfbeb06b`, `ready`, agent terminé.
  Code synchronisé ; aucune nouvelle publication produit ni recette humaine.
- Départ : **main réel après fetch**. Une PR de clôture documentaire peut suivre
  le merge technique ci-dessus ; ne restaurer aucune ancienne révision. Vérifier
  cette clôture et la CI post-fusion. Si un défaut du lot 2 subsiste, le finaliser
  avant le lot 3. Le checkout était propre au relevé de clôture ; recontrôler.
- Sauvegarde temporaire du lot 2 conservée : stash
  `7b42b9160e7672bfd2a45e3b505c3cd815a3d586`, nommé
  `lot-2-in-progress-before-lot-1-veto-finalization`. Son contenu a servi à la
  reprise avant les corrections finales ; **ne pas le réappliquer** sur main.
  Le contrôle automatique a refusé sa suppression, donc il reste conservé.
  Ce n'est pas une modification locale à livrer ni un travail du lot 3.

## Ce qui est branché au lot 2

- `characterHandoff.ts` vérifie le contrat du lot 1 : accord et cible cohérents,
  preuves exactes dans le reçu délivré, refus/contradictions prioritaires, tour et
  version courants. Les anciens filtres ne bloquent plus l'autorisation runtime.
  Les regex historiques restent pour guidance/tests de caractérisation, sans
  alias global Matt → Max.
- `characterHandoffState.ts` : enveloppe v2 dans `pending_handoff`, révision
  unique, session/source/cible/tour/version et preuve référencée. États stables
  none/awaiting_character/available ; états de transport locaux dans Index.
  L'offre expire à la prochaine soumission, au refus, au changement d'acteur ou
  version, et à la fin. Demande différée : deux messages maximum, sans prolonger
  sa borne, confirmée defer à chaque GM courant ; absence/échec/refus/retrait la
  ferme. Une demande seule n'autorise jamais une offre. Ancien stamp inéligible.
- `sessionHandoff.ts` : CAS JSONB de l'enveloppe précédente + session active +
  source + version + compteur, avec sélection de ligne ; zéro ligne = conflit.
  Tour/transcript/preuves/offre et salut sont protégés par ce CAS. Un GM ancien
  ne peut pas écraser le transcript avancé dans un autre onglet. Pas de migration.
- Même appel GM enrichi des identifiants exacts, de la demande ouverte et du reçu.
  Instructions préparées activées par le contexte runtime, JSON compact ; budget
  950 tokens / timeout de la version conservés, aucun nouvel appel LLM. Batch :
  preuve intégrale conservatrice après lecture complète, aucune estimation partielle.
  Aucun gain de latence mesuré ; le PATCH d'acquisition de tour protège sa propriété.
- Clic : verrou synchrone des handlers PTT/HF et des contrôles jusqu’à la fin du
  salut ou à l’échec, fermeture capture/sortie existantes, revalidation puis
  sonneries existantes. Décroché : nouvelle revalidation et CAS avant affichage.
  Panne avant commit : source conservée, offre récupérable si incident transitoire.
  Refus métier : révocation. Panne audio après commit : cible connectée, micro
  fermé et reprise explicite. Saluts de retour brefs, mémoires privées séparées.
- Audit dans les événements existants et `SessionsTab` : recommandation GM,
  validation, offre disponible, clic, connexion et refus séparés. `executed` GM
  n'est jamais une preuve de bascule. Session, timer, rôle, film et posture conservés.
- Carte basse encore présente. Continuer à parler avec une offre est possible,
  pour permettre sa révocation à la nouvelle soumission. Aucune pastille nouvelle.
- v6 inchangée : seuil 4, quota 1, pause 2. Les fixtures peuvent autoriser deux
  sens avec quota 8 ; ce n'est pas un changement du Cloud. Brouillon sandbox de
  recette à 8 et publication sont réservés au lot 4. Les anciens onglets devront
  être rechargés pour cette recette coordonnée.

## Objectif limité du lot 3

Réaliser seulement **la pastille et sa symétrie**, sur le moteur du lot 2 vérifié.
Ne pas lancer la campagne humaine, publier le produit ni modifier les réglages
Cloud du lot 4. Avant de modifier, actualiser le plan existant dans `docs/` avec
les dépendances réellement constatées. Baseline → test rouge → correction minimale.

1. Sous la pastille active en haut à gauche, afficher uniquement pour une offre
   disponible un bouton arrondi avec le portrait runtime de la cible, « Appeler
   Max/Emma » et une pulsation douce. Supprimer la carte basse et garder un seul
   emplacement d'appel. Action secondaire « Rester avec Emma/Max » révoquant l'offre.
2. Accessibilité : cible tactile ≥44 px, clavier, focus visible, nom explicite,
   annonce discrète à l'apparition, prefers-reduced-motion sans animation ; la
   disponibilité demeure lisible sans mouvement, à 390 px comme sur desktop.
3. Conserver les gardes et callbacks du lot 2. Appel bloqué pendant mic_starting,
   parole/finalisation, validation/sonnerie/changement ; échange possible tant que
   le joueur n'appelle pas. Nouvelle soumission révoque l'offre. Rien d'automatique.
4. Utiliser les portraits/fiches/voix runtime attribués à la bonne cible, dans les
   deux sens, sans mémoires privées partagées. Corriger seulement les aides admin
   prévues : seuil appliqué aussi aux demandes explicites, quota comptant les
   transferts exécutés. Ne pas assouplir silencieusement les gardes de la v6.
5. `experienceFrame.ts` reste l'unique constructeur du cadre partagé, injecté
   identiquement chez personnage et GM. Film initial conservé après intro replay.
   Décisions mains libres exclusivement dans `handsFreeVoice.ts`, candidats
   réversibles et stratégie texte de retour arrière préservés. Aucun provider
   ni paramètre de voix modifié ; réutiliser les primitives de fermeture existantes.
6. Revue des consommateurs, reprise et parseurs compris. Tester l'offre absente,
   disponible/révoquée, ciblage portrait/nom, clavier/mouvement réduit, mobile,
   deux sens, double clic, indisponibilité, sonnerie et maintien du timer.
   Conserver les tests de concurrence, de mémoire et de callbacks du lot 2.

Fichiers principaux : `src/components/prd4/ConversationScreen.tsx`,
`src/pages/IndexPRD4.tsx`, `CallingMaxScreen.tsx`, `src/components/admin/GameMasterSettingsTab.tsx`,
`src/services/characterHandoffState.ts`, `sessionHandoff.ts`, tests composants et
`tests/e2e/prd4-happy-path.spec.ts`. Ajuster aux sources réelles.

## Critères de sortie et clôture obligatoire

1. Actualiser `CHANGELOG.md`, `STORY.md` et le plan avec les faits vérifiés,
   preuves rouge/vert, limites et états préparé/branché/testé/synchronisé/publié.
2. Tests ciblés puis `npm run test:quality` et `npm run test:e2e` complets.
   Ne masquer aucune régression ni affaiblir d'assertion. Revues Standards/Spec
   indépendantes, corriger les constats puis vérifier le HEAD corrigé.
3. Livrer uniquement le lot autorisé par branche et PR. **Fusion exclusivement
   après CI verte sur le HEAD exact**. Puis main local/distant, propreté et
   synchronisation Lovable vérifiés. Aucun déploiement autonome ; une CI verte
   ne prouve pas une conversation humaine réussie.
4. Actualiser dans Notion les seuls faits/décisions durables de projet : relire
   avant édition, réutiliser l'entrée AVA, préserver Source, Last updated by=Codex,
   vérifier par lecture. Aucune préférence personnelle inventée, aucune écriture
   Conare, aucun secret/transcript complet/code copié/état temporaire.
5. Sauvegarder le prompt autonome du prochain chat dans
   `docs/prompt_reprise_switch_personnages_lot_4.md` seulement si le lot 3 est
   entièrement fini ; sinon sa finalisation d'abord. Reprendre ces obligations.
   Inclure objectif limité, contexte, branche/commit réels, modifications locales,
   PR/CI, Lovable, fait/restant, fichiers et critères. Rafraîchir après fusion.
6. Donner résultat, liens, contrôles et états local/GitHub/preview/production,
   puis le prompt du prochain chat prêt à copier avec lien vers le fichier.
   Aucun lot suivant ni nouveau chat lancé automatiquement. **Arrêter après le lot 3.**
