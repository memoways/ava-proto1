# Rapport — GM post-tour lisible, mesures sandbox (10 novembre 2026)

[Plan](plan_gm_post_tour_json_fiable.md). Environnement `sandbox-ulrich`, GM `google/gemini-2.5-flash` (sans
raisonnement), personnages `openai/gpt-5.6-luna`, juge `anthropic/claude-sonnet-5.5`. Chaque run :
`npm run eval:judge:sequences -- --candidate optimized_v3 --repeats 2 --max-cost-usd 3`, témoin `optimized_v3`
des deux côtés (même code), 4 séquences, 72 tours, 72 post-tours. Aucune session, aucune ligne `eval_runs`,
`admin_settings` intouché. Rapports locaux : `output/eval-judge/eval-judge-sequences-<run>.md` (hors dépôt).

## Diagnostic (run `ef71352a`, code de main)

| Constat | Valeur |
|---|---|
| Post-tours illisibles | **17/72 (23,6 %)**, tous `invalid_json · json_unreadable` |
| Forme | **tous tronqués** : `finish_reason: length`, 930 à 944 tokens produits pour un plafond de 950 |
| Sorties lisibles | médiane 840 tokens, maximum 923 : toutes près du plafond |
| Contenu | objet indenté dans un bloc \`\`\`json ; dans les 17 cas, `memory_delta` recopie la mémoire antérieure en objets `{id, text, sourceTurn}` (ignorés ensuite par `cleanMemoryDelta`) |
| Autres formes (texte autour, échappement, champ manquant) | aucune |

## Mesures après correctif

Conseils transmis : tours qui reçoivent un `next_turn_guidance` du post-tour précédent (56 possibles). Mémoire
absorbée : post-tours dont le `memory_delta` est fusionné dans la mémoire du tour suivant.

| Run | Code | Illisibles | Tokens médiane / max | Conseils transmis | Mémoire absorbée | Tour réf. / cand. | Séquence réf. / cand. | Coût |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `ef71352a` | main (avant) | 17/72 | 840 / 944 | 44/56 | 54/72 | 5,38 / 5,34 | 6,44 / 6,54 | 1,72 $ |
| `eecdf5b3` | compact + plancher 1600 + « null si rien de nouveau » | 0/72 | 520 / 765 | 56/56 | 62/72 | 5,31 / 5,28 | 6,50 / 6,08 | 1,65 $ |
| `ecdab072` | `lastExchange` toujours renseigné | 0/72 | 520 / 1014 | 56/56 | 66/72 | 5,15 / 5,30 | 6,23 / 5,69 | 1,64 $ |
| `00eedcfc` | « memory_delta jamais null » | 2/72 | 510 / 1600 | 54/56 | 61/72 | 5,40 / 5,47 | 6,13 / 6,23 | 1,64 $ |
| **`60cb2aab`** | **livré** : mémoire antérieure en chaînes « id — texte » | **0/72** | **498 / 757** | **56/56** | **63/72** | 5,72 / 5,19 | 6,65 / 5,63 | 1,65 $ |

Plus un rejeu court de diagnostic (`max-B`, `emma-A`, un passage, 0,42 $). Total mesuré : **8,72 $**.

- **Taux d'échec : 23,6 % → 0 %** sur la version livrée. Tous les post-tours rendent `stop`, au plus 757 tokens,
  sous l'ancien plafond : le plancher de 1600 est une marge, pas la cause de la correction.
- Le run `00eedcfc` a montré deux sorties qui **bouclaient en recopiant les objets de la mémoire** jusqu'au plafond de
  1600, malgré la consigne. Présenter la mémoire antérieure en chaînes « id — texte » a supprimé ce gabarit : aucun
  `memory_delta` null, aucune boucle au run suivant.
- **Notes du juge sans recul au-delà du bruit.** Note par tour, deux côtés réunis : 5,36 avant ; 5,30, 5,23, 5,44,
  5,46 après (bruit < 0,3). Note de séquence : 6,49 avant ; 6,29, 5,96, 6,18, 6,14 après, soit −0,35 en moyenne, sous
  le seuil de bruit de séquence (< 1,0). L'écart est du même signe dans les quatre runs : à surveiller dans les
  mesures du lot R. Les écarts référence/candidat d'un même run (jusqu'à −1,02 en séquence pour `60cb2aab`) opposent
  deux configurations identiques : c'est la variance du témoin.

## Ce qui reste hors de ce lot

- **Mémoire écartée par le moteur relationnel** (9/72 tours sur la version livrée). Un refus de la proposition
  `relationship` annule tout le `memory_delta` du tour (`gameMasterPRD4.ts`, comportement existant). Motifs relevés au
  rejeu de diagnostic : `upward_without_user_evidence`, `unknown_topic` (ids de sujets sensibles inventés, longs
  slugs de phrases). Ces tours étaient auparavant le plus souvent tronqués, donc déjà perdus. Garder les faits du
  tour quand seule la relation est refusée change une règle du moteur : à décider dans un lot à part.
- L'extension de passage (`CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS`) garde sa règle « null si rien de nouveau »
  pour les tours de passage ; non mesurée ici (aucun passage dans le corpus J3).
