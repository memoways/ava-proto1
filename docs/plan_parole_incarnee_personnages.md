# Plan — Parole incarnée par personnage (Max, Emma)

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
