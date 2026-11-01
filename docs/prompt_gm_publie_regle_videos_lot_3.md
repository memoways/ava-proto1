# Prompt GM publié — règle vidéos « choix au sens » (sélection lot 3)

Date : 2026-11-01. Statut : **non publié.** Publication par la voie admin seulement ;
la production exige l'accord explicite d'Ulrich.
Plan : [sélection contextuelle des vidéos](plan_selection_videos_contextuelle.md#lot-3--choix-au-sens-pas-au-mot-clé).

## Pourquoi

Le prompt GM publié en admin (`systemPromptOverride`) remplace
`EXPERIENCE_DIRECTOR_SYSTEM_PROMPT`. Sa règle vidéo historique compare seulement
`labels.themes` aux thèmes et interdit toute vidéo sans thème extrait. Tant qu'elle
reste publiée, la règle du lot 3 n'agit qu'à moitié : le bloc VIDÉOS DISPONIBLES
(contexte et description) et la consigne finale du message GM viennent du code et
s'appliquent déjà, mais le prompt système publié continue d'imposer le thème.

## Version publiée active (lue via Lovable, lecture seule, 2026-11-01)

Table `experience_orchestration_versions`, statut `published` :

| Environnement | Version | id | Nom | Publiée le |
|---|---|---|---|---|
| `sandbox-ulrich` | 7 | `98145fe3-96f1-4525-84c2-0e0a1cc5c6da` | Recette switching lot 4 — Ulrich — 22 octobre 2026 | 2026-10-22 |
| `prod` | 8 | `74450a74-d1dc-47e6-9f06-4a177a7c5f6a` | Transposé depuis Ulrich v7 — 25 octobre 2026 | 2026-10-25 |
| `sandbox-julien` | 9 | `a7e1d5b7-80ad-4111-be52-e119115c2af4` | Transposé depuis Ulrich v7 — 25 octobre 2026 | 2026-10-25 |

Les trois portent le même prompt : 10 415 caractères, md5 `82f57f2ce02633dccb1fbd9f1e01feca`,
identique à la fixture `src/agents/fixtures/gm-published-sandbox-v7.txt` (sans le saut de
ligne final). `sandbox-romed` et `sandbox-benoit` utilisent `builtin://experience-director/v1`,
donc le prompt du code : ils reçoivent la règle dès la publication Lovable du code.

## Règle vidéo : ancien et nouveau bloc (référence)

Contrat JSON inchangé (`trigger_video_id`, `action.cinematic`).

Bloc actuel (à retirer) :

~~~~text
Règles "trigger_video_id" — PRIORITÉ HAUTE :
- Compare `labels.themes` aux champs `themes` de VIDÉOS DISPONIBLES.
- Tolère synonymes/fautes : "patricarcat"="patriarcat" ; "famille" ⊃ parents/sœur/père/frère/enfance/fratrie ; "trahison" ⊃ mensonge/cacher/secret ; "secrets" ⊃ cacher/vérité.
- DÈS QU'UN thème de la vidéo recoupe un label `themes` que tu viens d'extraire → renseigne `trigger_video_id` avec l'id de la vidéo.
- Plusieurs matchs : prends la priorité la plus haute (number le plus petit = plus prioritaire).
- Jamais d'id déjà présent dans `already_triggered`.
- Si `labels.themes` est vide, retourne null (pas de trigger sans label clair).
~~~~

Nouveau bloc (identique à la règle du prompt du code) :

~~~~text
Règles "trigger_video_id" — choix au sens, PRIORITÉ HAUTE :
- VIDÉOS DISPONIBLES ne liste que des vidéos déjà autorisées pour ce moment (parcours film, personnage en ligne, vidéos déjà jouées exclues). Choisis uniquement parmi elles.
- Rapproche chaque vidéo de ce qui se joue maintenant : thèmes, sujets concrets et intention du joueur (labels), et ce que le personnage vient de dire.
- Appuie-toi d'abord sur `contexte` (intention éditoriale : à quel moment de la conversation la vidéo prend son sens), puis sur `description` (ce que montre la séquence), puis sur `thèmes`.
- Un thème commun ne suffit pas si le contexte de la vidéo ne correspond pas à l'échange. Un contexte qui correspond clairement suffit, même sans thème identique.
- Tolère synonymes/fautes : "patricarcat"="patriarcat" ; "famille" ⊃ parents/sœur/père/frère/enfance/fratrie ; "trahison" ⊃ mensonge/cacher/secret ; "secrets" ⊃ cacher/vérité.
- Plusieurs vidéos pertinentes : prends la plus juste au regard du contexte ; à égalité, la priorité la plus haute (number le plus petit = plus prioritaire).
- Jamais d'id déjà présent dans `already_triggered`.
- Si rien ne rejoint clairement l'échange (message vague, salutation, hors-sujet), retourne null : jamais de vidéo par défaut.
~~~~

## Publication par l'admin (aucun copier-coller, aucune écriture SQL)

Le champ « Aperçu du prompt généré » est en lecture seule : un brouillon n'est pas saisi à
la main. « Nouveau brouillon » génère le prompt à partir du prompt du **code**
(`EXPERIENCE_DIRECTOR_SYSTEM_PROMPT`) et des réglages de la version source
(`buildExperienceDirectorPrompt`, `src/services/gameMasterPromptBuilder.ts`). Le brouillon
reprend donc la règle du lot 3 si l'admin utilisé contient ce code.

1. Ouvrir l'admin sur l'**aperçu Lovable** (synchronisé sur main) :
   https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app. Le site publié
   porte un code plus ancien : un brouillon créé là reprendrait l'ancienne règle.
2. Environnement **`sandbox-ulrich`** → onglet Game Master → version publiée 7 →
   « Nouveau brouillon » (réglages de la v7 recopiés).
3. Vérifier dans l'aperçu : « Règles "trigger_video_id" — choix au sens » et « Cinématiques :
   autorisées lorsqu'une vidéo disponible rejoint le sens de l'échange ».
4. « Test sans effet réel », puis « Publier ». Seules les sessions démarrées après la
   publication l'utilisent.
5. `prod` et `sandbox-julien` : même opération seulement après la recette d'Ulrich et son
   accord explicite pour la production (et, pour la production, après publication Lovable
   du code).

Retour arrière : republier la version 7 (« Restaurer en brouillon » puis « Publier »).

## Ce que le nouveau brouillon change aussi par rapport à la v7

La v7 (22 octobre) a été générée sur un prompt du code plus ancien. Le brouillon apporte,
en plus de la règle vidéo, des règles déjà livrées dans le code mais jamais publiées dans
ces environnements :

- règles « hors-monde » (recadrage en rôle d'un sujet étranger à l'histoire, intention
  `hors-sujet`) ;
- champ et règles `next_speech_state` (état de parole du prochain tour ; déjà exigé par le
  contrat technique ajouté à chaque appel) ;
- ligne de réglage « Cinématiques » alignée sur le choix au sens (correctif du lot 3 : elle
  disait « lorsqu'un thème correspond »).

Les réglages administrateur de la v7 (contexte du projet, questions ouvertes, garde-fous,
passages) sont recopiés tels quels.
