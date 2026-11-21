# Lot H — mesure factualité avant/après la hiérarchie des consignes (21 novembre 2026)

Sandbox `sandbox-ulrich`, `optimized_v3`, modèle joueur `openai/gpt-5.6-luna` (T 1,4), juge `anthropic/claude-sonnet-5.5`,
corpus `docs/eval/sequences_factuality_f.json` (6 séquences, 3 passages), **mêmes réglages dans le même arbre de code**.
Seule différence : *avant* = hiérarchie retirée en mémoire (`--reference-json '{"instructionHierarchy":false}'`),
*après* = jeu actuel. Radar : aucun profil actif en sandbox, donc les nouveaux textes du radar ne sont pas dans cette mesure.
Rapports bruts : [avant](juge_hierarchie_lot_h_avant_20261121.md) · [après](juge_hierarchie_lot_h_apres_20261121.md).

| | Avant | Après | Écart |
|---|---|---|---|
| Max | 6,56 (37 tours) | 5,58 (38 tours) | −0,98 |
| Emma | 7,15 (31 tours) | 6,42 (30 tours) | −0,73 |
| Tous tours | 6,83 (68 tours) | 5,95 (68 tours) | **−0,88** |
| Écart-type d'un même tour entre passages | 1,65 | 1,47 | |
| Coût mesuré | 1,44 $ | 1,91 $ | 3,35 $ au total |

Les deux runs sont signalés « arrêtés au plafond de coût » (3 $ par run) : 68 tours notés sur 78 chacun, même couverture.
Coût annoncé avant : estimation 2,84 $ par run, plafond 3 $ par run ; coût réel cumulé 3,35 $.

## Lecture honnête
- **Critère du plan respecté à la lettre** : −0,88 est inférieur au bruit par tour (1,37 ; 1,5 à 1,65 ici).
- **Mais le signe est le même pour les deux personnages**, et le bruit d'une *moyenne* de 68 tours est bien plus petit que
  celui d'un tour (ordre de 0,25 point si les tours étaient indépendants). Ne pas conclure « aucun effet » : la baisse est
  **probablement réelle, de l'ordre d'un point**, sur une mesure à un seul run par côté et au juge non calibré.
- Ce qui change dans les réponses « après » : Max répond plus souvent « je ne peux pas confirmer ce détail » sur le thermos et le
  chevreuil (passages 2 et 3), une prudence que le juge ne pénalise pas comme contradiction mais qui retire des faits attendus.
  Hypothèse non vérifiée : la formulation « ce qui est vrai ne change ni pour te défendre… » rend le personnage frileux sur les
  prémisses. Les erreurs de fiche répétées du lot F (Mona/père, fusil, contamination) restent présentes des deux côtés : elles
  ne dépendent pas de la hiérarchie.
- Température 1,4 : une partie de l'écart peut venir de l'échantillonnage.

## Décision livrée
La hiérarchie est livrée **active dans `optimized_v3`** (le critère du plan est tenu et le lot demande une seule
hiérarchie écrite) ; rien n'est publié en production. Retour arrière sans code : l'interrupteur d'évaluation permet de
rejouer sans hiérarchie, et la constante `INSTRUCTION_HIERARCHY` est le seul texte à assouplir. **À arbitrer par Ulrich** :
rejouer un second run par côté (≈ 3,4 $) avant publication, ou assouplir la formule du niveau 1. Le juge de factualité reste non
calibré (dix réponses notées par Romed attendues).

## Non mesuré dans ce lot
Textes d'attitude vécue du radar (aucun profil actif en sandbox ; activation après validation de Romed), interrupteur
« références intellectuelles » (mesure de ton : round J5).
