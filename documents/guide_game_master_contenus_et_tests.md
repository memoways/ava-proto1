# Guide complet — Contenus, prompts, paramètres et plan de test du Game Master

> Document de travail pour remplir, calibrer et tester la mécanique du Game Master de "Parle à Max" (prototype 1 — univers *Où est Ava ?*).
> Public : Product, narratif, dev. Source de vérité narrative : Notion (4 bases AVA). Source de vérité technique : panneau Admin de l'app (`/admin`).

---

## 0. Comment lire ce document

Ce guide te permet de :
1. **Comprendre** quels textes / prompts / variables existent et à quoi ils servent.
2. **Remplir** chaque champ avec un contenu de départ utilisable immédiatement.
3. **Tester** la mécanique en variant les paramètres de manière structurée (matrice de tests).
4. **Décider** : pour chaque paramètre, on identifie la *question de principe* à trancher et les *critères* qui permettent de la trancher.

Convention :
- 🧠 = paramètre éditorial / narratif (vient de Notion)
- ⚙️ = paramètre technique / gameplay (admin app)
- 🎚️ = paramètre à faire varier dans les tests
- ❓ = question de principe à trancher après tests

---

## 1. Cartographie : où est quoi ?

### 1.1 Les 4 bases narratives Notion (source éditoriale)

| Base Notion | Contient | Utilisé par |
|---|---|---|
| 🐼 Base Caractères AVA | Fiches personnages (Max, Ava, Léo, Emma…), prompts personnages, ton, backstory | RAG → prompt Max |
| 📦 Storyworld AVA | Univers, lieux, thématiques, secrets, vérité narrative | RAG → prompt Max + Game Master |
| 🎮 Gameplay AVA | Étapes du jeu, conditions de progression, gates | Référence pour calibrer le GM |
| 🎬 Vidéos AVA | Catalogue triggers vidéo, thèmes de déclenchement, contexte post-vidéo | Table `video_triggers` + GM |

> ⚠️ Tout ce qui vient de Notion est synchronisé vers Supabase + embeddings pgvector. **Les system prompts locaux édités dans `/admin` ne doivent jamais être écrasés par la sync Notion** (rappel mémoire projet).

### 1.2 Les 6 zones de configuration dans l'app `/admin`

| Onglet `/admin` | Ce qu'on y règle | Persistence |
|---|---|---|
| **LLM Config** | Modèle / temperature / max_tokens pour Max ET pour le Game Master (séparés) | `admin_settings` DB |
| **Voice Config** | Voix Max (ElevenLabs), STT Deepgram | `admin_settings` DB |
| **Max Prompt Control** | Identité de Max en 9 blocs (persona, objectifs, style, politique de vérité…) | `admin_settings` DB |
| **Game Master Config** | Modes de parole, seuils gameplay, **2 prompts GM** (system + pre-turn), triggers vidéo | `admin_settings` DB |
| **Anti-hallucination Validator** | Faits autorisés globaux + règles de blocage avant TTS | `admin_settings` DB |
| **Pipeline Trace + Latence & blocage** | Lecture seule — diagnostic post-session | DB sessions |

---

## 2. Architecture du Game Master à connaître avant de remplir

Le GM intervient à **3 moments** d'un tour de conversation :

```
Utilisateur parle
   └─► RAG (récupère contexte narratif autorisé)
        └─► [1] GM PRE-TURN PLANNER  ← produit un BRIEF JSON pour cadrer Max
              └─► Max génère sa réponse sous contraintes
                   └─► [2] VALIDATEUR anti-hallucination (avant TTS)
                        └─► TTS lit la réponse
                             └─► [3] GM POST-TURN SCORER ← trust_delta, triggers, game_over
```

**À retenir** :
- Le **pre-turn planner** est ce qui donne du contrôle éditorial fin (mode de parole, reveal_budget, faits autorisés). C'est *le* levier narratif principal.
- Le **post-turn scorer** est l'ancien GM : il juge après coup et pilote la progression (trust, triggers, game_over).
- Le **validateur** est un garde-fou anti-invention : il peut forcer une régénération.
- En cas de timeout (>4 s) ou d'erreur LLM sur le pre-turn → **fail-soft** vers un brief par défaut prudent.

---

## 3. Remplir les contenus narratifs (côté Notion → RAG)

### 3.1 🧠 Fiche Max (Base Caractères AVA)

**Pourquoi** : c'est la matière première pour le RAG et pour la cohérence de Max. Sans elle, Max invente.

**À écrire dans Notion** (1 page Max) :

| Section | Contenu attendu | Longueur cible |
|---|---|---|
| Identité | Nom, âge, métier, situation actuelle (post-pandémie Protogyny, recherche d'Ava) | 3-5 lignes |
| Voix & ton | Comment il parle : registre, lexique, rythme, tics, ce qu'il évite | 5-10 lignes |
| Backstory factuelle | 8-12 faits courts, datés si possible, classés `certain` / `probable` / `inconnu` | Liste à puces |
| Relation avec Ava | Liens, conflits, derniers contacts, ce qu'il sait / ne sait pas / soupçonne | 8-12 lignes |
| Zones d'ombre | Sujets que Max esquive, refoule, ou refuse d'aborder tant que la confiance n'est pas là | 5-8 lignes |
| Ce qu'il veut obtenir du joueur | Objectif sous-jacent (chercher de l'aide, tester, se confier, manipuler, etc.) | 3-5 lignes |

**Hypothèses à tester** :
- 🎚️ Plus la backstory est *segmentée par certitude*, plus le RAG produit du contexte propre.
- ❓ Faut-il une seule fiche Max longue ou plusieurs fiches thématiques (famille, travail, Ava, soi) ?

### 3.2 🧠 Storyworld minimal (Base Storyworld AVA)

Cibler **5 entrées courtes** pour démarrer :

1. **Le virus Protogyny** — origine, effets, état du monde, date.
2. **La disparition d'Ava** — quand, où, dernier signe de vie connu, hypothèses.
3. **Lieux clés** — appartement, lieu de la disparition, lieu de l'appel.
4. **Personnages secondaires mentionnables** — Léo, Emma (cibles de la gate), entourage proche.
5. **Vérités cachées** — la "bible factuelle" de l'enquête, classée par niveau de révélation autorisé (jamais / après gate / fin de partie).

> Règle d'or : tout ce qui est dans Storyworld peut potentiellement remonter dans le RAG → **ne jamais y mettre de spoiler narratif sans l'étiqueter explicitement** (`révélation: post_gate`, `révélation: jamais`, etc.).

### 3.3 🧠 Triggers vidéo (Base Vidéos AVA → table `video_triggers`)

Pour le proto, viser **3-5 triggers** suffisants pour valider la mécanique.

| Champ | Exemple |
|---|---|
| `id` | `trigger_famille` |
| `title` | "Flashback enfance d'Ava" |
| `type` | `mid_conversation` (ou `intro`, `interlude`) |
| `themes` | `["famille", "enfance", "parents"]` |
| `placeholder_text` | "[Vidéo : Max et Ava, été 2008, terrain vague]" |
| `priority` | 1-5 (en cas de conflit) |
| `transition_style` | `fade_to_black` / `cut` |
| `post_video_context` | "L'utilisateur vient de voir un flashback de l'enfance d'Ava. Max peut y faire référence si la conversation s'y prête, sans le forcer." |
| `duration_seconds` | 10 |

**3 triggers de départ recommandés** :
- `trigger_famille` — thèmes famille / parents / enfance.
- `trigger_secret` — thèmes secret / mensonge / vérité cachée.
- `trigger_disparition` — thèmes disparition / dernier contact / recherche.

❓ Question de principe : combien de triggers faut-il pour qu'une session de 10 min paraisse riche sans devenir un tunnel ? (cf. § 6 plan de test).

---

## 4. Remplir les paramètres `/admin` (côté technique)

### 4.1 ⚙️ Réglages de jeu (`GameMasterConfigTab` → "Réglages de jeu")

| Paramètre | Défaut actuel | Plage utile | Effet | Question à trancher |
|---|---|---|---|---|
| `TRUST_THRESHOLD` | 10 | 5–15 | Trust à atteindre pour ouvrir la gate (Léo/Emma) | ❓ Combien d'échanges sincères faut-il pour que la gate soit *méritée* sans être frustrante ? |
| `TIMEOUT_SECONDS` | 600 (10 min) | 240–900 | Durée max d'une session avant `game_over` | ❓ 10 min est-il le bon format perçu (cf. mémoire projet : "10-min sessions") ? |
| `MAX_INSULT_TOLERANCE` | 1 | 0–3 | Nb de propos inappropriés avant `game_over` | ❓ Tolérance zéro vs. un avertissement avant game_over ? |
| `MIN_QUESTIONS_BEFORE_GATE` | 10 | 5–20 | Plancher d'échanges même si trust suffisant | ❓ Empêche-t-on un "speedrun" du jeu ? À quel coût narratif ? |
| `RAG_TOP_K` | 5 | 3–10 | Nb de passages RAG injectés dans le prompt | ❓ Plus de RAG = plus de cohérence mais + de tokens et + de latence. Sweet spot ? |
| `VIDEO_PLACEHOLDER_DURATION` | 10 s | 5–30 | Durée affichage placeholder vidéo | ❓ Quelle durée donne l'illusion d'une vraie cinématique sans casser le rythme ? |

### 4.2 ⚙️ Réglages LLM (onglet LLM Config)

Deux moteurs, deux profils.

**Max (conversationnel, créatif, oral)**
| Param | Défaut | Recommandation test |
|---|---|---|
| `LLM_MODEL` | `qwen/qwen-2.5-72b-instruct` | Tester aussi `claude-sonnet-4`, `grok-3-mini-beta`, `gemini-2.5-flash` |
| `LLM_TEMPERATURE` | 0.8 | 0.6 (plus sec, plus contrôlé) ↔ 0.95 (plus humain, + d'invention) |
| `LLM_MAX_TOKENS` | 500 | 200 si on veut forcer la brièveté orale |
| `LLM_TOP_P` | 0.95 | Garder par défaut au démarrage |

**Game Master (JSON déterministe, pas créatif)**
| Param | Défaut | Recommandation test |
|---|---|---|
| `LLM_MODEL_GM` | `google/gemini-2.0-flash-001` | Tester `gpt-4o-mini`, `llama-3.1-8b` (vitesse) vs `gemini-2.5-flash` (qualité) |
| `LLM_TEMPERATURE_GM` | 0.3 | Garder bas (≤0.4). 0 si on veut des décisions stables et reproductibles |
| `LLM_MAX_TOKENS_GM` | 180 | Suffisant pour un brief JSON. À monter à 250 si on enrichit le brief |

❓ **Décision principe LLM** : assume-t-on que GM = modèle *flash/lite* (vitesse) et Max = modèle *fort* (qualité narrative) ? Le code va déjà dans ce sens (cf. settings GM par défaut).

### 4.3 🧠 Catalogue des modes de parole (déjà câblé)

6 modes sont disponibles. Le GM choisit dans son brief le champ `response_mode` ; Max l'exécute via les `style_instructions`.

| Mode | À utiliser quand | Risque |
|---|---|---|
| `ferme_mefiant` | Début de session, joueur agressif/intrusif | Si on y reste, expérience frustrante |
| `testeur` | Joueur ambigu, on veut sonder | Peut tourner en rond |
| `fragile` | Joueur empathique, montée émotionnelle | Trop tôt = mélo |
| `accusateur` | Joueur insultant ou manipulateur | Peut casser l'immersion |
| `confiant` | Trust élevé, joueur cohérent | Peut révéler trop vite |
| `revelateur_partiel` | Juste avant gate ou après trigger | Doit rester *partiel* |

❓ **Décision principe modes** : faut-il *figer* la trajectoire des modes (ex. `ferme_mefiant` → `testeur` → `fragile` → `revelateur_partiel`) ou laisser le GM libre ? À tester (cf. § 6).

### 4.4 🧠 Identité de Max (Max Prompt Control — 9 blocs)

Les 9 blocs sont déjà préremplis avec une base solide. À retravailler dans cet ordre de priorité :

1. **Persona** — "Tu es Max, le père d'Ava…" → **enrichir** avec 2-3 traits sensibles (voix grave, fatigue, formation pro, etc.).
2. **LongTermMemory** — *passer ici les éléments stables de la fiche Notion Max* (la "bible" condensée).
3. **AllowedKnowledgePolicy** + **ForbiddenAssertions** — la double règle anti-hallucination. **Ne pas relâcher**.
4. **ResponseStyle** — fixer la longueur (2-3 phrases), l'oralité, l'absence de narration meta.
5. **UncertaintyPolicy** — fixer comment Max dit "je ne sais pas".
6. **ForbiddenTopics** — sujets bloqués tant que la gate n'est pas atteinte.
7. **Objectives** — ce que Max veut obtenir du joueur (= moteur dramatique).
8. **RoleContext** — rappel "tu n'es pas un assistant".

> 💡 Ne jamais mettre de spoilers narratifs dans `LongTermMemory` : ça vit dans le prompt système et sera lu à *chaque* tour. Les éléments à révéler progressivement vivent dans le RAG (storyworld) et sont filtrés par le GM via `allowed_knowledge`.

### 4.5 🧠 Prompt système Game Master (post-turn)

Le défaut actuel est correct mais minimal. À enrichir avec :
- Définition explicite de "réponse sincère" / "évasive" pour stabiliser le `trust_delta`.
- Liste des comportements qui déclenchent `game_over` (insultes, refus de jouer, hors-sujet répété).
- Règle anti-double-trigger (ne jamais rejouer un trigger déjà activé).
- Format JSON strict + interdiction de prose hors JSON.

### 4.6 🧠 Prompt pre-turn planner Game Master (= levier narratif principal)

C'est **le prompt à itérer en priorité**. Variables à injecter dans le brief :
- `response_mode` — un des 6 modes ci-dessus.
- `openness_level` (0–5) — combien Max s'ouvre ce tour.
- `emotional_state` — état dominant (tendu, fragile, en colère, posé…).
- `conversation_goal` — objectif de Max ce tour (sonder, esquiver, révéler, accuser…).
- `reveal_budget` (0–2) — nb de faits autorisés à lâcher max.
- `allowed_knowledge[]` — copie filtrée du RAG.
- `forbidden_topics[]` — topics bloqués ce tour.
- `blocked_assertions[]` — affirmations interdites ce tour.
- `style_instructions[]` — exécution concrète (longueur, ton, question de contrôle…).
- `trigger_hint` — préparer un trigger si pertinent (sans le déclencher).

❓ **Décision principe pre-turn** : laisse-t-on `reveal_budget` être pris en compte de manière *stricte* par Max (validateur compte les révélations), ou seulement *indicatif* ?

### 4.7 🧠 Validateur anti-hallucination

Deux champs à remplir :
1. **Faits autorisés globaux** — la "bible factuelle" minimale (Max est le père d'Ava, Ava a disparu, etc.).
2. **Règles de blocage** — quoi rejeter avant TTS (affirmations non sourcées, transformation hypothèse → certitude, inventions).

Politique : si la réponse de Max viole les règles → **régénération avec consigne corrective** (max 2 essais). Au 3e, on garde la version la moins fautive et on logge `validator_blocked` dans le pipeline.

❓ **Décision principe validateur** : tolérance zéro (régénère systématiquement) ou seuil (ignore les violations mineures pour préserver la latence) ?

---

## 5. Variables et choix de gameplay — synthèse à trancher

| # | Choix de principe | Options | Recommandation initiale | Validation par |
|---|---|---|---|---|
| 1 | Modèle Max | qwen 72B / claude sonnet 4 / grok-3 / gemini-2.5-flash | Comparer qwen vs claude sur 5 sessions identiques | Score qualité narrative + latence |
| 2 | Modèle GM | gemini flash / gpt-4o-mini / llama-8b | Garder gemini-2.0-flash sauf si JSON instable | Taux de fallback `no_json` |
| 3 | Trust threshold | 7 / 10 / 13 | 10 par défaut | % sessions atteignant la gate |
| 4 | Min questions before gate | 5 / 10 / 15 | 10 | % de "speedrun" perçus frustrants |
| 5 | Timeout | 4 min / 7 min / 10 min | 10 min (mémoire projet) | NPS post-session |
| 6 | Tolérance insultes | 0 / 1 / 2 | 1 (1 avertissement) | Game over justes vs injustes |
| 7 | RAG_TOP_K | 3 / 5 / 8 | 5 | Cohérence vs latence |
| 8 | Trajectoire modes | libre vs scriptée | Libre, GM décide | Cohérence dramatique perçue |
| 9 | Reveal_budget | strict (validateur compte) vs indicatif | Indicatif au début, strict si débordements | % de révélations involontaires |
| 10 | Validateur | tolérance zéro vs seuil | Zéro pour les hallucinations factuelles, seuil pour le ton | Taux de régénérations |
| 11 | Triggers | 3 minimum vs 5 / 7 | 3 pour le proto, 5 si la session paraît plate | Densité narrative perçue |
| 12 | Voix Max | preset `max_diction` vs `expressive` vs `calm_measured` | `calm_measured` (père inquiet) | Test utilisateur |

---

## 6. Plan de test — comment valider en pratique

### 6.1 Méthode

Pour chaque variable à trancher, créer une **fiche test** avec :
- **Scénario joueur fixe** (script de questions identiques pour comparer A/B).
- **Variantes** (ex. variante 1 = `TRUST_THRESHOLD=7`, variante 2 = `=10`, variante 3 = `=13`).
- **Métriques mesurées** dans `/admin` :
  - Onglet **Sessions** → durée, nb tours, trust final, gate atteinte, game_over, triggers joués.
  - Onglet **Latence & blocage** → latences par étape, blocker, écart-type sur les tours.
  - Onglet **Hallucination Metrics** → taux de régénération, violations.
  - Onglet **LLM Usage** → coût par session.
- **Feedback qualitatif** : questionnaire post-session déjà câblé (auto-sync Notion).
- **Critère d'arrêt** : nb min de sessions par variante (recommandé 5).

### 6.2 Matrice de tests recommandée (semaine 1)

| Test | Ce qu'on fait varier | Tout le reste constant | Décision visée |
|---|---|---|---|
| T1 — Modèle Max | qwen 72B vs claude sonnet 4 vs grok-3-mini | gameplay défaut, scénario fixe | Choix modèle Max |
| T2 — Modèle GM | gemini-2.0-flash vs gpt-4o-mini | idem | Choix modèle GM |
| T3 — Trust threshold | 7 vs 10 vs 13 | modèles figés depuis T1/T2 | Calibrage gate |
| T4 — Modes scripts | scripté vs libre (2 versions de prompt pre-turn) | T1+T2+T3 figés | Liberté du GM |
| T5 — Validateur | strict vs souple | T1→T4 figés | Trade-off latence / pureté |
| T6 — Densité triggers | 3 vs 5 triggers | T1→T5 figés | Densité narrative |

### 6.3 Variantes "expérience utilisateur" à tester en parallèle

Au-delà des paramètres, 4 axes UX méritent une variante chacun :

1. **Onboarding A vs B** (déjà câblé : co-création vs narrateur omniscient).
2. **Modalité voix** : micro ouvert vs push-to-talk (déjà câblé, choix utilisateur).
3. **Voix Max** : `calm_measured` vs `expressive` (preset ElevenLabs).
4. **Sous-titres** : on / off (impact perçu sur l'immersion vs accessibilité).

### 6.4 Variantes "approche technique" à tester

1. **Pre-turn GM activé vs désactivé** (mode "ancien GM uniquement post-turn").
2. **Validateur activé vs désactivé** — mesurer l'effet sur les hallucinations et la latence.
3. **RAG_TOP_K** = 3 vs 5 vs 8 — cohérence vs latence vs coût.
4. **Streaming TTS** (déjà actif) vs TTS bloquant — confirmer le gain perçu.

---

## 7. Hypothèses de travail (à confirmer par les tests)

1. **H1** — Le pre-turn GM réduit significativement les hallucinations de Max (vs ancien GM post-turn seul).
2. **H2** — Un modèle GM *flash* suffit ; passer à un modèle plus gros n'améliore pas la qualité du brief mais augmente la latence (et donc les fallbacks).
3. **H3** — Au-delà de `RAG_TOP_K = 6`, le contexte devient bruyant et Max perd en focus.
4. **H4** — Une session de 10 min permet ~12-18 tours utiles ; en deçà de 8 tours, la gate paraît trop précoce.
5. **H5** — La trajectoire émotionnelle (mode `ferme` → `testeur` → `fragile` → `revelateur_partiel`) ressentie comme plus dramatique qu'une trajectoire libre du GM, *mais moins adaptative*.
6. **H6** — Les utilisateurs perçoivent comme "intelligent" un Max qui *refuse* d'affirmer plus que ce qu'il ne dit ("je ne sais pas") — la retenue paie plus que la générosité.
7. **H7** — Un seul `MAX_INSULT_TOLERANCE` (1 avertissement) est mieux qu'une tolérance zéro pour ne pas frustrer un joueur maladroit.

---

## 8. Enjeux à garder en tête

| Enjeu | Pourquoi c'est critique | Métrique de surveillance |
|---|---|---|
| **Latence perçue < 2 s** par tour | Cible UX du proto (cf. dashboard Latence) | `total_ms` médian par tour |
| **Cohérence narrative** | Sans elle, Max devient un assistant, pas un personnage | Taux de violations validateur |
| **Pas d'écrasement Notion** | Les prompts locaux édités dans `/admin` ne doivent pas être écrasés par la sync | Mémoire projet : constraint déjà actif |
| **Coût LLM par session** | OpenRouter facture par token, GM pre-turn ajoute un appel par tour | Onglet LLM Usage |
| **Reproductibilité des décisions GM** | Trust et triggers doivent être stables pour un même contexte | `LLM_TEMPERATURE_GM` ≤ 0.3 |
| **Pas de spoilers via RAG** | Les éléments classés `révélation: jamais` ne doivent jamais sortir | Audit manuel sur 10 sessions |
| **Préview vs Live** | Les configs ne se synchronisent PAS automatiquement | Mémoire projet : checklist manuelle avant publish |

---

## 9. Checklist opérationnelle — par où commencer

### Étape 1 — Contenus narratifs (Notion, ~1 jour)
- [ ] Page Max enrichie selon le gabarit § 3.1.
- [ ] 5 entrées Storyworld selon § 3.2 avec étiquette de révélation.
- [ ] 3 triggers vidéo dans `video_triggers` selon § 3.3.
- [ ] Sync Notion → Supabase lancée et vérifiée (onglet Admin sync).

### Étape 2 — Prompts dans `/admin` (~½ journée)
- [ ] Max Prompt Control : retravailler les 9 blocs en prenant la fiche Notion Max comme source.
- [ ] GM system prompt : enrichir selon § 4.5.
- [ ] GM pre-turn planner : enrichir selon § 4.6.
- [ ] Validateur anti-hallucination : remplir faits autorisés + règles de blocage.

### Étape 3 — Réglages techniques (~1 h)
- [ ] LLM Max + GM : choisir modèles de départ (qwen + gemini-flash).
- [ ] Réglages de jeu : valeurs du tableau § 4.1.
- [ ] Voix Max : preset `calm_measured`.

### Étape 4 — Premier passage de test (~½ journée)
- [ ] Lancer 3 sessions soi-même → diagnostic dans Pipeline Trace + Latence & blocage.
- [ ] Corriger les évidences (prompt confus, latence > 2 s, hallucination flagrante).

### Étape 5 — Plan de test structuré (~1 semaine)
- [ ] Exécuter T1 → T6 (§ 6.2) avec 5 sessions par variante.
- [ ] Documenter les décisions de principe dans une page Notion "Décisions GM v1".

---

## 10. Annexes

### 10.1 Glossaire express

- **Brief de tour** : objet JSON produit par le GM pre-turn et lu par Max avant de répondre.
- **Trust** : score 0→threshold qui mesure la qualité de l'engagement du joueur.
- **Gate** : seuil narratif qui débloque la phase suivante (proposition Léo/Emma).
- **Trigger** : vidéo placeholder déclenchée par le GM quand un thème clé est touché.
- **Fail-soft** : repli automatique sur un brief par défaut si le GM pre-turn dépasse 4 s ou échoue.
- **Validateur** : check pré-TTS qui vérifie qu'aucune affirmation interdite n'est dans la réponse de Max.

### 10.2 Format JSON cibles (à respecter dans les prompts)

**Brief pre-turn (sortie du GM avant Max)** :
```json
{
  "response_mode": "testeur",
  "openness_level": 2,
  "emotional_state": "tendu",
  "conversation_goal": "sonder la sincérité",
  "reveal_budget": 1,
  "allowed_knowledge": ["fait_a", "fait_b"],
  "forbidden_topics": ["disparition_jour_J"],
  "blocked_assertions": ["Max sait où est Ava"],
  "style_instructions": ["2 phrases max", "poser une question"],
  "trigger_hint": null,
  "notes": "Joueur vague, on sonde."
}
```

**Évaluation post-turn (sortie du GM après Max)** :
```json
{
  "trust_delta": 1,
  "trigger_video_id": null,
  "game_over": false,
  "game_over_reason": null,
  "gate_reached": false,
  "moderation_flag": false,
  "notes": "Échange sincère, pas encore de thème clé."
}
```

### 10.3 Liens utiles dans le repo

- `src/services/settingsService.ts` — toutes les valeurs par défaut et leur structure.
- `src/services/speechModes.ts` — catalogue formel des 6 modes de parole.
- `src/agents/gameMasterAgent.ts` — implémentation des appels GM (pre-turn + post-turn) avec fail-soft.
- `documents/PRD_Prototype_1.md` — référence PRD source.
- `documents/plan_implementation_max.md` — réflexion architecture sur le contrôle de Max.

---

*Document vivant — à mettre à jour après chaque vague de tests. Les décisions tranchées doivent remonter dans Notion (page "Décisions GM") et dans le `STORY.md` du repo.*
