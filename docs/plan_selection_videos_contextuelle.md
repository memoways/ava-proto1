# Plan — sélection contextuelle des vidéos

Date : 2026-11-01. Statut : lots 1 (données), 2 (filtre d'éligibilité), 3 (choix au sens),
3b (transition cinématique), 4 (Description IA) et 5 (lecture et mémoire) livrés ; règle GM
publiée en sandbox-ulrich (v11), prod (v8) et sandbox-julien (v9) inchangés. Les 17 vidéos ont
une Description IA ; lot 6 (consigne d'analyse) préparé
([prompt lot 6](prompt_reprise_selection_videos_lot_6.md)).
Source : analyse de la mécanique vidéo (session du 2026-11-01) et décisions d'Ulrich.

## État actuel (résumé)

- Le Game Master PRD4 choisit seul la vidéo après chaque tour. Il compare
  uniquement `labels.themes` aux Thèmes Notion et voit : id, titre, type,
  priorité, thèmes, 160 caractères de Description.
- Contexte n'est pas envoyé au GM. Il sert une seule fois après la vidéo, coupé
  à 500 caractères (`maxOptimizedPromptCompiler.ts`).
- Type, Priorité, Style de transition, Étape Gameplay : sans effet sur le choix.
  Description vide partout. Aucun filtre par personnage ni par parcours film.
- Garde-fous existants (`experienceDirector.ts`) : activé, URL présente, jamais
  rejouée, délai avant la première vidéo et entre deux vidéos, maximum par session.
- `videoTriggerMatcher.ts` n'était appelé nulle part (code mort) : supprimé au lot 3.
- Le prompt GM publié (`systemPromptOverride`, fixture `gm-published-sandbox-v7`)
  remplace le prompt du code : toute règle vidéo doit aussi passer dans la
  version publiée, sinon elle reste sans effet.

## Décisions d'Ulrich (2026-11-01)

1. **Deux natures de vidéo** : « Extrait du film » et « Vidéo transformée »
   (transformée par l'IA, onirique).
2. **Parcours film** (`experiencePathFromFilmAnswer`, `vu`/`rappel` → seen,
   `pas_vu` → unseen) :
   - film vu : uniquement des vidéos transformées, jamais d'extrait ;
   - film pas vu : d'abord des extraits ; une vidéo transformée n'est possible
     qu'après un nombre minimum d'extraits montrés (réglage admin).
3. **Pas d'ordre chronologique** imposé aux extraits : choix au fil de la conversation.
4. **Personnages** : multi-select Max, Emma, Ava, Léo, Tous. Une vidéo n'est
   proposée que si le personnage en ligne en fait partie. Valeur « Tous » ou
   champ vide : vidéo disponible pour tous.
5. **Contexte ≠ Description** :
   - Contexte = contexte narratif éditorial, subjectif, écrit par Ulrich ;
     il porte les intentions et sert à rapprocher la vidéo de la conversation ;
   - Description = description factuelle et objective de la séquence.
6. **Description automatisée** : une IA analyse la vidéo et remplit un champ
   séparé « Description IA ». Le GM lit Description si elle est remplie, sinon
   Description IA. La saisie humaine n'est jamais écrasée.

## Changements Notion (base 🎬 Vidéos AVA)

Nature, Personnages et Description IA ont été créés le 2026-11-01 (accord
d'Ulrich), vides sur toutes les vidéos. Nettoyage des Thèmes et Priorités : à
faire par Ulrich. La base Caractères n'est pas concernée et reste en lecture seule.

| Champ | Type | Valeurs / rôle |
|---|---|---|
| Nature | select | Extrait du film, Vidéo transformée |
| Personnages | multi-select | Max, Emma, Ava, Léo, Tous |
| Description IA | texte | rempli par l'analyse automatique |
| Thèmes | multi-select existant | corriger « patricarcat », harmoniser « Contamination », retirer « contexte » |
| Priorité | nombre existant | à remplir (plus petit = prioritaire) |

Valeurs par défaut à la synchronisation : Nature vide → Vidéo transformée (les
vidéos actuelles le sont) ; Personnages vide → Tous.

## Lots

### Lot 1 — Données et synchronisation

- Migration `video_triggers` via Lovable : colonnes `nature`, `characters`
  (text[]), `ai_description`.
- `sync-notion` : mapper Nature, Personnages, Description IA avec les défauts
  ci-dessus. `VideoTriggerRow` étendu.
- Tests : mapping et défauts.

**Exécution (2026-11-01).** Champs Notion vérifiés par `notion-gamilab`
(get-self Gamilab `7e1a9a09…`), aucune vidéo modifiée.

- Migration additive `20261101120000_video_triggers_selection_metadata.sql`
  (`nature`, `characters` text[], `ai_description`, nullables, sans backfill).
- Mapping pur `supabase/functions/_shared/videoMetadata.ts` :
  `mapVideoNature` (Extrait du film → `extract`, vide ou inconnu →
  `transformed`, casse/accents tolérés) et `mapVideoCharacters` (noms →
  identifiants sans accent, Léo → `leo`, « Tous » ou vide → `['all']`,
  doublons retirés, valeurs inconnues gardées normalisées).
- `sync-notion` écrit les trois champs ; si la migration n'est pas encore
  appliquée (`PGRST204`/`42703` sur ces colonnes), il resynchronise les
  colonnes historiques sans échec et renvoie `video_metadata_synced: false`.
- `VideoTriggerRow` étendu (champs optionnels) ; lecture `select("*")` pour
  rester valide avant et après la migration. Types Supabase étendus.
- Éditeur admin : Nature et Personnages affichés en lecture seule.
- Aucune règle de sélection modifiée : le GM lit toujours les mêmes champs.
- Tests : `src/services/videoMetadata.test.ts` (défauts, inconnus, accents,
  détection de colonne absente).

### Lot 2 — Filtre d'éligibilité déterministe

Nouvelle fonction pure (par exemple `selectEligibleVideos`) appelée avant le GM :

- parcours seen : `nature = transformée` seulement ;
- parcours unseen : extraits d'abord ; vidéos transformées autorisées quand
  `extraitsMontrés >= MIN_EXTRACTS_BEFORE_CINEMATIC` (nouveau réglage, défaut 2).
  S'il n'existe aucun extrait en ligne, le comportement actuel est conservé ;
- personnage actif ∈ `characters`, ou `Tous` ;
- Type `intro` exclu de la conversation ;
- déjà jouées exclues (règle existante).

Le GM ne reçoit que les candidates éligibles. `validateDirectorDecision` refait
le même contrôle (nouveau motif de blocage `ineligible`) au cas où le GM
citerait un id hors liste. Tests unitaires sur toutes les combinaisons.

**Exécution (2026-11-01).** Lot 1 vérifié via Lovable : colonnes présentes, Nature et
Personnages remplis sur les 15 vidéos (extraits et transformées, Max/Emma/Léo).

- `src/services/videoEligibility.ts` : `selectEligibleVideos`, `countPlayedExtracts`,
  `videoAvailableForCharacter`. Nature absente → transformée ; Personnages absent, vide ou
  `all` → tous. « Aucun extrait éligible » s'entend après filtres personnage, intro et déjà
  jouées : extraits tous joués ou réservés à un autre personnage → transformées autorisées.
- GM (`evaluatePostTurnPRD4`) : filtre la liste avant `buildUserPrompt` et `validIds`.
  Entrées `experiencePath` (depuis `experiencePathFromFilmAnswer`) et
  `minExtractsBeforeCinematic` transmises par l'orchestrateur ; absentes (tests admin) →
  parcours inconnu, seuil 2.
- Directeur : `DirectorGuardContext.eligibleVideoIds` et motif `ineligible`, contrôlé après
  `cinematic_already_played`. `IndexPRD4` calcule la même liste au moment de la décision.
  Aucun libellé admin des motifs n'existait : rien à ajouter.
- Réglage `MIN_EXTRACTS_BEFORE_CINEMATIC` (défaut 2) dans `VideoTriggerSettings` et
  l'éditeur vidéo admin ; fusion avec les défauts pour les réglages déjà enregistrés.
- Tests : `videoEligibility.test.ts`, `gameMasterPRD4.videos.test.ts`, motif `ineligible`
  dans `experienceDirector.test.ts`.

### Lot 3 — Choix au sens, pas au mot-clé

- Bloc VIDÉOS DISPONIBLES : ajouter Description (ou Description IA) et Contexte,
  plafonnés (par exemple 300 caractères chacun).
- Règle GM : rapprocher la vidéo de ce qui se joue (thèmes, sujets, intention du
  joueur) en s'appuyant sur Contexte ; thèmes ne sont plus le seul critère.
  Contrat JSON inchangé.
- Mettre à jour le prompt du code **et** la version publiée en admin.
- Décider du sort de `videoTriggerMatcher.ts` : filet de sécurité ou suppression.

**Exécution (2026-11-01).**

- Ligne vidéo : fonction pure `formatVideoCandidateLine` (`src/services/videoCandidateLine.ts`).
  Format historique conservé (id, titre, type, priorité, thèmes), puis `contexte="…"` et
  `description="…"`. Description humaine prioritaire ; Description IA seulement si
  Description est vide ou blanche. Chaque texte : une ligne, guillemets doubles remplacés,
  plafond 300 caractères coupé au mot avec « … » ; champ vide omis. Titre plafonné à 120.
- Règle GM du code (`EXPERIENCE_DIRECTOR_SYSTEM_PROMPT`, bloc « trigger_video_id — choix au
  sens ») : candidates déjà autorisées ; rapprocher de ce qui se joue (labels, réplique du
  personnage) ; contexte d'abord, puis description, puis thèmes ; un thème commun ne suffit
  pas si le contexte ne correspond pas, un contexte clair suffit sans thème ; null si rien ne
  rejoint clairement l'échange. La consigne finale du message GM (code, toujours envoyée)
  suit la même règle. Contrat JSON inchangé.
- Prompt publié : version active lue via Lovable (lecture seule). `sandbox-ulrich` v7,
  `prod` v8 et `sandbox-julien` v9 portent le même texte que la fixture
  `gm-published-sandbox-v7` (md5 `82f57f2c…`). L'aperçu du prompt en admin est en lecture
  seule : « Nouveau brouillon » génère le prompt depuis le prompt du code et les réglages de
  la version source. Publication = nouveau brouillon depuis l'admin de l'aperçu Lovable,
  puis « Publier » ; procédure et écarts avec la v7 (règles hors-monde et
  `next_speech_state` jamais publiées) : [prompt GM publié, lot 3](prompt_gm_publie_regle_videos_lot_3.md).
  **Non publié** : action d'Ulrich, sandbox d'abord ; la production exige son accord.
  Correctif : la ligne de réglage « Cinématiques » du constructeur
  (`gameMasterPromptBuilder.ts`) disait « lorsqu'un thème correspond » ; elle suit désormais
  le choix au sens. Un test garde le document identique à la règle du code. Jusqu'à la
  publication, en sandbox-ulrich, prod et sandbox-julien, le bloc et la consigne finale
  (code) s'appliquent mais le prompt système publié impose encore le thème.
- `videoTriggerMatcher.ts` **supprimé** : jamais appelé, et un filet par mots-clés
  déclencherait une vidéo sur un seul thème commun, à l'opposé du choix au sens. Le filtre
  d'éligibilité (lot 2) et la garde du directeur restent les seules barrières.
- Taille mesurée sur le catalogue réel (17 vidéos, Description et Description IA vides,
  Contexte de 28 à 600 caractères), bloc VIDÉOS DISPONIBLES avant → après :
  film vu Max 11 vidéos 1 633 → 3 076 car. ; film vu Emma 8 vidéos 1 213 → 2 220 ;
  film pas vu Max 3 extraits 376 → 1 312 ; film pas vu Emma 2 extraits 254 → 878.
  Pire cas +1 443 caractères (≈ +400 jetons) pour un prompt système de ≈ 12 300 caractères
  (publié 10 415 + contrat technique 1 849) ; plafond théorique 300 + 300 par vidéo.
- Tests : `videoCandidateLine.test.ts` (priorité Description, repli IA, plafonds, champs
  vides) ; `gameMasterPRD4.videos.test.ts` (contexte et description envoyés, règle du code,
  texte publié préparé identique) ; suites GM, directeur et synchronisation vertes.

**Recette d'Ulrich (2026-11-01, sandbox-ulrich, v11 « Test prov — brouillon » publiée à
13:56 UTC).** Le choix des vidéos convient. Gêne relevée : la cinématique arrive alors que
le joueur a commencé à répondre à la réplique du personnage ; rien ne signale qu'il ne sert
plus à rien de parler.

### Lot 3b — Transition cinématique (demande d'Ulrich, 2026-11-01)

Constat dans le code (main `83baa4e`) : `IndexPRD4` appelle `setActiveVideo` dès que la
décision du directeur est validée (`guarded.action.type === "cinematic"`), sans attendre la
fin de la réplique ; un effet interrompt alors la sortie vocale en cours
(`responseOutputRef.current?.interrupt()`). L'écoute mains libres n'est pas suspendue à
l'annonce. Le lecteur (`GumletVideoPlayer`) n'a qu'un fondu d'opacité de 200 ms.

Comportement voulu par Ulrich :

1. La décision cinématique est connue pendant la réplique (le GM tourne en parallèle de la
   voix) : la vidéo est **en attente**, la réplique n'est jamais coupée.
2. Dès l'annonce, l'écoute du joueur est suspendue (aucun nouveau tour), avec un signe
   visuel discret qu'une séquence arrive.
3. Fin de la réplique → fondu au noir du personnage → vidéo → fondu au noir → retour en
   fondu sur le personnage → écoute rouverte : une respiration, pas une invitation à parler.
4. Décision arrivée après la fin de la réplique alors que le joueur parle déjà : ne pas lui
   couper la parole ; reporter la vidéo à la fin de la réplique suivante (à confirmer en
   recette) — sinon, si personne ne parle, enchaîner tout de suite.
5. Bouton « passer » conservé ; le même retour en fondu s'applique.

L'item « attendre la fin de la réplique avant de lancer la vidéo » du lot 5 est traité ici.

**Exécution (2026-11-01, livré).**

- Constat de départ, vérifié dans le code : le GM n'évalue un tour qu'**après la livraison
  réelle** de la réplique (`runPostTurn` attend le reçu de livraison : seul le texte entendu
  entre dans son journal). La décision cinématique arrive donc toujours après la fin du son,
  souvent quand le joueur a déjà repris la parole en mains libres. L'ancien code lançait
  alors la vidéo, et le blocage mains libres (`activeVideo`) abandonnait le tour du joueur
  (`capture-interlude`) : c'est la gêne relevée. Le moment de l'appel GM n'a pas été changé
  (invariant du lot : aucun changement du GM).
- Machine d'état pure `src/services/cinematicTransition.ts` :
  `idle → pending → fading_out → playing → closing → fading_in → idle`. Événements :
  `decided` (conversation occupée ? joueur en train de parler ?), `turn_started`,
  `conversation_idle`, `turn_abandoned`, `fade_out_done`, `video_ended` (completed, skipped,
  error), `close_done`, `fade_in_done`, `skip`, `cancel`. Durées nommées :
  `CINEMATIC_FADE_OUT_MS` 700 (personnage → noir), `CINEMATIC_REVEAL_MS` 400 (noir → vidéo),
  `CINEMATIC_CLOSE_MS` 700 (vidéo → noir), `CINEMATIC_FADE_IN_MS` 800 (noir → personnage),
  à ajuster en recette.
- Règles : décision pendant un tour en cours → `pending`, écoute tenue, départ quand la
  réplique a réellement fini ; décision quand personne ne parle → fondu immédiat ; décision
  pendant que le joueur parle → `pending` **sans** tenir l'écoute (`deferrals: 1`) : son
  énoncé devient un tour normal, la séquence est annoncée dès que ce tour démarre, puis jouée
  à la fin de la réplique suivante. Si le joueur s'arrête sans produire de tour, elle part
  au retour au calme. L'écoute est tenue de l'annonce jusqu'à la fin du retour en fondu.
- `IndexPRD4` : la décision cinématique est lue dans un chemin dédié, enregistré avant la
  lecture de la réplique ; le directeur d'après-tour ne traite plus que guidance, passage et
  fin. Une seule garde `guardDirector` sert aux deux (mêmes règles : jamais rejouée, délai
  entre vidéos, éligibilité). La vidéo est réservée dès la décision ; annulée avant d'être
  vue (hors « Ignorer »), la réservation est rendue. La réplique n'est jamais interrompue :
  `activeVideo` n'est posé qu'au début de la lecture, quand plus rien ne parle.
- Écoute tenue (`cinematicHoldsInput`) : `processTurn`, transcriptions mains libres, fin de
  parole, détecteur acoustique et appui-pour-parler refusent toute entrée ; à l'annonce, le
  début d'énoncé entendu est oublié et une réplique suspendue par un candidat acoustique
  reprend ; à la sortie, la transcription repart propre (`stt.resume()`). Le micro mains libres
  est coupé pendant la vidéo par le blocage existant et réarmé pendant le retour en fondu
  (`handsFreeNeedsRearm`, `handsFreeRecovery` inchangés). Délais de fin de parole et stratégie
  d'interruption hors cinématique inchangés.
- Visuel : voile noir unique (`data-testid="cinematic-veil"`, `data-phase`) au-dessus du
  personnage et de la vidéo ; signe discret « Une séquence arrive… » avec « Ignorer » pendant
  l'attente et le fondu. « Passer » reste le bouton du lecteur, seulement pendant la lecture ;
  il ramène par le même fondu. Bouton parler désactivé et statut « Max répond » (sans
  « tu peux l'interrompre ») pendant la tenue.
- Annulations : « Ignorer » (attente) ou « Passer » ; fin de partie, raccrocher, passage à
  l'autre personnage et réinitialisations (`cleanupAudio`, `cancel`) ; abandon du tour attendu
  (`turn_abandoned`) ; erreur de lecture native du `<video>` ou format non pris en charge
  (`onError` du lecteur → retour en fondu). **Limite :** une erreur fatale hls.js reste
  seulement journalisée, comme avant ; le lecteur garde « Passer ».
- Mesures, sans nouvelle table : `experience_events` `cinematic_recommended` (décision),
  `cinematic_played` (début réel, `decisionToStartMs`, `deferrals`), `cinematic_skipped`
  (`stage`, `outcome`), `cinematic_blocked` `transition_cancelled` (annulation avant lecture,
  `reason`, `stage`) ; PostHog `prd4_video_announced`, `prd4_video_deferred`,
  `prd4_video_cancelled`, `prd4_video_triggered` (`decision_to_start_ms`, `deferrals`).
- Mode appui-pour-parler : appuyer pour parler avant la décision du GM rend son résultat
  caduc (comportement existant, `new-user-turn`) ; aucune vidéo ne part alors pour ce tour.
- Tests : `cinematicTransition.test.ts` (15 : transitions, annulations, report, tenue) ;
  `ConversationScreen` (parler tenu), `GumletVideoPlayer` (`onError`) ; E2E `lot 3b` (décision
  après la réplique, joueur silencieux ; mains libres, décision pendant que le joueur parle,
  reportée, annoncée pendant la réplique suivante non coupée, puis jouée, micro réarmé ;
  « Ignorer ») ; E2E cinématique HLS et endurance inchangés et verts.
- Recette humaine d'Ulrich (sandbox) : une cinématique décidée pendant qu'il se tait, une
  pendant qu'il parle déjà, « Passer » et « Ignorer » ; il juge la fluidité des fondus et la
  justesse du report (question ouverte ci-dessous).

**Recette d'Ulrich et retouches (2026-11-01, session `89e1868f…`, sandbox-ulrich).** La
transition « fonctionne bien ». Trois retouches demandées et livrées :

- Lecteur : plus d'infobulle « Video player » (attribut `title` remplacé par `aria-label`) ;
  le pointeur est masqué pendant la vidéo et réapparaît 1,5 s quand la souris bouge, pour
  garder « Passer » atteignable (`POINTER_IDLE_HIDE_MS`).
- Annonce : capsule « Une vidéo arrive » (avec « Ignorer ») dans la colonne des personnages,
  en haut à gauche, sous les capsules, dans le flux : plus de bulle flottante au-dessus du
  texte.
- Max « trop en colère, deux fois » : cause mesurée sur la session. Rugosité de Max = 3 en
  sandbox-ulrich. Réplique 2 sans état de parole joué → heuristique lexicale : le seul mot
  « maintenant » la classe `urgent`. Réplique 3 : état « La digue cède » (GM l'a proposé trois
  tours de suite, le contrat l'autorise) → `urgent`, intensité « very », vitesse 1,12. Deux
  répliques emportées consécutives. Correctif de rendu seulement (`performanceIntent.ts`,
  `withTemper`) : une émotion « emportée » (`angry`, `urgent`, `accusatory`) n'est jamais rendue
  sur deux répliques de suite du même personnage ; la seconde passe en voix retenue (Max :
  `tense`, mesurée, intensité 0, vitesse 1), marquée `tempered: "calmed"` dans
  `prd4_tts_performance`. L'état de parole, son nom, le GM, Notion et l'échelle de rugosité
  (lot B) restent inchangés : une emportée isolée garde sa force. Levier de force restant :
  la rugosité de Max en admin (3 → 2), décision d'Ulrich.

### Lot 4 — Description IA automatique

- Fonction edge `describe-video` : analyse la vidéo et écrit « Description IA »
  dans Notion (ce seul champ).
- Déclenchement : bouton « Analyser » par vidéo et « Analyser les vidéos sans
  description » dans l'éditeur vidéo admin.
- Point technique à vérifier d'abord : la passerelle Lovable AI (Gemini 2.5
  Flash déjà utilisé) accepte-t-elle une vidéo ? Sinon, images extraites
  (vignettes Gumlet) ou rendu MP4 au lieu du flux HLS.
- Consigne de l'analyse : décrire objectivement ce qu'on voit (personnages,
  lieu, actions, ambiance), sans interprétation narrative.

**Étape 0 — faisabilité (2026-11-01, avant le code).**

- Modèle : `GET https://openrouter.ai/api/v1/models` déclare pour `google/gemini-2.5-flash`
  les entrées `text, image, file, audio, video` (0,30 $/M jetons en entrée, 2,50 $/M en
  sortie), seul fournisseur Google AI Studio. Documentation OpenRouter (vidéos) : partie
  `video_url` de Chat Completions, URL ou donnée base64 ; **Gemini sur AI Studio n'accepte en
  URL que YouTube**, donc base64 obligatoire ; formats `video/mp4`, `video/mpeg`, `video/mov`,
  `video/webm`. Limite d'une requête Gemini en ligne : environ 20 Mo. Aucune passerelle Lovable
  AI dédiée n'est utilisée par le projet (OpenRouter, `OPENROUTER_API_KEY` côté serveur).
- Gumlet (accès public, sans clé) : `video.gumlet.io/<collection>/<asset>/main.m3u8` répond
  200 ; `download.mp4`, `main.mp4`, `360p.mp4`… répondent 403/401 (aucun MP4 public) ;
  `thumbnail-1-0.png` donne une seule vignette (insuffisant). Chaque rendu HLS est **un seul
  MP4 fragmenté** adressé par plages d'octets (`EXT-X-MAP` + `EXT-X-BYTERANGE`, jeton signé
  dans la playlist) : téléchargé sans plage, c'est la piste vidéo complète, sans le son
  (piste audio séparée). Vérifié sur les 17 vidéos : 8 à 65 s, 121 Ko à 3,5 Mo en 360p
  (4,7 Mo en base64 au pire), tout sous la limite.
- Coût estimé (non mesuré, aucune clé hors serveur) : environ 258 jetons par seconde de
  vidéo, soit ≈ 17 000 jetons (≈ 0,5 centime) pour la plus longue (65 s), ≈ 80 000 jetons
  (≈ 3 centimes) pour tout le catalogue (≈ 330 s). Coût et latence réels : renvoyés par
  `describe-video` (`usage`, `latency_ms`) à la première analyse.
- Voie retenue : Edge Function → master → rendu 360p → fichier MP4 → base64 → OpenRouter.

**Exécution (2026-11-01, livré).**

- Module pur `supabase/functions/_shared/videoDescription.ts` : `gumletAssetId`,
  `pickAnalysisVariant` (plus petit rendu ≥ 360p, sinon le plus grand), `variantMediaFileUrl`
  (refuse les playlists à segments distincts), `buildDescribeVideoRequest`,
  `VIDEO_DESCRIPTION_PROMPT`, `normalizeAiDescription` (une ligne, 300 caractères coupés au
  mot), `buildAiDescriptionNotionPatch` et `assertOnlyAiDescription` (« Description IA »
  seule ; Description refusée en premier), `parseDescribeVideoBody`, `selectVideosToDescribe`.
- Edge Function `describe-video` : `requireAdmin` avant toute lecture ; URL Gumlet lue dans
  `video_triggers` par `notion_id` (colonnes `notion_id, video_url` seulement : Description
  jamais lue) ; vidéo > 12 Mo refusée (413) ; réponse vide → 502 sans écriture ; PATCH Notion
  « Description IA » puis miroir `ai_description`. Pas d'entrée `config.toml` : JWT vérifié
  par défaut, comme `update-notion-video` (non utilisé ni étendu).
- Consigne : séquence sans le son ; personnages (apparence, attitude), lieu, actions, lumière
  et ambiance ; français, présent, une ou deux phrases, 300 caractères ; seulement le visible,
  aucune interprétation narrative ni intention prêtée ni nom propre deviné. Le titre et le
  Contexte ne sont pas envoyés (ils orienteraient l'analyse).
- Éditeur admin (`VideoTriggersEditor`) : « Analyser » par vidéo ; « Analyser les vidéos sans
  description (n) » avec confirmation, séquentiel, progression ; interrupteur « Réanalyser les
  Descriptions IA existantes » (une vidéo à Description humaine n'est jamais prise en lot, le
  bouton par vidéo reste possible et n'écrit toujours que Description IA).
- Tests : `videoDescription.test.ts` (16), `describeVideoEndpoint.test.ts` (7) ; résolution
  Gumlet du module vérifiée en direct sur les 17 vidéos.
- **Analyse réelle non lancée** (écriture Notion, appel admin) : Ulrich analyse d'abord une
  vidéo courte (par exemple « Emma regard feu avec Max », 9 s), on relit le texte dans
  Notion et l'admin, puis le reste par « Analyser les vidéos sans description ». Les vidéos
  analysées seront listées dans le compte rendu de cette recette.

**Analyse réelle (constat du 2026-11-01, lecture Lovable).** Les 17 vidéos ont une
Description IA (201 à 299 caractères) ; les Descriptions humaines sont restées vides et
intactes. Relecture : textes coupés par « … » sur « couteau » et « Ava dans les bras de Emma »
(Gemini dépasse 300, `normalizeAiDescription` coupe) ; descriptions presque identiques pour
« Max lampe perdu dans la neige » et « test slowly-turning-on-himself » (même plan, le GM ne
peut pas les distinguer). Suite : lot 6.

### Lot 5 — Lecture et mémoire

- (Traité au lot 3b : la vidéo attend la fin de la réplique.)
- Contexte post-vidéo : relever la limite de 500 caractères.
- Mémoire : garder dans la session les vidéos vues et ce qu'elles montrent,
  pour le GM et le personnage au-delà d'un tour.

**Étape 0 — mesure (2026-11-01, avant le code).**

- Prompt personnage `optimized_v3` (seule variante des 84 tours tracés sur 30 jours) : noyau
  statique ≈ 4 400 caractères (max 4 448, plafond 5 500) ; prompt système p50 7 396 (Emma) et
  9 603 (Max), p95 10 113 et 10 496 ; limite 11 000 moins l'historique (p95 ≈ 1 000). Aucun
  tour hors budget.
- Le contexte post-vidéo était la **dernière** section, après les souvenirs RAG (moyenne 349,
  max 1 750), qui finissent parfois « budget_contexte_epuise » : il pouvait être coupé ou omis.
- Catalogue : Contexte 28 à 600 caractères (trois au-delà de 300 : 600, 431, 366), Description IA
  201 à 299, Description vide partout.
- Plafonds retenus : Contexte 650 (marge sur 600), ce que la vidéo montrait 300, section
  post-vidéo 1 000 ; vidéos vues : trois lignes (titre 80, description 140), section 750. Les
  deux sections passent avant les souvenirs complémentaires : la limite globale ne bouge pas, ce
  sont les souvenirs qui cèdent quand le contexte est plein. Pas de dépassement : aucune décision
  d'Ulrich requise.

**Exécution (2026-11-01, livré).**

- `src/services/watchedVideoMemory.ts` : `capAtWord` (jamais au milieu d'un mot, « … » marque la
  coupe), `buildPostVideoContext`, `watchedVideoFrom`, `rememberWatchedVideo` (ordre de
  visionnage, une vidéo rejouée passe en fin), `formatWatchedVideos` (trois dernières, de la
  plus ancienne à la plus récente : « - « titre » (tour N[, passée avant la fin]) : ce qu'elle
  montre »).
- `IndexPRD4` : `watchedVideosRef` (remis à zéro au démarrage et au redémarrage) alimenté par
  `finishActiveVideo` ; le bloc part à chaque tour (`watchedVideos`), le contexte post-vidéo une
  seule fois comme avant.
- Décisions : vidéo « Ignorée » (annonce écartée) ou jamais montrée (transition annulée,
  erreur de lecture) hors mémoire ; « Passée » pendant la lecture : gardée, marquée « passée
  avant la fin » (le joueur en a vu le début, le personnage ne doit pas supposer la fin vue).
- GM : section « VIDÉOS DÉJÀ VUES PAR LE JOUEUR » du message utilisateur (code, pas le prompt
  publié) ; personnage : section de même titre, contenu identique (exemptée du dédoublonnage,
  comme le cadre commun) dans `optimized_v3`, `compact_v1`, `rich_v2` et legacy. Trace :
  `memory.watchedVideos`.
- Persistance : aucune table. Les événements `cinematic_played/completed/skipped` restent dans
  `experience_events`, lisibles par les admins seulement ; `triggers_activated` n'est pas écrit
  par PRD4. Une reprise de session repart donc sans mémoire vidéo (comme l'exclusion des vidéos
  jouées aujourd'hui). La restaurer exigerait une politique RLS de lecture propriétaire
  (migration Lovable, accord d'Ulrich) : non nécessaire à ce stade.
- Tests : `watchedVideoMemory.test.ts` (10), `maxOptimizedPromptCompiler.test.ts` (+4 : Contexte
  de 600 entier, ordre avant RAG, bloc identique, rien sans vidéo), `gameMasterPRD4.videos.test.ts`
  (+2 : bloc reçu tel quel, « (aucune) »).
- Recette humaine (Ulrich) : une partie où une vidéo est jouée, puis une allusion à cette scène
  deux ou trois tours plus tard ; vérifier aussi « Passer » en cours de lecture.

### Lot 6 — Consigne d'analyse (préparé)

- Descriptions IA sans coupure : consigne visant 260 caractères au plus, phrases complètes.
- Distinguer les plans voisins : demander le geste ou l'objet distinctif de la séquence.
- Réanalyse des vidéos concernées par Ulrich en admin ; aucune écriture Notion par l'agent.
- [Prompt lot 6](prompt_reprise_selection_videos_lot_6.md).

## Non-régression

- Parcours film vu : avec Nature vide → transformée et Personnages vide →
  Tous, le comportement actuel est inchangé, à l'exception de l'exclusion `intro`.
- Parcours pas vu sans extrait en ligne : comportement actuel conservé.
- Tests existants du GM, du directeur et de la synchronisation verts à chaque lot.

## Questions encore ouvertes

- Réglage `MIN_EXTRACTS_BEFORE_CINEMATIC` : la valeur 2 convient-elle ?
- Ava et Léo ne sont pas encore appelables : les vidéos où ils figurent seuls
  devront être tagguées « Tous » pour être jouées.
- Signification exacte de Type `interlude` face à `mid_conversation`.
- Lot 4 : la consigne d'analyse produit-elle des descriptions assez parlantes pour le GM ?
  À juger sur les premières Descriptions IA ; ajuster `VIDEO_DESCRIPTION_PROMPT` si besoin.
- Lot 3b : le report « à la fin de la réplique suivante » convient-il, ou la vidéo
  devrait-elle partir dès que le joueur se tait ? Durées de fondu à ajuster en recette.
