# Plan — Parole incarnée par personnage (Max, Emma)

## Suite après recette — proposition du 25 octobre 2026

**Statut : lot 3 autorisé et en cours ; lot 4 proposé, hors périmètre.** Le lot 2
est livré par [#75](https://github.com/memoways/ava-proto1/pull/75), main
`5b56c0e987b04caf98f09726dae8ed62bd2d61cc`. Sa recette humaine n'est pas
acceptée. Cette section actualise la suite ; les bilans précédents restent
historiques. [Prompt du premier lot](prompt_reprise_fiabilisation_recette_lot_3.md).

### Ce qui est acquis et ne doit pas être refait

Les quatre compilateurs conservent les unités éditoriales propres à chaque
personnage sous leurs budgets. Le mapping sandbox a été sauvegardé et relu,
version `2026-10-25T11:39:32.000Z`. La session réelle
`abb58e39-763d-465e-baeb-203c3f99bae0` utilise ces protections et Gradium :
il ne faut plus attribuer cet essai à un ancien onglet. Production non publiée.

### Quatre écarts observés

| Point | Preuve et limite | Résultat attendu |
| --- | --- | --- |
| Bug de réponse | T2 : parole ponctuée suivie de `</speech` tronqué ; rejet `Incomplete response sentence or quote`, reproduit localement. Cause amont de la fermeture tronquée inconnue. | Le protocole ne casse pas une parole complète ; les vraies troncatures, citations ouvertes, structures privées et identités étrangères restent refusées. |
| Emma ne prend pas l'appel | T8 : décision périmée ; T9 : `consentRef=currentUserMessage` hors schéma ; T12 : accord délivré rejeté par le veto sur « Non… pas encore ». | Un accord courant réellement livré peut produire l'offre cliquable ; refus, différés et décisions périmées restent bloqués. |
| Parole artificielle | Six des huit réponses livrées déclarent « Bloqué ». Les suspensions deviennent de la ponctuation ; l'acting libre n'est pas envoyé comme émotion Gradium. | Reprises motivées par la pensée et l'émotion, silences irréguliers, diversité justifiée ; aucun bégaiement systématique. |
| Accueil répétitif/sec | `IndexPRD4.tsx` joue `profile.openingLine`, avant toute génération personnage. La session commence par « Bonjour, qu'est-ce qui t'amène à me contacter ? ». | Accueil varié : personnage tiré de ses pensées, surpris, qui rejoint progressivement l'appelant, sans hostilité. |

Les 126 tests existants du parseur/passage passent alors que deux replays
ciblés reproduisent les défauts : le manque porte aussi sur la couverture.
Le validateur de passage n'a pas changé dans #75 ; ne pas présenter toute
la panne comme une régression causée par ce lot.

La télémétrie estime le premier son 4 à 8,7 s après transcription finale.
Elle ne mesure pas isolément la connexion d'Ulrich. Les durées TTS globales
ne sont pas toutes un temps d'attente avant son. La session contient 33
tentatives, 24 annulées avant premier token et 23 interruptions confirmées :
cela explique la nécessité de tester la concurrence, sans prouver un défaut
du détecteur ou du réseau. Aucun chantier mains libres ajouté.

### Lot 3 proposé — réponse sûre et transfert fiable

Deux défauts techniques dans un seul lot, sans toucher au jeu vocal :

1. **Reproduire avant de corriger.** Fixtures minimales de T2/T8/T9/T12,
   sans copie de transcript ou prompt complet. Tester Max → Emma et Emma → Max.
2. **Protocole de sortie.** Empêcher la fermeture parasite dans le contrat.
   Définir explicitement le traitement de son éventuel résidu terminal à EOF :
   seulement une fermeture connue, fin normale confirmée et parole déjà valide.
   Ne jamais convertir une fin SSE `length`, un abandon ou une phrase coupée
   en succès, ni avaler un tag arbitraire. Si cette distinction n'est pas
   démontrable, garder le rejet sûr et corriger l'émission/récupération existante.
   Aucun rejeu après début sonore, aucune répétition d'un segment déjà entendu.
3. **Refus contextualisé.** Corriger le faux veto sur une négation de l'action
   passée suivie d'un accord présent. Ne pas supprimer les vetos de véritable
   refus ou de rétractation (« je te la passe… enfin non »). La preuve GM,
   le reçu et toutes les gardes restent requis ; pas d'autorisation par regex seule.
4. **Référence GM.** Rejouer la référence invalide de T9 : elle doit rester
   invalide. Rendre le contrat compact plus clair sur `speech_N`, avec les
   exemples au bon niveau ; ne pas réparer arbitrairement la réponse du modèle.
   Vérifier tous les prompts publiés effectifs dans le même budget/appel GM.
5. **Résultat tardif.** Rejouer réponse/lecture/GM/nouvelle soumission, y compris
   interruption et reprise. Une décision périmée ne crée pas d'offre. Un accord
   confirmé au tour courant doit pouvoir aboutir sans ressusciter l'ancien.
   Examiner la course de persistance de T8 avant de lui attribuer une cause ;
   ne pas bloquer la voix ou modifier capture/interruptions pour attendre le GM.

**Sortie du lot :** nouveaux replays rouges puis verts sur les défauts corrigés,
contrôles négatifs toujours rouges côté autorisation, tests d'intégration du
vrai évaluateur et E2E de la chaîne jusqu'au clic/connexion dans les deux sens.
`test:quality` et E2E requis ; PR/CI sur HEAD exact, main/CI/E2E, nettoyage de
la seule branche du lot, synchronisation et preview Lovable vérifiées. Une
recette humaine courte de transfert reste distincte. Pas de promesse de naturel
à ce stade. Pas de production. [Détail passage](plan_changement_interlocuteur_manuel.md#suite-de-recette--25-octobre-2026).

### Exécution du lot 3 — 25 octobre 2026

Base `5b56c0e987b04caf98f09726dae8ed62bd2d61cc`, branche unique
`codex/recette-lot-3-safe-response-handoff`. Quatre documents locaux reconnus et
intégrés ; PR étrangère #24 sans recoupement de fichiers, préservée. Identité
GitHub Ulrfis réutilisée (aucune App configurée), Lovable initialement au même SHA.
Workspace Notion vérifié par son ID ; fiche et PRD historiques relus.

**Défauts reproduits avant correction :**

- Parseur + validateur : **4 rouges, 142 verts** par
  `npx vitest run src/services/responseIntentStream.test.ts src/services/characterHandoff.test.ts`.
  Résidu exact T2 rejeté et faux refus T12 symétrique, plus contrat d'émission.
- Véritable évaluateur GM : référence T9 refusée sans raison spécifique et
  annulation pendant persistance classée `persistence_failed`. Deux replays
  supplémentaires d'adaptateurs résolus après annulation, génération/persistance,
  retournaient encore `executed` ; ils échouent avant ajout des barrières.
- Condition différée après suspension : « Je te la passe maintenant… si elle
  accepte. » était acceptée malgré la condition, dans les deux sens ; désormais
  différée. Le choix terminal du joueur « si tu veux » conserve l'accord
  présent et le clic, avec un test symétrique ; il ne dispense jamais des preuves.
  La sélection de preuve des tests est réellement présente, y compris
  dans les rétractations ; ils ne passent pas seulement par preuve manquante.

**Comportement implémenté :**

- Le contrat commun interdit de fermer `<speech>`. Le parseur ne tolère que
  `</speech>` ou le résidu exact `</speech`, exclusivement terminal, après `stop`
  confirmé et `[DONE]` SSE (ou stop batch). Complétude, citations, identité et
  absence de structure restent contrôlées ; aucun retrait arbitraire après `<`.
  EOF sans DONE, raison absente pour ce résidu, length/error/filtrage/outils et
  abandon restent des échecs. Le code ne requalifie pas le reçu historique T2.
- La preuve de fin normale traverse le client, simulateMaxResponse et le vrai
  point d'appel de l'orchestrateur ; tests à toutes les frontières de tokens
  et octet par octet en SSE. Un résidu toléré ne déclenche aucune régénération.
  Après son soumis, les erreurs conservent delivered/uncertain/private sans
  fallback ni répétition. Avant son, la récupération existante reste unique et
  bornée : même tour/contexte, aucun RAG/GM utilisateur supplémentaire.
- Seul le préambule initial « Non… pas encore. », antérieur à la citation exacte
  d'accord courant, est exclu des vetos locaux. Tout le reste est inspecté.
  Aucune autorisation par mot-clé : GM, preuve délivrée, source/cible, tour/version,
  seuil, quota, pause, persistance atomique et clic restent nécessaires.
- Le contrat effectif ajouté après tout prompt, dont v7, exige `speech_N` pris
  dans speechEvidence ; currentUserMessage/openRequest ne sont que les sources
  de demande. T9 reste refusé, sans remapping, avec diagnostic persisté
  `handoff_proof_rejected / consent_reference_invalid`, visible dans Sessions.
- Barrières après génération et après persistance GM : un résultat résolu malgré
  l'annulation ne transmet aucune action. Annulation pendant persistance :
  `parent_aborted`, distinct d'une vraie `persistence_failed`. Un ancien tour
  reste gm_late côté interface/CAS ; un nouvel accord ne reprend pas l'ancien.

**Preuves Cloud minimales relues via MCP Lovable :** T2 `failed`, 0 caractère
confirmé, 137 caractères incertains et suffixe `</speech` ; T8 GM failed /
persistence_failed, audit gm_late, erreur diagnostique absente ; T9 référence
currentUserMessage ; T12 preuve « Je te la passe maintenant. » et faux veto.
Six GM persistés, zéro transfert ; versions de départ confirmées. Le prompt v7
Cloud (10 415 caractères) et la fixture existante ont le même MD5 après retrait
du retour final : 82f57f2ce02633dccb1fbd9f1e01feca. Cause amont de
la fermeture et cause historique précise de l'échec T8 **non établies**. Les
courses corrigées sont reproduites localement, sans attribution au réseau.

**Validation/livraison :** qualité finale verte : lint, types, build,
66 tests régression, 941 unitaires, 41 intégration. **78 E2E complets verts**
sur code final (Chromium, Firefox/WebKit média, 12,7 minutes). E2E v7 batch et Gradium déjà réussis dans les deux sens,
avec résidu T2 et accord T12 jusqu'au clic/connexion, sans partage des confidences.
Bilan final, SHA et liens CI dans la PR de ce lot ; recette humaine restante.
Aucune configuration Cloud, fiche, mapping sandbox, voix, capture, décision mains
libres, modèle, budget 950 ou timeout GM modifiés. GM code version
`gm-2026-10-25-safe-response-handoff`. Pas de production ni de lot 4 commencé.

**Complément CI avant fusion :** premier run
[40200403020](https://github.com/memoways/ava-proto1/actions/runs/40200403020)
rouge : 75 E2E verts, deux échecs et un scénario réussi seulement à la relance.
Traces examinées, sans extrapolation au runtime réel : assertion v7 à
666099,449 ms, CAS awaiting_character à 666170,2 ms (environ 71 ms après) ;
reload du scénario de reprise à 640176,601 ms, écriture GM à 640240,3 ms.
La fin audio, le départ de l'appel GM et networkidle ne prouvent pas sa
persistance. Le test de reprise doit établir l'offre avant de la recharger.
Correction limitée aux attentes E2E : poll de l'état différé réellement persisté,
offre visible/persistée avant reload. Aucun délai ni garde runtime modifié.
Les trois scénarios passent chacun deux fois (6/6, 49,6 s) après cette correction.
Nouveau HEAD et CI exacte à vérifier avant fusion, sans relance aveugle du rouge.

Référence protocole : [OpenRouter — streaming](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/streaming.mdx)
et [finish_reason](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/overview.mdx),
consultés le 25 octobre 2026. Architecture existante réutilisée, aucun nouvel appel
systématique, aucune dépendance ajoutée ; défauts et contrôles reproduits avant fix.

### Lot 4 proposé — accueil et parole vivante

1. **Accueil sans nouvel appel IA.** Petit répertoire éditorial distinct Max/Emma,
   choisi une fois par nouvel appel, sans répéter immédiatement la même entrée
   lorsque plusieurs sont disponibles. Réutiliser le répertoire de transfert/
   retour en préservant ses trois contextes, sans réécrire les fiches Notion.
   Tester plusieurs ouvertures et l'absence de confidence précoce. Un changement
   de script ne suffit pas à valider le ton entendu.
2. **Pensée avant hésitation.** Préserver les mots abandonnés/repris et le non-dit
   de chaque fiche ; éviter l'injection mécanique de « je… je » ou de « euh ».
   Distinguer l'état déclaré/livré de la proposition GM. Diagnostiquer pourquoi
   « Bloqué » domine, sans forcer une rotation ni relabelliser artificiellement
   le reçu. La colère contre soi, la retenue et l'émotion doivent varier avec
   la scène ; Max et Emma gardent leurs cinq états propres.
3. **Pauses Gradium contrôlées.** Vérifier la capacité documentée `break` dans
   l'adaptateur réel, batch et streaming, puis essayer des pauses sobres et
   irrégulières sur un corpus borné. Les contrôles sont créés seulement à la
   frontière TTS après validation ; aucun tag LLM accepté dans la parole.
   Les sous-titres et preuves gardent les mots, aucune pause technique ne devient
   une confidence. Pas de changement de température pour simuler l'émotion.
4. **Écoute courte avant généralisation.** Huit textes proposés : par personnage,
   deux accueils, une reprise interrompue puis continuée, une émotion qui monte
   sans explication psychologique. Comparaison A/B sur quatre textes au plus,
   puis seulement les candidats retenus ; pas de matrice fournisseurs ou de
   session synthétique massive. Réécoute depuis cache et coût visible si connu.
   Ulrich juge mots entendus, tics, pauses, accueil et émotion. Si Gradium ne
   rend pas la voix étranglée crédible, déclarer cette limite et proposer une
   audition séparée, sans changer le fournisseur de jeu ni la production.

**Sortie du lot :** accueil varié testé, rendu batch/streaming cohérent,
sécurité et reçus conservés, réglages sandbox sauvegardés/relus si modifiés,
comparaison audible acceptée puis un parcours Max/Emma. Premier son et latence
voix-à-voix mesurés séparément ; aucune performance revendiquée sans mesures.
[Détail vocal](plan_lot_b_rendu_vocal.md#suite-de-recette--25-octobre-2026).

### Organisation pour éviter de recommencer

- Deux lots, une branche par lot ; livrer le lot 3 avant de commencer le lot 4.
- Pendant la préparation présente : documents locaux seulement, pas de code,
  Cloud, PR ni nouvelle CI. Les documents seront intégrés à la branche du lot 3.
- Lire d'abord les preuves présentes ; nouvelle enquête seulement si l'état a
  changé ou si elle départage une cause encore inconnue. Aucun nouveau contrôle
  de connexion GitHub si l'identité authentifiée existante fonctionne.
- Donner une seule URL de recette avec SHA et environnement vérifiés. Ne pas
  prendre un lien reçu pour une acceptation. Réserver l'écoute humaine aux
  points qu'une simulation ne peut pas trancher.

## Lot 2 — protection effective et Gradium, 25 octobre 2026

Base vérifiée : main `53baa8618eb388714c23612bb7154f5b5cb17491`, PR #74,
CI PR puis main/E2E vertes (runs 40185859015 et 40187022790), Lovable synchronisé
et ready. PR étrangère #24 sans recouvrement, préservée avec toutes ses branches.
Checkout canonique, branche `codex/parole-incarnee-lot-2`, aucun autre agent.

1. Figer comme fixtures les deux fiches éditoriales sandbox lues par MCP Lovable ;
   reproduire les pertes dans les quatre prompts effectifs. La sélection dans
   legacy/rich/optimized existe déjà ; elle ne garantit pas la conservation.
2. Réserver un bloc atomique pour « Manière de parler » intégrale et le paragraphe
   « Ce que tu veux vraiment, sans le savoir », propre à la fiche. Réallouer les
   budgets existants, sans catalogue commun ni réécriture Cloud des fiches.
   La peur de Max pour Emma/Ava, l'amour, le couple et l'identité restent sous
   la surface ; aucune confession parfaitement analysée imposée à l'ouverture.
3. Protéger les suspensions et reprises aux frontières incrémentales, sans
   accepter une réponse tronquée, citation ouverte, structure ou identité étrangère.
   Contrôler déclaration privée, états inconnus, reçus et variété ; vérifier
   séparément le repli neutre temporaire du runtime autorisé.
4. Aucun mapping `ava_speech_performance` présent lors du SELECT initial :
   sauvegarder puis relire seulement sandbox-ulrich avec ses dix états exacts.
   Vérifier paramètres Gradium batch/incrémental et version ; aucune voix prod.
   Documentation officielle relue : padding = rythme, pas pause intra-phrase
   garantie ; aucun tag émotionnel documenté/activé.
5. Tests ciblés avant/après, test:quality, E2E, revue du diff, PR/CI sur HEAD exact,
   squash, CI main/E2E puis suppression de la seule branche du lot. Vérifier
   main/preview Lovable ; recette au casque Max/Emma avec Ulrich distincte des
   simulations. Aucune publication production autorisée.

Sources Gradium : https://docs.gradium.ai/guides/text-to-speech et
https://docs.gradium.ai/guides/voice-settings (consultées le 25 octobre).
Invariants du plan latence conservés : experienceFrame, mémoire privée, capture,
interruptions, mains libres, budget GM, preuve/gardes/clic de passage inchangés.

### Résultats du diagnostic et corrections

- Fixtures : les deux fiches sandbox réellement lues le 25 octobre, sans
  modernisation. Max : Manière de parler 1 835 caractères, moteur intime 765 ;
  Emma : 1 556 et 926. Les cinq noms et descriptions sont vérifiés littéralement
  dans chaque prompt final ; aucun texte de l'autre fiche n'y est injecté.
- Avant : quatre variantes en échec dans le test des prompts effectifs.
  rich_v2 sélectionnait déjà le champ mais son plafond 1 800 coupait Max ;
  priorités/réserve pouvaient omettre des unités. optimized_v3 sélectionnait
  déjà le champ au score 850, mais la déduplication et le budget 4 500 en
  supprimaient des unités. Le moteur intime était aussi éligible à omission.
  compact_v1 n'avait pas ce champ ; legacy pouvait l'évincer derrière la fiche.
- Après : deux unités éditoriales atomiques, réservées avant sélection/déduplication
  dans les quatre chemins ; aucun prompt commun inventé ni fiche Cloud modifiée.
  Les plafonds restent 7 000/12 000 compact, 12 000/18 000 rich,
  4 500/11 000 optimized et 20 000/24 000 legacy. Le header identité/passage
  est désormais déduit du budget statique rich : le test a révélé un dépassement
  réel à 12 892 caractères avant cette comptabilité.
- Les suspensions internes restent avec leur reprise jusqu'à une frontière sûre,
  pour ne pas transformer « Je… je » en deux segments « Je. » / « je » chez
  Gradium. Une suspension terminale ou un tiret volontaire reste possible à EOF,
  mais une phrase non ponctuée, citation ouverte, structure ou identification
  interrompue reste refusée. SSE tronqué reste une erreur ; aucun rejeu après son.
- Contrôles séparés conservés : déclaration privée facultative, état inconnu →
  null, jamais trois propositions identiques, reçu réellement livré avant GM.
  Échec/timeout du réglage autorisé : rugosité 0 pour le seul tour, pas de version
  inventée, réponse tardive ignorée, nouvelle lecture au tour suivant.
- Les suggestions GM ne sont jamais une preuve de l'état joué. Le mapping
  Gradium n'invente pas une émotion audible ; il garde température/voix et module
  le rythme documenté. Diction, naturel et latence réels restent non mesurés.

Confiance avant correction : reproduction rouge, chemins et doublons examinés,
architecture existante conservée, documentation et exemples officiels Gradium
consultés ; aucune dépendance ni appel LLM ajouté.

### Vérifications locales du lot 2

- `npm run test:quality` vert : lint (avertissement useCallback préexistant),
  typecheck, **64 régression, 882 unitaires, 41 intégration**, build.
- `npm run test:e2e` : **72/72 verts**, 10,6 minutes, Chromium et contrôles média
  Firefox/WebKit. Les dernières extensions de la garde de fragments sont couvertes
  par les unitaires et un rejeu E2E ciblé P1 Max/Emma sur le code final.
- Tests rouges avant/après conservés : quatre prompts effectifs en perte avant
  réservation ; contrôles de tiret volontaire et d'identité interrompue en échec
  avant correction. Reprises/suspensions/citations testées à chaque frontière SSE.
- Le SELECT de contrôle et l'admin connecté confirment le mapping activé en sandbox,
  dix états exacts, version `2026-10-25T11:39:32.000Z`. Aucun audio réel généré.
- Recette humaine encore requise : aucun verdict de naturel/diction ni p50/p95
  acoustique. Aucune publication production. La livraison GitHub/CI/Lovable est
  rapportée avec ses identifiants vérifiés dans la PR et le compte rendu final.

Sera aussi enregistré dans `docs/plan_parole_incarnee_personnages.md`.

## Compréhension

- Les fiches Notion de Max et Emma ont été réécrites le 24.10 (même page ID). Les archives en « Backup » ne sont pas synchronisées.
- Aucun prompt commun de « parole » : tout vient de chaque fiche. `experienceFrame` reste limité au cadre de l'appel.
- Nouveau champ « Manière de parler », qui contient la liste « Tes états de parole ».
- Le GM post-tour propose l'état du tour suivant. Le personnage déclare l'état joué dans son en-tête privé.
- Un seul nouveau réglage : la rugosité (0 à 3) par personnage.
- Pas d'appel IA en plus, budget de 45 mots et 220 tokens inchangé, sandbox uniquement.

## Constats et conflits relevés dans le code

1. **sync-notion écrit `environment_id: 'prod'` en dur** (ligne 629). Une synchronisation lancée aujourd'hui pousserait les nouveaux textes **directement en production**, et le nouveau champ serait ignoré.
2. **`speechModes.ts` est du code mort** : seul son test l'importe. Je propose de le supprimer (catalogue codé en dur et propre à Max, contraire à la règle).
3. L'en-tête privé est strict (`{"goal","points"}`, 1 100 caractères maximum). Ajouter `"parole"` (≤ 40 caractères) reste dans la limite, mais un nom d'état inconnu doit être ignoré sans faire échouer le tour.
4. Le GM produit déjà `next_turn_guidance` (texte libre). L'état proposé sera un champ séparé, `next_speech_state`, validé contre la liste du personnage, avec un repli neutre.
5. La règle de variété (jamais trois fois de suite) se calcule localement à partir des traces, sans appel IA.

## Étapes (chacune testable et réversible)

1. **Synchronisation sandbox** : sync-notion reçoit un paramètre `environment_id` (par défaut `sandbox-ulrich` depuis l'admin, `prod` seulement sur choix explicite).
2. **Champ « Manière de parler »** : migration qui ajoute `maniere_de_parler` et `speech_states` (jsonb) à `character_prompts`, plus l'alias Notion. Le service de prompts compile une section dédiée au même rang que les 8 autres. Le champ est éditable dans l'admin.
3. **États de parole** : analyse des lignes `- Nom : description` de la sous-liste « Tes états de parole » pendant la sync, stockage par personnage et affichage en lecture dans l'admin. Un avertissement apparaît si la liste est vide. Suppression de `speechModes.ts`.
4. **En-tête privé** : ajout du champ `"parole"` ; rien n'en sort dans `<speech>` ; la garde d'identité reste inchangée.
5. **GM post-tour** : `next_speech_state` est choisi d'après le sujet, l'émotion et le palier. Le prompt du GM reçoit la liste d'états du personnage actif, l'arc d'espoir par palier, les règles sur la promesse de guérison et sur l'absence de solution, et les interdits (pas de raccrochage spontané, silences autorisés, jamais « suicide » pour Emma). Le JSON reste complet et validé.
6. **Rugosité 0 à 3** dans les réglages personnages : versionnée, épinglée sur la session. Elle module la fréquence des états bloqués et des ruptures et la tolérance au silence, pas les faits. 0 = comportement actuel.
7. **Traces et évaluation** : pour chaque tour, l'état proposé, l'état joué, le palier, l'étape de l'arc et la rugosité. Cinq nouveaux critères dans le banc d'évaluation automatique.

## Quand synchroniser avec Notion

- **Pas maintenant.** Le code actuel écrirait en production et perdrait le nouveau champ.
- **Première synchronisation : après les étapes 1 à 3**, en sandbox-ulrich. Elle apporte les nouveaux textes, « Manière de parler » et les états analysés. On vérifie ensuite dans l'admin les 5 états de Max et les 5 d'Emma.
- Avant cette synchronisation, il faut que le champ « Manière de parler » existe dans la base Notion avec ce nom exact et que les deux fiches actives ne soient pas en « Backup ».
- La production ne sera synchronisée qu'après la recette humaine, sur décision explicite.

## Vérifications

- Tests : analyse des états (formats variés, liste vide), en-tête avec `parole`, parole sans fuite, GM avec état inconnu suivi du repli, règle des trois fois de suite, rugosité 0 identique au comportement actuel.
- Recette humaine en sandbox sur Max et Emma ; surveillance de la latence (médiane ≤ 2 s, p95 ≤ 4 s).

## Questions ouvertes

- Rugosité par défaut : 0 pour Max et Emma (décision d’Ulrich, 24.10, à tester).
- Faut-il plutôt garder la modification manuelle de « Manière de parler » dans l'admin, sachant que la prochaine synchronisation l'écrasera ?

## Avancement (24.10.2026, Lovable)

- Étapes 1 à 3 faites en sandbox : colonnes `maniere_de_parler` et `speech_states` ajoutées, alias Notion « Manière de parler », sync-notion écrit dans l'environnement actif de l'admin (`environment_id`, défaut `prod` pour les anciens appels), états analysés et affichés dans l'admin, `speechModes.ts` supprimé.
- sync-notion déployé le 24.10 (source_sha256 d4d16bc6…cf95d). Synchronisation sandbox « champs seulement » possible.
- Limite : les embeddings RAG restent globaux (non séparés par environnement). En mode `full`, une synchronisation sandbox réindexe le RAG partagé avec la production. Pour la sandbox, utiliser « champs seulement ».
- Étapes 4 à 7 faites le 24.10 (Lovable) : champ `"parole"` dans l'en-tête privé
  (optionnel, ≤40 caractères, jamais diffusé, valeur malformée ignorée) ;
  `next_speech_state` du GM validé contre la liste du personnage (inconnu → null) ;
  rugosité 0–3 dans `character_runtime_profiles.rugosite` (migration
  `character_rugosite`), réglable dans Réglages personnages, épinglée à la session,
  injectée chez le personnage et le GM (0 = rien d'injecté) ; traces de l'état
  proposé, de l'état joué (`speech_state_played` dans le log GM) et de la rugosité.
  `GM_CODE_VERSION` = `gm-2026-10-24-speech-states`. 854/854 tests, build vert.
- Reste : recette humaine en sandbox (tester rugosité 1 à 3 sur Max et Emma) et
  configuration des cinq critères dans le banc d'évaluation automatique.

## Finalisation du lot A — 24.10.2026

- Remplacer la lecture directe du profil protégé par une fonction runtime limitée
  au personnage et à l'environnement autorisés ; ne pas rendre les profils publics.
- Épingler en base la valeur et la version du réglage par session/personnage,
  sans conserver une ancienne valeur entre deux nouvelles sessions.
- Injecter les états dans tous les chemins de prompts, notamment rich_v2,
  sans ajouter de style commun : le contenu éditorial reste celui de la fiche.
- Valider l'état joué, conserver les deux derniers états propres au personnage,
  empêcher une troisième proposition identique et tracer proposition/jeu/palier/arc/rugosité.
- Ajouter les cinq critères au même appel juge, sans nouvel appel IA en jeu.
- Vérifier par tests locaux et lecture authentifiée des réglages, sans session
  ni audio synthétiques ; l'écoute Max/Emma reste une recette humaine.
- Lot B exclu : attendre le texte fourni par Ulrich. Aucune publication production.

### Résultat vérifié

- Fonction runtime appliquée dans Lovable Cloud, colonne de snapshot vérifiée.
- Lecture connectée sans création de session : Max 3 et Emma 2, sans erreur ;
  contrôle affiché dans la preview admin. Aucun niveau sauvegardé modifié.
- 863/863 tests locaux verts, compilation automatique Lovable verte.
- Manquaient réellement : champ éditorial absent de rich_v2/optimized_v3,
  consigne absente de rich_v2/compact, lecture protégée sans accès joueur,
  faux épinglage navigateur, déclaration batch absente, anti-répétition absent,
  traces palier/version incomplètes et cinq critères juge non intégrés.
- Restent : écouter de nouvelles conversations Max/Emma pour juger le naturel
  et mesurer les latences. Pas de conversation synthétique exécutée.
- GitHub main, CI et branches non vérifiables depuis ce sandbox ; ce lot n'est
  pas déclaré livré sur main. Production non publiée. Lot B attend son texte.
