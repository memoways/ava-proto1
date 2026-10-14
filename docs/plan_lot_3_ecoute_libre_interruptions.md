# Reprise — lot 3 / P2 : écoute libre et interruptions confirmées

Date : 14 octobre 2026. Statut actuel : **P2 livré par Lovable depuis
`0daa7e3`, PR #38/#39/#40 fusionnées par squash, deux revues finales par PR
et CI finales vertes. Recettes humaines preview Max/Emma et publié Max
réussies dans Brave / sandbox-ulrich ; appels clôturés. Quatre outils MCP Ava
rétablis et vérifiés. Canary P2 uniquement sandbox-ulrich, batch conservé
en production. Pilote statistique et mesures physiques non réalisés**.
Le prompt ci-dessous conserve la préparation
historique après P1 et le contrat obligatoire de ce lot.

## Point de reprise et résultat attendu

- Dépôt : `memoways/ava-proto1`.
- Workspace : `/Users/ulrich/CodeProjects/memoways/ava-proto1`.
- Référence constatée avant préparation : `main`,
  `f3c61beb574cce29bbd5b2b5cb0d2d5d21889083`, workspace propre.
  Le commit de ce document ou un descendant devient la référence documentaire.
- Code P1 : `fe9c954fa70d613bdd1519a58b7e76fe4f09f49c`, PR #33 à #37
  fusionnées par squash. Publication Lovable depuis `19cfa5f` (documentation
  seule en plus), domaine publié vérifié par un échange Max réel et reçu V4.
- CI finale du bilan P1 : `38517558400`, success sur `f3c61be` :
  46 régressions, 546 unitaires, 34 intégrations, 36 E2E sans retry.
  Deux revues indépendantes finales du code sans constat restant.
- P1 progressif activé seulement dans `sandbox-ulrich` ; production conserve
  le batch par défaut. Paramètres sandbox constatés : mains libres activées,
  barge-in activé, stratégie texte, 3 mots, silence 900 ms, hésitation 700 ms.
  Le défaut code est 2 mots : ne pas le confondre avec le preset sandbox.
- Preview : Max/Emma complets et naturels, interruption Max puis nouvelle
  réponse cohérente sans replay. Publié : réponse Max complète confirmée.
  Appels et captures clôturés. Pas de mesure acoustique d'arrêt matériel.

Le résultat P2 est une écoute continue qui réagit au début de parole, conserve
le premier phonème et confirme ensuite une vraie interruption. Un faux
candidat reprend exactement la sortie conservée, sans replay ni mutation de
mémoire. La conversation publique devient voix seule ; consentement, fin de
session, accessibilité et PTT de compatibilité restent disponibles.

La section 3 et les gates du
[plan général](plan_optimisation_latence_voice_to_voice.md) font autorité.
Ce document les applique au prochain lot ; il ne redéfinit pas P1 ou P3.

## Réserves à traiter sans élargir à P3

Deux GM post-tour ont atteint leur deadline existante de 12000 ms :

- preview Max : session `3f2ded7a-fc05-4ae6-a66a-575f99402f8c`, après
  interruption/reprise, tour 4 ;
- publié Max : session `1e5a72b5-5aa2-4263-bba0-db55ddf7f616`, tour 1.

Les réponses vocales sont livrées intégralement et leurs reçus sauvegardés.
Le délai et le prompt GM sont conservés ; leur cause n'est pas démontrée.
L'agrégat antérieur consulté comporte 62 appels et 24 annulations volontaires,
sans message de ce même timeout : il ne permet pas de les déclarer préexistants
ni de conclure à une régression causée par P1. Les entrées « Stream failed »
des tentatives interrompues sans texte/audio doivent être distinguées des
échecs d'un nouveau tour. Le bilan P1 détaille les générations et reçus.

Le pilote de 300 tours / 10 sessions et l'activation générale ne sont pas
réalisés. Ils ne deviennent pas acquis parce que P1 est publié. Les réserves
P0 restent historiques : transfert accepté non observé dans la dernière
recette GM, écart éditorial Emma sans cause technique démontrée, prompt exact
post-vidéo non attesté. Ne pas relancer leur recette par défaut.

## Prompt complet à coller dans le prochain chat

Mets en œuvre uniquement le lot 3/P2 d'Ava Proto 1 : écoute libre,
interruption acoustique candidate puis confirmée, reprise réversible et UI
voix seule. Commence par le diagnostic ciblé des deux timeouts GM laissés
comme réserve P1, puis réalise P2 selon la section 3 du plan général.
Ne redemande pas une validation générique de P0/P1 et ne relance pas leur
recette par défaut. Les réserves restent explicites ; une violation démontrée
d'un invariant bloque le passage, une cause inconnue ne devient pas un succès.
Ne commence pas P3.

Dépôt : memoways/ava-proto1.
Workspace : /Users/ulrich/CodeProjects/memoways/ava-proto1.
Référence : main, f3c61beb574cce29bbd5b2b5cb0d2d5d21889083 ou descendant
contenant ce prompt sauvegardé. Dernier code P1 livré : fe9c954, PR #33 à #37 ;
publication frontend depuis 19cfa5f, clôture documentaire f3c61be.
Actualise ces faits depuis le dépôt et Lovable avant d'agir ; aucun SHA de
build servi ou numéro de version Edge exact n'a été indépendamment attesté.

Lis AGENTS.md, CHANGELOG.md, STORY.md, puis :
- docs/plan_lot_3_ecoute_libre_interruptions.md : ce prompt complet obligatoire ;
- docs/plan_optimisation_latence_voice_to_voice.md : section 3, gates et rollout ;
- docs/plan_lot_2_memoire_streaming_coherent.md : dernier bilan publié et réserves ;
- docs/plan_lot_1_observabilite_latence.md : dernier bilan et limites de mesures ;
- docs/plan_changement_interlocuteur_manuel.md : clarification prioritaire ;
- docs/plan_conversation_mains_libres.md : base existante, sans refaire son lot.
Les anciens prompts et bilans intermédiaires restent historiques ; le dernier
bilan et la clarification prioritaire prévalent. Préserve les travaux non liés.
Complète ce plan avant implémentation avec architecture, modules, sous-lots,
contrats de pause/reprise, mesures, tests, rollback et stockage réellement retenus.

Lovable/Lovable Cloud reste l'unique chaîne de compilation et de livraison :
projet 1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4, Cloud iralfqlslqndgvexixis,
site https://proto1.parle-a-ava.com. Vérifie ces cibles depuis les connecteurs
natifs authentifiés avant toute action Cloud/build/publication. Aucun autre
hébergeur ou Supabase externe. Réutilise l'identité GitHub configurée ; ne
remplace pas des identifiants à cause d'un refus de sandbox/trousseau.
Ne touche jamais Gami DigiDouble et n'affiche aucun animal de compagnie.

### Préflight P1 borné

1. Retrouve les deux timeouts GM par leurs sessions/tours, avec projections
   techniques autorisées : configuration épinglée, signal parent, délais,
   spans upstream/corps/validation/persistance et couverture disponible.
   Ne lis pas automatiquement des transcriptions, intentions privées complètes
   ou secrets pour produire un diagnostic de latence. Distingue tentative
   volontairement annulée, vrai timeout GM et échec du tour suivant.
2. Cherche une cause reproductible, compare le chemin batch et le chemin P1,
   puis vérifie qu'un GM échoué/retardé ne modifie ni acteur, relation, reçu
   courant ni autorisation de transfert. Si un défaut P1 est démontré,
   documente un sous-lot correctif ciblé et sa reproduction avant de le livrer.
   Pas de tuning de prompt/modèle/budget RAG/GM ou de deadline comme raccourci.
3. Si la cause reste fournisseur ou non démontrée, conserve la réserve avec
   preuves et limite de comparaison. Tu peux travailler sur P2 en canary si
   les invariants restent vérifiés ; n'annonce pas une validation statistique
   ni une activation générale. Toute violation réelle d'une gate doit être
   résolue avant publication de la variante qui la reproduit.

### Contrat P2 obligatoire

- handsFreeVoice.ts reste l'unique autorité applicative de fin de parole et
  d'interruption, indépendante du STT. Sépare états de capture/écoute et de
  sortie ; conserve le geste initial d'activation du micro et le PTT existants.
  Les providers livrent signaux et texte, sans décider eux-mêmes la fin du tour.
- Vérifie les paramètres DSP effectivement appliqués et la fréquence réelle
  du micro. Ajoute la détection locale de parole après annulation d'écho ;
  un dépassement d'énergie seul ne suffit pas. Le début acoustique n'est pas
  une preuve que le joueur a fini sa phrase.
- Candidat : identifiant propre, atténuation immédiate, suspension si la voix
  persiste. Conserve génération, capture, intention, samples et curseur ; aucun
  nouvel appel LLM, cancel irréversible, finalisation de reçu ou GM à ce stade.
  Continue à compter l'audio réellement audible pendant l'atténuation.
- Confirmation : parole reconnue corrélée au candidat ; une correction courte
  « non » ou « attends » peut suffire avec contexte acoustique. Le seuil de
  3 mots du preset texte sandbox ne s'impose pas à acoustic_confirmed. Utilise
  la sortie effectivement jouée pour écarter l'écho ; le recouvrement lexical
  de 80 % avec toute la réponse ne suffit pas à rejeter le joueur. Annule la
  génération et l'ancienne sortie, finalise son reçu partiel, puis poursuis
  la capture du joueur ; le nouveau LLM attend sa propre fin de parole.
- Rejet : bruit/toux/écho rétablit le volume et reprend uniquement les samples
  non lus au curseur conservé. Aucun replay, nouveau contexte TTS, mutation de
  mémoire ou nouvelle génération. Une expiration seule ne reprend pas l'audio
  si une voix candidate persiste. Borne buffer/attente et définis explicitement
  la récupération d'une panne STT.
- Ajoute une véritable capacité réversible de gain/pause/reprise au player
  P1 : AudioContext.suspend() seul ne prouve pas une pause correcte, surtout
  si le contexte est partagé. Ne fais pas de cancel/recréation pour simuler
  un rejet. Garde la comptabilité du reçu correcte avant/pendant/après reprise.
  Explique le comportement de chaque sortie compatible ; une capacité absente
  reste sur la stratégie texte, sans appliquer une pseudo-pause destructive.
- Capture continue : premier phonème conservé, reprise après flush, aucun
  callback de l'ancienne sortie ne vide l'énoncé actuel. Barrières de génération
  sur capture, flush, sortie, GM et synchronisation. Vidéo/handoff réinitialisent
  réellement les buffers et désarment la prise de tour ; fin de session, perte
  de permission ou panne non récupérable déconnectent capture et sorties.
- Deepgram : garder le mode manuel, interim/final, keepalive en suspension et
  flush de secours borné ; ne pas transformer son signal en décision de tour.
  Gradium STT : ready, end_text et flush_id exact, step diagnostique, messages
  d'un ancien flush sans effet sur le nouveau tour ; commencer à 10 et comparer
  7/10 sur français. Remplacer ScriptProcessor Gradium/AssemblyAI par
  AudioWorklet, frames/fréquence conformes, sans supprimer leurs providers.
- Tempo : ignorer les callbacks de transcription identiques sans nouveau mot.
  Comparer séparément silence 900/700/500 ms et hésitation 700/300 ms, un levier
  à la fois dans sandbox. Retenir seulement une variante sans faux endpoints
  et préserver les « oui/non » explicites. La durée du timer économisée n'est
  pas un gain de bout en bout mesuré. Ne changer aucune valeur de production
  ou valeur par défaut sur la seule base d'un petit échantillon.
- UI voix seule sous flag désactivé par défaut : masquer les transcriptions
  utilisateur/personnage dans la conversation publique, garder le texte interne
  et les outils admin. Garder Terminer, activation/coupure micro, statuts
  accessibles, consentement Appeler/Rester et PTT de compatibilité. Précharger
  une courte voix de secours connue pour une panne de sortie ; aucun fallback
  ne dépend d'un dialogue textuel caché. Préserver Gumlet et le contexte post-vidéo.

### Invariants conservés

P1 reste complet : une génération personnage par tour, intention privée compacte
jamais envoyée au TTS, segments sûrs et garde d'identité cumulée, mémoire V4
normalisant V1–V3, reçus isolés par personnage, continuation non entendue jamais
promue en fait partagé, GM/résumés sur livraison confirmée. Gradium conserve
un contexte et la voix du personnage par tour ; aucun replay après premier son,
aucun callback périmé, batch et laboratoires maintenus. Ne relève pas le budget
LLM pour contourner une fin length ; conserve format compact et gardes SSE.

Préserve voix, modèles, canon, confidences, relations, réponse initiale film et
cadre commun construit uniquement par experienceFrame.ts pour GM/personnages.
Seul le choix du premier personnage est libre. Pendant l'appel : recommandation
GM exécutée, règles narratives validées et accord explicite du personnage
avant Appeler/Rester ; aucun bouton permanent ni transfert vocal automatique.
Un refus narratif valide n'est pas un bug ; ne force pas un accord pour tester.
Conserve migrations P0/P1, RPC CAS et handoff_count >= 0, droits/RLS et données.
Documente toute migration indispensable avant application exclusivement Cloud.

Ne commence pas P3 : aucune optimisation GM/RAG, réduction de schéma/prompt,
comparaison de modèles/voix, routage LLM, pré-retrieval ou réglage du prébuffer
Gradium dans ce lot. Les avatars conservent leur chemin ; ne leur applique pas
le nouvel audio incrémental sans tests spécifiques et périmètre explicite.

### Tests, mesures et activation

Planifie des tests utiles de bout en bout aux seams réels, pas seulement des
tests reproduisant l'implémentation : candidat bref/persistant, confirmation
sur un mot, rejet bruit/toux/écho, expiration avec voix toujours active, panne
STT, interruptions rapides, détection avant son/premier mot/milieu/fin, samples
pendant atténuation, curseur de reprise sans replay, buffers bornés, premier et
dernier mot, callbacks/flush tardifs, vidéo/handoff/reprise/fin, mémoire V4 et
batch. Tests providers simulés pour races/délais, E2E multi-navigateurs isolés ;
aucune voix de ces simulations n'est injectée dans l'application réelle.
Exécute test:regression, test:unit, lint, typecheck/build et intégrations/E2E
appropriés. Deux revues indépendantes du HEAD final, exigences et standards.

Conserve la mesure V2 et ajoute/complète les corrélations interruption_id :
voix capturée/détectée → candidat → atténuation → suspension → confirmation
ou rejet → dernier son ou reprise. Mesure les fausses atténuations séparément
des fausses coupures, couverture et disponibilité mémoire. Jamais null→zéro,
jamais soustraction d'horloges non synchronisées. Les samples AudioContext
attestent la lecture estimée, pas à eux seuls le dernier son matériel.
Prépare une référence acoustique conforme aux permissions accordées ; si elle
manque, dis que la cible physique reste non attestée.

Pilote comparatif : mêmes questions/pauses françaises, révision et presets
épinglés, au moins 300 tours sur 10 sessions. Sépare comparaison descriptive,
validation automatique et preuve humaine. Tests humains uniquement dans Brave,
sandbox-ulrich, admin → Tester moi-même : prépare toi-même les onglets, demande
seulement le geste humain nécessaire, une action à la fois. Aucune parole
synthétique injectée, aucun changement Shields sans accord spécifique. Les
autres navigateurs sont couverts par E2E simulés ; leurs percentiles vocaux
réels restent non attestés sans sessions humaines autorisées correspondantes.
N'invente pas un corpus pour atteindre l'effectif : si sa réalisation dépend
d'Ulrich, prépare le protocole/tableau et rapporte exactement ce qui reste.

Gates : pas de perte/duplication des mots, mélange d'identité, fuite privée,
révélation non entendue ou action périmée ; faux endpoints/interruption ≤ 1 %
sur corpus contrôlé, rejets réversibles sans replay, aucun ancien chunk
reprogrammé après confirmation, stabilité/underruns/contexte comparables à la
baseline de la même cohorte. Objectifs : détection locale→atténuation p95 ≤ 100 ms,
confirmation→dernier son p95 ≤ 200 ms ; distinguer aussi voix physique→détection.
Fin réelle de parole→premier son : objectifs p50 ≤ 1500 ms / p95 ≤ 2500 ms, pas un
résultat promis du seul P2. Aucun gain ni levée de réserve sans mesure.

Ajoute stratégie text/acoustic_confirmed normalisée à text pour l'existant,
épinglée par session. Garde les flags sortie incrémentale/UI voix seule
désactivés par défaut et les réglages enabled/bargeInEnabled actuels.
Active explicitement le preset P2 uniquement dans sandbox-ulrich pour recette.
Le pilote et les gates précèdent toute activation générale ; ne confonds pas
publication de code compatible et bascule du trafic production.

### Livraison et clôture

Conduis le lot jusqu'aux tests, PR codex/ vers main, revues/CI finales,
squash merge, synchronisation Lovable, contrôle preview, publication native
et vérification publiée en sandbox-ulrich. Préserve les travaux non liés.
Une commande locale ne livre rien ; GitHub, preview et publié sont distincts.
Sur Lovable, privilégie synchronisation Git native, lectures et publication.
L'agent Lovable a déjà modifié quatre fichiers hors P1 malgré une interdiction :
ne lui confie pas une correction automatique globale. Contrôle le diff et le
SHA après chaque intervention ; toute modification imprévue doit être isolée
et restaurée sans effacer les travaux d'autrui ni réécrire main.

Rollback : nouvelles sessions sur text et UI courante, batch disponible ;
annuler proprement les sorties actives à une frontière explicite. Préserver
les presets des sessions déjà épinglées, mémoire V4 et reçus conservateurs ;
pas de migration destructive ni retour au plafond handoff 1.
Un navigateur/connecteur déconnecté doit être reconnecté, pas contourné.
Termine avec SHAs/PR/CI, résultat par scénario, révisions/voix/presets,
mesures/effectifs/couverture, réserves GM et pilote, état local/GitHub/preview/
publié, rollback et reste éventuel. Actualise ce plan, CHANGELOG et STORY,
commit/push de la clôture ; ne commence aucun autre lot.

## Modules à inspecter avant de compléter le plan d'exécution

- `src/services/handsFreeVoice.ts`, `src/pages/IndexPRD4.tsx` : autorité de tour,
  orchestration capture/sortie et protections de génération existantes.
- `src/services/tts/gradiumStreamPlayer.ts`, `src/services/responseDelivery.ts`,
  `src/services/tts/providers/gradium.ts` : pause/gain réversibles à concevoir,
  samples/curseur/progression et conservation du contrat P1.
- `src/services/stt/providers/gradiumSTT.ts`, `assemblyaiSTT.ts` et providers
  effectivement résolus au runtime : capture, AudioWorklet, flush et DSP.
- `src/services/settingsService.ts`, configuration/preset de session, UI admin
  et écrans publics : normalisation text, pinning, flag voix seule et compatibilité.
- `src/services/voiceTurnTelemetryV2.ts`, projections admin/MCP Ava : candidats,
  couverture et mesures techniques sans exposition privée.
- `src/services/prd4Orchestrator.ts`, `src/agents/gameMasterPRD4.ts`, persistance
  mémoire et RPC CAS : préflight des réserves et absence d'effets obsolètes.

Ce sont des points d'inspection, pas un choix d'architecture déjà implémenté.
Les sous-lots et leurs dépendances seront enregistrés ici avant le premier
changement applicatif. Préparation actuelle : documentation uniquement.

## Préflight d'exécution — 14 octobre 2026 : routage MCP Ava vérifié

Demande actuelle : exécuter uniquement P2 jusqu'à sa livraison Lovable,
avec diagnostic préalable des deux timeouts GM P1. P0 n'est pas relancé et
P3 reste hors périmètre. Aucun changement applicatif effectué à ce relevé.

- État local vérifié : branche `main`,
  `8dd55dbd2f222d99f2b5cda748289c77e13908e0`, workspace initialement propre,
  remote `https://github.com/memoways/ava-proto1.git`.
- Connecteur Lovable authentifié : compte `ulrichmemoways`, workspace
  Memoways `5glbtPltldwz9tgNwIi4`, projet Ava
  `1265958d-b74e-40f2-917d-182fe05163fc`. Le projet est prêt,
  `agentFinished=true`, et son SHA courant correspond à `8dd55db`.
  Ces métadonnées ne prouvent pas la révision du bundle publié.
- `get_database_status` Lovable confirme `enabled=true`, `stack=supabase`.
  Aucun SQL, changement Cloud, build ou publication demandé.
- Le connecteur natif Supabase refuse `get_project` ciblé sur
  `iralfqlslqndgvexixis` : `ProtocolError`, MCP `-32600`,
  `You do not have permission to perform this action` ; son champ structuré
  rapporte `INVALID_ARGUMENT`. La réponse textuelle précise donc un refus
  de permission, sans démontrer une expiration d'identifiants.
- L'arrêt initial et la demande de reconnexion Supabase étaient une erreur
  de routage de l'assistant. Ulrich rappelle le connecteur spécial fonctionnel.
  Le [plan MCP](plan_mcp_statistiques.md) documentait déjà l'accès par l'app ;
  le [bilan P0](plan_lot_1_observabilite_latence.md) donne l'endpoint exact et
  ses preuves. Le README précise désormais cette entrée pour les reprises.
- **MCP app Ava testé et fonctionnel**, OAuth admin, endpoint
  `https://iralfqlslqndgvexixis.supabase.co/functions/v1/mcp` :
  `list_sessions(days=2, environment=sandbox-ulrich, limit=10)` retourne
  les deux sessions P1 ; `get_voice_latencies(days=2,
  environment=sandbox-ulrich)` retourne leurs projections techniques V2,
  sans dialogue ni secrets. Aucun navigateur ou SQL direct utilisé.
- Les deux autres outils natifs répondent également sans erreur :
  `get_usage_overview(days=2, environment=sandbox-ulrich)` et
  `get_llm_costs(days=2)`. Ce dernier n'offre pas de filtre d'environnement,
  conformément au contrat documenté. Les quatre outils ont donc été testés.
- Fenêtre du relevé V2 conservé : `[2026-10-12T06:20:15.474Z,
  2026-10-14T06:20:15.474Z)`, page 0/100, `nextOffset=100`, aucune ligne
  invalide. Statistiques limitées à la page, pas à toute la cohorte.
- Preview Max tour 4 : tentative `e8ae0885-3f72-454a-94d0-27e7fa99270f`,
  GM `b412ebbb-8093-4ea9-b038-3bd53bbdc75b` ; génération failed
  de 146 à 12151 ms (12005 ms), persistance ok de 12151 à 12347 ms.
- Publié Max tour 1 : tentative `0f4d1a2c-0cf5-40bc-be34-83d225ebe7a0`,
  GM `66884b15-d4c3-4819-aedc-70ebdc7f9ba2` ; génération failed
  de 92 à 12094 ms (12002 ms), persistance ok de 12095 à 12297 ms.
- Les deux portent la config épinglée `9217fd34-321a-45c7-8363-6a8cf0b0157c`.
  Le statut completed des événements GM est celui du tour vocal associé,
  pas un succès du GM : son span génération est failed. Le GM du tour 1
  preview est distinct et réussi (4291 ms de génération).
- Le modèle effectif, les spans headers/corps GM et le signal parent ne
  sont pas disponibles dans ces projections d'échec. Aucune attribution
  fournisseur ni cause P1 démontrée. Les deux réserves restent ouvertes.

Accès technique rétabli sans intervention de reconnexion. Prochaine étape :
vérifier les invariants des résultats GM échoués/périmés aux seams réels,
puis compléter l'architecture et les sous-lots P2 avant l'implémentation.
Pas de PR, fusion, activation canary ou publication P2 à ce relevé.

Contrôle automatique initial, avant tout changement applicatif : 27 tests
réussis dans `gameMasterPRD4.memory`, `prd4Orchestrator`,
`sessionConversationMemory` et `ConversationScreen`. Ils couvrent les
contrats existants ; ils ne reproduisent pas la cause des deux timeouts.
Le préflight complet et le plan d'architecture P2 restent à terminer.

## Plan d'exécution retenu — 14 octobre 2026, avant implémentation

### Architecture et sous-lots

1. Préflight borné : comparer le GM commun aux chemins batch/SSE ; tests au
   seam `evaluatePostTurnPRD4` pour timeout et signal parent, persistance sans
   delta, absence d'action/consentement. Les deux échecs réels sont retrouvés
   via MCP Ava ; leur cause demeure inconnue, pas de tuning ni recette P0.
2. `handsFreeVoice.ts` : stratégie normalisée `text` / `acoustic_confirmed`,
   automate candidat/atténué/suspendu/confirmé/rejeté, timer de parole distinct,
   transcription identique ignorée. Capture et sortie ont des états séparés.
   La détection locale fournit seulement des indices (énergie, périodicité,
   variations spectrales/zero crossings), jamais une décision de tour.
3. `tts/gradiumStreamPlayer.ts` : gain propre au tour, pause au curseur des
   samples rendus, conservation des PCM non lus et ledger de livraison. Les
   BufferSource Web Audio sont à usage unique : leur arrêt/reprogrammation
   utilise uniquement le suffixe PCM non rendu ; socket, contexte TTS,
   intention, promesses et tour restent identiques. Aucun `session.cancel`,
   aucun `AudioContext.suspend`, aucun replay ni nouvel appel à TTS au rejet.
   L'outputLatency continue de décaler le suivi du son estimé après pause.
   Buffer existant de 30 s conservé, attente candidate bornée à 8 s ; si la
   voix persiste sans STT à cette limite, fermer la capture et arrêter la
   sortie à une frontière d'erreur explicite, sans confirmer ni lancer LLM.
   Batch, avatars et secours blob : stratégie texte faute de pause réversible.
4. Capture : AudioWorklet partagé comme primitive de frames, contexte micro
   indépendant du player, fréquence effective mesurée et conversion PCM
   conforme (Gradium 24 kHz/1920 samples, AssemblyAI fréquence annoncée/50 ms).
   Vérifier DSP sur `MediaStreamTrack.getSettings()` ; absence d'AEC effective
   rend la stratégie acoustique indisponible, avec compatibilité texte.
   Deepgram garde son MediaRecorder, mode manuel, keepalive et flush borné.
   Gradium attend `ready`, écoute `end_text`, expose `step` comme diagnostic,
   acquitte seulement le `flush_id` exact ; délai initial 10, comparaison 7
   réservée au corpus français. Aucun provider supprimé.
5. `IndexPRD4.tsx` : atténuer/suspendre seulement une sortie réversible du
   tour courant ; confirmer avec parole nouvelle corrélée à la fenêtre
   candidate (un « non » ou « attends » suffit). Écho comparé au préfixe
   effectivement joué, jamais à toute la réponse générée. Sur rejet, le
   player reprend seul ; pas de mémoire, reçu ni GM. Sur confirmation,
   annulation P1 et reçu partiel existants, puis fin applicative du nouvel
   énoncé avant LLM. L'ancienne sortie ne fait plus `resume()` si la capture
   tourne déjà : ce callback ne peut vider le nouvel énoncé.
   Vidéo/handoff/offre : désarmer, reset effectif du STT ; le retour reprend
   un buffer vide. Panne/perte permission/fin : fermer capture et sortie.
6. UI voix seule sous flag par défaut false ; conversation sans sous-titres,
   état accessible, contrôle micro, Terminer et Appeler/Rester conservés.
   Le PTT existant demeure disponible en mode de compatibilité. Précharger
   après geste micro un court secours TTS fixe avec la voix du personnage,
   hors dialogue/mémoire ; si ce secours manque, statut accessible et retry.
7. Qualité, deux revues indépendantes HEAD final, CI, PR `codex/` → main,
   squash, synchronisation native Lovable, preview Brave puis publication et
   contrôle publié. Les tests humains nécessitent la voix d'Ulrich ; préparer
   les onglets et demander un seul geste à la fois, sans injection synthétique.

### Stockage et observabilité

Pas de migration : preset normalisé (stratégie, timing, UI) dans la mémoire
V4 JSONB existante, conservé par normalisation/merge/CAS, épinglé à la création
et repris avec la session. Une ancienne session reprend text/UI courante ;
les flags de nouvelles sessions restent désactivés hors canary explicite.
Télémétrie V2 additive : candidats bornés par `interruption_id`, offsets
monotones et mesures DSP techniques sans audio ni texte ; début détecté,
atténuation, pause, confirmation/rejet, reprise/arrêt estimé. Projections
admin/MCP filtrées mises à jour. Aucun null converti en zéro. Les mesures
AudioContext restent des estimations ; pas de preuve d'arrêt matériel sans
référence acoustique autorisée. Pas de gain statistique revendiqué.

### Tests, pilote et rollback

Tests seams réels : gain/pause/suffixe/reçu sans duplication et sans EOS
précoce, buffer borné pendant pause ; automate un mot, écho, toux/bruit,
expiration avec voix persistante, récupération STT ; frames resampling et
flush exact/tardif ; mémoire/preset/reprise ; UI accessible et PTT/batch.
E2E simulés isolés Chromium, Firefox et WebKit selon capacités disponibles,
incluant capture→flush→réponse→nouvel énoncé et frontières vidéo/handoff.
Exécuter regression/unit/integration/lint/typecheck/build, puis E2E et CI.
Délais 900/700/500 et hésitation 700/300 comparés un levier à la fois lors du
pilote humain ; aucune modification de défaut sur petit échantillon.
Préparer tableau 300 tours/10 sessions avec pauses françaises, voix, révisions,
effectifs, faux endpoints/coupures/atténuations, couverture et références.
Le code compatible peut être publié avec flags off ; activation générale
attend corpus/gates. Rollback : nouvelles sessions text/UI actuelle/batch,
anciennes sessions épinglées conservées ; pas de migration destructive.

### Références techniques vérifiées

- [Gradium STT](https://docs.gradium.ai/guides/speech-to-text) : ready,
  text/end_text, step et flush exact ; frames PCM 24 kHz de 80 ms.
- [Gradium délais valides](https://gradium.ai/blog/semantic-vad) : 7 et 10
  disponibles, 4 existant non conforme ; départ 10 sans changer la voix.
- [Web Audio BufferSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start) :
  offset en secondes, node à usage unique ; pause isolée sur suffixe retenu.
- [Exemples AudioWorklet MDN](https://github.com/mdn/webaudio-examples) :
  primitive native compatible Vite, sans nouvelle dépendance STT ni service.

Confiance d'implémentation P2 : 93 % après inspection des seams existants,
absence de duplication, conformité Lovable et documentation providers/Web
Audio. Le diagnostic de cause des deux timeouts GM reste non démontré et
n'est pas inclus dans cette confiance ; ses réserves sont maintenues.

## Exécution locale et corrections de revue

- Préflight : les deux GM failed sont retrouvés par MCP Ava. Le batch et
  l'incrémental utilisent le même `evaluatePostTurnPRD4`, délai inchangé
  de 12000 ms, réception confirmée requise pour P1. Deux tests nouveaux
  injectent timeout et annulation parent au seam GM : aucun delta mémoire,
  action, proposition consentie, vidéo ou fin ; log d'échec distinct conservé.
  Les protections de persistance CAS et de résultat périmé restent celles
  de P1. Aucun défaut expliquant les deux échecs fournisseur démontré.
- Automate candidat, gain isolé, pause au curseur rendu, suffixe non lu,
  confirmation sur un mot et rejet sans reçu/GM supplémentaires implémentés.
  Les samples atténués restent comptés ; `output_stop_estimated` ajoute
  l'estimation de queue de sortie lorsqu'outputLatency est disponible.
- Capture AudioWorklet à fréquence réelle ; resampling et frames 24 kHz/80 ms
  Gradium, fréquence annoncée/50 ms AssemblyAI. Gradium ready/flush exact et
  messages horodatés retirés, délai valide 10. Deepgram conserve mode manuel
  et keepalive pendant pause ; `resume()` est idempotent sur capture active.
- Revue préparatoire Spec/Standards : pertes pendant flush, worklet tardif
  après stop, candidat suspendu au micro-off, perte de périphérique et secours
  PTT/handoff corrigés. Pendant flush, conserver les nouvelles frames PCM
  (Gradium : 40 frames, 3,2 s ; AssemblyAI : 60 frames, 3 s) ou les chunks
  MediaRecorder (Deepgram : 20 chunks) puis envoyer cette seule queue après
  ACK/flush borné. Aucune reconstruction du phonème depuis du texte.
  Frontières vidéo/offre/handoff : arrêter la capture ancienne et la recréer
  après la frontière, avec consentement micro existant et generation guards.
- Perte de track, panne STT ou détecteur devenu muet arrêtent capture/sorties ;
  mic-off rejette et reprend le candidat réversiblement. Secours fixe avec
  la voix active préchargé aussi en PTT et au changement de personnage ;
  il n'entre jamais dans dialogue, reçu ou mémoire narrative.
- Preset handsFree et voix seule conservé dans V4 par normalisation/merge/CAS,
  sans migration ; ancienne session : text/UI actuelle. Défauts production
  et timers 900/700 préservés. Ni activation canary ni réglage distant à ce stade.
- Contrôle qualité complet : 567 unitaires, 34 intégrations, 46 régressions,
  typecheck/build réussis ; lint sans erreur (un avertissement de dépendance
  préexistant). Suite E2E complète initiale : 39 sans retry ; les neuf scénarios
  P2 finaux passent également sans retry, incluant micro-off et perte de track
  sur les trois navigateurs simulés (suite finale : 45 cas). Revues et CI du HEAD final suivent ; ces
  nombres intermédiaires ne sont pas une preuve humaine ni une mesure de gain.

## Protocole humain et pilote préparé

Revue finale Spec : un écho rejeté pouvait rester dans le buffer STT à la fin
de sortie. Correction ciblée : mémoriser le préfixe corrélé rejeté puis retirer
ce seul préfixe (y compris révision de ponctuation), sans vider l'énoncé suivant.
Test au seam candidat → rejet → nouvelle parole et préfixe absent ajouté.

CI initiale `38527380267` : 41 E2E réussis, 2 Firefox échoués et 2 retries
Chromium/WebKit. Les fakes P2 conservaient un AudioContext matériel Linux
pour une capture déjà simulée ; activation inachevée dans les traces Firefox.
Le périphérique/curseur Web Audio est désormais simulé explicitement dans ces
seuls E2E, player/détecteur/automate applicatifs inchangés. Attente de fin portée
à 15 s pour deux chunks PCM de 4,8 s, sans modifier un timeout produit.

## Livraison P2 — état vérifié

### Correctif ciblé de la recette réelle — transfert AudioWorklet

La première recette preview échoue : connexion Deepgram puis « Micro à
réactiver », sans question complète. Publication suspendue. Le worklet appelle
postMessage avec transfert du buffer avant de lire `frame.length` pour allouer
le suivant ; le transfert détache le tableau et sa longueur devient 0.
Reproduction native `structuredClone(..., { transfer: [frame.buffer] })` :
lengthAfterTransfer=0. Le fake du test VM ne transférait pas le buffer, ce qui
masquait ce défaut ; les E2E P2 simulent explicitement le périphérique.

Sous-lot correctif prévu avant implémentation : test VM utilisant un véritable
transfert structuredClone, observer la perte après première frame puis conserver
la taille avant le transfert et allouer le buffer suivant avant postMessage.
Vérifier continuité 16/24 kHz, resampling 44,1/48 kHz et flush, puis qualité/CI,
deux revues, PR codex/ → main et squash ; refresh preview et même test humain.
Aucun changement de DSP, timer de surveillance, STT, Shields ou voix pour
masquer le défaut. Il ne s'agit pas des warnings postMessage Lovable d'origine.

Reproduction rouge : les trois tests worklet utilisant un transfert réel échouent
(1 frame au lieu de 12 ; frame suivante absente). Après allocation avant
transfert : ces trois tests et 11 tests voisins passent. Qualité locale complète
verte : 568 unitaires, 34 intégrations, 46 régressions, lint/typecheck/build.
Appel défaillant clôturé ; stratégie text et voix seule false rétablies dans
sandbox-ulrich pendant correction, sans changer le preset P1 900/700.

Livraison du correctif : PR [#39](https://github.com/memoways/ava-proto1/pull/39),
HEAD `14cbb5c21ca688c7f962ce75d9b3070a036caa0a`, deux revues indépendantes
sans constat ; CI [38532213832](https://github.com/memoways/ava-proto1/actions/runs/38532213832)
success, 568/34/46 et 45 E2E sans retry. Squash main
`aef4dfb319a9bdc35594165160c74d93a86d6a1d`, 08:11:47 UTC ; workspace
synchronisé et même SHA constaté via MCP Lovable, ready/agentFinished=true.
Refresh natif puis canary P2 réactivée uniquement sandbox-ulrich, mêmes
réglages. Admin → Tester moi-même : nouvel appel Max prêt, micro fermé.
Session échouée `13394105-6610-4200-aefd-f5476731f086` clôturée à 07:57:34 UTC,
session corrigée `37d9abbb-edaf-47e7-9de2-774fa6ab3027` préparée à 08:14:15 UTC.
À ce relevé intermédiaire, la recette humaine attendait sa confirmation ;
la réponse ultérieure est consignée ci-dessous, sans preuve artificielle.

### Correctif ciblé MCP après publication

Recette corrigée confirmée par Ulrich : Max complet et voix habituelle,
interruption puis nouvelle réponse sans replay, bruit bref déclaré fluide,
micro-off avec sortie complète et bouton réactivable ; Emma complète et voix
habituelle. Max V4/preset épinglé, reçu interrompu conservateur (234 caractères
incertains, aucun préfixe promu), autres réponses livrées isolées ; Emma V4
isolée. DSP réel : AEC/NS/AGC true, track 48 kHz, contexte capture 16 kHz.
Candidat `a058caca-b2d1-4391-aa6d-c2b1b308fac9` : atténuation même timestamp,
suspension +128 ms, confirmation +316 ms, arrêt logiciel estimé +26 ms après
confirmation. Un seul cas, sans percentile ni preuve matérielle. Rejet bruit
réel non observé dans les événements de cet essai ; couvert automatiquement
et à confirmer sur pilote, pas revendiqué comme preuve physique.

Publication native `76aec5a6-1902-4d21-96b8-3eb474d71191` lancée depuis
`aef4dfb` ; flags production absents et normalisés false, canary sandbox seule.
Après publication, outils MCP Ava retournent -32603 Internal error. Hypothèse
reproduite localement : `.optional().transform(value => value ?? null)` dans
le schéma public des milestones n'est pas sérialisable en JSON Schema.
Sous-lot avant implémentation : test au vrai schéma de sortie du tool et au
sérialiseur SDK, remplacer transform par default(null), conserver historiques
et null sans conversion en zéro, regénérer uniquement mcp par build SDK ;
qualité, revues, PR codex/ → main, CI, squash et publication Lovable. Vérifier
les quatre outils après publication et la voix sur domaine publié. Diagnostic
Cloud Lovable plan-mode en lecture seule demandé ; aucune correction globale
ni migration ni reconnexion ne doit masquer cette panne.

Preuve Cloud reçue : trois boots de `mcp` lèvent l'exception exacte
`get_voice_latencies outputSchema cannot be represented as JSON Schema:
Transforms cannot be represented in JSON Schema`, stack assertToolSchemas
(mcp-js 3.0.5) → defineMcp → mcp/index.ts:890. L'auth OAuth était valide avant
publication ; aucune demande de reconnexion. Le test du schéma réel via
`toJsonSchemaCompat` est rouge sur transform, vert sur default(null), tout
comme l'historique conservant null. Qualité locale verte : 569/34/46,
lint/typecheck/build ; fonction mcp régénérée par SDK uniquement.
Lovable a écrit un plan hors autorisation en `.lovable/plan.md`, commit
`1d3e09a` (aucun code modifié). Ulrich a explicitement refusé sa validation
`plan--show` ; ce seul changement a été restauré à l'état `aef4dfb` dans la
PR #40, sans réécrire main ni toucher aux autres travaux.

- PR [#38](https://github.com/memoways/ava-proto1/pull/38), branche
  `codex/p2-hands-free-interruptions`, HEAD final revu
  `f709fe50bfa4ff540fcfa77fdf8544acba5f684d` ; deux revues indépendantes
  Spec/Standards sans constat restant. Application finale : `d0aac98` ; les
  commits suivants isolent les périphériques E2E et corrigent le lint du fake.
- CI finale [38529828574](https://github.com/memoways/ava-proto1/actions/runs/38529828574)
  success : 568 unitaires, 34 intégrations, 46 régressions, 45 E2E sans retry,
  lint sans erreur, typecheck et build réussis.
- Squash merge : `48f4d52561c9289689ea7d8b72c273740819a4de`, 07:50:14 UTC.
  Workspace main synchronisé. MCP Lovable constate ce même SHA, projet ready,
  agentFinished=true ; aucun agent de correction globale invoqué.
- Preview Brave : nouveaux contrôles voix seule et stratégie acoustique visibles
  après refresh natif Lovable. Admin authentifié, environnement Sandbox — Ulrich,
  preset P2 sauvegardé (mains libres, progressif, acoustic_confirmed, voix seule),
  délais 900/700 et seuil texte 3 conservés. Admin → Tester moi-même ; appel Max
  préparé, micro fermé. Réponse film `vu` conservée depuis les sessions humaines
  de baseline vérifiées via MCP Ava. Aucune parole synthétique injectée.
- Première recette vocale humaine : échouée, correctif ciblé ci-dessus. Au
  relevé initial de PR #38, publication et vérification publiée restaient à
  réaliser. Leur bilan final suit ; les 300 tours et objectifs physiques
  restent non attestés. La fusion GitHub n'est pas une publication.

### Bilan final publié — 14 octobre 2026

- PR [#40](https://github.com/memoways/ava-proto1/pull/40), branche
  `codex/p2-mcp-schema`, HEAD final revu
  `6ee0697959a4d926bc646fa53df5659db6e5ad84` : deux revues indépendantes
  Spec/Standards sans constat. CI
  [38538197826](https://github.com/memoways/ava-proto1/actions/runs/38538197826)
  success : 569 unitaires, 34 intégrations, 46 régressions et 45 E2E sans
  retry ; lint sans erreur (un warning préexistant), typecheck/build réussis.
- Squash main `0daa7e315f5f1ef81d5c9a7735b914e121065312`, 09:03:53 UTC.
  CI après fusion
  [38539614778](https://github.com/memoways/ava-proto1/actions/runs/38539614778)
  success à 09:13:42 UTC. Workspace main synchronisé ; MCP Lovable confirme
  ce SHA, projet ready et agentFinished=true.
- Republication native Lovable
  `cefe6424-cc0e-4215-bf0e-e6eaa36e4c5f`, depuis `0daa7e3`. Le lancement
  retourne pending ; le succès est ensuite attesté par les quatre outils MCP
  fonctionnels et le parcours vocal réel sur `https://proto1.parle-a-ava.com`.
  Aucun SHA de bundle servi ni numéro Edge exact n'est indépendamment attesté.
- Les quatre outils **MCP app Ava** répondent après republication : usage,
  sessions et latences filtrés sandbox-ulrich, coûts globaux. La projection
  V2 retournée à 09:06 UTC comporte `invalidRows=0` et les jalons P2 de la
  session Max corrigée. Son périmètre reste la page retournée, sans conclusion
  statistique sur une cohorte ni assimilation des observations GM à des tours.
- Contrôle publié préparé depuis admin → Tester moi-même, Sandbox — Ulrich,
  dans Brave. Session Max `bd6dc87e-328a-4d61-b3a7-e6ea6d184e79`,
  09:11:50 → 09:14:03 UTC, film `vu`. Ulrich confirme « Réponse complète,
  voix habituelle, micro actif ». UI voix seule observée, statut À L'ÉCOUTE
  et bouton Couper le micro après réponse ; Terminer libère la capture.
- Lecture technique ciblée par MCP Lovable sur le même Cloud : mémoire V4,
  preset acoustic_confirmed / voix seule / progressif épinglé, délais
  900/700 et seuil texte 3 ; livraison isolée à Max. Reçu tour 1 completed :
  211 caractères générés et livrés, 0 incertain, 0 continuation privée,
  préfixe valide. Aucun dialogue ni intention privée lu pour cette vérification.
- Preview Max et Emma précédentes clôturées, nouvelle session publiée clôturée.
  Aucune parole synthétique injectée en réel et aucun changement de Shields.
  Production conserve les défauts batch et flags P2 désactivés ; canary
  active seulement dans sandbox-ulrich. P3 non commencé.

Les réserves GM P1 demeurent : cause des deux délais 12000 ms inconnue,
invariants vérifiés, aucun tuning. Réserves P0 historiques conservées sans
relance. Le bruit bref réel a été déclaré fluide, mais aucun rejet acoustique
n'a été observé dans cet essai : ne pas le présenter comme preuve de reprise
physique. Le pilote 300 tours / 10 sessions, l'arrêt matériel et l'activation
générale restent à réaliser selon le protocole suivant.

Recette courte : Brave, admin → Tester moi-même, sandbox-ulrich. Vérifier
Max puis Emma avec leur voix inchangée : réponse entière, une correction
« non, attends » au milieu, réponse nouvelle après sa fin de parole ; une
toux/bruit bref doit atténuer puis reprendre la même réponse ; coupure micro
pendant candidat et fin de session doivent rester utilisables. Ne pas forcer
de consentement GM ni relancer P0. Aucune voix synthétique injectée en réel.
Référence acoustique physique : non capturée ; objectifs hardware non attestés.

Pilote acoustique : 10 sessions de 30 tours (300), 5 baseline P1/text et
5 acoustic_confirmed, mêmes voix, modèle, révision, RAG et timers 900/700.
Brave seulement pour la voix humaine autorisée ; percentiles réels des autres
navigateurs non attestés. Répartir 6 sessions Max / 4 Emma, 3 Max et 2 Emma
par stratégie. Alterner question canonique, reformulation elliptique, pause
de réflexion, reprise, « oui/non/attends », noms propres ; inclure bruit/toux,
casque/haut-parleur, candidat avant son/premier mot/milieu/fin et interruptions
rapides. Les variantes 900/700/500 et hésitation 700/300, puis Gradium 7/10,
nécessitent des cohortes distinctes en changeant un seul levier à la fois.

| Session prévue | Personnage | Stratégie | Tours réels | Révision/preset | Résultat/gates |
| --- | --- | --- | --- | --- | --- |
| B1–B3 | Max | text | À renseigner | À épingler | Non exécuté |
| B4–B5 | Emma | text | À renseigner | À épingler | Non exécuté |
| P1–P3 | Max | acoustic_confirmed | À renseigner | À épingler | Non exécuté |
| P4–P5 | Emma | acoustic_confirmed | À renseigner | À épingler | Non exécuté |

Pour chaque tour : session/attempt/turn/interruption_id, question et pause
contrôlée, état final, premier/dernier mot, faux endpoint, fausse atténuation,
fausse coupure, identité/fuite/mémoire, underrun/replay, disponibilité et
couverture. Dédupliquer les snapshots V2 par tentative/candidat/événement,
exclure les observations GM des effectifs de tours. Chronométrer séparément
détection→atténuation, confirmation→arrêt estimé, rejet→reprise ; valeurs
absentes restent null. Publier effectifs/p50/p95 par cohorte ; aucune durée
de timer économisée n'est un gain de bout en bout. 300 tours/10 sessions
restent à réaliser, sans corpus fictif ni activation générale.
