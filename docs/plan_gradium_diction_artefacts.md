# Plan — Artefacts de diction Gradium (hoquets, clics, prononciations)

Date : 2026-09-25 — Statut : implémenté

## Causes identifiées
1. **Lecture streaming sans tampon** (`gradiumStreamPlayer.ts`) : chaque paquet audio arrivant en retard créait un trou puis un redémarrage sec → hoquets/clics au milieu des mots.
2. **Découpage trop fin** (160 caractères) : chaque phrase générée séparément → intonation remise à zéro, respirations parasites entre phrases.
3. **Température trop haute** : le pilotage émotionnel ajoutait jusqu'à +0,26 (0,7 → 0,96) → sons étranges, prononciations instables.
4. **Ponctuation piégeuse** : « ... », tirets, guillemets, parenthèses lus comme souffles/bruits.

## Correctifs
- Tampon de 300 ms avant démarrage, 200 ms après une coupure réseau, micro-fondu de 4 ms à chaque (re)démarrage.
- Segments Gradium portés à 320 caractères.
- Bonus de température plafonné à +0,1, plafond absolu 0,85.
- `prepareTextForGradium` : nettoyage ponctuation spécifique Gradium.

## Tests
`gradium.textprep.test.ts`, suites TTS existantes, typecheck. Aucune migration.
