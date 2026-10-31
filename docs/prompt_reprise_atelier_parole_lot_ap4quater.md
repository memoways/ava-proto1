# Ava — AP4-quater : fournisseurs qui échouent, voix trop lentes et trop « lues »

Exécute uniquement AP4-quater, dans un chat neuf. Prompt préparé le 30 octobre
2026 après l’essai d’Ulrich sur main `d5dd517` (AP4-ter fusionné par #116). Il ne
lance rien. AP5 (comparaison avec les voix custom de Max) reste en attente.
Les jugements d’Ulrich à l’oreille priment : une CI verte ne prouve ni la
crédibilité vocale ni la disparition d’un échec fournisseur.

## Retour d’Ulrich (30 octobre, après #116)

1. Capture de l’atelier (passage P2, « Très dramatique ») :
   - **ElevenLabs · eleven_v4** : « ElevenLabs TTS error: 400
     (unsupported_model) ». Le bug n’est donc pas réglé, ou `eleven_v4` n’existe
     pas / n’est pas ouvert sur le compte, ou `proxy-tts` n’est pas redéployé.
   - **Gradium** : « tts_gradium_blob timed out after 12000ms », alors qu’il
     marchait avant.
   - **Inworld** : ne fonctionne toujours pas (bouton « Arrêter » affiché,
     génération qui ne rend rien).
2. **Fish et Inworld sont « horribles » : beaucoup trop lents, pâteux,
   « comme bourré, anesthésié ». Quel que soit le réglage, c’est toujours la
   même voix.** Il faut voir ce qui est réglable pour que les intentions
   émotionnelles s’entendent vraiment.

## Notes et avis déjà enregistrés (lus en base, `sandbox-ulrich`)

Source : `admin_settings`, clé `speech_workshop_documents`, `environment_id =
sandbox-ulrich`, champ `intentTrials` (4 essais). Relire avant d’agir (lecture
seule via le MCP Lovable Ava). Tous les essais sont sur Max.

| Intention (passage) | Gradium | Fish s1 | ElevenLabs | Inworld | Cartesia |
|---|---|---|---|---|---|
| Moyennement dramatique (P1) | 3 | — | — | — | — |
| Très dramatique (P2, voix du jeu) | **1** | — | — | — | — |
| Perdu (P3) | 3 | 2 | sans note (v3 en échec) | 2 | 3 |
| Très dramatique (P2, catalogue) | 3 | 2 | sans note | 2 | 3 |

Avis (« ce qui est off ») à reprendre mot pour mot dans l’analyse :
- Gradium : « trop parfait, on ne sent pas du tout l’émotion, la charge
  émotionnelle, cela doit être bien plus dramatique » (note 1) ; « trop
  linéaire et trop bien dit, comme un acteur qui lit son texte, plus cassé,
  plus surprenant, plus émotionnel » ; « pas assez d’hésitations, il lit
  littéralement un texte, plus de variations de rythme, il cherche ses mots ».
- Fish : « toujours la même voix pâteuse, comme bourré, non plus varié » ;
  « comme bourré, anesthésié, plus varié au niveau rythmes et plus normal pour
  la diction ».
- Inworld : « bien trop lent, affreux, il faut plus de cassures et variations » ;
  « ça traîne trop, trop monocorde, plus varié et cassé, plus de surprises, la
  voix est trop pâteuse ».
- Cartesia : « trop linéaire et trop lu, plus cassé et variable, émotionnel
  cassé » (note 3, la meilleure avec Gradium).

Constat commun : tout est **trop lent, trop linéaire, trop « bien dit »**.
Ulrich veut des ruptures, des hésitations, des variations de rythme, de la
surprise, un texte qui n’a pas l’air lu.

## Diagnostic déjà fait (à confirmer, pas à refaire en entier)

Mesures de `evidence` (requêtes REST, texte de 400 à 550 caractères) :

| Fournisseur | 1er octet | Durée de génération | Durée du son |
|---|---|---|---|
| Gradium (WAV) | 10–12 s | 10–12 s | 19–23 s |
| Fish s1 | 1 s | 5,9 s | 22–24 s |
| Inworld | 7–9 s | 7–9 s | **41 s** |
| Cartesia | 0,6 s | 3,3 s | 25–26 s |

- **Timeouts.** Les trois providers REST ont un délai fixe de 12 s
  (`gradium.ts` lignes 102 et 123, `inworld.ts` 46 et 64, `fish.ts` 45 et 63).
  Gradium rend le blob WAV complet en 10–12 s pour un passage d’atelier : il
  est à la limite, et un jour un peu plus lent il échoue. Ce n’est pas une
  régression du code d’AP4-ter, c’est un seuil prévu pour de courtes répliques
  de jeu, appliqué à des passages de 500 caractères. Inworld est à 7–9 s
  avant même la fin du corps : le même mécanisme le fait échouer, et l’UI reste
  bloquée sur « Arrêter ».
- **Lenteur.** `speedHint` vaut 0,88 pour « Très dramatique » et « Perdu »,
  0,92 pour « Moyennement dramatique », et il est appliqué à **tous** les
  fournisseurs (Fish `speed` 0,88, Inworld `Débit` 0,88, Cartesia 0,88,
  ElevenLabs 0,88). Inworld produit 41 s pour 530 caractères contre 22–26 s
  ailleurs : ralentir un modèle déjà lent donne la voix pâteuse. Les
  recettes « Posé », « Très dramatique », « Perdu » pilotent toutes « lent »
  alors qu’Ulrich réclame plus de rythme et de cassures.
- **« Toujours pareil ».** Les paramètres réellement appliqués sont presque
  identiques d’une intention à l’autre : Fish `temperature` 0,7 / `topP` 0,7
  fixes, Inworld `temperature` 0,7 fixe (seuls mode et instruction changent),
  Cartesia ne reçoit que volume et vitesse (émotion ignorée en français),
  Gradium ne fait varier que `temp` (0,74–0,78) et `padding_bonus` (0,7). Il
  n’y a quasiment aucun levier d’émotion réellement transmis.
- **ElevenLabs.** `eleven_v3` n’a jamais produit de son : aucune note.
  Après #116, `eleven_v4` répond encore 400. Hypothèses à départager par une
  preuve : (a) `proxy-tts` non redéployé par Lovable ; (b) `eleven_v4` n’est
  pas un identifiant accepté par ce compte ; (c) autre paramètre refusé
  (`language_code`, `seed`, `apply_text_normalization`, `voice_settings`).
  Le client n’affiche que « 400 (unsupported_model) » : le message complet
  d’ElevenLabs est dans le corps de la réponse (`details`), pas dans la carte.

## Périmètre

1. **Preuve d’abord, une fois.**
   - Vérifier par le MCP Lovable Ava que `proxy-tts` déployé contient #116
     (`elevenLabsModels`), sans rien modifier.
   - Obtenir le **corps exact** de l’erreur ElevenLabs et la liste des modèles
     accessibles (`GET /v1/models` côté serveur, via une action
     d’administration de `proxy-tts` réservée aux admins, ou un essai minimal).
     Ne jamais exposer la clé. Choisir `eleven_v4`, `eleven_v3` ou un autre
     modèle **d’après cette liste**, pas la doc. Si `eleven_v4` n’existe pas,
     le retirer de la liste et du défaut.
   - Afficher dans la carte le message du fournisseur (court, sans secret),
     pas seulement le code, pour qu’un échec soit lisible sans les logs.
2. **Gradium et Inworld doivent de nouveau jouer.**
   - Délais adaptés aux passages longs (par exemple selon la longueur du texte
     ou un délai d’atelier plus large), sans toucher aux délais du jeu en
     direct. Préférer, si le fournisseur le propose, un transport en flux
     plutôt qu’un blob complet pour l’atelier.
   - Diagnostiquer Inworld précisément : requête, réponse, voix, modèle,
     jeton, format audio, première réponse. Ne pas supposer que c’est le délai
     avant de l’avoir mesuré. Le bouton « Arrêter » ne doit jamais rester
     affiché après un échec : l’état doit revenir et l’erreur s’afficher.
   - Une génération échouée ne doit pas empêcher les autres cartes ni la
     sauvegarde de l’essai.
3. **Intentions plus vivantes, par fournisseur (cœur du lot).**
   - Revoir les recettes d’intention : ne plus ralentir systématiquement
     (0,88 → proche de 1, voire plus rapide avec pauses) ; remplacer « lent »
     par ruptures, hésitations et variations de rythme. Le débit ne doit pas
     être le même pour tous : un fournisseur déjà lent (Inworld 41 s) ne
     reçoit pas de ralentissement.
   - Pour chaque fournisseur, chercher dans sa documentation actuelle les
     leviers d’expressivité **réellement transmis** et les rendre visibles
     dans la carte : Fish (`temperature`, `topP`, marqueurs d’émotion et de
     rupture, `chunk_length`, latence), Inworld (`temperature`, mode
     `CREATIVE`, instruction, balises éventuelles), Cartesia (émotion hors
     anglais, `generation_config`), Gradium (`temp`, `padding_bonus`, balises
     de pause, texte réécrit avec hésitations), ElevenLabs (stabilité basse,
     style haut, balises audio, `[pause]`).
   - Le texte lui-même peut porter le jeu : variantes de ponctuation et de
     coupures (« … », phrases brisées, reprises) appliquées **seulement dans
     l’atelier**, visibles et désactivables, jamais dans le prompt GM ni les
     fiches Notion. Proposer à Ulrich avant de généraliser.
   - Faire varier réellement les paramètres entre intentions (l’écart entre
     « Posé » et « Très dramatique » doit s’entendre) et le montrer dans le
     plan de carte.
   - Ne pas conclure sans écoute : produire un petit jeu d’essais A/B (ancien
     réglage / nouveau réglage) à faire noter par Ulrich de 1 à 5, sur P2
     « Très dramatique » et P3 « Perdu », avec l’avis libre habituel.
4. **Documents** : plan (section AP4-quater dans
   `docs/plan_lot_b_rendu_vocal.md`, avec le tableau des notes ci-dessus),
   CHANGELOG, `docs/etat_courant.md`, prompt AP5 actualisé.

## Invariants

- Inchangés : fiches Notion, prompt GM, modèle/température LLM, mapping des
  états, budget, capture/STT, interruptions/mains libres, transferts, voix et
  fournisseur du jeu (hors enregistrement explicite dans TTS Config), délais
  de la voix en direct du jeu.
- Secrets côté serveur uniquement ; aucune clé dans le client, les logs ou
  les documents. Aucune migration. Pas de `.env`. Aucun audio durable. Aucun
  juge LLM. Gami DigiDouble exclu, aucun animal affiché.
- Lovable est la seule chaîne Cloud et de déploiement (Edge Functions comprises) ;
  vérifier le déploiement avant de déclarer un bug corrigé. Production non
  publiée sans autorisation. Pas de lancement automatique d’AP5.
- GitHub : voie décrite dans AGENTS.md (App directe, `gh` via
  `github-delivery-exec`, 1Password en secours, aucun Trousseau). Un seul
  agent actif ; PR #24 préservée.
- Les notes et avis d’Ulrich sont une donnée de décision : ne pas les
  réécrire ni les supprimer. Les essais existants restent lisibles.

## Validations

- Unitaires : délais et états d’erreur de chaque provider (échec propre,
  « Arrêter » retiré), plan de carte par fournisseur et par intention,
  débits qui ne ralentissent pas un fournisseur déjà lent, message d’erreur
  fournisseur sans secret, liste de modèles ElevenLabs conforme au compte.
- E2E `speech-workshop.spec.ts` : un fournisseur qui échoue n’empêche pas les
  autres cartes ni l’enregistrement ; erreur lisible.
- `npm run test:quality` et `npm run test:delivery` verts avant le push (si
  l’intégration expire, relancer avec `--hookTimeout=90000 --testTimeout=90000`
  : base embarquée lente au démarrage, déjà constaté).
- **Recette humaine distincte** : après déploiement Lovable, Ulrich rejoue
  P2 « Très dramatique » et P3 « Perdu » sur les cinq cartes. Critères : chaque
  carte joue sans échec ; Fish et Inworld ne sont plus pâteux ni traînants ;
  les intentions s’entendent ; notes de 1 à 5 supérieures à celles du tableau.
  Le résultat se mesure à l’oreille, pas à la CI.

## Livraison

- Une CI sur la PR, HEAD exact contenant main à jour ; fusion uniquement par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`
  (via `github-delivery-exec`), puis arbre et parent vérifiés. Supprimer notre
  seule branche, vérifier Lovable synchronisé et `proxy-tts` déployé.
- Notion : relire la tâche Gamilab
  https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d, ajouter la
  section AP4-quater avec « Last updated by », relire l’écriture.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. `git status`, AGENTS.md, `docs/etat_courant.md`, début du CHANGELOG,
   sections AP4, AP4-bis et AP4-ter du plan.
2. Chats actifs, remote unique, branches et PR, `git fetch --prune`, main à
   jour par pull ff-only. Reprendre la branche locale
   `claude/ap4-quater-voix-expressives` (ce prompt seul, aucun code).
3. Relire les essais en base (requête en lecture seule ci-dessus) pour
   confirmer le tableau, puis vérifier le déploiement de `proxy-tts`.
4. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Règle de travail (demande d’Ulrich)

À chaque nouveau lot, après le diagnostic et **avant tout code**, rédiger le
prompt de reprise pour un chat neuf, le donner à Ulrich et s’arrêter. Ici le
diagnostic est fait : commencer par la preuve (étape 1 du périmètre), puis
coder.

## Clôture obligatoire

Dans le même tour, actualiser `docs/prompt_reprise_atelier_parole_lot_ap5.md`
(état vérifié, fournisseurs réellement fonctionnels, réglages retenus), donner
son lien sans lancer AP5. Si AP4-quater reste incomplet, enregistrer la reprise
exacte et l’unique action humaine indispensable. Le bilan indique
PR/SHA/CI/arbre/parent, l’état du déploiement de `proxy-tts`, les branches
restantes, et rappelle que la production n’est pas publiée.
