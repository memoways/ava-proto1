# Plan — Tavus audible et fluide, transcription utilisateur complète

Date : 14 octobre 2026. Base : `9f4aba4`, projet Lovable
`1265958d-b74e-40f2-917d-182fe05163fc`, dépôt `memoways/ava-proto1`.

## Demande et critères

- Afficher en bas la transcription utilisateur pendant la capture, sa révision
  pendant la finalisation et la phrase réellement envoyée pendant la réponse.
  Aucun sous-titre personnage, même hors mode voix seule.
- Tavus doit recevoir le texte Ava et rendre audio + vidéo ; le micro reste
  réservé au STT Ava. Préserver Echo, les voix, le choix des fournisseurs et les
  interruptions décidées par `handsFreeVoice.ts`.
- Éviter de conclure le tour sur un ancien résultat STT avant réception de la
  fin de phrase ; conserver un délai de récupération borné.
- Distinguer erreurs de lecture navigateur, pistes absentes, qualité réseau et
  charge de décodage locale. Ne pas attribuer une panne historique sans mesure.

## Exécution

1. Reproductions automatisées au niveau du composant et des adaptateurs réels :
   mises à jour du transcript sans rattachement vidéo, piste audio tardive,
   lecture refusée, final Deepgram retardé.
2. Stabiliser le rattachement média et conserver un seul flux ; traiter
   explicitement les erreurs de lecture et le renouvellement des pistes.
3. Rendre le transcript utilisateur indépendamment du preset voix seule ;
   retirer le rendu des répliques personnage. Actualiser la décision du plan P2.
4. Corriger la finalisation démontrée, sans modifier les timers applicatifs de
   fin de parole ni la stratégie de barge-in.
5. Ajouter des diagnostics Tavus techniques sans texte privé, token ou URL de
   salle : pistes, lecture, qualité réseau, pertes/jitter, charge CPU Daily.
6. Tests ciblés, régressions, types/lint ; livraison GitHub puis reprise et
   compilation/publication par Lovable seulement. Recette réelle audio/image
   distincte des tests simulés ; documenter ce qui reste non attesté.

## Sources et limites

- [Daily : conserver les pistes et éviter les réassignations de flux](https://www.daily.co/blog/working-with-video-call-participants-media-tracks-for-fun-and-profit/).
- [Tavus : événements PAL/replica de parole](https://docs.tavus.io/sections/event-schemas/conversation-started-stopped-speaking).
- [Deepgram : Finalize et from_finalize](https://developers.deepgram.com/docs/finalize).
- Lovable confirme la cible et la révision. Le connecteur Supabase disponible
  ne donne pas accès à `iralfqlslqndgvexixis` : pas de lecture ciblée ni de
  contournement navigateur. Le README documente aussi le routage natif
  Lovable `query_database` pour ce Cloud : identité confirmée et métadonnées
  ciblées lues par ce connecteur. Les saccades historiques ne disposent pas
  encore de mesures de réseau/décodage.

## Livraison et validation

- Reproduction rouge initiale : 9 échecs / 23 tests ; rattachement réassigné,
  readiness vidéo seule, refus play ignoré, fin Deepgram prématurée et nouveau
  contrat UI. Après correction : première suite 23/23 verte, puis 582 tests
  unitaires verts avec scénario post-flush supplémentaire.
- Typecheck vert ; lint sans erreur, 1 warning préexistant IndexPRD4.
- Essai historique du 14 octobre à 14:02 Zurich dans sandbox-ulrich :
  connect 6589 ms, première piste vidéo 6560 ms, notification parole 7659 ms,
  aucun fallback. Ces jalons ne prouvent pas un son entendu ni une image fluide.
- E2E adaptés pour vérifier le texte reçu par le synthétiseur et son absence
  sur l'écran personnage ; user transcript visible sous preset voix seule.
- Aucune migration, variable, secret ou fonction Cloud modifié. Pas de tuning
  de voix, fournisseur, GM, RAG, timers applicatifs ou preset de production.
- Premier run CI : 43/45 E2E verts ; deux échecs du même test cinématique
  (Chromium/Firefox), variable de fixture non liée dans l'assertion modifiée.
  Liaison corrigée ; aucun défaut applicatif dans ces deux traces. Second run
  vert : 582 tests unitaires, 34 intégration, 48 régression, 45 E2E Chromium et
  Firefox. CI main également verte. Libellé admin actualisé ; ancien flag voix seule conservé dans les
  presets pour compatibilité, sans proposer un contrôle devenu sans effet.
- Brave confirmé par Ulrich. Essai de référence privé dans Brave avant
  correctif : connexion 12943 ms, notification parole 661 ms après envoi,
  durée de parole 6460 ms, played 1/1, session automatiquement fermée. Audio
  réellement entendu encore à confirmer ; inspection DOM média indisponible
  (délai de commande navigateur), aucune conclusion réseau/CPU tirée de ce délai.
- PR [#43](https://github.com/memoways/ava-proto1/pull/43) fusionnée dans
  `95d061d4993127db7715ea3cd010937e9f846068`. Local sur main, propre après
  récupération ; projet Lovable prêt et synchronisé sur cette révision.
  Publication effectuée par Ulrich dans Lovable.
- Test privé du correctif sur Brave : audio = 1, vidéo = 1, lecture acceptée,
  charge CPU Daily faible, pertes audio/vidéo = 0 sur l'échantillon ; débit vidéo
  1,83 Mbit/s, RTT 18 ms. Ce test vérifie l'adaptateur mais ne constitue pas la
  recette de l'expérience.
- Recette réelle sur [l'expérience publiée](https://proto1.parle-a-ava.com/?env=sandbox-ulrich)
  dans Brave : appel de Max, transcription observée en direct puis phrase
  complète conservée pendant sa réponse, sans sous-titre personnage. Ulrich
  confirme « bon là ça fonctionne, j'ai fait un échange puis coupé après
  2 échanges ». L'appel a été clôturé par Ulrich. Cette validation porte sur
  l'expérience réelle et l'environnement sandbox-ulrich du domaine publié.
- Cause démontrée dans le code : rattachements vidéo répétés à chaque rendu
  React, readiness avant arrivée audio, refus de lecture ignorés et finalisation
  Deepgram possible sur un ancien résultat. Les correctifs couvrent ces défauts.
  Leur contribution précise à l'essai historique reste indéterminée : absence
  de mesures réseau/décodage de cet essai. Pas de manque de RAM constaté lors
  du contrôle ponctuel (32 Gio, 38 % libres), sans conclusion sur l'état passé.
- Aucun reste dans ce lot ; les statistiques ajoutées permettent de qualifier
  un éventuel incident ultérieur. Aucun tuning de fournisseur ou de voix.

La finalisation Deepgram sans acquittement peut désormais attendre 1,5 s ;
la qualité de la fin de phrase prime sur l'ancien raccourci de 450 ms. Les
providers batch ne produisent pas de texte en direct et ne sont pas remplacés.
Rollback : revert du commit du lot via GitHub puis reprise/publication Lovable.
