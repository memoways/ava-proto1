# Prompt autonome — Ava, A3 : réglages fidèles et auditions des pauses

Exécute et livre **uniquement le lot app A3** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`. Lis AGENTS.md et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Implémentation, tests et livraison complète sont attendus, sans nouveau chantier
de planification. Un seul agent : aucun sous-agent, clone ou nouveau worktree.
Réutilise les identités et connexions configurées.

## 1. Reprendre l'état livré

A1 est livré par [#77](https://github.com/memoways/ava-proto1/pull/77), A2 par
[#78](https://github.com/memoways/ava-proto1/pull/78).
Base **app** vérifiée le 25 octobre 2026 :
`a63ee8a379dcee47346903b43efab2e627f9ed7c`.
Une correction documentaire ultérieure peut porter ce prompt et son obligation
de livraison ; reprends le main réel, sans revenir au SHA app ni perdre ces docs.

A2 livré et vérifié :
- Breaks Gradium WS depuis la parole validée et un mapping autorisé. Parties
  texte/contrôle séparées ; mots et reçus originaux conservés.
- Essais `short=0,25`, `normal=0,6`, `long=1` seconde ; huit pauses maximum par
  contexte de synthèse, quota partagé sur le tour incrémental. Virgules et traits
  d'union lexicaux ne créent pas de pause. Nettoyage anti-hoquet conservé.
- `gradiumPausesEnabled` absent dans le JSON Cloud sandbox relu : **désactivé**.
  Production fermée, tags émotionnels fermés. Aucun réglage sauvegardé ou activé.
- REST garde les mots nettoyés ; pauses contrôlées non attestées sur ce chemin,
  signalées par `pauseRendering: rest_unavailable` si elles étaient éligibles.
- Qualité verte : lint/types/build, 66 régressions, 987 unitaires, 41 intégrations.
  78 E2E sans retry en local, en CI PR et en CI main.
  [CI PR](https://github.com/memoways/ava-proto1/actions/runs/40227877871),
  [CI main](https://github.com/memoways/ava-proto1/actions/runs/40229327400).
- Lovable synchronisé au même SHA, ready/agentFinished. Preview connectée
  vérifiée, bundle `/assets/index-BCNMaBQN.js`. Quatre messages console d'accès
  au stockage refusé observés, origine non établie ; page et banc chargés.
  Ce constat ne justifie pas un changement des protections du navigateur.
- Aucun audio fournisseur réel, gain acoustique, acting ou latence réelle mesuré.
  A2 n'est pas publié en production et ses pauses ne sont pas acceptées à l'écoute.

Commence par `git fetch --prune`, statut, derniers commits de main, branches et
PR ouvertes ; mets main à jour avant toute écriture. Lis les changements si main
a avancé. Cherche une préparation A3 autorisée avant de créer une autre branche.

À la clôture A2 : checkout canonique propre sur main ; distantes `main` et
`agent/test-gap-invitation-validity-multi-use` ; PR étrangère #24 et 16 branches
locales étrangères conservées. Ne modifie, ne fusionne ni ne supprime ce travail.
Applique AGENTS.md si une activité récente ou un recoupement apparaît.

## 2. Sources à lire

1. `docs/plan_lot_b_rendu_vocal.md` : bilans A1/A2, section A3 et dépendances A4.
2. `docs/plan_parole_incarnee_personnages.md` : direction après écoute.
3. `docs/tache_notion_parole_incarnee_personnages.md` : huit cas proposés,
   **non canoniques**, exemples à calibrer et jamais répliques à injecter.
4. `docs/plan_optimisation_latence_voice_to_voice.md`, section 3 : invariants
   d'interruption réversible. Les décisions restent dans `handsFreeVoice.ts`.

Actualise les deux plans existants ; ne crée pas de plan concurrent.

## 3. Résultat attendu et périmètre

L'admin doit montrer les paramètres réellement consommés et le banc existant
doit permettre une courte comparaison attribuable des pauses WS d'A2, sans
activer ces pauses dans les conversations de jeu ni sauvegarder automatiquement.

Périmètre principal :
- `src/components/SpeechAuditionBench.tsx` ;
- `src/components/TTSConfigTab.tsx` ;
- `src/services/tts/speechAudition.ts` ;
- `src/services/tts/speechPerformanceSettings.ts` et leurs tests.

Inspecte les frontières nécessaires dans `performanceIntent.ts`,
`gradiumSpeech.ts`, `providers/gradium.ts`, `gradiumStreamPlayer.ts` et les types
TTS. Étends-les seulement pour transporter un contexte d'audition isolé et les
preuves utiles. Réutilise le moteur et le lecteur A2, pas un second compilateur
de pauses. A4 — accueils et intégration éditoriale — reste hors périmètre.

## 4. Diagnostic établi à compléter dans les appels réels

Le banc actuel :
- appelle `provider.generate()`, donc REST pour Gradium ; il ne teste pas les
  pauses WS, même si l'UI affiche « pauses longues » ou une intention d'acting ;
- affiche une matrice historique de 150 combinaisons par personnage ;
- calcule un texte de synthèse avec le nettoyage historique ;
- conserve propositions et voix d'audition localement, et des blobs en cache.

Le résolveur A2 exige un environnement sandbox, un mapping actif, le booléen
strictement vrai, une intention `speech_state`, le personnage/état et une version
concordants. Il consulte les réglages d'environnement : un simple aperçu React
ou une intention construite localement ne suffit pas à ouvrir les pauses WS.

Conçois la frontière d'audition pour utiliser un snapshot **temporaire, explicite
et isolé**. Elle doit pouvoir comparer témoin et pauses A2 sans modifier le JSON
live, falsifier une version enregistrée ou lire des réglages de jeu différents
de ceux affichés. Garde la fermeture production et la validation des états.

## 5. Implémentation attendue

### Réglages et capacités lisibles

- Afficher personnage, noms/descriptions de la fiche synchronisée, environnement,
  mapping enregistré/version et changements temporaires du banc.
- Pour Gradium, distinguer `padding_bonus` (rythme global), breaks explicites WS,
  limite du repli REST et émotion/acting non appliqués. Une instruction affichée
  qui n'est pas transmise ne doit pas devenir une capacité prétendue.
- Montrer texte source, mots préparés, contrôles séparés et paramètres réellement
  envoyés, avec transport effectif et éventuel repli. Les contrôles restent hors
  du dialogue et ne proviennent jamais de tags libres écrits dans le texte.
- Garder le sens des réglages des autres fournisseurs et l'isolation des voix.

### Comparaison courte dans le banc existant

- Réutiliser les huit cas proposés. Première comparaison A/B sur **quatre textes
  au maximum**, puis seulement les finalistes. Aucun lancement automatique de
  série ni de matrice multi-fournisseurs.
- Témoin initial Max 3 / Emma 2 ; mêmes mots, même voix et mêmes paramètres de
  base pour comparer pauses désactivées / pauses expérimentales. Préparer les
  contextes proposés sans les enregistrer comme canon.
- Fournir une audition WS Gradium réellement reliée au compilateur A2. Détecter
  et montrer tout repli REST ; une écoute REST ne valide pas les pauses WS.
- Un appel à la demande, annulation et callbacks périmés protégés. Les voix,
  provider actif, paramètres de jeu et activations live restent indépendants.
- Rejouer une écoute identique depuis le cache sans appel fournisseur. Préserver
  l'audio WS nécessaire à ce rejeu avec les primitives existantes, de façon bornée
  et annulable ; si une capacité manque, l'indiquer avant de promettre le cache.
- Indexer/invalider le cache selon texte, personnage, état/rugosité, voix,
  fournisseur/modèle, snapshot/version, paramètres et mode de pause/transport.
  Un ancien résultat ou sa callback ne remplace pas une écoute plus récente.
- Séparer notes mots/pensée, pauses/rythme, affect/timbre et clics/hoquets.
  Exporter réglages effectifs, transport, métriques et statut cached. Compter
  les appels réels ; afficher un coût uniquement s'il est connu.

### Sauvegarde et acceptation

- Aucun enregistrement, activation ou remplacement automatique du mapping
  `2026-10-25T11:39:32.000Z`. Séparer clairement brouillon d'audition et réglages
  enregistrés. Toute sauvegarde reste un geste explicite en sandbox ; après ce
  geste, relire le même environnement, conserver les champs non édités et rendre
  visible un échec. Couvrir ce contrat par des fournisseurs/stockages simulés.
- La livraison technique peut rester désactivée sans écoute humaine acceptée.
  Préparer la courte audition ; ne génère pas d'audio réel automatiquement.
  Un clic humain explicite peut lancer l'appel prévu par le banc.
- Une pause ne garantit ni souffle, ni sanglot, ni voix étranglée. Si les mots
  et pauses sont justes mais le timbre reste détaché, proposer au plus deux voix
  alternatives pour une audition ultérieure, sans changer le fournisseur de jeu.

## 6. Invariants et plateforme

Conserve les protections A1/A2, reçus delivered/uncertain/private, samples,
annulation et reprise sans rejeu après son ; setup configuré avant le premier
segment ; récupération préalable unique et bornée. Délais et buffers ne sont
pas rallongés pour masquer un défaut. Capture, STT et décisions mains libres
restent inchangés. Conserve `experienceFrame`, mémoires isolées et gardes de
transfert, modèles/températures/voix de jeu et budgets 220 personnage / 950 GM.
Les tags émotionnels Gradium restent désactivés. Aucune publication production.

Lovable / Lovable Cloud restent l'unique chaîne, projet
`1265958d-b74e-40f2-917d-182fe05163fc`. SQL exclusivement par son MCP Lovable,
jamais par Supabase générique. Pas de nouveau backend, hébergeur ou secrets.
Vérifie la cible avant toute intervention Cloud ; privilégie les changements app
sans migration. Réutilise les identités GitHub existantes, sans login/refresh/logout.

Ulrich édite les champs personnages dans Notion **Gamilab**, toujours. Vérifie
le workspace du connecteur avant toute lecture ciblée. À la clôture A2, seul
Ulrich était exposé : mauvais routage Ava, sans preuve de défaut de synchronisation.
Réutilise Gamilab natif s'il est disponible ; sinon signale la limite et poursuis
le travail technique indépendant. Aucun nouveau diagnostic OAuth ni navigateur
Notion, édition de fiche, tâche doublon, sync automatique, prompt Cloud réécrit
ou reconstruction RAG dans A3.

## 7. Vérifications et livraison complète

Ajoute seulement la couverture manquante : fidélité affichage/envoi réel ; état
et voix propres au personnage ; témoin/pauses WS/repli REST ; brouillon isolé du
live et de la prod ; cache exact sans nouvel appel et invalidations ; arrêt,
rejeu et callbacks tardifs ; sauvegarde explicite et readback du même environnement.
Conserve les suites A2, passages Max ↔ Emma, persistance/CAS et clic.

Exécute les tests ciblés, puis `npm run test:quality` et les E2E requis sur le
code final. Suites lourdes séquentielles ; ne répète pas une suite verte sans
modification ou doute précis. Fournisseurs simulés pour les tests déterministes.
Réutilise le navigateur déjà connecté pour la validation visuelle Lovable ;
profil CLI vierge, source synchronisée et preview affichée sont des preuves
distinctes. Aucun transfert de cookies ni changement des protections d'accès.

Actualise les deux plans, CHANGELOG et STORY avec preuves, limites et état
d'activation. Livre le seul lot A3 : PR attachée au chat, CI verte sur son HEAD
exact avant squash, CI main verte sur le commit de fusion/E2E compris, même SHA
dans Lovable et preview vérifiée. Supprime seulement la branche A3 locale et
distante. Préserve #24 et toutes les branches étrangères. Production non publiée.

**Passation obligatoire dans ce même tour :** rédige et enregistre le prompt
autonome du prochain lot A4, actualisé avec le résultat réel d'A3 et les conditions
d'intégration éditoriale encore ouvertes. Donne son lien direct dans le compte
rendu final, avec celui du plan et de la PR. Le nom « A4 » seul ne suffit pas ;
ne reporte pas cette préparation à une proposition de suivi et ne lance pas A4.

Bilan final : résultat concret, tests, limites, SHA main, CI, checkout, branches
restantes, Lovable/preview/production, activation expérimentale et **prompt A4**.
Si une étape technique bloque, indique le lot incomplet et une seule action
humaine précise ; livre quand même la reprise avec le blocage et le reste exact.
L'absence de Gamilab ou d'écoute acceptée ne bloque pas la livraison technique
désactivée ; elle interdit de revendiquer leur validation.
