# Ava — état courant

**Décisions vidéo, lecture (21 novembre, code, sélection inchangée)** : l'onglet ferme chaque session par défaut et affiche le titre de Données session (personne, date, personnages) avec le nombre de vidéos jouées. Le filtre distingue cinématique et extrait. Le Sankey montre le nombre et le pourcentage de chaque thème, de chaque vidéo et de chaque lien. La synthèse est triée du plus grand pourcentage au plus petit. Rien en production.

**Décisions vidéo, lot 2 (21 novembre, code, sélection inchangée)** : le Game Master et les vidéos partagent un vocabulaire lu dans Notion « Vidéos AVA » (thèmes déjà là, émotion, enjeu, à l'écran). `sync-notion` exporte les options, ou l'union des valeurs, et remplace l'instantané : un terme ajouté ou retiré n'attend aucun changement de code. L'onglet peut suivre l'émotion ou l'enjeu dès que la liste contient un terme ; une valeur hors liste est marquée. **À faire par Ulrich** : coller `supabase/migrations/20261121193000_video_triggers_label_vocabulary.sql` dans le chat Lovable, puis resynchroniser. **À valider par Romed** : [proposition](proposition_vocabulaire_videos_romed.md) (patricarcat, Contamination / pandémie, listes de départ). Les propriétés Émotion, Enjeu et À l'écran ne sont pas créées ici. Rien en production. [Plan](plan_decisions_video.md) · [reprise lot 3](prompt_reprise_decisions_video_lot_3.md).

**Décisions vidéo, lot 1 (21 novembre, code, lecture seule)** : onglet Admin › Expérience › Décisions vidéo (par session, Sankey des thèmes, synthèse des motifs) à la place des deux historiques bruts. Le journal `cinematic_recommended` / `cinematic_blocked` garde mécanisme, candidates, écartées, extraits de réplique et détail de lien faible. Compteur « N lectures · M sessions » sur 30 jours, tri par les plus jouées. Rien ne change en jeu. **Non vérifié** : les 20 choix overlay du 19 au 21 novembre dans l'onglet, et « Max, Emma et Leo suspendus » en tête des lectures. Diagnostic du plan inchangé (confiance 0,8, liens lâches, 17 lectures). [Plan](plan_decisions_video.md) · [reprise lot 2](prompt_reprise_decisions_video_lot_2.md).

**Extraits du film, lot 3 (21 novembre, code + mesure hors ligne)** : Romed a vérifié les 3 extraits (couteau et mauvaise conscience parlés, mort Peter silencieux) : ils sont sélectionnables dès que « Activer les extraits » l'est (inactive, rien en production). Nouvel outil `npm run eval:extracts` (rejeu du sélecteur, bascule en mémoire, sandbox seulement). Il a trouvé un vrai bug : `max_tokens` 160 coupait le JSON (7 réponses sur 24 perdues) ; relevé à 400 + cues courts : rappel 64 → 100 % sur 12 cas, 0 faux positif, latence 0,76 s médian / 0,94 s p90. **Non fait** : activation sandbox, écoute, recette humaine (personnes n'ayant pas vu le film, pas Benoît), blocage de l'entrée du joueur. [Reprise lot 4](prompt_reprise_extraits_film_lot_4.md).

**Extraits du film, lot 1b (21 novembre, code + déploiement + essai réel)** : `transcribe-video` et `sync-notion` déployées via Lovable (`sync-notion` n'avait pas la version du lot 1 : Dialogue restait vide en base jusqu'au redéploiement). Boutons « Transcrire » / « Transcrire les extraits parlés sans transcription (N) » dans Admin › Expérience › Extraits ; écoute la rendition **audio** Gumlet (AAC ≈ 1,5 Mo, acceptée telle quelle par Gemini via OpenRouter, sans repli), n'écrit que « Transcription », non vérifiée ; aucune parole = rien d'écrit ; transcription vérifiée jamais écrasée sans confirmation. **Essai réel** : « couteau » (0,0022 $, 3,8 s) ; les 3 extraits sont labellisés « Parlé » et transcrits ; à la lecture de la base, « Transcription vérifiée » est encore décochée sur les 3 (relecture humaine Romed : qualité non prouvée, « mort Peter » ne compte que 37 caractères, la fin de « couteau » est une réplique vide). Aucun extrait n'est donc utilisable tant que la case n'est pas cochée. Rien en production. [Reprise lot 3](prompt_reprise_extraits_film_lot_3.md).

**Extraits du film, lot 2 (21 novembre, code, inactif par défaut)** : sélection contextuelle (extrait silencieux ou parlé à transcription vérifiée, lien concret + apport complémentaire), lecture parlée après la réplique avec son propre son ou silencieuse superposée, reprise avec la question initiale et le contenu réellement diffusé, fréquence propre ; **une seule bascule** « Activer les extraits » (Admin › Expérience › Extraits) les retire du pool des cinématiques. Migration du lot 1 vérifiée appliquée ; **les 3 extraits en base n'ont ni Dialogue ni transcription** (Romed) : aucun n'est utilisable tant que ce n'est pas rempli. Recette humaine non faite, rien activé, aucune production. [Plan](plan_extraits_film_pas_vu.md) · [reprise lot 3](prompt_reprise_extraits_film_lot_3.md).

**Extraits du film « film pas vu », lot 1 (21 novembre, code + Notion)** : propriétés « Transcription », « Dialogue » (Parlé/Silencieux) et « Transcription vérifiée » créées dans Vidéos AVA (vides, à remplir par Romed) ; `sync-notion` les lit (absent/effacé → null) ; onglet Admin › Expérience › Extraits (extraits retirés de l'onglet Cinématiques) avec statut de transcription et réglages propres inactifs. **À faire par Ulrich** : coller la migration `20261121150000_video_triggers_extract_transcription.sql` dans le chat Lovable, puis resynchroniser. Rien ne change en jeu ; sélection, lecture parlé/silencieux, reprise et retrait des extraits du pool des cinématiques = lot 2. [Plan](plan_extraits_film_pas_vu.md) · [reprise lot 2](prompt_reprise_extraits_film_lot_2.md).

**Faits établis : champ Notion « Ce que tu sais aujourd'hui » créé (21 novembre)** : propriété texte ajoutée à la base Caractères AVA (vide, à remplir par Romed) ; la synchro la lisait déjà, vérifiée par resynchro sandbox sans erreur. Raison : le paragraphe de l'identité dépasse le budget de 1 200 car. (1 399 / 1 414) et sa fin, dont « où ton père l'a mise », est coupée du prompt. `eval:judge:sheets` signale source, taille et coupe. Tâche Romed : [Notion](https://app.notion.com/p/41f62322e59581069c5bdd6c83e144a6).

**Juge, lot H — une seule hiérarchie (21 novembre, code + mesure sandbox)** : hiérarchie écrite en tête du prompt personnage (faits de la fiche > cadre > état de l'app > parole du tour ; le radar règle l'attitude, jamais la vérité ni le registre) ; textes de radar « attitude vécue » derrière un réglage de profil **désactivé par défaut** (validation Romed) ; une seule décision GM par tour ; vue « Voir ce que reçoit le personnage » avec provenance ; interrupteurs d'évaluation en mémoire (`instructionHierarchy`, `intellectualReferences`, `radarTexts`). **Mesure factualité avant/après** (68 tours, 3 passages) : 6,83 → 5,95/10 (Max −0,98, Emma −0,73) : dans le critère de 1,37 pt mais de même signe, **probablement une vraie baisse d'environ un point** ; livrée active, rien en production ; arbitrage d'Ulrich : second run (≈ 3,4 $) ou assouplir la formule du niveau 1. Erreurs de fiche du lot F inchangées. [Rapport](eval/juge_hierarchie_lot_h_20261121.md) · [propositions Romed](proposition_romed_hierarchie_lot_h.md) · [reprise lot D2](prompt_reprise_juge_lot_d2.md).

**Juge, lot F — round 1 factualité (21 novembre, code + mesure sandbox)** : fiches Max/Emma resynchronisées (`fields_only`, sandbox-ulrich) et retouchées par Romed : plus aucun « tu attends l'appel » ; `neutralizeAwaitedCall` / `sheetAtCallTime` **supprimés** (une seule logique, la fiche ; garde-fou `findAwaitedCallSentences` : test + avertissement de `eval:judge:sheets`, qui accepte `--resync`) ; `CALL_PRESENT_INVARIANT` → `ExperienceFrameConfig.callPresentText` (défaut = texte précédent, rien ne change en jeu, champ éditable dans Admin › Expérience › Orchestration) ; champ « Ce que tu sais aujourd'hui » rempli = seule source. Nouveau **mode factualité** `eval:judge:sequences --focus factuality` (note séparée, style exclu, rapport par fait, bruit) + corpus `docs/eval/sequences_factuality_f.json`. **Mesure** (65 tours, 3 passages, bruit 1,37 pt) : Max 5,6/10, Emma 6,2/10 ; **Max nie que son père ait envoyé Mona au camp (3/3)** et Emma accepte les prémisses « elle a contaminé Ava » et « Max a pris le fusil » : le paragraphe des faits fait 1 399/1 414 car. pour 1 200 de budget, la coupe retire « où ton père l'a mise ». **À décider par Romed** : créer le champ dédié court (≤ ~1 000 car., faits par ordre d'importance) ou resserrer le paragraphe. Juge de factualité **non calibré** (dix réponses notées par Romed attendues). Aucune production, aucune migration. [Rapport](eval/juge_factualite_lot_f_20261121.md) · [plan](plan_juge_direction_rounds.md) · [reprise lot H](prompt_reprise_juge_lot_h.md).

**Juge, fiches et direction de jeu : état des lieux (21 novembre, plan, aucun code)** : fiches Max/Emma retouchées par Romed le 19 novembre (plus de « tu attends l'appel »), mais pas de champ « Ce que tu sais aujourd'hui » et un futur restant (« sera contaminée ») ; six couches disent au personnage comment être sans hiérarchie (cadre, directive GM, parole du tour, radar, fiche, RAG) ; conflits : 5 états de parole (fiche) et 5 axes du radar (app) en parallèle, radar lucidité/initiative/ouverture hauts qui poussent vers l'analyse, références intellectuelles et format dans la fiche ; juge à note unique mêlant faits et style. Répartition retenue : Notion = vérité et réalité émotionnelle, app = direction de jeu, GM = évolution dans les bornes. Rounds séparés : F factualité → H hiérarchie sans contradiction → D2 état qui évolue → J4 direction → J5 crédibilité/style. [Plan](plan_juge_direction_rounds.md) · [reprise lot F](prompt_reprise_juge_lot_f.md).

**Fin d'expérience (20 novembre, code)** : écran « La communication se coupe » supprimé, fin → questionnaire direct, introduction (5 minutes, réponse vocale) sur la première question.

**Questionnaire conversationnel, lisibilité (20 novembre, code)** : relance en premier, zone de réponse agrandie, consentement/email/« Valider et envoyer » avant le récapitulatif ; questionnaire non rallongé. Recette sur appareils ciblés à faire (non vérifié hors jsdom).

**STT : phrases coupées (21 novembre, correctif)** : fin de tour retenue tant que le joueur parle (détecteur de voix local toujours actif en mains libres, plafond 4 s) et reste tardif d'un tour jamais reporté au suivant (Deepgram). Aucune attente ajoutée. Recette appareils à faire ; [CHANGELOG](../CHANGELOG.md).

**Latence Tavus, lot T9 (21 novembre, analyse seule, lot arrêté par Ulrich, aucun code)** : décomposition de l'attente vidéo Tavus sur 31 tours (19 à 21 novembre, voix d'Ava, flux PCM T1) : `video_wait_ms` médian ≈ 0,90 s (0,81 à 1,20 s) = ≈ 0,34 s de `tts_text_sent` à `first_audio_chunk` (ouverture du flux ElevenLabs jusqu'aux premiers octets) + ≈ 0,56 s de `first_audio_chunk` à `output_estimated` (chunk de 250 ms, envoi, aller-retour Tavus, pré-roll, lèvres). En TTS seul la sortie suit les premiers octets de ≈ 0,35 s : le surcoût propre à Tavus est ≈ 0,2 s, plafond de ce que le client peut gagner. Seul essai envisagé : premier chunk de 100 ms derrière un réglage (gain attendu 0,05 à 0,15 s, déduit, non mesuré). **Décision d'Ulrich (21 novembre) : on arrête, aucun essai codé** ; l'attente vidéo est presque incompressible côté Ava. T7 (`streamedLlm`, faux par défaut) et T8 inchangés ; la mesure de T7 par Ulrich reste à faire. [Analyse](analyse_latence_tavus_20261119.md).

**Latence Tavus, lot T8 (21 novembre, correctif livré)** : mesure de T7 (7 tours) : −0,4 à −0,65 s sur la première phrase, mais 2 relances d'intent sur 7 (+1,5 s) car le mode flux n'avait pas la salvage locale G1 du lot (26 % des tours ont un en-tête d'intent inutilisable). Salvage ajoutée en mode flux (réponse complète seulement, mêmes gardes) ; aussi pour Gradium. `streamedLlm` reste **faux par défaut**. **Mesure à refaire par Ulrich** : activer `streamedLlm` sur sandbox-ulrich, ≥ 10 tours, puis ≥ 10 tours désactivé ; on attend 0 relance `character_retry_intent` et un gain médian sur Max audible. [Analyse](analyse_latence_tavus_20261119.md) · [reprise lot T9](prompt_reprise_latence_tavus_lot_t9.md).

**Latence Tavus, lot T7 (21 novembre, prototype livré, désactivé par défaut)** : levier choisi par Ulrich, le LLM streamé vers le TTS, première phrase seulement, Tavus avec voix d'Ava. Réglage admin `streamedLlm` (Configuration avatar, Tavus), défaut **faux** ; rien ne change tant qu'il n'est pas activé. Gain attendu −0,5 à −0,9 s (estimation), **non mesuré** : mesure sandbox-ulrich ≥ 10 tours à faire par Ulrich (activer le réglage, comparer `tts_text_sent` et Max audible). Risques : [évaluation](evaluation_llm_streame_vers_tts.md). [Analyse](analyse_latence_tavus_20261119.md). Suite : lot T8 ci-dessus.

**Latence Tavus, lot T6 (21 novembre, mesure, aucun changement de code)** : `evalJudge` avec/sans rerank (126 tours, 0 erreur) : 4,54 contre 4,58 /10, bruit ± 0,63, 6 questions en hausse et 6 en baisse, `canon_timeline` −0,16 : le retrait du rerank ne change rien de mesurable ; gain ≈ −0,2 s sur `character_rag`. **Décision d'Ulrich (21 novembre) : le rerank est conservé** ; aucun retrait, ni en voix ni ailleurs. [Analyse](analyse_latence_tavus_20261119.md) · [reprise lot T7](prompt_reprise_latence_tavus_lot_t7.md).

**Latence Tavus, lot T5 (21 novembre, mesure, aucun changement de code)** : rerank conditionnel testé (20 questions × 2 personnages) : le rerank modifie fortement le top 5 (recouvrement 2,4/5, premier passage identique 32 %), aucun critère de cosinus ne désigne de cas sûr ; seuls ≈ 7 % des tours ont ≤ 5 passages. Rerank conservé ; qualité réelle à trancher par `evalJudge` avec/sans rerank. Outil : `npm run eval:rerank-replay`. [Analyse](analyse_latence_tavus_20261119.md) · [prompt T6 (réalisé)](prompt_reprise_latence_tavus_lot_t6.md).

**Latence Tavus, lot T4 (21 novembre, mesure, aucun code)** : T3 sans régression RAG (0 erreur, 6,0 passages en moyenne, `character_rag` 740 → 690 ms, p90 inchangé) ; décision d'Ulrich attendue entre rerank conditionnel/retiré (≈ −0,2 s, rejeu qualité d'abord) et embedding sur transcript partiel. [Analyse](analyse_latence_tavus_20261119.md) · [prompt T6 (réalisé)](prompt_reprise_latence_tavus_lot_t6.md).

**Latence Tavus, lot T3 (20 novembre, code)** : `query-rag` lit le profil RAG en parallèle du quota (chevauchement mesuré le 20 novembre, déployé via le chat Lovable ; `character_rag` 690 ms contre 735/753, gain ≈ −56 ms non significatif) ; le rerank (208 ms) ne se parallélise pas, son retrait attend décision et rejeu de qualité. Reprise :
[lot T4](prompt_reprise_latence_tavus_lot_t4.md).

**Latence Max en vidéo Tavus, lot T2 (19 novembre, code)** : le retard de 1,3–1,6 s de 2 tours sur 9 venait de l'attente du
GM post-tour du tour précédent ; hors passage plausible, le tour suivant ne l'attend plus. Spans d'attente découpés ;
interruptions (≈ 1,3 s après la décision, aussi hors Tavus) non corrigées, décision d'Ulrich ; LLM streamé évalué sans code.
**Mesuré le 20 novembre** (20 tours) : attente de passage ≤ 0,17 s à tous les tours, passage Max → Emma validé ; Max audible ≈ 4,1 s (Emma ≈ 3,5 s, sans l'attente vidéo Tavus de ≈ 1,0 s). Leviers restants chiffrés dans l'analyse. [Analyse](analyse_latence_tavus_20261119.md) ·
[évaluation LLM streamé](evaluation_llm_streame_vers_tts.md) · [reprise lot T3](prompt_reprise_latence_tavus_lot_t3.md).

**Latence Max en vidéo Tavus, lot T1 (19 novembre, code)** : la première ligne ElevenLabs part vers Tavus au fil de l'eau
(PCM 24 kHz, morceaux de 250 ms) ; repli sur le blob si le flux échoue avant le premier octet ; seul Tavus est concerné.
Nouveau span `pre_turn_handoff_wait`. **Mesuré** (sandbox-ulrich) : `video_wait_ms` médian 1,0 s, `output_estimated` 3,9 s, aucun repli ; reste l'attente de passage (1,3–1,6 s sur 2 tours de 7) et l'écoute d'Ulrich. [Analyse](analyse_latence_tavus_20261119.md) ·
[reprise lot T2](prompt_reprise_latence_tavus_lot_t2.md).

**Latence Max en vidéo Tavus (19 novembre, analyse)** : Max audible à 5,4–6,0 s en Tavus contre 3,5–3,8 s en Anam/TTS. Les lots GM du jour n'ajoutent rien de mesurable ; la cause est la voix d'Ava envoyée à Tavus (#161) qui attend le blob ElevenLabs complet (1,6–2,2 s). Correction proposée : flux PCM vers Tavus. [Analyse](analyse_latence_tavus_20261119.md) · [reprise lot T1](prompt_reprise_latence_tavus_lot_t1.md).

**Courbe d'expérience du GM, lot E1 (19 novembre, code non branché)** : moteur pur de directions (`experienceDirection.ts`), option B validée par Ulrich ; catalogue provisoire à valider avec Romed. Rien d'actif. Reprise : [lot E2](prompt_reprise_courbe_experience_gm_lot_e2.md).

**Courbe d'expérience du GM, lot E (19 novembre, cadrage seulement)** : [cadrage](cadrage_courbe_experience_gm.md) ; aucun code ; décisions attendues d'Ulrich (catalogue de directions avec Romed, option B, mode light). Reprise : [lot E1](prompt_reprise_courbe_experience_gm_lot_e1.md).

**Réglages GM lisibles, lot D (19 novembre, code)** : chaque personnage peut recevoir un état à 5 dimensions (0–5) à chaque
tour, que le GM fait évoluer d'un cran au plus par tour (`character_state_delta`, validé par le code, tardif ignoré, sans
appel IA ajouté). Off : état initial fixe ; light et full : évolution conservée. Radar éditable dans Réglages
personnages, mini-radar et courbes dans l'historique des sessions. **À faire** : coller la migration
`20261119140000_character_state_profile.sql` dans le chat Lovable (colonne `state_profile` + RPC), valider les 5
dimensions avec Romed, activer le radar d'un personnage en sandbox ; rien n'est actif tant que `state_profile` est
NULL. Production non publiée. [Plan](plan_reglages_gm_lisibles_gradues.md) · [Cadrage lot E](prompt_reprise_courbe_experience_gm_lot_e.md).

**Réglages GM lisibles, lot B (19 novembre, code)** : les 4 cases « Priorités d'analyse » deviennent des curseurs 0–3
(`editor.priorityLevels`, sécurité plancher à 1, règle d'arbitrage générée quand les niveaux diffèrent, aperçu sous les
curseurs) ; versions publiées lues via Lovable : cran 2 partout, aucune migration. **Mesure J3 : effet non démontré**
(conseils du GM quasi identiques entre deux profils extrêmes) ; décision sur les crans après recette sandbox. Production
non publiée. [Plan et mesure](plan_reglages_gm_lisibles_gradues.md) · [Reprise lot D](prompt_reprise_reglages_gm_lot_d.md).

**Réglages GM lisibles, lot C (19 novembre, code)** : `editor.gmMode` off / léger / fort remplace `speechGuidance`
(`false` → léger, absent → fort ; v13 « GM désactivé » devient léger, aucune migration). Off : aucun appel GM post-tour
(ni mémoire GM, passage proposé, cinématique ; fin au minuteur) ; le tour est tout de même journalisé. Chaque tour
persiste `gm_mode` et `injected` (texte exact transmis au personnage) ; historique des sessions et export Markdown
affichent « GM → personnage ». Juge J3 : `gmMode` remplace l'ancien réglage. Limite : en off, le passage validé par le GM
(preuve de consentement) n'est pas disponible, la demande explicite du joueur ne reçoit que la règle de procédure
côté personnage. À écouter en sandbox ; production non publiée. [Reprise lot B](prompt_reprise_reglages_gm_lot_b.md) (livré).

**Réglages GM lisibles, lot A (19 novembre, code)** : les réglages GM agissent désormais sur toutes les versions,
`builtin://` compris (sandbox-romed et sandbox-benoit recevaient zéro réglage) : bloc compilé à chaque tour depuis la
config épinglée, sans double bloc. Registre unique des 24 réglages ; aperçu « ➜ envoyé au GM / au personnage / appliqué
par le code » sous chacun et bouton « Voir ce que reçoit le GM ». Interrupteur « Repères de temps du personnage » (défaut
activé). Température GM réglable (`LLM_GM_TEMPERATURE`, défaut 0.2 inchangé). À écouter en sandbox Romed/Benoît (le GM y
reçoit maintenant posture et garde-fous) ; production non publiée. [Reprise lot C](prompt_reprise_reglages_gm_lot_c.md).

**Réglages GM lisibles et gradués (19 novembre, plan)** : constat — les priorités d'analyse n'ont aucun effet dans le
code, la moitié des réglages GM n'agit que par un prompt figé à la sauvegarde (absent sur les versions `builtin://`,
sandbox-romed et sandbox-benoit), deux réglages sont morts. Plan validé : registre unique et aperçu de chaque réglage
(A), GM off/léger/fort avec vue « GM → personnage » par tour (C), priorités en curseurs 0–3 (B), radar d'état des
personnages à 5 dimensions que le GM fait évoluer (D), courbe d'expérience en chantier séparé (E).
[Plan](plan_reglages_gm_lisibles_gradues.md) · [reprise lot A](prompt_reprise_reglages_gm_lot_a.md).

**Guidage de parole du GM : interrupteur A/B (19 novembre, code)** : Réglages GM → « Guidage de parole du GM » (défaut
activé). Désactivé, le personnage ne reçoit plus le conseil, l'état de parole proposé ni les sujets abordés ; le GM
continue (cinématiques, passages, mémoire, fin). Les recadrages des garde-fous tombent avec le conseil (arbitrage
possible). Écoute A/B Ulrich + Romed en sandbox à faire ; production non publiée.
[Plan et protocole](plan_guidage_parole_gm_ab.md) · [reprise lot 2](prompt_reprise_guidage_parole_gm_lot_2.md).

**Cinématiques : interruption ou superposition (19 novembre, code, lot 2)** : mode au choix dans Expérience →
Cinématiques (défaut « Interrompre », inchangé). Lot 2 après la recette (1 vidéo hors sujet, 20 sélections sur 22 hors
délai) : réflexion de Gemini coupée pour ce seul appel, requête compacte, échéance selon la parole restante (≤ 5 s),
lien concret exigé (un prénom seul refusé), tours sans vidéo journalisés avec leur motif. À faire : vérifier le
redéploiement `proxy-llm` par Lovable, mesurer en sandbox, recette de pertinence Ulrich + Romed ; production non publiée.
[Plan](plan_cinematiques_interruption_superposition.md) · [reprise lot 3](prompt_reprise_cinematiques_superposition_lot_3.md).

**Socle commun des réglages (19 novembre)** : sandbox et voix héritent de la production champ par champ ; migrations de copie Ulrich → Romed/Benoît/Julien et catalogue prod à faire appliquer par Lovable (prod : go requis). [Plan et reprise](plan_socle_commun_reglages.md).

**Lot K1 — faits établis et juge calibré (14 novembre, code)** : le noyau `optimized_v3` porte un bloc protégé
« FAITS ÉTABLIS » tiré de la fiche, « tu attends l'appel » est lu comme l'appel en cours (personnage et GM), et le juge
vérifie le canon avec un plafond. Calibrage sur les dix réponses de Romed : écart moyen 1,51 → 0,82 à 0,85, écarts > 2
points 3 → 0 (réglé sur ces dix réponses, à confirmer). Séquences J3 v2 : continuité +0,96 (au-delà du bruit), note par
tour +0,06 ; Emma déballe plus tôt, Max B1 lit « camp de quarantaine » comme la cause (fiche à corriger). La fin de la manière de parler ne se joue plus (641 car. Max,
1 037 Emma) : écoute à faire. Migration `ce_que_tu_sais_aujourdhui` appliquée et `sync-notion` redéployée (Lovable,
15 novembre) ; **publié en production par Ulrich le 15 novembre**. À faire par Romed et Ulrich : fiches à la source (le
champ « Ce que tu sais aujourd'hui » devient la seule place des faits), relecture du corpus J3 v2, dix réponses à noter.
Ensuite seulement, K2 retire les deux corrections provisoires écrites dans le code (une seule logique : la fiche).
[Plan et mesures](plan_calibration_juge_lot_k1.md) · prochain lot : [K2](prompt_reprise_fiches_corrigees_lot_k2.md).

**Calibrage du juge par Romed (14 novembre)** : seuil franchi (écart moyen 1,5 ; 3 écarts > 2 points) ; le juge laisse
passer les erreurs de canon que le corpus n'écrit pas, et le noyau `optimized_v3` écarte ~95 % du canon des fiches.
[Analyse](analyse_calibration_juge_romed_20261114.md). Lot K1 livré (ci-dessus).
Corrections de source (fiches) : [tâche Notion](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27), par Romed et Ulrich.

**Capacité Soleure (12 novembre)** : [étude Lovable / Coolify et migration](plan_capacite_soleure_migration_coolify.md), analyse statique et scénarios sur trois jours, serveur Supermicro partagé documenté ; aucune capacité démontrée ni migration décidée. [Reprise mesures](prompt_reprise_capacite_soleure_lot_1.md).

**Rappel sortant de Max (12 novembre)** : [plan et prompt de reprise](plan_rappel_sortant_max.md)
préparés pour Soleure. Étude de faisabilité complète et prototype non lancés ; choix techniques,
coûts complets et compatibilité Lovable / WhatsApp restent à vérifier.

Mise à jour : 10 novembre 2026 (GM post-tour lisible). Entrée courte de reprise, historique dans CHANGELOG.

## Priorité produit

Continuer l'amélioration de Max/Emma ; pas de gel de démo accepté. Présent canonique
livré par #104, code vert `9adabdce5b5a4f9be6f6fdc6545868659cb4120a` ; 109 E2E,
[CI 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202).
Le souvenir J−2 de l'hôtel doit rester distinct du présent de l'appartement.
Voix et mains libres acceptées préservées ; la recette F4 demeure humaine et
distincte : [prompt F4](prompt_reprise_present_canonique_lot_f4_recette.md).
Aucune publication production par CT1 ; main fusionné ne vaut pas publication.

## Parole sous le choc (9 novembre)

Lot C1 : vécu Notion protégé avant les faits et souvenirs présentés comme vécu
(`optimized_v3`). [État des lieux et suite](analyse_parole_sous_le_choc.md). Base
Caractères en lecture seule. Générateur PRÉSENT mesuré par le lot P (non changé) ; reste l'écoute sandbox.
Suite ordonnée (mesure d'abord, LLM juge J1 → J3) : [feuille de route](feuille_de_route_jeu_personnages.md).

## Lot P — parole guidée par le juge (9 novembre, code)

Deux leviers mesurés par J2 sur sandbox-ulrich contre `optimized_v3`. **Contrat de flux `lived_v2` adopté en jeu**
(+0,33/10, `lived_impact` +0,32, aucun recul ; run `837feca1`) ; Max énumère encore, plus court. **PRÉSENT
`v2_second_person` non retenu** (−0,27 ; corrige la date de Peter mais perd des faits) : la synchro garde la consigne
`v1`, désormais partagée (`_shared/situationSummaryPrompt.ts`), comportement identique. Le juge rejoue un tour refusé
(429) au lieu de noter une réplique de secours. **À faire par Ulrich** : écoute AP5 en sandbox (Max surtout).
[Plan](plan_parole_lot_p.md), [rapport](rapport_parole_lot_p_sandbox_20261109.md).

## Pause du 10 novembre — reprendre la main avant R

Ulrich arrête l'enchaînement des lots : le juge, ses corpus et sa grille ont été produits par des agents et n'ont
jamais été comparés à un jugement humain ; `lived_v2` et le conseil GM touchent le jeu sans écoute. **Lot R bloqué**
jusqu'au calibrage du juge (Ulrich), à une définition éditoriale de la rumination (Romed, Ulrich) et à la relecture
des corpus. Devoirs, scénarios sandbox et ordre : [bilan de la pause](bilan_pause_juge_parole_rumination_20261110.md).

## Multilingue FR / EN / DE (12 novembre, plan)

Rien n'existe pour la langue dans le code (session, interface, STT, TTS, avatars, prompts, règles du moteur : tout
est français en dur). Décisions d'Ulrich : langue fixe par session, sélecteur + lien, Hochdeutsch, personnages natifs,
faits et RAG en français avec voix adaptée par langue, traductions en base validées par un natif, services par
langue, FR + DE publics à Soleure, anglais pilote en sandbox. Onze lots M1–M11, aucun code livré.
[Plan](plan_multilingue_ava.md), [prompt M1 « socle »](prompt_reprise_multilingue_lot_m1.md), non lancé.

## GM post-tour lisible (10 novembre, code)

Les post-tours illisibles relevés par J3 étaient tous tronqués à 950 tokens (objet indenté, mémoire antérieure
recopiée). Contrat GM compact, mémoire antérieure en chaînes « id — texte », plancher 1600 : **23,6 % → 0 %**
d'illisibles sur sandbox, conseil GM transmis à chaque tour (56/56), notes du juge sans recul au-delà du bruit.
Reste hors lot : un refus de la relation par le moteur annule le `memory_delta` du tour (9/72).
[Plan](plan_gm_post_tour_json_fiable.md), [rapport](rapport_gm_post_tour_json_sandbox_20261110.md).
Prochain lot : [R](prompt_reprise_rumination_sous_texte_lot_r.md), bloqué par la pause ci-dessus.

## LLM juge J3 — plusieurs tours (9 novembre, code)

`npm run eval:judge:sequences` rejoue des séquences de 3 à 5 tours sur sandbox (historique, mémoire structurée, conseil
GM du tour précédent), en mémoire, sans session ni ligne `eval_runs` ; note par tour (grille J1) et note de séquence
(continuité, reprise d'un fil, rumination, timeline, trajectoire) séparées. Bruit : par tour < 0,3, par séquence < 1,0.
`lived_v2` confirmé sur plusieurs tours sans recul (longueur +1,02). Rumination en formules répétées, prémisses
fausses acceptées par Max, GM post-tour illisible ~17 % des tours (corrigé le 10 novembre). 7,87 $ mesurés.
[Plan](plan_llm_as_judge.md#lot-j3--juge-sur-plusieurs-tours-9-novembre-2026), [rapport](rapport_llm_juge_j3_sandbox_20261109.md).
**À faire par Ulrich** : valider le [corpus J3 proposé](corpus_llm_juge_sequences_j3.md) (rien n'est saisi dans
Notion) ; Romed : arbitrages A–F pour les séquences C et D. Prochain lot :
[R, rumination et sous-texte](prompt_reprise_rumination_sous_texte_lot_r.md).

## LLM juge J1 (9 novembre, code)

Admin › Qualité › LLM as judge : mode « Référence contre candidat » par défaut (deux variantes de prompt ou deux
instantanés JSON, en mémoire seulement), questions Max et Emma, quatre critères de jeu (`not_meta`,
`lived_impact`, `canon_timeline`, `distinct_voice`) et `speech_quality` pondéré ; Δ par critère, question et
personnage. Option Emma ajoutée à la base corpus. [Plan](plan_llm_as_judge.md#lot-j1--mesurer-le-jeu-de-max-et-emma-implémenté-9-novembre-2026).
[Corpus v1](corpus_llm_juge_v1.md) validé par Ulrich et saisi dans la base corpus (20 lignes).
Premier run réel (sandbox, 126 tours, 2,10 $) : `rich_v2` ne bat pas `optimized_v3` (Δ −0,15) ; Max énumère encore
les morts et date mal la mort de Peter (erreur du résumé PRÉSENT) — base de mesure pour le lot P.
**J2 (9 novembre, code)** : même comparaison sans navigateur, `npm run eval:judge -- --candidate rich_v2`
(identifiants admin dans `.env.eval.local`, ignoré par git ; `prod` refusé ; plafond `--max-cost-usd`, 3 $ par défaut ;
rapport Markdown dans `output/eval-judge/`), ou workflow manuel « LLM judge (manual) » (secrets
`AVA_EVAL_EMAIL` / `AVA_EVAL_PASSWORD` à créer). Run réel `b12b2d34` : 5,02 → 4,96 (Δ −0,06, bruit ± 0,57), 2,13 $,
dans le bruit de J1. [Plan J2](plan_llm_as_judge.md#lot-j2--lancer-le-juge-sans-navigateur-implémenté-9-novembre-2026).
Lot P livré ensuite (section ci-dessus).

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

**Réglages par appareil (9 novembre, lot 2 livré en code — plan terminé).** Expérience › Appareils : par appareil
sortie, avatar, STT affiché, puis moteur de Max et d'Emma ; voix du catalogue TTS Config ; ligne « Joué : … ».
`ava_device_services` v2, ancien format lu sans perte (ID saisi gardé et signalé). TTS Config : catalogue et réglages
fins ; Streaming Avatar : lien. **À faire par Ulrich** : dans sandbox-ulrich, ouvrir Expérience › Appareils, choisir le
moteur de Max sur smartphone et sauvegarder ; puis recette iPhone (voix de Max) et iPad. [Plan](plan_reglages_par_appareil.md).

**Smartphone : film et voix (8 novembre, code).** Film d'introduction en image entière (portrait) avec « Plein
écran ⤢ » (paysage) ; Admin › Expérience › Appareils choisit sortie, avatar, moteur et voix par
appareil (défauts inchangés). Constat : l'iPhone jouait bien ElevenLabs `eleven_multilingual_v2` (voix Orchestration),
l'ordinateur la voix Anam. **À faire par Ulrich** : choisir la voix smartphone dans ce panneau puis recette iPhone
([recette](recette_adaptation_ecrans.md), section 1).

**Recette iPad et invitations (8 novembre, code).** iPad : le micro ne démarrait pas en mains libres, sans erreur
enregistrée ; le message dit désormais la cause (permission, micro occupé, navigateur) et le tour garde
`capture_error`. Navigateur visible sur la capture : Brave, pas Safari. Console d'invitations : mot de passe
réaffichable (invitations nouvelles) ou renouvelable (anciennes), copie chiffrée côté serveur. À faire par Lovable :
migration `code_ciphertext` et redéploiement de `manage-test-invitations`.

**Écrans, retours de recette iPhone (8 novembre, code).** Max muet en mains libres sur iPhone : iOS refusait le
lecteur `<audio>` d'ElevenLabs hors geste ; la réplique passe désormais par l'AudioContext déverrouillé (démarrage
après réception complète du MP3 sur iPhone). Appel smartphone : « Terminer » et minutage en haut à droite, autres
personnages en haut à gauche. Reste la recette humaine : [docs/recette_adaptation_ecrans.md](recette_adaptation_ecrans.md).

**Questionnaire conversationnel (9 novembre, lot 4 : dernier lot, désactivé par défaut).** Parcours complet derrière
le réglage « Questionnaire conversationnel (à la voix) » (🧭 Expérience → Orchestration, défaut PRD4) : 5 dimensions,
une relance max, note confirmée ou « non évalué », synthèse éditable, radar, « Valider et envoyer » ; admin agrégé.
Premier envoi réel vérifié dans Notion (iPhone, session `a3586dec`). Lot 4 : mise en page téléphone / tablette /
desktop, texte de dictée gardé à l'arrêt, E2E iPhone/iPad. **Aucun lot ne suit** : reste la recette humaine,
[docs/recette_questionnaire_conversationnel.md](recette_questionnaire_conversationnel.md), puis la décision d'activer
le mode par défaut. [Plan](plan_questionnaire_conversationnel.md).

**Adaptation aux écrans, lot 3 (8 novembre, code) — dernier lot du plan.** Tablette : même écran vidéo (avatar gardé),
avec une prop `touchFirst` calculée une fois depuis la classe (`touchFirstFor`) : cibles 44 px (Terminer, Ignorer,
« Passer » du teaser, « Revoir la vidéo d'introduction », « Terminer l'expérience »), « Touche pour parler », `100svh`.
Desktop inchangé. Revue 768×1024 à 1366×1024 portrait/paysage : cadrage vidéo et capsules corrects. Projets Playwright
`iphone` / `ipad` (WebKit) sur les tests `@device`, répartis dans les 4 shards. **Aucun lot ne suit** : reste la recette
humaine, [docs/recette_adaptation_ecrans.md](recette_adaptation_ecrans.md) (iPhone, Android, iPad, desktop, latences).

**Adaptation aux écrans, lot 2 bis (8 novembre, code).** Sur iPhone, Max était muet en appel vocal : iOS met l'AudioContext
en `interrupted` au démarrage du micro ; relance corrigée (`audioPlayback.ts`, réveil à chaque geste) et erreur exacte
dans `voice_turn_completed.error_detail`. Écrans < 640 px pensés pour le pouce (film : image pleine largeur et réponses
en bas ; accueil, fin : bouton en bas ; cibles 44 px). Lot 2 (#171) : appel vocal sans avatar sur smartphone, tablette et
desktop inchangés. Recette iPhone puis suite : [prompt lot 3](prompt_reprise_adaptation_ecrans_lot_3.md).

**Anam, mode « Calage initial » (7 novembre, code).** Mesures du mode navigateur : synchro stable (~−30 ms) dès la
réplique 4, mais +1,6 s puis −0,6 s sur les deux premières (recalage lent, seulement pendant la parole). Nouveau mode
par défaut : l'écart mesuré à la connexion est corrigé d'un coup avant l'accueil, puis le navigateur prend le relais.
Suite : Ulrich choisit « Calage initial » dans l'admin et teste ; lecture des répliques 1 à 3.

**Adaptation aux écrans (7 novembre, plan).** Smartphone (tactile, petit côté < 600 px) : appel vocal sans avatar
vidéo, nom et vignette ronde du personnage ; teaser, cinématiques, grille et questionnaire gardés. Tablette et desktop
inchangés (vidéo), tablette optimisée au lot 3. Classe d'appareil enregistrée sur la session, chaque tour et PostHog,
filtre « Appareil » dans l'admin. Forçage `?ecran=telephone|tablette|desktop`. [Plan](plan_adaptation_ecrans.md),
[prompt lot 1](prompt_reprise_adaptation_ecrans_lot_1.md) (métriques, migration via chat Lovable).

**Anam, réglage « Synchro labiale » (6 novembre, code).** Cinématiques sans coupure (recette OK). Synchro encore
flottante : mesures par réplique désormais enregistrées (insert corrigé), réglage admin auto / navigateur seul /
décalage manuel pour comparer, avec modèle et qualité vidéo. Suite : essais d'Ulrich puis lecture des écarts.

**Anam, synchro par voix audible + micro tenu pendant les cinématiques (6 novembre, code).** La correction
suit l'écart mesuré pendant la parole (pas au repos), dans les silences ; une ligne `avatar_av_sync` par
réplique (admin Sessions). Micro gardé ouvert pendant les cinématiques (coupure ~2 s due au casque
Bluetooth probable). Suite : recette d'Ulrich, puis lecture des écarts par réplique.

**Anam, synchro tenue par réplique + cinématiques préchargées (6 novembre, code).** Corrections de synchro
appliquées entre deux répliques (plus en pleine phrase), aucune mesure pendant une cinématique ; écart mesuré
par réplique visible dans l'admin (Sessions). Cinématique préchargée pendant l'annonce, départ sur 4 s de
tampon. Suite : recette d'Ulrich ; si une réplique désynchronisée montre « synchro ~0 ms », la cause est côté Anam.

**Anam, synchro labiale active (6 novembre, code).** Son et image désynchronisés puis en dérive : Ava mesure
l'écart audio/vidéo dans les stats WebRTC et retarde la piste en avance (tampon par piste), avant l'accueil et
pendant toute la session ; arrêt automatique si sans effet. Diagnostic `av_sync`. Suite : recette d'Ulrich
(accueil, session longue) ; si la désynchro reste visible avec un écart mesuré ~0, elle vient des horodatages Anam.

**Passage Max → Emma fluide (6 novembre, code).** Les boucles « De quoi veux-tu lui parler ? » venaient d'une
question figée du code substituée à l'accord de Max quand la preuve du GM échouait (fragments STT, référence mal
formée). Preuve sur toute la demande, preuve déterministe si Max annonce le transfert demandé, question de motif une
seule fois et seulement sans raison. Suite : recette d'Ulrich (demander Emma en expliquant, en plusieurs phrases).
Aucun lot de code ne suit. [Plan](plan_fluidite_passage_max_emma.md).

**Tavus, écoute pilotée par le jeu (6 novembre, prompt).** En voix Ava, le visage suit l'intention de jeu en
parlant mais repasse à une émotion d'écoute fixe dès la fin de la réplique (et toutes les 5 s). Lot 1 : l'écoute
prolonge, atténué, l'état de jeu de la dernière réplique ; réglage « Écoute : fixe / suit le jeu », front seul.
[Prompt lot 1](prompt_reprise_tavus_ecoute_jeu_lot_1.md).

**Tavus voix d'Ava (6 novembre, code) : audio Echo.** Tavus ne parle plus avec sa voix (diction française
faible) : Ava synthétise chaque réplique avec la voix du personnage et l'envoie en audio Echo, Tavus anime le visage
et les lèvres ; l'intention de jeu choisit l'émotion du visage. Format vérifié sur conversation réelle. Réglage
« Source de la voix » (défaut Ava, par personnage), voie texte conservée. Rien à déployer côté Edge. Suite : recette
d'Ulrich, intégrée au [lot 4](prompt_reprise_tavus_face_emotion_lot_4.md). [Plan](plan_tavus_voix_ava_audio.md).

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
