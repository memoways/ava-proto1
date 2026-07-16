## Contexte

Cinq providers STT sont branchés dans le projet : **Deepgram** (actif par défaut, Nova‑3), **AssemblyAI**, **OpenAI Whisper**, **Gradium** et **Gamilab**. La qualité se dégrade surtout sur les noms propres du récit (Max, Ava, Emma, Léo, Protogyny, MemoWays, etc.) et le vocabulaire spécifique.

## Support natif d'un dictionnaire custom par provider

| Provider | Mécanisme natif | Où le passer | Efficacité pour noms propres |
| --- | --- | --- | --- |
| Deepgram Nova‑3 | `keyterm` (prompting) — jusqu'à 100 termes, boost sémantique fort | Query param sur le WS `wss://…/v1/listen?keyterm=Ava&keyterm=Protogyny…` | ⭐⭐⭐⭐⭐ (le meilleur) |
| Deepgram (legacy) | `keywords=Ava:2` (intensifier) | Query param | ⭐⭐⭐ (déprécié en Nova‑3) |
| AssemblyAI | `word_boost: [...]` + `boost_param: high` | Body JSON de la session | ⭐⭐⭐⭐ |
| OpenAI Whisper (`whisper-1`) | `prompt` (≤224 tokens, exemples in‑context) | multipart form | ⭐⭐⭐ (fragile, biais stylistique) |
| OpenAI `gpt-4o-transcribe` | `prompt` idem | multipart form | ⭐⭐⭐ |
| Gradium | `pronunciation_id` (dictionnaire de prononciation créé côté Gradium) + `rewrite_rules` (côté TTS, non STT) | À confirmer côté STT — la doc STT mentionne `keyterms` selon leurs modèles | ⭐⭐ (à valider avec Nicolas) |
| Gamilab | SDK propriétaire, pas d'API dictionnaire documentée | — | ❌ |

Deepgram Nova‑3 avec `keyterm` est de loin le levier le plus rentable — c'est aussi le provider actif, donc l'impact est immédiat.

## Objectif

1. Un **dictionnaire projet unique** (liste éditable de termes) stocké en DB, éditable depuis l'admin.
2. **Injection automatique** de ce dictionnaire dans chaque provider selon son API native.
3. Focus qualité sur le provider actif (Deepgram Nova‑3), sans dégrader la latence.

## Livraison en 3 étapes

### Étape 1 — Dictionnaire projet (fondation)

- Nouvelle clé `admin_settings.key = "ava_stt_dictionary"` avec `value = { terms: string[] }`.
- Service `src/services/stt/dictionary.ts` : `getDictionaryTerms()`, `loadDictionaryFromDB()`, `saveDictionaryToDB()` (même pattern que `providerSettings.ts`).
- Onglet **STT Config** enrichi : textarea "Dictionnaire (un terme par ligne)" + compteur (limite Deepgram 100 termes) + bouton Sauver.
- Pré‑remplissage initial avec les noms clés du récit (Max, Ava, Emma, Léo, Protogyny, MemoWays, Ulrich Fischer).

### Étape 2 — Deepgram Nova‑3 keyterm (priorité qualité)

- `buildDeepgramWebSocketUrl()` accepte un `keyterms: string[]` et ajoute `keyterm=…` répété (URL‑encoder chaque terme, respecter la limite de 100).
- Le composant qui ouvre la session Deepgram lit `getDictionaryTerms()` juste avant `new WebSocket(url)` et passe la liste.
- Impact latence : nul (query param).
- Vérification manuelle : dire "Protogyny" et "Léo" dans une session avant/après.

### Étape 3 — Extension aux providers secondaires (best‑effort, sans blocage)

- **AssemblyAI** : ajouter `word_boost` + `boost_param: "high"` dans la config de session (proxy `proxy-stt-assemblyai`).
- **OpenAI Whisper / gpt‑4o‑transcribe** : concaténer les termes en une phrase prompt courte ("Contexte : Max, Ava, Emma, Léo, Protogyny…") et l'envoyer dans le champ `prompt`.
- **Gradium** : ajouter un champ optionnel `pronunciationId` côté STT (déjà présent côté TTS) et — action externe — demander à Nicolas Goy si un mécanisme keyterms STT est exposé, avant d'implémenter.
- **Gamilab** : marquer "non supporté" dans l'UI, aucun code.

Chaque étape est indépendamment mergeable ; l'étape 2 seule règle 90 % du problème sur le provider actif.

## Détails techniques

- **Format Deepgram keyterm** : `?model=nova-3&keyterm=Ava&keyterm=Protogyny&keyterm=Ulrich%20Fischer` — les termes multi‑mots sont acceptés tels quels URL‑encodés, pas besoin de guillemets.
- **Où lire le dictionnaire** : côté client uniquement (les termes ne sont pas des secrets, la clé Deepgram reste côté proxy). L'edge function `proxy-stt` continue de ne renvoyer que `key/model/language` — pas de round‑trip supplémentaire.
- **Migration DB** : aucune. On réutilise `admin_settings(key, value jsonb)` déjà en place.
- **Tests** : étendre `deepgramSTT.test.ts` avec un cas "URL contient tous les keyterm".
- **Doc** : ajouter une note dans `STORY.md` (nouvelle session) et mettre à jour `mem://features/voice-to-voice` pour tracer le mécanisme.

## Hors périmètre (à discuter si besoin)

- Poids par terme (Deepgram Nova‑3 keyterm n'expose plus d'intensifier — c'est binaire).
- Dictionnaires par personnage (aujourd'hui un seul dictionnaire projet suffit ; à envisager si Emma/Léo introduisent leur propre lexique).
- Post‑correction LLM (regex ou pass de rewriting sur le transcript final) — plan B si les keyterms ne suffisent pas.
