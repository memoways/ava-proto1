
# Plan — TTS multi-providers + monitoring Consommation Voix

Livré en 2 phases distinctes pour minimiser le risque de régression. Phase 1 ne touche pas au monitoring existant ; Phase 2 ne touche pas au pipeline audio.

---

## Phase 1 — Refonte TTS multi-providers

### Objectif
Remplacer l'appel direct "ElevenLabs only" par une abstraction `TTSProvider` permettant de choisir l'un des 4 services depuis l'admin, sans changer le comportement runtime côté `Index.tsx` / `TTSQueue`.

### Providers cibles
1. **ElevenLabs** (existant, conservé tel quel)
2. **Inworld TTS** — API REST, modèles `inworld-tts-1` / `inworld-tts-1-max`
3. **StepAudio** (Step-Audio / StepFun) — API REST, voix FR
4. **Hume AI Octave** — API REST, voix expressives

Une 5e (Cartesia, Deepgram Aura, OpenAI TTS) pourra être ajoutée sans refactor — l'archi est ouverte.

### Architecture

```text
src/services/tts/
  index.ts                  ← façade publique : generateSpeech(), TTSQueue
  types.ts                  ← TTSProvider interface, TTSRequest, TTSResponse
  registry.ts               ← map { elevenlabs, inworld, stepaudio, hume } → provider
  providers/
    elevenlabs.ts           ← wrap existant (appelle proxy-tts)
    inworld.ts              ← appelle proxy-tts-inworld
    stepaudio.ts            ← appelle proxy-tts-stepaudio
    hume.ts                 ← appelle proxy-tts-hume

supabase/functions/
  proxy-tts/                ← inchangé (ElevenLabs)
  proxy-tts-inworld/        ← nouveau
  proxy-tts-stepaudio/      ← nouveau
  proxy-tts-hume/           ← nouveau
```

Chaque provider expose la même signature :
```ts
interface TTSProvider {
  id: "elevenlabs" | "inworld" | "stepaudio" | "hume";
  label: string;
  generate(text: string, opts: CommonTTSOptions): Promise<{ blob: Blob; meta: ProviderMeta }>;
  defaultSettings(): ProviderSettings;
  settingsSchema: SettingsField[];  // pour rendu auto dans TTS Config
}
```

### Sélection du provider actif

- Nouvelle clé dans `admin_settings` : `tts_active_provider` (default `"elevenlabs"`).
- Chargée au boot via `settingsService` et exposée par `getActiveTTSProvider()`.
- `generateSpeech(text, opts)` (façade) délègue à `registry[active].generate(...)`.
- **Aucun changement** dans `Index.tsx` ni `TTSQueue` : ils continuent à appeler `generateSpeech()` comme aujourd'hui.

### Refonte de l'onglet "Voix" → "TTS Config"

`src/components/VoiceConfigTab.tsx` devient `TTSConfigTab.tsx`, structuré comme `LLMConfigTab` :

1. **Sélecteur de provider actif** (radio + descriptif + bouton "Définir comme actif")
2. **Section par provider** (accordéon), avec :
   - Réglages spécifiques (voix, modèle, stabilité, vitesse, format audio…) générés depuis `settingsSchema`
   - Bouton "🔊 Tester ce provider" (utilise le provider de la section, pas le provider actif)
   - Statut secret : `ELEVENLABS_API_KEY` configurée ✓ / `INWORLD_API_KEY` manquante ⚠️
3. **Section comparaison rapide** : un même texte joué successivement par chaque provider (utile pour A/B).

Persistance : une clé par provider dans `admin_settings` (`tts_settings_elevenlabs`, `tts_settings_inworld`, …).

### Secrets requis

À ajouter via `secrets--add_secret` au début de la phase :
- `INWORLD_API_KEY`
- `STEPAUDIO_API_KEY`
- `HUME_API_KEY`

(Note : je demanderai à l'utilisateur les clés au moment de démarrer la phase, pas maintenant.)

### Garde-fous régression
- ElevenLabs reste branché à `proxy-tts` existant, signature inchangée, défaut actif.
- La façade `generateSpeech` garde la même signature publique → `Index.tsx`, `TTSQueue`, tests existants restent verts.
- Renommer "Voix" → "TTS Config" dans `Admin.tsx` (1 ligne), garder `tab=voice` pour ne pas casser les liens.
- Tests unitaires nouveaux : registry mapping + selection.

---

## Phase 2 — Panel "Consommation Voix"

### Objectif
Ajouter un onglet à côté de "Consommation" (renommé "Consommation LLM"), monitoring multi-providers basé sur la table existante `audio_latencies` enrichie.

### Renommages dans `Admin.tsx`
- `usage` → label "Consommation LLM" (id inchangé)
- Nouveau tab `voice-usage` → label "Consommation Voix"

### Enrichissement données

Migration `audio_latencies` :
- Ajout colonnes : `provider text`, `status_code int`, `error_type text` (`ok` / `quota` / `auth` / `network` / `server` / `client`), `error_message text`.
- Backfill : `provider = 'elevenlabs'` pour les lignes existantes.

Côté providers (Phase 1 déjà en place) : chaque `provider.generate()` retourne `meta` qui est passé à `recordAudioLatency()` — donc Phase 2 n'a qu'à lire ces champs.

### Composant `VoiceUsageTab.tsx`

Sur une fenêtre temporelle sélectionnable (24h / 7j / total) :

- **Cartes par provider** (ElevenLabs, Inworld, StepAudio, Hume) :
  - Requêtes totales / succès / erreurs (+ % succès)
  - Répartition codes HTTP : 200 / 401 / 429 / 5xx (mini bar chart)
  - Latence first-byte p50 / p95
  - Latence totale p50 / p95
  - Dernière erreur (timestamp + message tronqué)
- **Bandeau d'alerte** si taux d'erreur > 10% sur 24h
- **Tableau comparatif** côte-à-côte (1 ligne par provider, colonnes : req, succès, p50, p95, erreurs)

Requêtes : `supabase.from('audio_latencies').select(...)` agrégé côté client (volumes modestes), filtrage par fenêtre temporelle.

### Garde-fous régression
- Lecture seule. Aucun impact sur le pipeline voix.
- La phase 1 garantit que `provider`, `status_code`, `error_type` sont déjà alimentés avant que ce panel ne soit livré.

---

## Détails techniques

### Question quotas/coûts (hors scope monitoring de base, prévu extensible)
Aucun appel `/v1/usage` ou équivalent provider dans Phase 2 — le coût et le quota restant ne seront pas affichés (peuvent être ajoutés en Phase 3 si besoin, sans toucher au schéma).

### PostHog
Les events `audio_latency` envoyés depuis `latencyTelemetry.ts` reçoivent automatiquement les nouveaux champs (`provider`, `status_code`, `error_type`) → exploitables aussi côté PostHog Insights sans travail supplémentaire.

### Fichiers touchés (estimation)

Phase 1 (~10 fichiers) :
- nouveaux : `src/services/tts/{index,types,registry}.ts`, `src/services/tts/providers/{elevenlabs,inworld,stepaudio,hume}.ts`, `src/components/TTSConfigTab.tsx`, 3 edge functions
- modifiés : `src/pages/Admin.tsx` (label + import), `src/services/settingsService.ts` (clés par provider), `src/pages/Index.tsx` (aucun changement attendu — import via façade)
- supprimé/déprécié : `src/components/VoiceConfigTab.tsx` (logique migrée)

Phase 2 (~4 fichiers) :
- nouveaux : `src/components/admin/VoiceUsageTab.tsx`, 1 migration SQL
- modifiés : `src/pages/Admin.tsx` (rename + nouvel onglet), `src/services/latencyTelemetry.ts` (4 nouveaux champs)

### Risques identifiés
- **Inworld / StepAudio / Hume** : APIs moins documentées qu'ElevenLabs ; je vérifierai les endpoints + formats au moment de coder chaque proxy et signalerai tout blocage.
- **Latence ajoutée** : nulle — la façade est un simple lookup de map ; `Index.tsx` ne change pas.
- **Régression ElevenLabs** : couverte par les tests unitaires existants (`elevenLabsTTS.test.ts`) qui resteront verts car le provider ElevenLabs reste un wrapper 1:1 du code actuel.

---

## Validation à chaque phase
1. Build + tests verts
2. Test manuel du provider actif en jeu (ElevenLabs par défaut → comportement identique)
3. Test du bouton "Tester ce provider" pour chaque provider configuré
4. Phase 2 : vérifier que le panel se peuple correctement après quelques tours de jeu
