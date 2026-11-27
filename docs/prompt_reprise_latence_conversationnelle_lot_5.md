# Prompt de reprise — Latence conversationnelle, lot 5 (fin de parole plus courte, essai)

À copier dans un nouveau chat Ava. Plan : [plan_latence_conversationnelle_llm_tts.md](plan_latence_conversationnelle_llm_tts.md), sections « Lot 4 » (résultat) et « Lot 5 ». Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

**Objectif** : raccourcir le délai entre la fin de la phrase du joueur et la décision du tour, en mains libres, sans couper davantage la parole du joueur. Essai sandbox, derrière le réglage admin existant. Ce lot seulement ; ne pas commencer le bilan final.

**Précondition (à vérifier en premier)** : le lot 4 est fusionné sur origin/main (`git log origin/main --grep "latency lot 4"`), et la mesure du lot 4 est écrite dans le plan (par sortie, au moins 10 tours interrupteur activé et 10 désactivé, lus dans `voice_turn_events` via `metadata_json.output_stream.mode`). Si la mesure du lot 4 manque, ne rien coder : dire à Ulrich quelle mesure manque (une seule action), puis s'arrêter. Le choix du défaut du lot 4 (passer `VOICE_STREAMED_LLM` ou `anam.streamedLlm` à vrai) reste la décision d'Ulrich et n'est pas fait dans ce lot.

## État vérifié (27 novembre 2026, fin du lot 4)

- Lot 4 livré : interrupteurs `VOICE_STREAMED_LLM` (Réglages › Game Master, voix seule hors Gradium progressif) et `anam.streamedLlm` (Réglages › Avatar vidéo › Anam), défaut faux. Puits commun `src/services/streamedOutputSink.ts`. Télémétrie `output_stream` (`output`, `mode`, `llm_transport`). Vérifier le SHA de fusion avec `git log origin/main`.
- Lot 3 mesuré : appel du personnage 1,23 s en médiane (routage `sort: latency`), premier son voix seule 2,88 s depuis le transcript final.
- Fin de parole : `VOICE_HANDS_FREE.endOfSpeechMs` (défaut 900 ms, bornes 300-3 000, `src/services/handsFreeVoice.ts`), plus `hesitationExtraMs` (700 ms) sur une fin hésitante. Réglé dans Réglages › Game Master (mains libres).
- Deepgram : la finalisation (`Finalize`) peut attendre jusqu'à environ 1,5 s avant le transcript final (à mesurer : jalons `flush_sent`, `flush_acknowledged`, `transcript_final` de `voice_turn_events`).
- Un bloc de parole = un tour (24 novembre) : si le personnage n'a encore rien dit, une parole qui suit continue le message du joueur au lieu d'ouvrir un tour.

## Sources à lire

- Plan, section « Lot 5 ».
- `src/services/handsFreeVoice.ts` (`endOfSpeechMs`, `hesitationExtraMs`, détection de fin hésitante).
- La façade `src/services/stt` (seule entrée STT) et le fournisseur Deepgram, pour l'attente `Finalize` ; `src/services/stt/finalization.ts`.
- Dans `src/pages/IndexPRD4.tsx`, la décision de fin de tour en mains libres et la continuation d'un tour sans réplique.
- Invariants mains libres, interruption et passage de personnage en fin d'AGENTS.md.

## Périmètre

1. Mesurer d'abord, sans changer de réglage : sur les 7 derniers jours de `sandbox-ulrich`, médianes de `turn_decided` → `transcript_final` et de `flush_sent` → `flush_acknowledged`, nombre de tours re-décidés ou annulés (signature « annulation 1,1-1,5 s après la décision »).
2. Essai sandbox : `endOfSpeechMs` à 600-700 ms sur `sandbox-ulrich` seulement, puis mesure. Si l'attente `Finalize` domine, proposer (sans l'activer en production) une borne plus courte derrière un réglage, défaut inchangé.
3. Télémétrie au besoin : délai de décision et cause d'une annulation, dans `voice_turn_events` (JSON, sans migration).

**Hors périmètre** : LLM, routage, TTS, sorties vidéo (lot 4 terminé), cache, production.

## Invariants et limites d'autorisation

- Sandbox uniquement. La production n'est pas publiée. Aucune migration attendue ; si une colonne est nécessaire, elle passe par Lovable et reste additive.
- Base Caractères Notion en lecture seule. Gami DigiDouble exclu.
- Interruption, passage de personnage, cinématiques et continuation d'un bloc de parole inchangés.
- Appels payants bornés et annoncés ; Ulrich lance et écoute les runs. Limite serveur : 3 ouvertures de salle avatar par 10 minutes.

## Validations

- Mesure : au moins 20 tours mains libres avec le réglage court, comparés aux 7 jours précédents. Adoption seulement si les coupures ressenties et les tours annulés n'augmentent pas (écoute d'Ulrich).
- Tests sur toute borne ou tout réglage ajouté (absent = comportement actuel).
- `npm run typecheck`, lint, `npm run test:quality` et `npm run test:delivery` verts avant le push. CI de la PR verte, avec `regression-gates`. Si `PeriodCostLines.test.tsx` échoue localement sur « 1'500 », c'est la locale ICU de Node ; la CI fait foi.

## Livraison

Branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, puis fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier sur origin/main (arbre et parent), supprimer notre branche, synchroniser en local et sur Lovable. Mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan (section lot 5 : mesures, statut).

**Première action exécutable** : vérifier la précondition (fusion du lot 4, mesure du lot 4 dans le plan). Si elle est remplie, lancer la mesure en lecture du point 1 via le MCP Lovable (requête sur `voice_turn_events`).

**Clôture obligatoire** : avant le push, écrire `docs/prompt_reprise_latence_conversationnelle_bilan.md` (bilan final, section « Bilan final » du plan). Il contient l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture. Donner le lien direct dans le compte rendu. Ne pas lancer le bilan final.
