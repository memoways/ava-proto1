# Prompt autonome — Ava, A4 : accueils et intégration éditoriale

Exécute uniquement le lot A4 dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`. Lis AGENTS.md et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Un seul agent, aucun sous-agent, clone ni worktree. Ce prompt prépare la reprise ;
sa création dans A3 ne lance pas A4.

## Première action exécutable et état à reprendre

Commence par `git fetch --prune`, statut, `git log origin/main`, branches et PR
ouvertes, puis lis le CHANGELOG. Mets le checkout à jour avant d’écrire. A3 part
exactement de `46d29a573eef5e44b808c37dcef78202499edc47` (passation #79), après
A1 #77 et A2 #78. Reprends le main réel et son bilan de livraison A3, sans revenir
à cette base ni perdre les corrections documentaires ultérieures. Le SHA de
fusion et les runs exacts de CI sont ceux du bilan de la PR A3 référencée dans
le plan opérationnel ; les vérifier par GitHub avant d’affirmer leur état.

État technique A3 vérifié dans le dépôt :

- Banc existant `SpeechAuditionBench.tsx`, audition Gradium WS par le moteur A2,
  snapshot temporaire explicite sandbox/personnage et base Gradium figée avant
  setup et repli ; version enregistrée conservée, aucune version Cloud inventée.
- Huit cas de la tâche proposés, non canoniques ; première comparaison sur
  M1/M2/E1/E2, ensuite seulement les finalistes cochés. Max 3 / Emma 2 au départ ;
  mêmes mots/voix/paramètres de base en A/B, un appel à la demande, aucun audio
  réel automatique ni matrice multi-fournisseurs.
- Paramètres effectifs, parties de contrôle, transports et repli exportables.
  Gradium : `padding_bonus` règle le rythme global, breaks WS 0,25/0,6/1 s,
  huit maximum ; émotion/instruction d’acting non appliquées. REST ne valide
  jamais les pauses WS. Aucun tag émotionnel spéculatif.
- Samples WS capturés opt-in et rejoués en WAV sans appel fournisseur ; capture
  30 s maximum, cache mémoire 16 écoutes / 16 Mio, clé sur tout le contexte,
  annulation et callbacks périmés protégés. Les métriques de génération du cache
  restent celles du fournisseur original ; métriques de lecture renouvelées.
- Sauvegarde distincte : sandbox exacte, contrôle de version/CAS, conservation
  des champs non édités, readback DB exact avant cache local, échec visible.
  Le mode A/B n’est jamais une activation live ni une sauvegarde implicite.
- Qualité locale : lint/types/build, 66 régressions, 1 010 unitaires et
  41 intégrations et 78 E2E verts sans retry (13,5 minutes). Livraison
  GitHub/Lovable et runs exacts à relire dans le bilan A3. Fournisseurs simulés pour les tests déterministes.
- Lecture MCP Lovable réelle : sandbox-ulrich et prod possèdent le mapping
  `2026-10-25T11:39:32.000Z`, `gradiumPausesEnabled` absent et
  `gradiumTagsEnabled=false`. Aucune écriture Cloud A3. Le runtime refuse A2
  en production même si un mapping est stocké. Aucun audio réel, gain acoustique,
  acting, latence matérielle ou acceptation humaine revendiqué. Production non publiée.

À la reprise A3, #24 `agent/test-gap-invitation-validity-multi-use` et 16 branches
locales étrangères existaient ; ne pas les modifier, fusionner, fermer ni supprimer.
Relire l’activité réelle. Ne créer qu’une branche A4 depuis main à jour et ne pas
recouper une PR ouverte. La branche propre A3 doit être supprimée après livraison ;
si le bilan signale un blocage, le résoudre avant d’ouvrir un chantier concurrent.

## Sources et routage

1. `docs/plan_lot_b_rendu_vocal.md` : bilans A1/A2/A3 et section A4.
2. `docs/plan_parole_incarnee_personnages.md` : direction validée après écoute.
3. `docs/tache_notion_parole_incarnee_personnages.md` : huit cas proposés,
   contextes à autoriser ; exemples à calibrer, jamais répliques injectées.
4. `docs/plan_optimisation_latence_voice_to_voice.md`, section 3 : interruptions
   réversibles et reprise sans rejouer les samples entendus.

Notion Ava est TOUJOURS Gamilab. Vérifie le workspace par MCP natif avant toute
lecture ciblée ou écriture. Sources : base Caractères AVA
`30362322e59580bbb7b8dd49d516b341`, Max `3f762322-e595-81ba-8241-c7f6b28f31fd`,
Emma `3f762322-e595-81f9-880f-e309adec7075`.
A3 ne disposait que du workspace Ulrich `377e8583-7838-4c05-9f76-8833a450f304` :
mauvais routage pour Ava, aucune lecture ni capitalisation Gamilab. Ne pas
redemander le choix, conclure à un défaut de partage/synchronisation ou relancer
OAuth sur cette seule preuve. Réutilise Gamilab natif s’il est disponible ; sinon
signale précisément la limite et avance uniquement les travaux indépendants.
Aucun navigateur Notion, transfert vers Ulrich ou tâche doublon. Gami DigiDouble
reste exclu. Les champs actuels sont annoncés synchronisés par Ulrich ; leur
édition continue de lui appartenir, aucune réécriture automatique de fiche.

Lovable / Cloud restent l’unique chaîne, projet
`1265958d-b74e-40f2-917d-182fe05163fc`. SQL uniquement par le MCP Lovable de ce
projet, jamais Supabase générique. Vérifie la cible avant toute intervention.
Réutilise les identités GitHub configurées : GitHub App si configurée, repli
personnel existant sinon, sans login/refresh/logout ni remplacement d’identifiants.

## Résultat A4 et limites

Le premier contact doit correspondre au personnage, avec trois entrées distinctes :
appel initial, premier transfert, retour. Inspecte d’abord les profils d’accueil
app, `src/services/characterConversationContinuity.ts`,
`src/services/openingTTSCache.ts` et les points d’accueil de
`src/pages/IndexPRD4.tsx`. Les profils contiennent un contenu d’accueil identifié ;
ne pas créer un prompt concurrent des fiches Notion.

Prépare un petit répertoire Max/Emma validable, sans nouvelle génération LLM à
l’ouverture, sans confidence prématurée, visite physique ou conférence inventée.
Ne transforme pas d’office les huit cas proposés en textes d’accueil canoniques.
Si les formulations ou leur validation manquent, prépare le diff concret dans
le plan existant et demande uniquement la décision éditoriale indispensable,
tout en terminant les travaux techniques indépendants. Sélection une fois par
appel, pas de répétition immédiate si un choix existe, pas de double lecture ;
cache indexé sur texte/voix/modèle/réglages pertinents et environnement.

Avant la recette finale, distinguer les modifications éditoriales E0 approuvées
des propositions. Intégrer seulement les éditions validées, puis synchroniser
les seuls champs concernés vers sandbox-ulrich par la chaîne existante. Relire
source/copie/prompt final et leurs versions. Aucun rebuild RAG pour ces seules
propriétés, aucune sync ou réécriture de prompts Cloud automatique.

La recette humaine vient après les vérifications techniques et cette intégration :
premiers contacts, sujet concret, rupture, éclair clair/espoir/fatalisme et
passages Max ↔ Emma. Déterminer si les mots et pauses fonctionnent séparément du
timbre. Une pause ne garantit ni souffle ni sanglot ; si le timbre reste détaché,
proposer au plus deux voix alternatives en audition isolée, sans changer les
voix/fournisseurs de jeu. Mesurer premier son séparément des silences voulus et
de la durée totale. Ne pas annoncer une recette acceptée ou une mesure réelle
sur la seule base des fournisseurs simulés.

## Invariants, tests et livraison

Conserver A1/A2/A3, contrôles séparés des mots, états validés propres au personnage,
reçus delivered/uncertain/private, samples, annulation et reprise sans rejeu après
son ; setup avant premier segment, récupération préalable unique et bornée.
Ne pas rallonger buffers/délais, modifier capture/STT ou décisions mains libres
(handsFreeVoice.ts), `experienceFrame`, mémoires isolées, gardes de transfert,
modèles/températures/voix de jeu et budgets 220 personnage / 950 GM. Pauses live
et tags Gradium fermés tant que l’écoute/activation n’est pas explicitement
acceptée. Aucun nouveau backend, hébergeur, secret ou publication production.

Ajouter seulement les tests manquants aux vrais points d’appel : trois contextes
d’accueil, choix stable, absence de répétition/double lecture, cache invalidé,
annulation et callbacks tardifs, passage Max ↔ Emma, reçus et offres cohérents.
Conserver les suites A2/A3, persistance/CAS et clic. Tests ciblés puis
`npm run test:quality` et E2E requis sur le code final, suites lourdes séquentielles.
Pas d’audio fournisseur réel automatique. Réutiliser le navigateur déjà connecté
pour la validation visuelle Lovable, sans transférer de cookies ni modifier ses
protections ; source synchronisée, profil CLI vierge et preview affichée sont
des preuves distinctes.

Actualiser les deux plans existants, CHANGELOG et STORY, pas de nouveau plan
concurrent. Livrer la branche propre par PR attachée au chat, CI verte sur son
HEAD exact avant squash puis CI main verte sur le commit de fusion, E2E compris.
Vérifier le même SHA Lovable et sa preview, supprimer seulement la branche A4
locale/distante. Préserver tous les travaux étrangers. Distinguer local, GitHub,
staging et production ; bilan avec SHA main, CI, checkout et branches restantes.

Clôture obligatoire dans le même tour : si un lot suivant existe, enregistrer
son prompt autonome `docs/prompt_reprise_<sujet>_lot_<id>.md`, actualisé avec les
faits vérifiés, sources, périmètre, invariants, validations, livraison attendue et
première action exécutable. Actualiser le plan et donner les liens directs du
plan, de la PR et de ce prompt. Transmettre cette même obligation sans lancer
le lot suivant. Sinon dire explicitement qu’aucun lot suivant n’est identifié.
Si bloqué, livrer la reprise exacte malgré le blocage, dire le lot incomplet et
donner une seule action humaine précise ; livraison technique et recette humaine
restent distinctes.
