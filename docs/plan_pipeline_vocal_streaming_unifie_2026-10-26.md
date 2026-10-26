# Plan d'architecture — Pipeline vocal unifié en streaming continu de bas niveau

> **Date** : 26 octobre 2026  
> **Auteur** : Agent Lovable / Revue Ulrich Fischer  
> **Statut** : Approuvé pour implémentation ultérieure (aucun code de production modifié à cette étape)  
> **Référence** : `docs/plan_pipeline_vocal_streaming_unifie_2026-10-26.md`

---

## 1. Contexte & Enjeux majeurs

### 1.1 Contexte initial : le constat de latence
Lors de la session sandbox Ulrich du 26 octobre 2026 (session `6120f397-19e5-4213-a75a-b5b64f57a006`, personnage Max, 5 tours de parole) avec Fish Audio (modèle S1) :
- Le délai moyen entre la fin de parole du joueur et le premier son de Max a atteint **7,8 secondes** (min 6,3 s, max 8,8 s).
- En comparaison, Gradium sur la même sandbox atteint un délai moyen de **1,9 seconde**.
- Cette latence de ~8 secondes brise l'illusion de fluidité d'une conversation incarnée voice-to-voice.

### 1.2 La fausse solution : le découpage par phrases naïf (« sentence chunking »)
Découper le texte généré par l'IA en phrases isolées pour les envoyer une par une au TTS sans gestion de contexte continu produit le phénomène bien connu du **« prosody cliff »** :
- **Perte de souffle et respirations hachées** : le synthétiseur audio redémarre sa prosodie à chaque segment, reprend une respiration artificielle en début de phrase et coupe brutalement la traîne naturelle de la fin de phrase précédente.
- **Micro-silences et ruptures de rythme** : entre deux requêtes REST ou deux blocs indépendants, l'écart de bufferisation provoque des clics ou des blancs perceptibles.
- **Incohérence narrative** : l'intention émotionnelle (la rugosité, les hésitations, les ruptures de ton du personnage établies au Lot A et Lot B) est fragmentée.

### 1.3 L'objectif fondamental
Construire un **socle universel de bas niveau pour l'ensemble des moteurs de synthèse vocale (TTS)** du projet, qui :
1. **Passe sous la barre des 2,0 secondes** de latence pour Fish Audio (en conservant son modèle expressif S1) et stabilise les autres moteurs.
2. **Préserve l'intégralité de la prosodie continue, des respirations et des inflexions narratives** sans coupures intempestives.
3. **Garantit une stricte non-régression** sur Gradium, ElevenLabs et Inworld.

---

## 2. Diagnostic technique de l'architecture actuelle

### 2.1 Le goulot d'étranglement : pipeline séquentiel bloquant
Dans `src/pages/IndexPRD4.tsx` (ligne ~540) :
```typescript
// Attente complète de TOUT le texte LLM généré :
const replyText = await generateCharacterReply(...); // Prend 2,0 à 3,5 s

// PUIS lancement de la synthèse audio sur le texte intégral :
const audioBuffer = await ttsProvider.synthesize(replyText); // Prend 4,0 à 5,5 s
```
Le joueur attend donc la somme complète : `Temps LLM intégral + Temps TTS intégral + Téléchargement MP3`.

### 2.2 Inégalité entre fournisseurs
- **Gradium** dispose déjà d'un connecteur streaming dédié (`src/services/gradiumStreamPlayer.ts`), ce qui explique sa réactivité (~1,9 s).
- **ElevenLabs**, **Inworld**, **Cartesia** et **Fish Audio** passent tous par une méthode synchrone `synthesize()` qui attend l'audio complet avant de commencer la lecture.
- **Fish Audio** propose pourtant nativement un protocole WebSocket bidirectionnel (`wss://api.fish.audio/v1/tts/live`) qui accepte des chunks de texte textuels au fil de l'eau et renvoie des chunks audio PCM/Opus en continu, avec persistance du contexte prosodique sur toute la durée de la session.

---

## 3. Architecture cible : Socle Streaming Unifié de Bas Niveau

Le système repose sur un contrat d'interface universel `UnifiedTTSStream` implémenté par chaque fournisseur selon ses capacités réelles.

```
+-------------------------------------------------------------+
|                     LLM Streaming (Token par token)         |
+-------------------------------------------------------------+
                              |
                              v  (Flux de tokens texte)
+-------------------------------------------------------------+
|             src/services/tts/UnifiedTTSStream.ts            |
|                                                             |
|  1. Détection de frontière prosodique minimale (warm-up)     |
|     - Bufferise ~8 à 12 mots / première ponctuation forte   |
|     - Envoie le 1er chunk au TTS pour amorcer l'audio       |
|                                                             |
|  2. Flux continu de texte (tokens suivants)                 |
|     - Injecte les tokens au fil de l'eau dans le socket     |
|     - Maintient la session ouverte (pas de reset de modèle) |
|                                                             |
|  3. Clôture de tour (flush)                                 |
|     - Signal de fin de phrase/tour ("finish")               |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       | (WebSocket live)     | (Chunking géré)     | (REST unifié)
       v                      v                      v
+---------------+      +---------------+      +---------------+
|  Fish Audio   |      |  Gradium /    |      | Inworld /     |
|  WebSocket    |      |  ElevenLabs   |      | Cartesia      |
|  (Live S1)    |      |  WebSocket    |      | (Fallback)    |
+---------------+      +---------------+      +---------------+
       |                      |                      |
       +----------------------+----------------------+
                              |  (Chunks audio PCM / MP3)
                              v
+-------------------------------------------------------------+
|             Web Audio API - Continuous Stream Player        |
|  - Buffer glissant (SourceBuffer / AudioContext scheduled)  |
|  - Démarrage dès les premiers 150 ms d'audio reçus          |
|  - Crossfade automatique inter-buffers si nécessaire (<5ms) |
|  - Coupure instantanée propre sur barge-in (interruption)   |
+-------------------------------------------------------------+
```

### 3.1 Découpage des responsabilités

1. **`UnifiedTTSStream` (Interface commune)** :
   - `openSession(config: TTSStreamConfig): Promise<void>`
   - `pushTextChunk(text: string): void`
   - `flush(): void`
   - `abort(): void`
   - Événements : `onAudioChunk(chunk: ArrayBuffer)`, `onFirstByte()`, `onError(err)`, `onEnd()`

2. **Adaptateurs par fournisseur** :
   - **Fish Audio (`FishAudioStreamSession`)** :
     - Connexion WebSocket `wss://api.fish.audio/v1/tts/live` via Edge Function relais sécurisée (`proxy-tts-fish-live` ou streaming direct avec ticket éphémère).
     - Format audio Opus/PCM 44.1kHz.
     - Gestion des frames MessagePack selon les spécifications Fish Audio Live.
     - Maintien du contexte de référence prosodique tout au long du tour.
   - **Gradium (`GradiumStreamSession`)** :
     - Reprise et refactorisation de `gradiumStreamPlayer.ts` sous l'interface `UnifiedTTSStream`.
     - Préservation exacte des réglages de température (0.65/0.7) et de padding (0.2).
   - **ElevenLabs (`ElevenLabsStreamSession`)** :
     - Utilisation du WebSocket ElevenLabs `v1/text-to-speech/{voice_id}/stream-input`.
   - **Fallback REST (Inworld, Cartesia, etc.)** :
     - Si un moteur ne supporte pas le streaming WebSocket textuel continu, repli sur le buffer complet classique sans bloquer l'architecture globale.

3. **`AudioStreamPlayer` (Lecteur audio Web Audio API)** :
   - File d'attente FIFO de décodage non bloquante.
   - Démarrage de la lecture dès que le premier paquet audio est décodé (seuil minimal ~100-150 ms pour éviter le buffer underrun).
   - Gestion stricte du barge-in : arrêt immédiat du contexte audio et vidage de la file en cas d'interruption du joueur.

---

## 4. Analyse des Risques et Stratégies de Non-Régression

| Risque identifié | Cause potentielle | Mesure de prévention & Garantie |
| :--- | :--- | :--- |
| **Coupures ou respirations hachées** | Clôture prématurée de blocs de texte côté moteur TTS. | **Session WebSocket unique par tour** : le moteur ne réinitialise pas son état vocal entre deux phrases d'une même réplique. |
| **Régression sur Gradium** (déjà performant) | Changement involontaire du protocole ou des paramètres de socket. | **Isolement de l'adaptateur Gradium** : son implémentation actuelle est encapsulée sans altération de sa logique socket validée. |
| **Désynchronisation des sous-titres** | L'audio démarre avant que le texte complet ne soit transcrit dans l'UI. | Le composant d'affichage des sous-titres écoute le flux de texte LLM déjà existant et synchronise l'affichage avec la lecture audio. |
| **Barge-in / Interruption cassé** | Le socket continue d'envoyer de l'audio alors que le joueur a repris la parole. | Méthode `abort()` synchrone sur `UnifiedTTSStream` qui coupe le socket et mute l'AudioContext instantanément (<10 ms). |
| **Échec réseau WebSocket** | Firewall, timeout ou instabilité du proxy. | **Repli transparent automatique (Graceful Fallback)** : en cas d'échec du socket dans les 800 ms, bascule silencieuse sur l'appel REST `synthesize()` standard. |

---

## 5. Découpage du Chantier en 6 Étapes (Roadmap)

Le chantier est découpé pour être exécutable par étapes indépendantes et testables :

### Étape 1 — Contrat d'interface et Lecteur Web Audio (`UnifiedTTSStream`)
- Définition des interfaces TypeScript dans `src/services/tts/stream/`.
- Création de `AudioStreamPlayer.ts` pour la gestion du buffer glissant Web Audio API.
- Tests unitaires d'orchestration de buffers et de politique de repli.

### Étape 2 — Banc d'audition Streaming dans l'Admin TTS
- Ajout d'un mode de test "Streaming Live" dans `TTSConfigTab.tsx` / `SpeechAuditionBench.tsx`.
- Permet d'écouter et de mesurer la latence du premier octet (TTFB) et la continuité prosodique sur une réplique type, sans toucher au jeu principal.

### Étape 3 — Relais et adaptateur WebSocket Fish Audio
- Création du connecteur WebSocket Fish Audio (`proxy-tts-fish` ou fonction relais dédiée).
- Encodage MessagePack, transmission des tokens et réception des frames audio.
- Validation auditive : zéro respiration coupée sur des textes de 3 à 4 phrases.

### Étape 4 — Encapsulation Gradium & ElevenLabs
- Branchement de Gradium et d'ElevenLabs sous le même contrat `UnifiedTTSStream`.
- Vérification que Gradium conserve sa latence de ~1,9 s et sa signature sonore sans altération.

### Étape 5 — Intégration dans l'Orchestrateur du Jeu (`IndexPRD4.tsx`)
- Remplacement de l'appel séquentiel `generateReply -> synthesize` par le pipeline en flux continu.
- Validation de l'intégration avec le système de sous-titres et les traces diagnostiques.

### Étape 6 — Recette de conversation réelle et mesures de latence
- Session réelle de 5 tours en sandbox-ulrich avec Max sur Fish Audio.
- Mesure de la télémétrie : validation de la cible < 2,0 s de délai total (versus 7,8 s actuellement).
- Vérification des interruptions par barge-in.
- Actualisation du CHANGELOG et de STORY.md.

---

## 6. Métriques de succès (Critères d'acceptation)

1. **Latence perçue (Délai fin de parole joueur -> 1er son personnage)** :
   - Fish Audio S1 : **< 2,2 secondes** (vs 7,8 s avant optimisation).
   - Gradium : **<= 1,9 seconde** (aucune régression).
   - ElevenLabs : **< 2,0 secondes**.
2. **Qualité prosodique** :
   - 0 respiration coupée au milieu d'une réplique.
   - Préservation des hésitations narratives issues des fiches de personnages (Lots A et B).
3. **Robustesse** :
   - En cas d'erreur WebSocket, le repli REST prend le relais sans couper la parole du personnage.
   - Interruption (barge-in) nette en moins de 50 ms sans résidu sonore.

