# Plan — service vidéo par personnage

Date : 25 novembre 2026. Statut : **proposition, non développée**. À auditer avant tout code.
Rien n’est implémenté à partir de ce fichier. Pas de branche, pas de production.

Auditeur attendu : Opus (Claude). Il doit juger si la proposition tient, si elle casse un comportement actuel, et s’il manque une question à poser à Ulrich. Le développement ne commence qu’après cet audit.

## 1. Requête d’Ulrich

Texte d’origine, 25 novembre 2026, tel que transcrit :

> En fait, j'aimerais, euh, ajouter, euh, aussi la, la mécanique, euh, streaming vidéo avatar à M1, je sais pas si c'est déjà prévu ou pas, si c'est prêt. Euh, si c'est pas le cas, ben, il faut pouvoir le faire. Donc, euh, là, concrètement, j'aimerais pouvoir, euh, mapper Nuance Lab, donc, euh, le, le caractère, euh, nuance, de Nuance Lab sur M1, et pouvoir discuter avec M1, euh, avec le caractère de Nuance Lab. Donc, ce qu'il faut, c'est d'assurer que tous les personnages puissent être mappés sur, euh, un modèle, euh, vidéo, euh, au même titre qu'on le fait pour le son, donc voir ce qu'il faut faire, donc il faut faire un audit de la mécanique, en fait, surtout pour éviter de faire ça n'importe comment, de casser des choses et de surcontextualiser. Donc, ce qu'il faut, c'est de faire un audit, euh, de la mécanique pour assurer que, euh, je puisse mapper, euh, n'importe quel personnage sur n'importe quel, euh, modèle vidéo avec des réglages spécifiques comme je fais pour le son. Donc, euh, faire ça bien, faire un audit de la mécanique, de comment ça fonctionne, euh, et me dire quelle est la meilleure manière de faire ou faire les choses pour que je puisse définir dans le réglage personnage, ce sera sans doute le réglage personnage que je dois, que je spécifie, euh, le, le modèle, quel modèle audio, mais aussi quel modèle vidéo utiliser, ce sera peut-être des modèles différents par, euh, personnage. Euh, comme ça, ça permet de faire un peu des tests comparatifs. Et, euh, me faire un, un, un plan sur l'implémentation du fait de pouvoir, euh, régler chaque personnage sur un net vidéo avec des, avec tous les, les réglages qui sont spécifiques pour le personnage, mais sans non plus, euh, surcontextualiser, mais il faut quand même pouvoir être assez fin au niveau des réglages, autant audio que vidéo pour chaque personnage.

Précision du même jour, après la proposition :

> Il faut le faire parce qu'il faut faire ce routing de spécifier quel service vidéo pour quel personnage. Enregistrer le plan dans le dépôt, avec la requête au début, pour audit par Opus. Ne pas démarrer le développement.

## 2. Besoins retenus

1. Savoir si le streaming vidéo avatar est déjà prévu ou prêt pour être choisi **par personnage**. S’il ne l’est pas, le rendre possible.
2. Pouvoir mapper une persona Nuance Labs sur un personnage et discuter avec ce personnage rendu par cette persona.
3. Le même genre de lien que pour le son : n’importe quel personnage vers n’importe quel modèle vidéo, avec des réglages propres au personnage.
4. L’endroit de réglage envisagé par Ulrich : **Réglages personnages** (modèle audio et modèle vidéo, éventuellement différents d’un personnage à l’autre).
5. Des tests comparatifs (deux personnages, ou deux essais, sur des modèles différents).
6. Rester fin sur l’audio et la vidéo, sans surcontextualiser et sans casser l’existant.
7. Un audit de la mécanique avant le code.

« M1 » dans la requête n’est pas tranché. Deux lectures possibles :

- le lot multilingue M1 « socle : langue de session » ;
- le personnage Max, si la transcription a écrit M1 pour Max.

La suite du message tranche le besoin produit : un **routage** « quel service vidéo pour quel personnage ». La lecture retenue ici est : ne pas gonfler le lot M1 ; ajouter ce routage à part. Opus doit dire si cette lecture est la bonne, ou s’il faut encore demander à Ulrich.

## 3. Audit — ce qui existe

### 3.1 Le lot M1 ne contient pas cette mécanique

[docs/plan_multilingue_ava.md](plan_multilingue_ava.md), lots :

- **M1** : langue de session seulement. Rien d’autre ne change. Non commencé.
- **M2** : voix, STT et TTS par langue, voix par personnage × moteur × langue.
- **M7** : fournisseur et réglages d’avatar **par langue**, voix Anam et HeyGen par langue, repli, mesure de synchro. Non commencé.

M7 prévoit un fournisseur pour une langue, pas un fournisseur différent par personnage. Nuance n’y figure pas : le plan date du 12 novembre 2026, Nuance du 25.

### 3.2 Le son est déjà par personnage

Réglages personnages ([src/components/CharacterRuntimeSettingsTab.tsx](../src/components/CharacterRuntimeSettingsTab.tsx)) : pour chaque fiche, `tts_provider` et `tts_voice_id` sur le profil runtime. La voix affichée vient du catalogue TTS, pas d’un identifiant retapé.

Résolution réelle ([src/services/effectiveVoice.ts](../src/services/effectiveVoice.ts), [src/services/deviceServices.ts](../src/services/deviceServices.ts)) :

1. L’appareil peut imposer un moteur pour ce personnage (Expérience › Appareils).
2. Sinon le moteur et la voix du profil.
3. Sinon le moteur TTS actif et la voix par défaut du moteur.

Les curseurs fins (stabilité, style, vitesse, température) vivent dans la config du moteur, partagée. Gradium a déjà un écart `byCharacter` (température, similarité, rythme). La rugosité de parole est un réglage de personnage à part. On ne recopie pas les curseurs d’un moteur sur la fiche.

### 3.3 La vidéo est un seul service pour l’appel

Au décrochage ([src/pages/IndexPRD4.tsx](../src/pages/IndexPRD4.tsx)) : le fournisseur de l’appareil s’il est fixé, sinon `activeProvider` de `ava_streaming_avatar_settings`.

[src/services/callOutputMode.ts](../src/services/callOutputMode.ts) n’ouvre le flux que si le personnage **de départ** est Max. Emma démarre en voix, avec sa photo, raison `character_voice_only`, pour ne jamais afficher le flux de Max. Un smartphone reste en voix, sauf réglage d’appareil « avatar ».

Seul Tavus a déjà des écarts par personnage, **à l’intérieur** de ce fournisseur unique : visage, émotion, émotion d’écoute, source de voix (`resolveTavusCharacterSettings` dans [src/services/streamingAvatar/settings.ts](../src/services/streamingAvatar/settings.ts)). HeyGen, Anam, LemonSlice et Nuance n’ont pas ce lien.

Le fournisseur est figé pour l’appel. Un passage Max → Emma ne rouvre pas une autre salle.

### 3.4 Nuance, limites qui comptent pour le mapping

Détail : [docs/plan_nuance_labs.md](plan_nuance_labs.md). Déjà sélectionnable. Secret `NUANCE_API_KEY` et migration `nuance` en place. Essai réel de parole anglaise pas encore fait.

- Personas : `sam` (défaut, on ne l’écrit pas dans le jeton), `sonia`, `mira`. Un id `max` ou `emma` est refusé.
- La persona fixe le visage et la voix. Elle ne porte pas la voix TTS d’Ava : pas de PCM, pas de `voice_id`.
- Anglais seulement, d’après la doc. Une réplique française peut être refusée ; l’appel bascule alors sur la voix d’Ava et la vidéo s’arrête pour la suite.
- Mode Texte d’Ava : consigne « Say only this », pas une garantie de texte exact.
- Mode Conversation Nuance : Nuance répond elle-même. Les deux textes peuvent différer.
- Le prompt de personnage, le RAG et le cadre d’expérience ne doivent pas être copiés dans `system_prompt`. Ce serait le surcontexte à éviter.

### 3.5 Conclusion d’audit

Le routage « service vidéo × personnage » n’est ni prêt, ni prévu tel quel. Le proche existant est : un fournisseur par appareil ou global, plus des écarts Tavus par personnage, plus la voix par personnage. Le besoin d’Ulrich demande d’étendre ce schéma aux autres fournisseurs, Nuance compris, sans deuxième cerveau de personnage.

## 4. Proposition

Un lot à part. Pas M1, pas M7.

Le lien vidéo est optionnel, par `max` et `emma`, dans le JSON d’environnement `ava_streaming_avatar_settings`. Pas de migration, pas de colonne sur la fiche. Vide ou absent : comportement d’aujourd’hui, JSON anciens relus sans perte.

L’écran est Réglages personnages, sous le provider TTS : « suivre le réglage global », ou un fournisseur, puis les quelques champs de ce fournisseur.

Priorité au décrochage, calquée sur la voix :

1. L’appareil impose un fournisseur d’avatar : il gagne pour tout l’écran.
2. Sinon le personnage de départ a un lien : ce fournisseur, et ses champs, par-dessus la config globale du **même** fournisseur. Secrets, délais, salle, qualité : inchangés, ils restent dans Streaming Avatar Config.
3. Sinon la règle actuelle : Max suit l’interrupteur global ; Emma sans lien reste en voix.

Champs propres au personnage, et rien d’autre :

| Fournisseur | Sur le personnage | Reste global |
| --- | --- | --- |
| Nuance | persona, expressivité 0–2, mode Texte d’Ava ou Conversation | texte de consigne par défaut |
| Tavus | visage, émotions, source de voix (déjà là) | délais, politique EU, `streamedLlm` |
| Anam, HeyGen, LemonSlice | identifiant de visage, et de voix s’il existe | qualité, salle, timeouts |

L’appel fige le fournisseur au décrochage. Pas de changement de salle WebRTC au passage d’un personnage à l’autre dans ce lot. Un comparatif, c’est deux appels.

Emma ouvre la vidéo seulement avec un lien explicite, et si l’appareil n’est pas forcé en voix. Sans lien, elle reste en voix.

Le grain audio du personnage ne change pas : moteur, voix du catalogue, rugosité. Les curseurs Gradium déjà par personnage restent dans Configuration TTS. Le bloc « Joué » décrit aussi la vidéo résolue (exemple : « Nuance · sonia · expressivité 1,2 »).

### Fichiers

- [src/services/streamingAvatar/settings.ts](../src/services/streamingAvatar/settings.ts) et son test : normaliser le lien, ignorer une valeur inconnue.
- Nouvelle résolution pure (appareil, lien, global, raison) branchée sur [src/services/callOutputMode.ts](../src/services/callOutputMode.ts).
- [src/pages/IndexPRD4.tsx](../src/pages/IndexPRD4.tsx) : au `prepareCall`, ouvrir la salle avec le fournisseur résolu et les champs du lien. La session enregistre le fournisseur réellement ouvert.
- [src/services/effectiveVoice.ts](../src/services/effectiveVoice.ts) : la description « Joué » suit cette résolution.
- [src/components/CharacterRuntimeSettingsTab.tsx](../src/components/CharacterRuntimeSettingsTab.tsx) : le sélecteur.

### Tests qui doivent rester vrais

- Un JSON d’avatar déjà enregistré, sans lien, se relit comme aujourd’hui.
- Max sans lien : même mode et même fournisseur qu’aujourd’hui.
- Max lié à Nuance `sonia` : la salle ouverte est Nuance, persona Sonia, sans envoi du prompt de Max.
- Emma sans lien : voix seule, raison `character_voice_only`.
- Emma avec lien, appareil non forcé en voix : son fournisseur.
- Un fournisseur fixé sur l’appareil gagne sur le lien du personnage.
- Smartphone en voix : pas de salle, lien ou pas.

Recette sandbox seulement, après le code, rien en production : Max, Nuance, persona choisie, Texte d’Ava, une phrase courte en anglais. Noter si le visage lit, refuse ou reformule. Emma sans lien : la voix, pas de vidéo.

## 5. Hors du lot

- Ne pas commencer le multilingue M1 ni M7.
- Ne pas changer de salle au milieu de l’appel.
- Ne pas injecter fiche, RAG ou cadre d’expérience dans Nuance.
- Ne pas dupliquer les curseurs TTS sur la fiche.
- Ne pas publier en production.

## 6. Risques à faire vérifier par l’audit

1. **Emma en vidéo.** Lever `startingCharacter !== "max"` seulement quand un lien existe. Un oubli montrerait le flux de Max sur Emma, ce que le commentaire de `callOutputMode` interdit.
2. **Deux sources Tavus.** Le visage par personnage existe déjà dans `tavus.characters`. Le nouveau lien ne doit pas en créer une deuxième. Si le lien dit Tavus, on réutilise `resolveTavusCharacterSettings`.
3. **Appareil contre personnage.** Si l’appareil gagne toujours, un essai « Max sur Nuance » ne se voit pas tant que l’appareil impose un autre fournisseur. Il faut que l’écran le dise (« Joué »), pas que le lien ait l’air ignoré.
4. **Nuance et le français.** Mapper Nuance sur Max ne fait pas parler Max avec la voix ElevenLabs ni en français garanti. L’échec doit garder le repli vocal déjà en place.
5. **Mode Conversation.** Nuance parle alors avec son propre texte. Ce n’est plus la réplique d’Ava. Le mode doit rester un choix visible, défaut Texte d’Ava.
6. **Passage de personnage.** Le fournisseur figé peut laisser Emma « porter » le visage ouvert pour Max. C’est accepté pour ce lot ; il faut le dire dans l’admin, pas le découvrir en jeu.
7. **`IndexPRD4`.** Le branchement au décrochage est le seul point qui peut changer un appel réel. Le reste (normalisation, résolution, libellé) doit être pur et testé sans ouvrir de salle.
8. **Complexité.** Le lien vide doit être une absence, pas un troisième interrupteur à maintenir. Pas de réglage par appareil × personnage × fournisseur dans ce lot.

## 7. Questions encore ouvertes

Opus les pose à Ulrich seulement si l’audit ne peut pas trancher :

1. « M1 » désigne-t-il le lot multilingue, ou Max ?
2. Le premier essai visé est-il bien Max sur une persona Nuance (`sam`, `sonia` ou `mira`), en Texte d’Ava ?
3. Un passage Max → Emma dans le même appel doit-il rester sur la salle déjà ouverte (proposition), ou faut-il exiger le changement de salle dès ce lot ?
4. Si l’appareil impose déjà un fournisseur, ce choix doit-il continuer de gagner (proposition, comme le moteur TTS), ou le personnage doit-il gagner ?

## 8. Ce que l’audit doit rendre

- Le routage proposé est suffisant pour le besoin, ou il manque un cas.
- La liste des régressions ci-dessus est la bonne, ou il en manque.
- Les quatre questions ouvertes : tranchées par le code actuel, ou à poser à Ulrich.
- Un avis clair : on peut coder ce lot tel quel, ou on corrige le plan d’abord.

Aucun code tant que cet avis n’est pas là.
