# Prompt de reprise — Lot G1 : gravité des personnages, nom « Ava » et latence réelle

Copier dans un nouveau chat sur Ava. Remplace `prompt_reprise_latence_lot_l2.md` (L2 est
absorbé dans la partie C).

---

Lot G1 Ava, issu de la recette d'Ulrich du 31 octobre (sandbox, ElevenLabs v4 Turbo, Max
puis Emma). Trois problèmes graves, traités dans cet ordre, chacun arrêtable :

**A. Gravité constante des personnages (texte et voix).**
Max et Emma sont écrasés par ce qui leur est arrivé. Par défaut et en permanence : drame,
peine à parler, pris par leur situation. Interdits : ton léger, guilleret, drôle, blagues ;
digressions triviales ou sensorielles du quotidien (odeur du café, poignée de porte…).
Constat recette : Max part dans ces trivialités ; Emma décroche l'appel sur un ton drôle et
guilleret. La règle doit tenir à deux niveaux :
1. **Texte (LLM)** : invariant de jeu injecté pour Max et Emma, qu'aucun réglage ne peut
   retirer, plus un contrôle de sortie si utile (sans relance coûteuse en latence).
2. **Voix (TTS)** : chaque fournisseur reçoit d'emblée une consigne de gravité
   (ElevenLabs, Gradium, Fish, Cartesia, Inworld selon ce que chacun accepte : style,
   balises, intention, instructions). Jamais d'intention légère par défaut, y compris pour
   l'accueil/décroché d'Emma. Vérifier l'atelier de parole (AP4) et les états de parole
   (`supabase/functions/_shared/speechStates.ts`, champ Notion « Manière de parler »).

**B. Nom « Ava », jamais « Eva ».** Emma dit « Eva ». Sa fille, qui devient son garçon,
s'appelle **Ava** (A-V-A). Aucune occurrence de « Eva » dans le RAG (`embeddings` : 117
« Ava », 0 « Eva »), `storyworld`, `rules` ni `admin_settings` (vérifié le 31 oct.). Causes
possibles, à départager avec preuve : transcription STT (« Ava » entendu « Eva »,
`src/services/stt/dictionary.ts` contient déjà « Ava » en keyterm), texte du LLM, ou
prononciation TTS (v4 Turbo qui dit « Éva »). Corriger à la bonne couche : garde de texte,
dictionnaire de prononciation ou réécriture phonétique côté TTS si c'est la voix.

**C. Latence réelle (ressentie inchangée par Ulrich).** Réglages vérifiés corrects :
`ava_tts_settings.modelId = eleven_v4_turbo`, fournisseur actif `elevenlabs`. Le TTS n'est
plus le goulot. Session `d00687ba-f31c-47b7-9398-93ea98a14ec2` (sandbox-ulrich), jalons
`voice_turn_finished.metadata_json.milestones` en ms depuis `turn_decided` :

| Tour | context_ready | llm_request | llm_response | tts_text_sent | son (audio_scheduled) |
|---|---|---|---|---|---|
| 1 Max | 1 335 | 2 117 | 5 417 | 5 421 | 5 903 |
| 2 Max | 1 048 | 1 819 | 3 799 | **6 458** | 7 011 |
| 3 Max | **4 933** | 6 034 | 8 335 | 8 343 | 8 852 |
| 4 Max | 1 633 | 2 476 | 4 569 | **7 165** | 7 617 |
| 5 Max | 1 482 | 2 316 | 3 899 | **9 813** | 10 241 |
| 6 Emma | 2 204 | 2 893 | 4 990 | 4 993 | 5 433 |

Lecture : texte → son = 0,43 à 0,56 s (L1 tient). Le délai de 5,4 à 10,2 s vient de :
- **écart fin LLM → envoi TTS** de 2,6 à 5,9 s sur 3 tours sur 6 (l'ancien L2, désormais
  un tour sur deux et plus long) ;
- **préparation du contexte** 1,0 à 4,9 s (RAG 0,8 à 1,9 s, tour 3 anormal) puis ~0,7 s
  avant la requête LLM ;
- **LLM Max** `openai/gpt-5.6-luna` 1,6 à 3,3 s sans `first_token` (réponse non streamée) ;
- non mesuré : silence de fin de parole avant `turn_decided` (déclencheur `silence`).
Pistes L2 toujours valables, non vérifiées : `needsHandoffPreparation` / `prepareHandoff`
(`src/services/prd4Orchestrator.ts`), garde d'identité ou relance, travail synchrone entre
`processPRD4Turn` et `LocalTTSOutput.renderText` (`src/pages/IndexPRD4.tsx`), GM
(`voice_turn_gm`, `gm_persistence` ~2,4 s) s'il est attendu. `VOICE_INCREMENTAL_OUTPUT` est
`false` en sandbox-ulrich, `true` en prod : ne pas le changer sans accord d'Ulrich.

Étapes :
- **G1.0 Diagnostic sans code** : cause de « Eva » (A) ; inventaire des consignes de ton
  réellement envoyées au LLM et à chaque TTS (B) ; cause nommée de l'écart fin LLM → TTS
  et du contexte lent (C). Me présenter le constat et les changements proposés, y compris
  les textes Notion à modifier.
- **G1.1 Correctifs** A, B, puis C (C : supprimer l'attente évitable sur le chemin critique ;
  modèle LLM ou streaming de Max seulement sur mon accord).
- **G1.2 Recette d'Ulrich** : sandbox, Max 5 tours puis Emma ; aucune légèreté ni
  trivialité, « Ava » prononcé correctement, décroché d'Emma grave, son en moins de ~3 s
  après la fin de parole visé ; Gradium inchangé.

Contraintes :
- **Base Caractères Notion en lecture seule, interdiction formelle** : proposer les textes,
  ne rien écrire sans ma demande explicite. L'invariant de gravité doit tenir côté code.
- Prompts éditoriaux dans Notion ; vérifier les surcharges `admin_settings`/localStorage.
- Façade `src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable uniquement ;
  invariants parole/mains libres d'AGENTS. Une simulation ne prouve pas le rendu vocal.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne
suit), avec cette même obligation.
