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

Implémenté localement, pas encore livré. Branche `codex/manual-character-call`,
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
