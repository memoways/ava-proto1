# Prompt de reprise — Lot R1 : relance conversationnelle (une phrase de plus)

Copier dans un nouveau chat sur Ava.

---

Lot R1 Ava : les répliques de Max/Emma sont trop courtes, « il manque une phrase ».
L'utilisateur n'a rien pour rebondir. Objectif : chaque réplique laisse une accroche
(détail concret non expliqué, réaction, fil narratif ouvert) qui donne envie de
continuer, **sans** finir systématiquement par une question.

Contexte vérifié le 31 oct. : `docs/plan_latence_elevenlabs_et_relance_2026-10-31.md` §2.
Causes dans le code :
- `src/services/responseIntentStream.ts` `buildResponseStreamContract` : plafond
  `Math.min(45, …)` mots et consigne « sans explication ni conclusion ajoutée ».
- `src/services/settingsService.ts:659` `responseStyle` « 1 à 2 phrases (45 mots maximum) ».
- `LLM_MAX_TOKENS` bridé à 220 (`settingsService.ts:213,296`), JSON d'intention inclus.

À faire :
1. Démarrage selon CLAUDE.md/AGENTS.md (git status, main à jour, branche du lot).
2. Vérifier la valeur **effective** du style de réponse : Notion (prompts éditoriaux),
   admin_settings, localStorage. Ne pas changer seulement le défaut si Notion le surcharge ;
   dans ce cas, me donner le texte Notion à remplacer (une action, un lien).
3. Proposer puis appliquer : ~2–3 phrases / ~60–70 mots ; règle « accroche » explicite
   avec 2–3 exemples courts in character ; garder l'interdit de la question réflexe ;
   garder fragments et suspensions permis, mais la réplique doit livrer son contenu avant
   de rester ouverte. Relever le budget de tokens en cohérence (le JSON d'intention compte).
4. Tests : mettre à jour `responseIntentStream` et settings ; tests de garde verts ;
   vérifier que les invariants parole/mains libres d'AGENTS ne bougent pas.
5. Preuve : 5 répliques avant/après sur les mêmes entrées (sandbox), lues par moi.
   La qualité ressentie reste ma validation humaine.
6. Signaler l'effet latence : réplique plus longue = attente ElevenLabs plus longue tant
   que le lot L1 n'est pas fait.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
