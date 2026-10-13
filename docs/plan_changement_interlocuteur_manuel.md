# Appel manuel de l'autre personnage

Demande explicite d'Ulrich le 13 octobre 2026 après le contrôle publié
d'Emma : un bouton doit couper Emma, appeler Max directement, faire entendre
quelques sonneries, puis laisser Max répondre. Le bouton symétrique depuis
Max appelle Emma. Ce changement produit est distinct du P0 publié depuis
57d04a7 (baseline et limites dans `plan_lot_1_observabilite_latence.md`).

## Comportement attendu

- Un bouton « Appeler Max » avec Emma, « Appeler Emma » avec Max, disponible
  sans attendre une proposition narrative et utilisable pendant une réponse.
- Un clic coupe la capture et la voix actuelles, annule les requêtes et les
  callbacks du tour abandonné ; aucune réponse ancienne ne doit se rejouer.
- Réutiliser `CallingMaxScreen` : trois sonneries, puis décroché. Le second
  personnage répond à chaque appel manuel, y compris lors d'un retour.
- Conserver la même session, son temps restant, le choix film et l'historique
  isolé par personnage. Appliquer la fiche et la voix runtime validées de
  la cible ; si elle est indisponible, rester sur l'ancien personnage avec
  un message clair, micro fermé.
- Empêcher doubles clics et changements concurrents ; pas de reprise de
  micro automatique pendant la sonnerie. Une fin de session doit empêcher
  une bascule tardive.
- Pendant la brève ouverture du micro, attendre sa stabilisation avant de
  rendre le bouton actif pour éviter une capture qui finit de démarrer sur
  l'ancien personnage. Le bouton reste utilisable pendant la réponse audio.
- Garder les propositions GM et les demandes vocales actuelles. Le nouveau
  bouton est un choix manuel du joueur, tracé comme tel ; il ne nécessite
  aucun changement de prompt, règle éditoriale ou configuration.

## Réalisation et validation

1. Ajouter le bouton au composant de conversation et la transition manuelle
   dans `IndexPRD4`, réutilisant son moteur de changement de personnage.
2. Bloquer les traitements périmés dès le clic ; séparer la sonnerie manuelle
   de la transition narrative existante. Tracer les appels répétés avec des
   identifiants d'événement distincts.
3. Tests de composant des deux sens, sans proposition GM et pendant la voix.
   E2E avec fournisseurs simulés : interruption d'une réponse, sonneries,
   changement dans la même session, retour et salut, profils distincts,
   ancien texte masqué, double clic sans double bascule.
4. Qualité complète, revues indépendantes Standards/Spec et CI sur PR.
   Fusion sur main, synchronisation Lovable et contrôle preview. Publication
   du nouveau bouton après validation du comportement demandé ; aucune
   chaîne de déploiement externe, migration, secret ou flag.

## Confiance avant réalisation

95 % : aucun bouton manuel indépendant trouvé ; le moteur de changement,
les primitives d'annulation et l'écran d'appel existent. Les refus constatés
sont des décisions narratives, pas une panne de reconnaissance. La demande
actuelle autorise explicitement le choix manuel direct. Références : tests
existants de conversation/sonnerie et fixtures Playwright du dépôt ;
[documentation officielle React useRef](https://react.dev/reference/react/useRef)
pour le verrou synchrone et les callbacks. Aucun nouvel adaptateur STT ou
algorithme d'interruption acoustique : arrêt explicite de capture via les
primitives actuelles. La stratégie de `handsFreeVoice.ts` reste inchangée.

## Livraison

État actuel : publié via Lovable le 13 octobre 2026, après migration autorisée
et contrôles réels des deux sens en preview puis sur le domaine canonique.
Preuves et révisions finales dans la dernière section ci-dessous.

Historique initial avant livraison : branche `codex/manual-character-call`,
base `c91b683`. Deux reproductions composant rouges avant le bouton, puis
vertes. Trois nouveaux E2E Chromium simulés réussis : interruption audio,
trois bascules avec clés distinctes dans une même session, retour avec salut,
réponse LLM tardive écartée, cible devenue indisponible sans changement de
personnage. Attente initiale du test corrigée pour les cinq secondes de
sonnerie existantes ; initialisation du fake audio attendue avant capture
pour éviter une course du fixture avec le salut initial. Aucun délai produit
changé pour corriger ces attentes. Suite : contrôles et revues sur dernier
HEAD, CI, preview puis livraison Lovable. P0 déjà publié ; baseline du
nouveau bouton séparée.

### Revue et corrections de concurrence

Deux revues indépendantes de b9f7e9a trouvent une finalisation STT abandonnée
encore traitable (Whisper finalise après stop), et une reprise de l'outbox
diagnostique manquante. Deux E2E reproduisent réellement avant correction :
ancien texte Whisper déclenche un LLM chez Max (attendu0, obtenu1), et
trace annulée jamais envoyée (attendu>0, obtenu0). Source seule du problème
aux callbacks/lifecycle Index, pas aux décisions de fin de parole.

Correctif : retirer l'identité STT courante avant stop ; callback transcript
accepté seulement pour le STT courant et une session active ; installer
cette identité avant start, abandonner silencieusement un démarrage périmé
et fermer son stream. Les finalisations PTT/mains libres ne modifient que
leur capture encore courante. Le clic reprend explicitement l'outbox.
Régression Whisper vérifie capture et flush abandonnés tandis qu'un nouveau
micro est déjà actif chez Max. Algorithme handsFreeVoice et fournisseurs
inchangés. Contrôles/revues complémentaires sur prochain HEAD nécessaires.

Après correction : qualité locale complète réussie,44régressions,
470unitaires,29intégrations, lint0erreur (avertissement préexistant),
typecheck et build. Quatre parcours manuels E2E réussis, y compris les deux
reproductions de revue désormais vertes. Les variantes Whisper renforcées
(capture et flush avec nouveau micro ouvert) sont en cours de contrôle ;
les deux revues complémentaires et la CI doivent porter sur le HEAD corrigé.

Revue complémentaire bdbecfd : deux défauts initiaux corrigés. Deux cas
supplémentaires protégés : les rejets tardifs de construction/démarrage STT
sont requalifiés si leur capture a été remplacée ; teardownSTT libère les
verrous de finalisation de la capture retirée, sans laisser un ancien finally
toucher la nouvelle capture. Deux E2E dédiés passent : après recommencement,
un ancien rejet de micro ne ferme pas le nouveau ; désactivation/réactivation
HF pendant flush permet au nouveau tour d'aboutir. Variantes Whisper capture
et flush avec nouveau micro actif également vertes. Prochain HEAD à revoir
avant fusion ; aucune publication de ce bouton encore effectuée.

### Contrôle réel après PR #30 — 13 octobre 2026

HEAD 937ac42 validé par les deux revues sans observation restante et CI
38370956927 réussie : 44 régressions, 470 unitaires, 29 intégrations et
24 E2E. PR #30 fusionnée en 2094d27, synchronisée dans Lovable ; preview
sert index-B7DiZfXD.js. Aucun nouveau bouton encore publié.

Session réelle sandbox-ulrich 8f52edc3-ae6e-4431-b205-1a63e1d07dc0 :
Emma → Max exécuté, source manual, même session et timer, compteur1.
Retour Max → Emma refusé par la base ; interface avait déjà changé d'acteur.
Cause confirmée dans pg_constraint : sessions_handoff_count_check limite
handoff_count à [0,1]. Les anciens E2E simulaient des PATCH toujours acceptés.

Correctif prévu avant publication : remplacer uniquement cette contrainte
par handoff_count >=0, conserver NOT NULL/default et toutes les données/RLS ;
ne changer l'acteur et son compteur en mémoire qu'après acceptation du PATCH.
Ajouter un test PGlite qui reproduit la limite historique puis vérifie trois
appels et les refus de négatif/null ; E2E refuse le PATCH, vérifie le maintien
d'Emma puis la reprise avec compteur1. Migration locale créée par CLI officielle
(sans connexion externe) : 20261013090739_allow_repeated_manual_calls.sql.
Application exclusivement Lovable Cloud iralfqlslqndgvexixis ; la demande
initiale interdisait les migrations, donc demander l'accord sur ce correctif
concret avant toute application cloud. Pas de changement de secret/flag/provider.
Confiance95% : contrainte native et migration historique concordent, seam SQL
PGlite et moteur existants, aucune migration d'assouplissement antérieure.
Référence officielle : https://www.postgresql.org/docs/current/sql-altertable.html.

Les deux reproductions sont rouges avant correction, puis vertes. Qualité
complète corrigée : 44 régressions, 470 unitaires, 30 intégrations, lint sans
erreur, typecheck et build réussis. E2E de refus/reprise réussi. Deux revues
indépendantes du complément : 0 constat bloquant. Application Cloud et
publication attendent l'accord humain demandé ; aucun SQL Cloud modifié.

### Livraison finale vérifiée — 13 octobre 2026

Ulrich autorise explicitement « cette migration pour les appels répétés ».
PR [#31](https://github.com/memoways/ava-proto1/pull/31) fusionnée en
`56158512fc0e8f8e915c69fbadbe537a671b9ee5`, après CI complète
[38374688314](https://github.com/memoways/ava-proto1/actions/runs/38374688314)
sur `16b6a5c` : 44 régressions, 470 unitaires, 30 intégrations, 25 E2E,
typecheck, lint sans erreur et build. Deux revues indépendantes sans constat
bloquant. CI post-fusion
[38376338000](https://github.com/memoways/ava-proto1/actions/runs/38376338000)
également réussie sur `5615851`. PR #30 avait livré le bouton en `2094d27` ;
PR #31 complète la contrainte réelle et le traitement du refus.

Cible vérifiée avec les connecteurs Lovable natifs : projet
`1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
`5glbtPltldwz9tgNwIi4`, base Supabase fournie par Lovable
`iralfqlslqndgvexixis` (config.toml synchronisé et Cloud activé).
Migration appliquée par query_database natif, transaction exacte du fichier
avec lock_timeout 5s. Lecture de pg_constraint après application :
`sessions_handoff_count_check`, `CHECK ((handoff_count >= 0))`, validée.
Colonne toujours NOT NULL, défaut0. Aucun UPDATE/DELETE de données dans cette
migration ; aucune modification de RLS, droits, secret, flag ou fournisseur.

Preview synchronisée sur `5615851`, frontend `index-pIhFyOdh.js`.
Session sandbox-ulrich `ce162520-3aa3-439d-8b5c-7d7b2d4462f1`, début
`2026-10-13T09:28:27.849182Z` : Emma → Max → Emma → Max, compteur3,
une seule session, choix film pas_vu conservé. Les écrans d'appel puis les
portraits/boutons cibles correspondent. Temps affiché 15:47 → 15:18 →
14:54 → 14:19, sans réinitialisation. Trois handoff_executed distincts,
source manual, sessionPreserved/timerPreserved true ; premier contact true
puis false/false. Les quatre saluts initiaux ou de retour ont des lignes
TTS-Queue Generated/Played en websocket, texte masqué lors de l'inspection.
Session clôturée par Terminer à `2026-10-13T09:30:33.507Z`, user_hangup.

Publication native deploy_project, ID
`f9ce5822-8f96-4d20-8b07-643e4a7c2a4a`, réponse pending. Aucun deuxième
déploiement pour sonder ce statut. Vérification observable : nouvel onglet
ouvert depuis Tester moi-même dans l'admin publié, environnement Sandbox
Ulrich ; URL https://proto1.parle-a-ava.com/?env=sandbox-ulrich et bundle
DOM `index-D3Q4mR9A.js`, différent du P0 `index-5XOMh72h.js`. Le connecteur
n'expose pas le statut final du job ni un hash des octets servis ; l'état
publié est attesté par le nouveau frontend et les parcours fonctionnels.

Session publiée `d6021247-ac3f-42b9-a305-b9dbd4639837`, début
`2026-10-13T09:32:25.828834Z` : Emma → Max → Emma réussi, compteur2,
une seule session, pas_vu conservé. Temps 15:46 → 15:29 → 14:37.
Deux événements exécutés distincts, source manual, session et timer
conservés ; firstContact true puis false. TTS websocket des trois saluts
généré et lu selon les journaux navigateur. Session clôturée par Terminer
à `2026-10-13T09:34:45.481Z`, user_hangup. Micro jamais ouvert pendant
ces contrôles de bouton ; aucune parole synthétique injectée dans l'application.

Les tests automatiques attestent la coupure audio/capture en cours, les
callbacks abandonnés et le PATCH refusé puis repris. Les contrôles réels
ci-dessus attestent les appels par bouton, leurs écrans et leur persistance,
avec lecture audio journalisée ; ce ne sont pas une nouvelle mesure
acoustique ni une validation humaine de coupure pendant un échange vocal.
Ce choix manuel n'atteste pas une décision narrative GM de transfert accepté.
Baseline et limites P0 antérieures restent dans
[plan_lot_1_observabilite_latence.md](plan_lot_1_observabilite_latence.md) ;
pas de mélange avec ces nouvelles sessions, aucun gain de latence revendiqué.
Lot2 non commencé. En cas de rollback frontend, conserver les compteurs
historiques et la contrainte non négative : ne pas réintroduire un plafond1
sur des sessions qui ont maintenant plusieurs appels.
