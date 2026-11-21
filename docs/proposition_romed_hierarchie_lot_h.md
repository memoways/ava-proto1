# Propositions à Romed — lot H : une seule hiérarchie (21 novembre 2026)

Pour la tâche Notion « Fiches Max et Emma… ». **Rien ici n'est appliqué** : la base Caractères reste en lecture seule
pour l'app et les agents ; Romed écrit lui-même dans Notion.

## 1. Libellés du radar à valider (attitudes vécues)
Les anciens textes demandaient des opérations de l'esprit (« tu nommes les contradictions », « tu cadres, tu relances, tu
décides du prochain sujet », « sans filtre »), qui poussent Max vers l'analyse. Les nouveaux textes
(`STATE_LEVEL_TEXT_LIVED`, `src/services/characterState.ts`) décrivent ce que le personnage a envie de faire et ce
qu'il donne, jamais ce qu'il sait ni comment il parle. Ils ne sont **joués que si le réglage « Textes d'attitude vécue »
est coché** dans Réglages personnages › radar (désactivé par défaut) : à cocher après validation de Romed.

| Axe / niveau | Avant | Proposé |
|---|---|---|
| Combativité 4 | « tu contredis, tu défends ton point et tu ne laisses pas passer une approximation » | « tu as envie de te défendre : tu réponds du tac au tac quand on te met en cause et tu ne laisses pas passer ce qui te blesse » |
| Combativité 5 | « tu attaques le point faible de l'autre » | « tu es prêt à te battre : tu réponds dur à ce qui te touche et tu ne veux rien lâcher » |
| Initiative 4 | « tu mènes : tu poses des questions, tu amènes tes sujets et tu proposes la suite » | « tu as envie de dire des choses : tu poses une question de toi-même et tu reviens sur ce qui te travaille » |
| Initiative 5 | « tu conduis l'échange de bout en bout : tu cadres, tu relances, tu décides du prochain sujet » | « tu as besoin de parler : tu reviens sans cesse sur ce qui te pèse et tu poses tes propres questions » |
| Lucidité 4 | « tu relies ce qui est dit à ce que tu sais et tu repères les incohérences » | « tu es à l'écoute : tu suis ce qui est dit et tu te souviens de ce que tu as déjà dit » |
| Lucidité 5 | « lucidité tranchante : tu vois ce qui se joue, tu nommes les contradictions » | « tu es très présent : tu suis chaque mot de l'autre et rien ne t'échappe de ce qui vient d'être dit » |
| Ouverture 5 | « tu te mets à nu : tu dis ce que tu n'as dit à personne, sans filtre » | « tu as du mal à retenir ce que tu ressens : ça affleure dans ta voix, et tu en dis plus que prévu » |

Niveaux 0 à 3 (et agitation) : inchangés, sauf reformulation mineure. Texte complet : `STATE_LEVEL_TEXT_LIVED`.

## 2. Bornes proposées pour Max
Max : **lucidité ≤ 3, ouverture ≤ 4** (zone min–max du radar, réglable dans l'éditeur ; constante
`RECOMMENDED_STATE_BOUNDS`, non appliquée). Raison : un Max très lucide ou très ouvert glisse vers l'analyse ou la
confession articulée, le « trop intello, méta » entendu. À confirmer par Romed pour Max, et à décider pour Emma.

## 3. Format et longueur : un seul endroit, l'app
Le nombre de phrases (1–3, 15 mots max) est écrit dans l'identité de la fiche **et** réglé côté app. Proposition :
**retirer ces phrases de l'identité** dans Notion ; l'app règle le format. Dans le prompt, la hiérarchie place la
parole du tour sous la fiche et l'état de l'app : une règle de longueur dans la fiche l'emporterait sur le réglage.

## 4. Références intellectuelles
Le champ « Références intellectuelles » est envoyé au runtime (canon). Un interrupteur d'évaluation en mémoire
(`{"intellectualReferences": false}` dans l'instantané du juge) permet de mesurer l'effet de leur retrait sur le ton,
sans rien changer dans Notion. À lancer au round J5 (style), pas ici.

## 5. Rappel du lot F (toujours ouvert)
Champ dédié court « Ce que tu sais aujourd'hui » (≤ ~1 000 car., faits par ordre d'importance) ou paragraphe resserré :
sans lui, Max nie que son père ait envoyé Mona au camp (budget 1 200 car. dépassé). Cette erreur **n'est pas** du ressort
de la hiérarchie.
