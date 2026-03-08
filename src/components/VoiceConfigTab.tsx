import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { generateSpeech, playAudioBlob } from "@/services/elevenLabsTTS";
import {
  getTTSSettings,
  saveTTSSettingsLocal,
  saveTTSSettingsToDB,
  loadTTSSettingsFromDB,
  resetTTSSettings,
  ELEVENLABS_MODELS,
  TTS_PRESETS,
  type TTSSettings,
} from "@/services/settingsService";

const TEST_PHRASE = "Écoute, je ne sais pas qui tu es... mais si tu sais quelque chose sur Ava, il faut me le dire maintenant. Je n'ai plus beaucoup de temps.";

export default function VoiceConfigTab() {
  const [settings, setSettings] = useState<TTSSettings>(getTTSSettings());
  const [savedSettings, setSavedSettings] = useState<TTSSettings>(getTTSSettings());
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTTSSettingsFromDB().then((s) => {
      setSettings(s);
      setSavedSettings(s);
    });
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function updateLocal(patch: Partial<TTSSettings>) {
    const current = { ...settings, ...patch };
    localStorage.setItem("ava_tts_settings", JSON.stringify(current));
    setSettings(current);
  }

  function applyPreset(key: string) {
    const preset = TTS_PRESETS[key];
    if (!preset) return;
    const updated = { ...settings, ...preset.settings };
    localStorage.setItem("ava_tts_settings", JSON.stringify(updated));
    setSettings(updated);
    toast.success(`Preset "${preset.label}" appliqué — sauvegarde nécessaire`);
  }

  async function handleSave() {
    setSaving(true);
    await saveTTSSettingsToDB(settings);
    setSavedSettings(settings);
    toast.success("Réglages voix sauvegardés ✓");
    setSaving(false);
  }

  function handleReset() {
    const defaults = resetTTSSettings();
    setSettings(defaults);
    setSavedSettings(defaults);
    toast.success("Réglages voix réinitialisés");
  }

  const testVoice = useCallback(async () => {
    setTesting(true);
    try {
      const blob = await generateSpeech(TEST_PHRASE);
      await playAudioBlob(blob);
      toast.success("Test audio terminé");
    } catch (err) {
      console.error("TTS test error:", err);
      toast.error("Erreur lors du test audio");
    } finally {
      setTesting(false);
    }
  }, []);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Réglages Voix (ElevenLabs)</h2>
          <p className="text-sm text-muted-foreground">
            Ajuste la diction, le ton et la fluidité de Max. Clique "Sauvegarder" pour persister.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" /> Réinitialiser
          </Button>
          <Button size="sm" onClick={testVoice} disabled={testing}>
            {testing ? "Lecture..." : "🔊 Tester la voix"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}
            className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
            <Save className="w-3 h-3 mr-1" /> {saving ? "..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 text-sm text-yellow-300">
          ⚠️ Modifications non sauvegardées — clique "Sauvegarder" pour persister en base de données.
        </div>
      )}

      {/* Presets */}
      <section className="border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">⚡ Presets rapides</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(TTS_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <span className="font-medium text-sm">{preset.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Model Selection */}
      <section className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-base">🎙️ Modèle TTS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ELEVENLABS_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => updateLocal({ modelId: m.id })}
              className={`text-left p-3 border rounded-lg transition-colors ${
                settings.modelId === m.id
                  ? "bg-primary/10 border-primary"
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{m.label}</span>
                {settings.modelId === m.id && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">actif</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Voice Settings */}
      <section className="border rounded-lg p-4 space-y-5">
        <h3 className="font-semibold text-base">🎛️ Paramètres de voix</h3>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Stabilité</label>
            <span className="text-sm font-mono">{settings.stability.toFixed(2)}</span>
          </div>
          <Slider value={[settings.stability]} onValueChange={([v]) => updateLocal({ stability: v })} min={0} max={1} step={0.05} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Très expressif, variable</span>
            <span>1 — Monotone, constant</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">💡 Pour Max : 0.40-0.55 donne un ton posé avec des variations naturelles</p>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Fidélité à la voix (Similarity Boost)</label>
            <span className="text-sm font-mono">{settings.similarityBoost.toFixed(2)}</span>
          </div>
          <Slider value={[settings.similarityBoost]} onValueChange={([v]) => updateLocal({ similarityBoost: v })} min={0} max={1} step={0.05} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Voix générique</span>
            <span>1 — Très fidèle au sample original</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">💡 Trop haut peut causer des artefacts. 0.70-0.85 est le sweet spot</p>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Style / Exagération</label>
            <span className="text-sm font-mono">{settings.style.toFixed(2)}</span>
          </div>
          <Slider value={[settings.style]} onValueChange={([v]) => updateLocal({ style: v })} min={0} max={1} step={0.05} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Neutre, diction plate</span>
            <span>1 — Très stylisé, théâtral</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">💡 Pour une diction naturelle, garder entre 0.10-0.30</p>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Vitesse</label>
            <span className="text-sm font-mono">{settings.speed.toFixed(2)}</span>
          </div>
          <Slider value={[settings.speed]} onValueChange={([v]) => updateLocal({ speed: v })} min={0.7} max={1.2} step={0.02} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.70 — Lent, délibéré</span>
            <span>1.20 — Rapide, pressé</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">💡 0.90-0.95 améliore souvent l'articulation en français</p>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Speaker Boost</label>
            <p className="text-xs text-muted-foreground/60">Améliore la clarté et la ressemblance</p>
          </div>
          <Switch checked={settings.useSpeakerBoost} onCheckedChange={(v) => updateLocal({ useSpeakerBoost: v })} />
        </div>
      </section>

      {/* Config summary */}
      <section className="border rounded-lg p-4 bg-muted/20">
        <h3 className="font-semibold text-sm mb-2">📋 Config voix active</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap">
{JSON.stringify(settings, null, 2)}
        </pre>
      </section>
    </div>
  );
}
