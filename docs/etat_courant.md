# Ava — état courant

Mise à jour : 5 novembre 2026. Entrée courte de reprise, historique dans CHANGELOG.

## Priorité produit

Continuer l'amélioration de Max/Emma ; pas de gel de démo accepté. Présent canonique
livré par #104, code vert `9adabdce5b5a4f9be6f6fdc6545868659cb4120a` ; 109 E2E,
[CI 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202).
Le souvenir J−2 de l'hôtel doit rester distinct du présent de l'appartement.
Voix et mains libres acceptées préservées ; la recette F4 demeure humaine et
distincte : [prompt F4](prompt_reprise_present_canonique_lot_f4_recette.md).
Aucune publication production par CT1 ; main fusionné ne vaut pas publication.

## CT1 — contexte et livraison

Les trois décisions ont été approuvées. [Plan et validations](plan_audit_contexte_travail.md),
[ADR CI](adr_ci_complete_sur_pr.md). Campagne complète sur PR/HEAD exact contenant
main ; garde obligatoire, puis arbre/parent fusionnés vérifiés. Aucun second
passage complet sur main. Le SHA réel et le run se lisent sur GitHub et dans le
compte rendu de livraison, sans créer une PR documentaire supplémentaire.
Contexte personnel/skills et branchement git-ship sont des changements locaux
du poste, décrits dans [la livraison CT1](livraison_contexte_travail_ct1.md).

## Livraison (3 novembre)

CI en jobs parallèles (qualité + E2E en 4 shards, ~8 min au lieu de 25). Livrer de bout
en bout sans demander : PR, CI, mise à jour sur main, garde, nettoyage. [ADR](adr_ci_complete_sur_pr.md#amendement-du-3-novembre-2026--même-campagne-en-parallèle).

## Démarrer

`git status`, remote, activité des chats, branches/PR, `git fetch --prune`, six
commits de main et début du CHANGELOG ; main propre par pull ff-only. PR étrangère
#24 et branches locales historiques à préserver. Aucun autre agent simultané.
Lire ensuite le plan du seul domaine concerné ; pas tous les historiques.

Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways `5glbtPltldwz9tgNwIi4` :
seul accès SQL/Cloud et seule chaîne de livraison. Notion Ava : Gamilab natif,
ID `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, vérifier par get-self. Tâche :
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f.
Personnel : Ulrich `377e8583-7838-4c05-9f76-8833a450f304`, sources Ava exclues.
GitHub natif Unknown tool au dernier test ; repli git/gh autorisé avec Ulrfis.

## Suite préparée

**Tavus lot 3 (5 novembre, code) : admin d'entraînement d'un Face.** Bloc « Entraîner un Face (vidéo) »
dans l'onglet Tavus : upload TUS vers le bucket privé, entraînement lancé seulement après confirmation,
liste des Faces avec suivi (30 s tant que `started`), « Attribuer à Max » (puis Sauvegarder). Bucket et
4 politiques vérifiés présents dans Lovable Cloud ; aucun entraînement réel lancé. Suite : recette
humaine, [lot 4](prompt_reprise_tavus_face_emotion_lot_4.md).
[Plan](plan_tavus_entrainement_face_emotion.md#exécution-lot-3--5-novembre-2026).

**Tavus lot 2 (5 novembre, code) : backend d'entraînement d'un Face.** Bucket privé + actions admin
`train-face` / `face-status` + client typé, sans interface ni entraînement réel. Actions d'Ulrich :
appliquer la migration dans le chat Lovable, vérifier le redéploiement de l'Edge Function. Suite :
[lot 3 « admin »](prompt_reprise_tavus_face_emotion_lot_3.md).
[Plan](plan_tavus_entrainement_face_emotion.md#exécution-lot-2--5-novembre-2026).

**Tavus lot 1 (5 novembre, code) : balise Echo et expressivité par personnage.** Balise Echo
choisie directement parmi les 11 valeurs (défaut `dejected`), découplée de `set_emotion` ;
surcharges Max/Emma (Face ID, balise, émotions ; vide = global), Face recréé seulement s'il
change ; balise jamais lue ni sous-titrée. Front seul, rien à déployer côté Edge. Suite :
[lot 2 « backend d'entraînement »](prompt_reprise_tavus_face_emotion_lot_2.md) (migration via
le chat Lovable). Recette visuelle au lot 4.
[Plan](plan_tavus_entrainement_face_emotion.md#exécution-lot-1--5-novembre-2026).

**Anam AN2 (5 novembre, code) : émotion du visage par réplique.** La balise Anam suit
l'intention de jeu (états de parole du Game Master, sa mémoire, la réplique) ; défauts sans
sourire, mode fixe en repli, table par personnage dans l'admin, trajectoire dans Admin →
Sessions. Diagnostic : le Game Master fait déjà évoluer Max (5 états, rugosité 3). Edge Function
à redéployer par Lovable, puis recette d'Ulrich (une dizaine d'échanges avec Max). Aucun lot ne
suit. [Exécution](plan_avatar_streaming_multi_fournisseurs.md#exécution-an2--5-novembre-2026).

**Anam AN1 (5 novembre, code) : fondations.** Cara 4.1 Express par défaut (valeurs enregistrées
gardées), métriques client Anam réactivées (télémétrie de connexion seule), chemin réseau (type de
candidat, protocole, RTT ; aucune adresse) dans `warm_up`, visible dans « Tester l'avatar », aides
voix. Edge Function à redéployer par Lovable. Recette d'Ulrich, puis
[AN2](prompt_reprise_anam_lot_an2.md). [Exécution](plan_avatar_streaming_multi_fournisseurs.md#exécution-an1--5-novembre-2026).

**Anam, expressivité et émotion évolutive (5 novembre, plan).** Recommandations du support Anam
relues contre le code : Director Notes et `videoQuality: "high"` déjà en place. Deux lots :
[AN1](prompt_reprise_anam_lot_an1.md) (Cara 4.1 Express par défaut, métriques client, chemin
réseau dans `warm_up`, aides voix) puis [AN2](prompt_reprise_anam_lot_an2.md) (balise d'émotion
par réplique tirée de l'intention de jeu que le Game Master fait évoluer ; Max ne sourit pas).
Chaque lot va au bout : garde, Lovable synchronisé, prompt suivant.
[Plan](plan_avatar_streaming_multi_fournisseurs.md#suite-anam--expressivité-émotion-évolutive-et-synchro-5-novembre-2026).

**Anam, jeu et synchro (2 novembre).** #145 fusionnée (`ae0cf92`) : balise de jeu au visage seul,
recette d'Ulrich : plus de déraillement. Suite (PR en cours) : tampon de lecture de 400 ms et accueil
retenu jusqu'à un flux WebRTC stable (≤ 10 s), fusionné (`fd721af`). #147 (répétition muette) a
régressé et est annulée ; écran de connexion gardé jusqu'à l'accueil, vidéo affichée une seule fois
(#149). Ouvert : l'image a 1 à 2 s d'avance sur le son pendant la première réplique.

**Avatars streaming AV3 (2 novembre, code) : LemonSlice en mode audio.** D1a : salle Daily privée
créée par l'Edge Function, navigateur en réception seule. La voix du personnage d'Ava (TTS actuel)
part en PCM16 sur le WebSocket LemonSlice, `audio_end` par réplique, fin sur `playback_finished`,
interruption, repli TTS. Contrainte `streaming_avatar_provider` appliquée par Lovable (main
`4970ba5`, relue : `anam` et `lemonslice` acceptés). À faire, une action à la fois : secrets
`LEMONSLICE_API_KEY` puis `DAILY_API_KEY`, Edge Function déployée par Lovable, recette d'Ulrich (voix de Max, synchro, aucun sourire, interruption, repli). Aucun lot
de code ne suit, sauf AV4 « Anam passthrough » si Ulrich choisit D2b.
[Plan](plan_avatar_streaming_multi_fournisseurs.md#exécution-av3--2-novembre-2026).

**Avatars streaming AV2 (2 novembre, code) : Anam en mode texte.** SDK 4.29.1, micro jamais
ouvert, LLM Anam coupé, une talk stream par réplique avec balise `[sad]`, Director Notes abattues
en parlant et fermées au repos, voix Anam (D2a), interruption `interruptPersona`. Migration
minimale décidée par Ulrich : contrainte `streaming_avatar_provider` élargie (`anam`,
`lemonslice`). À faire : secret `ANAM_API_KEY`, migration et Edge Function appliquées par Lovable,
puis recette d'Ulrich. [Plan](plan_avatar_streaming_multi_fournisseurs.md#exécution-av2--2-novembre-2026) ·
[Prompt AV3 « LemonSlice en mode audio »](prompt_reprise_avatar_streaming_lot_av3.md).

**Avatars streaming AV1 (2 novembre, code) : socle multi-fournisseurs et réglages complets.**
Module partagé Edge/client à liste blanche et bornes ; Anam et LemonSlice connus, non
sélectionnables. HeyGen : très haute qualité, encodage, durée max, voix par moteur, posture
d'écoute. Tavus : `languages`, délais, sous-titres, fond vert, politique UE, vérification
`test_mode` avec voix du PAL en lecture seule. Admin « Essentiel »/« Avancé ». Aucune migration
ni secret. À faire : déploiement Lovable de l'Edge Function, puis recette d'Ulrich (HeyGen et
Tavus sandbox, réglage avancé changé, interruption en cours de réplique).
[Plan](plan_avatar_streaming_multi_fournisseurs.md#exécution-av1--2-novembre-2026) ·
[Prompt AV2 « Anam en mode texte »](prompt_reprise_avatar_streaming_lot_av2.md).

**Avatar Tavus abattu (1er novembre, code) :** `conversation.set_emotion` « sadness » par défaut
à l'entrée, quand le flux est prêt et à chaque réplique, plus la balise Echo `dejected` dans chaque texte (recette 1 : sourire encore présent sans balise), renvoi en fin de réplique et toutes les 5 s pendant l'écoute (recette 2 : retour à l'assistant aimable). Réglable dans l'onglet admin Tavus. Recette 3 : écoute séparée (défaut Neutre, Tristesse faisait chien battu). Voix : passer le PAL Tavus sur ElevenLabs (voix de Max) côté Tavus. Recette humaine : Face
Phoenix-4/4.5 Pro, vérifier que Max ne sourit à aucun moment. HeyGen : aucun contrôle d'émotion.

**Sélection vidéos, lot 5 livré le 1er novembre (code) : lecture et mémoire.**
Contexte post-vidéo entier (coupe au mot) + « ce que la vidéo montrait », plafond 1 000 ;
mémoire des trois dernières vidéos vues, bloc identique pour le GM et le personnage
(« Ignorée » exclue, « Passée » marquée). Passe avant les souvenirs RAG. Aucune migration, aucune
écriture Notion, prompt GM publié inchangé. Lot 4 : 17/17 Descriptions IA (201–299), Descriptions
humaines intactes. Recette humaine par Ulrich : une vidéo jouée, puis une allusion à cette scène
deux ou trois tours plus tard. [Plan](plan_selection_videos_contextuelle.md#lot-5--lecture-et-mémoire) ·
[Prompt lot 6 « consigne d'analyse »](prompt_reprise_selection_videos_lot_6.md).

**Sélection vidéos, lot 4 livré le 1er novembre (code) : Description IA automatique.**
Edge Function `describe-video` (admin) : Gemini 2.5 Flash regarde le rendu 360p Gumlet
(MP4 fragmenté, base64) et écrit **seulement** « Description IA » dans Notion puis
`ai_description` ; Description humaine jamais lue ni écrite. Admin : « Analyser » par vidéo et
« Analyser les vidéos sans description ». Aucune analyse réelle lancée : Ulrich analyse une
vidéo de test, relecture, puis le reste. Prompt GM : sandbox-ulrich v11 porte la règle ; prod
v8, sandbox-julien v9 inchangés. [Plan](plan_selection_videos_contextuelle.md#lot-4--description-ia-automatique) ·
[Prompt lot 5 « lecture et mémoire »](prompt_reprise_selection_videos_lot_5.md).

**Sélection vidéos, lot 3b livré le 1er novembre (code) : transition cinématique.**
La vidéo ne coupe plus ni la réplique ni le joueur : le GM décide après la réplique livrée ;
personne ne parle → fondu au noir, vidéo, retour en fondu ; le joueur parle → son tour est
pris, la séquence est annoncée pendant la réplique suivante (écoute tenue, « Ignorer »), puis
jouée. Machine `cinematicTransition`, fondus 700/400/700/800 ms. Recette humaine à faire par
Ulrich en sandbox : vidéo décidée en silence, pendant qu'il parle, « Passer » et « Ignorer ».
Recette faite : « ça fonctionne bien » ; retouches livrées (pas d'infobulle ni de pointeur sur
la vidéo, capsule « Une vidéo arrive » sous les personnages, Max jamais emporté deux répliques
de suite). Levier restant : rugosité de Max (3 en sandbox-ulrich). Aucune publication. [Plan](plan_selection_videos_contextuelle.md#lot-3b--transition-cinématique-demande-dulrich-2026-11-01) ·
[Prompt lot 4 « Description IA automatique »](prompt_reprise_selection_videos_lot_4.md).

**Sélection vidéos, lot 3 livré le 1er novembre (code) : choix au sens.**
Bloc vidéos du GM avec Contexte et Description (ou Description IA), 300 caractères chacun ;
règle du code : contexte d'abord, un thème seul ne suffit plus. `videoTriggerMatcher.ts`
supprimé. **Prompt GM publié non modifié** (sandbox-ulrich v7, prod v8, sandbox-julien v9) :
publication admin par Ulrich, sandbox d'abord, production sur son accord :
nouveau brouillon depuis l'admin de l'aperçu Lovable puis « Publier » —
[procédure](prompt_gm_publie_regle_videos_lot_3.md). Recette humaine : film vu, film pas
vu, vidéo pertinente au fil de la conversation.
Recette d'Ulrich (sandbox-ulrich, v11 publiée) : choix validé ; la cinématique arrive
pendant qu'il répond → lot 3b « transition cinématique », livré (voir ci-dessus).
[Plan](plan_selection_videos_contextuelle.md) ·
[Prompt lot 3b](prompt_reprise_selection_videos_lot_3b.md) ·
[Prompt lot 4 « Description IA automatique »](prompt_reprise_selection_videos_lot_4.md).

**Sélection vidéos, lot 2 livré le 1er novembre : filtre d'éligibilité déterministe.**
`selectEligibleVideos` filtre avant le GM : film vu → transformées ; film pas vu → extraits
d'abord, transformées après `MIN_EXTRACTS_BEFORE_CINEMATIC` (défaut 2) ; personnage en ligne,
`intro` et déjà jouées exclues. Garde du directeur : motif `ineligible`. Lot 1 vérifié
appliqué (migration + synchro, champs remplis). Recette humaine à faire par Ulrich : une
partie film vu, une partie film pas vu. Prompts GM inchangés.
[Plan](plan_selection_videos_contextuelle.md) ·
[Prompt lot 3 « choix au sens »](prompt_reprise_selection_videos_lot_3.md).

**G1.3 implémenté le 31 octobre : le passage à Emma n'est plus jeté, pause jamais répétée.**
Recette d'Ulrich (session `e6918bd8…`) : le MJ avait validé « Je passe Emma » deux fois, mais
l'offre non préparée était révoquée (formulation non reconnue), puis la pause tournait en
boucle. Formulations reconnues, accord validé préparé après coup avec les mêmes gardes, pas de
seconde pause. G1.2 tient : prompt 25–58 ms, premier son hors passage 3,2–4,7 s. Fin de parole
sandbox passée de 2 000 à 900 ms (décision d'Ulrich, réglage seul) ; autres décisions de latence
et acceptation vocale à prendre par Ulrich.
[Recette et exécution G1.3](plan_gravite_ava_latence_g1.md#g13a--recette-dulrich-31-octobre-2026-sans-code) ·
[Prompt G1.4 « recette du passage, décisions d'Ulrich »](prompt_reprise_passage_latence_lot_g1_4.md).

**G1.2 implémenté le 31 octobre : recette lue, prompt ~0,8 s plus rapide, registre tenu.**
Recette d'Ulrich (session `4671a23a…`) : gravité tenue, aucune relance LLM, premier son
4,1–4,8 s. La construction du prompt `optimized_v3` coûtait 0,77–0,96 s par tour (déduplication
quadratique) : profils mis en cache, même prompt. Phrases scriptées en cours d'appel au « tu »
quand le personnage tutoie. À confirmer par `character_prompt_build` à la prochaine recette.
[Recette et exécution G1.2](plan_gravite_ava_latence_g1.md#g12a--recette-dulrich-31-octobre-2026-sans-code) ·
[Prompt G1.3 « latence, décisions d'Ulrich »](prompt_reprise_latence_decisions_lot_g1_3.md).

**G1 implémenté le 31 octobre : gravité, « Ava », relance LLM évitée.**
Cause de « Eva » : voix ElevenLabs v4 (texte et STT disent « Ava ») → graphie `Ahva` pour
v3/v4. Trivialités : accroche R1 « détail concret » → invariant de gravité non tronquable,
accroche tournée vers le drame, garde locale de sortie. Décroché léger : base vocale `warm`
d'Emma → base `fragile`, jamais `warm`/`sarcastic` par défaut pour Max et Emma. Écart fin
LLM → TTS : relance complète du LLM → pensée ouverte dite en suspension et sauvetage local.
Spans `character_*` pour la suite. Recette G1.2 faite.
[Constat et exécution](plan_gravite_ava_latence_g1.md) ·
[Prompt G1.2 « recette gravité et latence »](prompt_reprise_recette_gravite_lot_g1_2.md).

**L1 implémenté le 31 octobre : ElevenLabs lu au fil de l'eau, v4 Turbo retenu.**
L'écart de ~4 s avec Gradium venait de l'attente du MP3 complet. Lecture progressive
MediaSource avec repli blob et coupure nette ; défaut expressif `eleven_v4_turbo`.
Premier son mesuré à 0,66 s après envoi du texte (v4 : 0,98 s, avant 4,5 s). Le réglage
sandbox basculé en v4 Turbo par Ulrich le 31 oct. Recette L1.3 : latence ressentie
inchangée ; mesure : texte → son 0,43–0,56 s (L1 tient), mais 5,4–10,2 s de fin de tour à
son, dû à l'écart fin LLM → TTS (2,6–5,9 s, un tour sur deux), au contexte et au LLM.
Recette aussi : Max trivial, Emma légère au décroché, « Eva » au lieu de « Ava ».
[Mesures et exécution L1](plan_latence_elevenlabs_et_relance_2026-10-31.md#mesure-l10--31-octobre-2026) ·
[Prompt G1 « gravité, Ava, latence réelle »](prompt_reprise_gravite_ava_latence_lot_g1.md),
exécuté ; il absorbe [L2](prompt_reprise_latence_lot_l2.md).

**R1 implémenté le 31 octobre : répliques de deux à trois phrases avec accroche.**
Retour d'Ulrich sur ElevenLabs : meilleure voix, mais latence et répliques trop courtes.
Contrat de flux 45 → 70 mots, règle d'accroche partagée par les quatre variantes,
budget personnage [360, 480] tokens (220 stockés relevés à la lecture). Valeur effective
vérifiée : `optimized_v3`, `responseStyle` non injecté, Notion « une à trois phrases ».
Proposition Notion pour Max non appliquée. Ressenti à valider par Ulrich ; latence
ElevenLabs accrue jusqu'à L1.
[Exécution R1](plan_latence_elevenlabs_et_relance_2026-10-31.md#exécution-r1--31-octobre-2026) ·
[Prompt L1 « ElevenLabs réactif »](prompt_reprise_latence_elevenlabs_lot_l1.md), exécuté.

**AP1 livré techniquement ; utilisabilité rejetée par Ulrich.**
Accès admin sandbox : Expérience → Atelier de parole,
`/admin/experience/atelier-de-parole`. A/B temporaire, état explicite par cas,
transport actuel respecté et preuves effectives lisibles ; aucun réglage live.
[Résultat et validations AP1](plan_lot_b_rendu_vocal.md#exécution-ap1--28-octobre-2026).
Lire la PR AP1 et son reçu GitHub/Notion pour les SHA/run finaux ; ce document
est committé avant le squash. Lovable/production restent des étapes distinctes.

**AP2 implémenté : atelier unique et comparaisons persistantes.**
TTS Config ne lance plus d’audio. Dans l’atelier : réplique/état explicite → version
actuelle → un réglage différent → avis nommé et sauvegarde confirmée par relecture.
Emma, fournisseurs et contrôles experts dans les options avancées du même banc.
Documents admin/sandbox `speech_workshop_documents` (hors `ava_` pour conserver
l’isolation RLS), CAS du document et relecture exacte. Charger reste un brouillon,
aucun audio automatique ni activation du jeu. Audio exact uniquement en mémoire.
[Résultat et limites AP2](plan_lot_b_rendu_vocal.md#exécution-ap2--28-octobre-2026).
Livraison GitHub/CI et preview sont vérifiées à la clôture, avec reçu réel dans la
PR et Notion ; ne pas confondre implémentation et publication.

**AP3 mené le 29 octobre : parcours compris, réglages bruts refusés.**
Ulrich juge la mécanique claire. En revanche, les réglages bruts Gradium sont
incompréhensibles et les répliques M1/M2 trop courtes, sans contexte. Il demande
des passages de 2 à 3 phrases longues, une émotion choisie dans une liste, la
recette traduite pour chaque fournisseur avec ses paramètres visibles, et une
comparaison côte à côte entre fournisseurs notée de 1 à 5. Aucune écoute ni
comparaison enregistrée.
Analyse : le socle neutre `PerformanceIntent` et ses cinq adaptateurs existent
déjà ; l’atelier exposait la mauvaise couche.
[Retour, analyse et contrat AP4](plan_lot_b_rendu_vocal.md#retour-dulrich-pendant-ap3--29-octobre-2026).

**AP4 implémenté le 30 octobre : atelier par intention de jeu.**
Textes et dix intentions validés par Ulrich. Un texte, une émotion, une carte
par fournisseur côte à côte : recette, paramètres appliqués, leviers ignorés,
une génération par clic, note de 1 à 5 (« off » sous 5), tableau intention ×
fournisseur exportable. Essais dans `speech_workshop_documents` (`intentTrials`),
sans migration ; banc AP2 replié en options avancées. Seul Gradium a la voix
de Max dans `sandbox-ulrich` ; les autres demandent une voix d’atelier.
Aucun son réel généré en développement.
[Exécution AP4](plan_lot_b_rendu_vocal.md#exécution-ap4--30-octobre-2026).

**AP4-bis implémenté le 30 octobre : voix par fournisseur et atelier compact.**
Après l’essai d’Ulrich : Voice ID des 4 personnages × 5 fournisseurs saisis
une seule fois dans Technique → Configuration TTS (`ava_tts_character_voices`),
repris par les réglages des personnages et l’atelier ; la voix du jeu ne suit
que l’ID du fournisseur déjà choisi, à l’enregistrement. « Faire un autre
test » sans changer d’onglet, écran sur 2–3 colonnes. Gradium n’a aucun
réglage d’émotion : la carte le dit, trois options attendent la décision
d’Ulrich. La séance accompagnée de l’ancien AP5 est faite.
[Exécution AP4-bis](plan_lot_b_rendu_vocal.md#exécution-ap4-bis--30-octobre-2026) ·
[Prompt autonome AP5](prompt_reprise_atelier_parole_lot_ap5.md) : comparer les
fournisseurs avec les voix custom de Max, non lancé. Reçu PR/CI/fusion dans la
PR et Notion. F4 reste distincte. Aucune publication production implicite.

**AP4-ter implémenté le 30 octobre : ElevenLabs corrigé, v4 par défaut dans l’atelier.**
Le 400 `unsupported_model` venait très probablement de `optimize_streaming_latency`
(déprécié) et du contexte de phrases, envoyés à v3/v4 ; `proxy-tts` ne les envoie
plus que là où ils sont acceptés, les Turbo dépréciés sont lus comme Flash v2.5,
TTS Config liste les modèles actuels. Défaut expressif de l’atelier : `eleven_v4`
(choix d’Ulrich). Cause non confirmée par logs ni appel réel ; la recette humaine
après déploiement Lovable reste à faire.
[Exécution AP4-ter](plan_lot_b_rendu_vocal.md#exécution-ap4-ter--30-octobre-2026).

## Livraison AP2 et accès dédié

Qualité locale : 71 régressions, 1 131 unitaires, 42 intégrations, lint/typage/build ;
35 tests de livraison, dont session à un seul accès au coffre et jeton App stateless ; E2E ciblé simulé clavier/390 px.
Le reçu PR/HEAD, CI et arbre/parent fusionnés est consigné après livraison dans
la PR et la tâche Gamilab ; ce fichier est committé avant la fusion.
[Procédure de reprise AP2](prompt_reprise_atelier_parole_lot_ap2_livraison.md).

App privée `ava-delivery` créée (5515307) et installée (176291841) sur le seul dépôt
Ava : Contents/PR write, Actions/Metadata read. Clé dans le coffre Privé Fischers,
configuration locale de références non secrètes, jetons en mémoire, aucun repli
personnel. Accès API authentifié vérifié avec un seul dépôt retourné ; copie
PEM temporaire supprimée. Utiliser le lanceur versionné d’AGENTS à chaque reprise.
[Plan d’accès et limites](plan_authentification_github_sans_trousseau.md).
Scripts partagés inchangés ; une clé initiale non récupérée reste côté GitHub,
suppression distincte non effectuée. Aucun accès au Trousseau ni reconnexion
GitHub personnelle. AP3 préparé sans lancement ; aucune publication production.

PR AP2 #111 ouverte ; première CI 40751731709 rouge : seul le parcours AP2 Firefox
échoue après refus de lecture, 111 autres E2E verts. Garde : fusion refusée.
Correction locale : fixture audio déterministe + refus explicite ; trois navigateurs
et Firefox strict verts. Mode session pour éviter les demandes 1Password répétées,
suivi CI à une minute, aucun nouveau paramétrage 1Password. La première demande a expiré, sans relance ; après réponse « prêt » d’Ulrich,
une session réelle a été ouverte, puis traces CI et fetch effectués avec cette
même clé en mémoire. Les traces confirment OnMediaSinkAudioError sur le runner.
Nouveau HEAD/CI/fusion/preview encore à vérifier dans le reçu final.
