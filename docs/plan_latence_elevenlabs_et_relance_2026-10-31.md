# Mini-plan — latence ElevenLabs et relance conversationnelle

Date : 31 octobre 2026. Statut : R1 choisi par Ulrich et implémenté (voir [Exécution R1](#exécution-r1--31-octobre-2026)) ; L1 non lancé.

Retour de test d'Ulrich (31 oct.) : ElevenLabs sonne bien mieux, mais
1. la latence est nettement supérieure à Gradium ;
2. les répliques semblent tronquées : « il manque une phrase », rien pour rebondir.

## 1. Le grand chantier existe déjà : faut-il le lancer maintenant ?

Source : [plan_pipeline_vocal_streaming_unifie_2026-10-26.md](plan_pipeline_vocal_streaming_unifie_2026-10-26.md)
(pas de tâche Notion dédiée trouvée dans Gamilab). 6 étapes : contrat `UnifiedTTSStream`,
lecteur Web Audio, banc streaming, WebSocket Fish, encapsulation Gradium + ElevenLabs,
intégration orchestrateur, recette.

**Ce que le code dit aujourd'hui (le plan est en partie dépassé) :**

- Le diagnostic « attente de tout le LLM puis de tout le TTS » n'est plus vrai pour
  Gradium : `streamPRD4Turn` émet déjà des segments au fil du LLM, consommés par
  `prepareStreamedVoiceTurn` (`src/services/streamedVoiceTurn.ts`).
- Ce chemin incrémental est **verrouillé sur Gradium** :
  `src/pages/IndexPRD4.tsx:1505-1507` (`=== 'gradium'`). C'est la cause principale
  de l'écart ElevenLabs/Gradium.
- Pour ElevenLabs, le jeu attend donc la réplique complète, puis
  `providers/elevenlabs.ts` fait `response.blob()` : **tout le MP3 est téléchargé avant
  la première syllabe**, alors que `proxy-tts` relaie déjà le flux `/stream` d'ElevenLabs
  en chunked. Aucun `createStreamingPlayback` pour ElevenLabs (seul Gradium en a un).
- Modèle : v4 / v3 (expressifs) sont les plus lents et refusent le stitching
  (`previous_text`/`next_text`) et `optimize_streaming_latency`. Le catalogue propose
  `eleven_v4_turbo` et `eleven_v3_conversational`, annoncés rapides, avec balises audio.

**Recommandation : ne pas lancer le chantier universel en entier maintenant.**
Lancer un lot borné **L1 « ElevenLabs réactif »** qui en est la première tranche utile,
sans refonte de tous les fournisseurs :

| Étape | Contenu | Coût |
|---|---|---|
| L1.0 | Mesure : décomposer un tour EL (1er token LLM, LLM fini, 1er octet TTS, blob fini, 1er son) à partir des traces existantes ; comparer v4 / v4 Turbo / v3 Conversational / Flash dans l'atelier | faible, zéro risque |
| L1.1 | Lecture progressive du MP3 EL (`createStreamingPlayback` via MediaSource, repli blob) | moyen |
| L1.2 | Ouvrir le chemin incrémental à ElevenLabs (segments LLM → TTS au fil de l'eau), premier segment court | moyen, risque prosodie |
| L1.3 | Recette réelle sandbox, Max, 5 tours ; non-régression Gradium | humain |

Le gain attendu le plus sûr vient de L1.0 (choix du modèle) + L1.1 (ne plus attendre le
MP3 complet). L1.2 n'est fait que si L1.0/L1.1 ne suffisent pas : avec v3/v4 sans stitching,
découper en phrases expose au « prosody cliff » décrit dans le grand plan. Le WebSocket
`stream-input` d'ElevenLabs et sa compatibilité avec v3/v4 sont **à vérifier dans la doc
officielle** avant tout choix ; je ne l'affirme pas.

Le contrat unifié, Fish WebSocket et Inworld/Cartesia restent dans le grand plan, à
reprendre après L1 si Fish redevient un candidat.

## 2. Répliques trop courtes : la cause est dans le code

Trois contraintes s'empilent :

1. `src/services/responseIntentStream.ts:8-15` — `buildResponseStreamContract` impose
   « Limite du discours : **45 mots maximum** » (`Math.min(45, …)`), et ajoute « La pensée
   peut rester ouverte… fragments, suspensions… **sans explication ni conclusion ajoutée** ».
   C'est exactement l'effet « il ne dit pas tout ».
2. `src/services/settingsService.ts:659` — `responseStyle` par défaut : « 1 à 2 phrases
   (45 mots maximum) … Tu ne termines PAS chaque réponse par une question ».
   Peut être surchargé par Notion / admin_settings : **vérifier la valeur effective**.
3. `src/services/settingsService.ts:213,296` — `LLM_MAX_TOKENS` plafonné à 220 en dur,
   JSON d'intention compris.

La consigne actuelle interdit la question réflexe mais ne donne rien à la place.
Il faut une **« accroche »** : une phrase de plus qui laisse un fil (un détail concret
non expliqué, une réaction, une hésitation qui appelle la suite), sans question obligatoire.

Lot **R1 « Relance conversationnelle »** : passer à ~2–3 phrases / ~60–70 mots, ajouter
la règle d'accroche dans le contrat et le style, relever le plafond de tokens en cohérence,
garder l'interdiction de la question systématique. Mesurer sur des répliques de test avant /
après (LLM-as-judge existant ou relecture d'Ulrich).

## 3. Ordre conseillé

1. **R1 d'abord** : petit, surtout du prompt, fort effet sur l'usage.
2. **L1 ensuite.** Attention : R1 rallonge les répliques, donc **augmente la latence
   ElevenLabs** tant que le MP3 est attendu en entier. L1.1 compense directement cela.

Prompts de reprise :
[R1](prompt_reprise_relance_conversationnelle_lot_r1.md) ·
[L1](prompt_reprise_latence_elevenlabs_lot_l1.md).

## Exécution R1 — 31 octobre 2026

### Valeur effective vérifiée (avant changement)

| Source | Ce qui s'appliquait vraiment |
|---|---|
| Variante de prompt (`admin_settings`, sandbox-ulrich et prod) | `optimized_v3` |
| Contrat `optimized_v3` | « Une à trois phrases ou fragments suffisent généralement » |
| Contrat de flux (`buildResponseStreamContract`) | **45 mots maximum** + « sans explication ni conclusion ajoutée » : c'était la contrainte la plus forte |
| `LLM_MAX_TOKENS` (`admin_settings`, sandbox et prod) | 220 enregistrés, plafond code 220 |
| `responseStyle` (Max Prompt Control) | **jamais injecté dans le prompt live** : réglage d'admin seul, prod contient un texte d'avril « 2 à 3 phrases » |
| Notion Gamilab, Max, « Identité fondamentale » | « une à trois phrases parlées, **souvent moins**. Une réponse peut tenir en trois mots » |
| Notion Gamilab, Emma, « Identité fondamentale » | « une à trois phrases parlées. Une question quotidienne appelle une réponse brève » |

Notion ne surcharge pas le code : le plafond de 45 mots tronquait en pratique même
la latitude « jusqu'à cinq phrases » et le récit développé (quinze phrases) prévus par
les fiches. La fiche de Max tire cependant vers le très bref ; proposition ci-dessous.

### Changements

- Règle partagée `src/agents/responseHook.ts` (`RESPONSE_HOOK_RULE`) dans les quatre
  variantes (legacy, compact_v1, rich_v2, optimized_v3) : deux à trois phrases, ~60–70 mots,
  plus bref seulement si la relation l'exige ; **accroche** = livrer d'abord le contenu,
  puis un détail concret non expliqué, une réaction ou un fil ouvert, appuyés sur la fiche,
  sans inventer ; « ce n'est pas une question ». Trois exemples de forme, construits sur le
  présent canonique partagé (police qui ne rappelle pas), marqués « pas des faits ».
- Contrat de flux : limite `min(70, (budget − 70) / 3)` mots ; « Livre d'abord le contenu de
  ta réplique ; ensuite seulement, la pensée peut rester ouverte » ; « Termine sur une
  accroche…, pas sur une question réflexe ». Fragments et suspensions d'A1 conservés.
  En petit budget (< 50 mots), pas de cible de trois phrases.
- `LLM_MAX_TOKENS` des personnages borné à **[360, 480]**, défaut 360 (JSON d'intention
  ~70 tokens + ~70 mots parlés). Les 220 enregistrés en base sont relevés à 360 à la lecture,
  sans migration ni écriture DB, comme le plancher GM à 950. Curseur admin aligné.
- `responseStyle` par défaut réécrit dans le même sens (reste non injecté en live).
- Correctif trouvé en route : `capAtBoundary` (optimized_v3) pouvait rendre « … » seul quand
  il ne restait presque plus de place ; la section était alors ajoutée avec son titre et le
  prompt dépassait sa limite (~30 caractères). Section désormais omise.

### Proposition Notion (non appliquée, édition d'Ulrich)

Max, propriété « Identité fondamentale », 2e paragraphe. Remplacer :

> Par défaut, tu réponds le plus souvent en une à trois phrases parlées, souvent moins. Une réponse peut tenir en trois mots, ou en un silence suivi d'un « bon ». Un souvenir précis peut demander jusqu'à cinq phrases courtes.

par :

> Par défaut, tu réponds en deux à trois phrases parlées : tu dis ce que tu as à dire, puis tu laisses un détail, une réaction ou un fil ouvert auquel l'autre peut se raccrocher. Une réponse très brève (trois mots, un silence suivi d'un « bon ») reste possible quand la question te coupe. Un souvenir précis peut demander jusqu'à cinq phrases courtes.

Emma : compatible en l'état (« une à trois phrases ») ; même alignement possible plus tard.
Après édition, la synchronisation Notion → Lovable reste à confirmer par Ulrich (AGENTS).

### Effet latence

Une réplique de ~70 mots au lieu de ~45 est ~50 % plus longue à synthétiser. Tant que
L1 n'est pas fait, ElevenLabs attend le MP3 complet : **l'attente avant la première syllabe
augmente d'autant**. Gradium (chemin incrémental) n'est presque pas touché : il commence
sur la première phrase. L1.1 (lecture progressive du MP3) compense directement.
