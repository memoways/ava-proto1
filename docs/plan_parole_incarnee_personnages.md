# Plan — Parole incarnée par personnage (Max, Emma)

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

- La rugosité par défaut est-elle 0 pour les deux personnages ?
- Faut-il plutôt garder la modification manuelle de « Manière de parler » dans l'admin, sachant que la prochaine synchronisation l'écrasera ?

## Avancement (24.10.2026, Lovable)

- Étapes 1 à 3 faites en sandbox : colonnes `maniere_de_parler` et `speech_states` ajoutées, alias Notion « Manière de parler », sync-notion écrit dans l'environnement actif de l'admin (`environment_id`, défaut `prod` pour les anciens appels), états analysés et affichés dans l'admin, `speechModes.ts` supprimé.
- sync-notion n'est pas encore redéployé ; la synchronisation sandbox attend ce déploiement.
- Limite : les embeddings RAG restent globaux (non séparés par environnement). En mode `full`, une synchronisation sandbox réindexe le RAG partagé avec la production. Pour la sandbox, utiliser « champs seulement ».
- Étapes 4 à 7 restent à faire.
