import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { generateSpeech, playAudioBlob } from "@/services/tts";
import { TTS_PROVIDER_LIST } from "@/services/tts/registry";
import type { TTSProviderId } from "@/services/tts/types";
import {
  getActiveProviderId,
  loadActiveProviderFromDB,
  setActiveProvider,
  getInworldSettings,
  loadInworldSettingsFromDB,
  saveInworldSettingsToDB,
  resetInworldSettings,
  getHumeSettings,
  loadHumeSettingsFromDB,
  saveHumeSettingsToDB,
  resetHumeSettings,
  INWORLD_MODELS,
  type InworldSettings,
  type HumeSettings,
} from "@/services/tts/providerSettings";
import {
  getTTSSettings,
  saveTTSSettingsToDB,
  loadTTSSettingsFromDB,
  resetTTSSettings,
  ELEVENLABS_MODELS,
  TTS_PRESETS,
  type TTSSettings,
} from "@/services/settingsService";

const TEST_PHRASE = "Écoute, je ne sais pas qui tu es... mais si tu sais quelque chose sur Ava, il faut me le dire maintenant. Je n'ai plus beaucoup de temps.";

export default function TTSConfigTab() {
  const [activeProvider, setActiveProviderState] = useState<TTSProviderId>(getActiveProviderId());

  // ElevenLabs settings
  const [elSettings, setElSettings] = useState<TTSSettings>(getTTSSettings());
  const [elSaved, setElSaved] = useState<TTSSettings>(getTTSSettings());
  const [savingEl, setSavingEl] = useState(false);

  // Inworld settings
  const [iwSettings, setIwSettings] = useState<InworldSettings>(getInworldSettings());
  const [iwSaved, setIwSaved] = useState<InworldSettings>(getInworldSettings());
  const [savingIw, setSavingIw] = useState(false);

  // Hume settings
  const [huSettings, setHuSettings] = useState<HumeSettings>(getHumeSettings());
  const [huSaved, setHuSaved] = useState<HumeSettings>(getHumeSettings());
  const [savingHu, setSavingHu] = useState(false);

  // Test
  const [testing, setTesting] = useState<TTSProviderId | null>(null);

  useEffect(() => {
    loadActiveProviderFromDB().then(setActiveProviderState);
    loadTTSSettingsFromDB().then((s) => { setElSettings(s); setElSaved(s); });
    loadInworldSettingsFromDB().then((s) => { setIwSettings(s); setIwSaved(s); });
    loadHumeSettingsFromDB().then((s) => { setHuSettings(s); setHuSaved(s); });
  }, []);

  const elHasChanges = JSON.stringify(elSettings) !== JSON.stringify(elSaved);
  const iwHasChanges = JSON.stringify(iwSettings) !== JSON.stringify(iwSaved);
  const huHasChanges = JSON.stringify(huSettings) !== JSON.stringify(huSaved);

  async function handleActivate(id: TTSProviderId) {
    setActiveProviderState(id);
    await setActiveProvider(id);
    toast.success(`Provider actif : ${TTS_PROVIDER_LIST.find((p) => p.id === id)?.label}`);
  }

  const testProvider = useCallback(async (id: TTSProviderId) => {
    setTesting(id);
    try {
      const blob = await generateSpeech(TEST_PHRASE, { providerId: id });
      await playAudioBlob(blob);
      toast.success(`Test ${id} terminé`);
    } catch (err) {
      console.error(`TTS test error (${id}):`, err);
      toast.error(`Erreur test ${id}: ${err instanceof Error ? err.message.slice(0, 120) : "inconnu"}`);
    } finally {
      setTesting(null);
    }
  }, []);

  // ElevenLabs helpers
  function updateEl(patch: Partial<TTSSettings>) {
    const current = { ...elSettings, ...patch };
    localStorage.setItem("ava_tts_settings", JSON.stringify(current));
    setElSettings(current);
  }
  function applyElPreset(key: string) {
    const preset = TTS_PRESETS[key];
    if (!preset) return;
    const updated = { ...elSettings, ...preset.settings };
    localStorage.setItem("ava_tts_settings", JSON.stringify(updated));
    setElSettings(updated);
    toast.success(`Preset "${preset.label}" appliqué — sauvegarde nécessaire`);
  }
  async function saveEl() {
    setSavingEl(true);
    await saveTTSSettingsToDB(elSettings);
    setElSaved(elSettings);
    toast.success("ElevenLabs sauvegardé ✓");
    setSavingEl(false);
  }
  function resetEl() {
    const d = resetTTSSettings();
    setElSettings(d); setElSaved(d);
    toast.success("ElevenLabs réinitialisé");
  }

  // Inworld helpers
  function updateIw(patch: Partial<InworldSettings>) {
    const current = { ...iwSettings, ...patch };
    localStorage.setItem("ava_tts_settings_inworld", JSON.stringify(current));
    setIwSettings(current);
  }
  async function saveIw() {
    setSavingIw(true);
    await saveInworldSettingsToDB(iwSettings);
    setIwSaved(iwSettings);
    toast.success("Inworld sauvegardé ✓");
    setSavingIw(false);
  }
  function resetIw() {
    const d = resetInworldSettings();
    setIwSettings(d); setIwSaved(d);
    toast.success("Inworld réinitialisé");
  }

  // Hume helpers
  function updateHu(patch: Partial<HumeSettings>) {
    const current = { ...huSettings, ...patch };
    localStorage.setItem("ava_tts_settings_hume", JSON.stringify(current));
    setHuSettings(current);
  }
  async function saveHu() {
    setSavingHu(true);
    await saveHumeSettingsToDB(huSettings);
    setHuSaved(huSettings);
    toast.success("Hume sauvegardé ✓");
    setSavingHu(false);
  }
  function resetHu() {
    const d = resetHumeSettings();
    setHuSettings(d); setHuSaved(d);
    toast.success("Hume réinitialisé");
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">TTS Config — Multi-providers</h2>
        <p className="text-sm text-muted-foreground">
          Compare 3 services TTS. Le provider <strong>actif</strong> est utilisé dans le jeu ; les autres restent disponibles pour les tests.
        </p>
      </div>

      {/* ===== Active provider selector ===== */}
      <section className="border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">🎯 Provider actif (utilisé en jeu)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TTS_PROVIDER_LIST.map((p) => {
            const isActive = activeProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleActivate(p.id)}
                className={`text-left p-3 border rounded-lg transition-colors ${
                  isActive ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{p.label}</span>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ===== ElevenLabs panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ ElevenLabs</h3>
            <p className="text-xs text-muted-foreground">Réglages voix, presets, diction</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetEl}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("elevenlabs")} disabled={testing === "elevenlabs"}>
              {testing === "elevenlabs" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveEl} disabled={savingEl || !elHasChanges}
              className={elHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingEl ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {elHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications ElevenLabs non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">⚡ Presets rapides</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(TTS_PRESETS).map(([key, preset]) => (
              <button key={key} onClick={() => applyElPreset(key)}
                className="text-left p-2 border rounded hover:bg-accent/50 text-xs">
                <span className="font-medium">{preset.label}</span>
                <p className="text-muted-foreground mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium mb-2">Modèle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ELEVENLABS_MODELS.map((m) => (
              <button key={m.id} onClick={() => updateEl({ modelId: m.id })}
                className={`text-left p-2 border rounded text-xs ${
                  elSettings.modelId === m.id ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}>
                <span className="font-medium">{m.label}</span>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <SliderRow label="Stabilité" value={elSettings.stability} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ stability: v })} />
        <SliderRow label="Similarity Boost" value={elSettings.similarityBoost} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ similarityBoost: v })} />
        <SliderRow label="Style" value={elSettings.style} min={0} max={1} step={0.05}
          onChange={(v) => updateEl({ style: v })} />
        <SliderRow label="Vitesse" value={elSettings.speed} min={0.7} max={1.2} step={0.02}
          onChange={(v) => updateEl({ speed: v })} />
        <SliderRow label="Optimize streaming latency" value={elSettings.optimizeStreamingLatency} min={0} max={4} step={1}
          onChange={(v) => updateEl({ optimizeStreamingLatency: Math.round(v) })} format={(v) => v.toString()} />

        <div className="flex items-center justify-between py-2">
          <label className="text-sm">Speaker Boost</label>
          <Switch checked={elSettings.useSpeakerBoost} onCheckedChange={(v) => updateEl({ useSpeakerBoost: v })} />
        </div>
      </section>

      {/* ===== Inworld panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Inworld TTS</h3>
            <p className="text-xs text-muted-foreground">Modèles inworld-tts-1 / -max, voix multilingue</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetIw}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("inworld")} disabled={testing === "inworld"}>
              {testing === "inworld" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveIw} disabled={savingIw || !iwHasChanges}
              className={iwHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingIw ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {iwHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Inworld non sauvegardées
          </div>
        )}

        <div>
          <p className="text-xs font-medium mb-2">Modèle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INWORLD_MODELS.map((m) => (
              <button key={m.id} onClick={() => updateIw({ modelId: m.id as InworldSettings["modelId"] })}
                className={`text-left p-2 border rounded text-xs ${
                  iwSettings.modelId === m.id ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
                }`}>
                <span className="font-medium">{m.label}</span>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Voice ID</span>
            <input value={iwSettings.voiceId}
              onChange={(e) => updateIw({ voiceId: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Hades, Ashley, ..." />
            <span className="block text-xs text-muted-foreground/60">Ex: Hades, Ashley, Olivia, Pixie... (voir docs Inworld)</span>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Langue</span>
            <input value={iwSettings.languageCode}
              onChange={(e) => updateIw({ languageCode: e.target.value.trim().toLowerCase() || "fr" })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="fr" />
          </label>
        </div>

        <SliderRow label="Temperature" value={iwSettings.temperature} min={0} max={2} step={0.05}
          onChange={(v) => updateIw({ temperature: v })} />
      </section>

      {/* ===== Hume Octave panel ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">🎙️ Hume AI Octave</h3>
            <p className="text-xs text-muted-foreground">Très expressif, contrôle via description prosodique</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetHu}><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
            <Button size="sm" onClick={() => testProvider("hume")} disabled={testing === "hume"}>
              {testing === "hume" ? "..." : "🔊 Tester"}
            </Button>
            <Button size="sm" onClick={saveHu} disabled={savingHu || !huHasChanges}
              className={huHasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
              <Save className="w-3 h-3 mr-1" />{savingHu ? "..." : "Sauver"}
            </Button>
          </div>
        </div>

        {huHasChanges && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-1 text-xs text-yellow-300">
            ⚠️ Modifications Hume non sauvegardées
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Voice name</span>
            <input value={huSettings.voiceName}
              onChange={(e) => updateHu({ voiceName: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Male English Actor" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Provider de voix</span>
            <select value={huSettings.voiceProvider}
              onChange={(e) => updateHu({ voiceProvider: e.target.value as HumeSettings["voiceProvider"] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="HUME_AI">HUME_AI (catalogue public)</option>
              <option value="CUSTOM_VOICE">CUSTOM_VOICE (voix clonée)</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 text-sm block">
          <span className="font-medium text-muted-foreground">Description prosodique (optionnel)</span>
          <textarea value={huSettings.description}
            onChange={(e) => updateHu({ description: e.target.value })}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="ex: voix grave, posée, légèrement inquiète, rythme lent" />
          <span className="block text-xs text-muted-foreground/60">Octave utilise cette description pour moduler la prosodie.</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Format audio</span>
            <select value={huSettings.format}
              onChange={(e) => updateHu({ format: e.target.value as HumeSettings["format"] })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="pcm">PCM</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-muted-foreground">Langue</span>
            <input value={huSettings.languageCode}
              onChange={(e) => updateHu({ languageCode: e.target.value.trim().toLowerCase() || "fr" })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="fr" />
          </label>
        </div>
      </section>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const fmt = format ?? ((v) => v.toFixed(2));
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <span className="text-sm font-mono">{fmt(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}
