# Évaluation — LLM de Max streamé vers le TTS (lot T2, sans code)

Statut : **note d'évaluation, aucun code**. Décision d'Ulrich attendue avant tout lot d'implémentation.
Mesures : session sandbox-ulrich `c293829f…` (19 novembre, Tavus, après T1) et `llm_usage`.

## Où va le temps aujourd'hui (médianes, depuis la décision de tour)

| Étape | Durée | Source |
|---|---|---|
| Contexte prêt (RAG, lectures, prompt) | 0,7–1,2 s | `character_rag`, `llm_request` |
| Appel LLM complet (`prd4_chat`, gpt-5.6-luna, `http_batch`) | 1,5–2,0 s | `character_attempt` |
| Texte envoyé au TTS | ≈ 2,7 s | `tts_text_sent` |
| Premier octet audio ElevenLabs (flux PCM, T1) | ≈ 0,35 s après | `first_audio_chunk` |
| Attente vidéo Tavus | ≈ 1,0 s | `video_wait_ms` |
| **Max audible** | **≈ 3,9 s** | `output_estimated` |

Le LLM répond 64–123 tokens de sortie pour 3,8 k de prompt : la réponse est courte, donc l'essentiel de l'appel est la
latence au premier token, pas le débit.

## Gain attendu (estimation, non mesurée)

Si la première phrase part au TTS dès qu'elle est complète dans le flux, au lieu d'attendre la réponse entière :
- première phrase typique de Max : 8–15 mots ≈ 20–30 tokens ; le premier token arrive après ~0,6–0,9 s, la première
  phrase après ~0,9–1,2 s, contre 1,5–2,0 s pour la réponse complète ;
- gain probable **0,5 à 0,9 s** sur `tts_text_sent`, donc sur « Max audible » (≈ 3,9 s → ≈ 3,1–3,4 s) ;
- gain nul sur les tours dont la première phrase est longue ou tardive (cf. `ResponseIntentParser`).
À confirmer sur un prototype avant tout engagement : ces chiffres viennent des durées d'appel, pas d'un essai.

## Ce qui existe déjà

`streamPRD4Turn`, `ResponseIntentParser` et `prepareStreamedVoiceTurn` découpent déjà une réponse en segments pour le mode
incrémental (Gradium) ; le chemin Tavus lit la réponse du LLM en lot (`http_batch`) puis alimente ce découpage.
Le travail serait donc de **streamer l'appel LLM** (SSE via `proxy-llm`) et de brancher ses morceaux sur le parseur, pas
de réécrire la segmentation.

## Risques

1. **Première phrase** : en lot, la validation (salvage, intent, garde de gravité, `character_local_salvage`) voit la
   réponse entière avant la première parole. En flux, la première phrase est dite avant d'avoir vu la suite : une phrase
   refusée par une garde ne peut plus être retirée, seulement interrompue (coupure audible). Les gardes qui jugent la
   réponse entière devraient devenir des gardes de première phrase, ou rester post-hoc.
2. **Intent et état de parole** : l'intent (`ResponseIntentParser`) arrive dans la réponse ; sans intent complet, la voix
   (stabilité, style ElevenLabs) et le cue d'avatar de la première phrase seraient décidés trop tôt.
3. **Passage de personnage** : la garde `needsHandoffPreparation` retient la sortie quand le texte propose un passage ; en
   flux il faut retenir avant de savoir. Le chemin passage (`heldOutput`) devrait rester en lot (résolution à la fin).
4. **Reprise sur échec** : tentative 2 (retry intent / phrase / vide, spans `character_retry_*`) repose sur une réponse
   complète ; un flux interrompu après la première phrase laisse un début de réponse déjà prononcé.
5. **Segmentation et coupures Tavus** : plus de morceaux envoyés tôt, donc plus de risque de coupure entre phrases côté
   Tavus ; T1 envoie déjà la première ligne en flux, la ligne suivante est préchargée en blob.
6. **Coût et fournisseur** : le proxy LLM doit relayer le flux ; `llm_usage` doit rester journalisé en fin de flux.
7. **Régression Anam / LemonSlice / Gradium / TTS seul** : tous partagent le pipeline de segmentation ; le flux serait
   activé par fournisseur, Tavus d'abord.

## Recommandation

Ne pas implémenter d'emblée. Ordre proposé si Ulrich valide : (1) prototype mesuré sur sandbox-ulrich, Tavus seul,
flux de la première phrase uniquement, réponse complète validée comme aujourd'hui pour le reste ; (2) comparer
`tts_text_sent`, taux de salvage et de coupure sur 20 tours ; (3) étendre seulement si le gain dépasse 0,5 s médian sans
phrase retirée. Un levier moins risquant, déjà identifié, est de réduire le contexte prêt (0,7–1,2 s) : à instruire à part.
