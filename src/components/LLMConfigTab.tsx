import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  getLLMSettings,
  saveLLMSettings,
  resetLLMSettings,
  OPENROUTER_MODELS,
  type LLMSettings,
} from "@/services/settingsService";

export default function LLMConfigTab() {
  const [settings, setSettings] = useState<LLMSettings>(getLLMSettings());
  const [customModel, setCustomModel] = useState("");
  const [customModelGM, setCustomModelGM] = useState("");

  useEffect(() => {
    const s = getLLMSettings();
    setSettings(s);
    // If current model isn't in presets, show it in custom field
    if (!OPENROUTER_MODELS.find((m) => m.id === s.LLM_MODEL)) {
      setCustomModel(s.LLM_MODEL);
    }
    if (!OPENROUTER_MODELS.find((m) => m.id === s.LLM_MODEL_GM)) {
      setCustomModelGM(s.LLM_MODEL_GM);
    }
  }, []);

  function update(patch: Partial<LLMSettings>) {
    const updated = saveLLMSettings(patch);
    setSettings(updated);
  }

  function handleReset() {
    const defaults = resetLLMSettings();
    setSettings(defaults);
    setCustomModel("");
    setCustomModelGM("");
    toast.success("Paramètres LLM réinitialisés");
  }

  const isPresetModel = (id: string) => OPENROUTER_MODELS.some((m) => m.id === id);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configuration LLM</h2>
          <p className="text-sm text-muted-foreground">
            Modèles OpenRouter, température, tokens — appliqués immédiatement à la prochaine conversation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Réinitialiser
        </Button>
      </div>

      {/* ===== MAX AGENT MODEL ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-base">🎭 Agent Max (conversation)</h3>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Modèle</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OPENROUTER_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  update({ LLM_MODEL: m.id });
                  setCustomModel("");
                  toast.success(`Max → ${m.label}`);
                }}
                className={`text-left p-3 border rounded-lg transition-colors ${
                  settings.LLM_MODEL === m.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{m.label}</span>
                  {settings.LLM_MODEL === m.id && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">actif</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{m.id}</p>
              </button>
            ))}
          </div>

          {/* Custom model input */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customModel || (!isPresetModel(settings.LLM_MODEL) ? settings.LLM_MODEL : "")}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Modèle custom OpenRouter (ex: deepseek/deepseek-r1)"
              className="flex-1 bg-muted/30 border rounded px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!customModel.trim()}
              onClick={() => {
                update({ LLM_MODEL: customModel.trim() });
                toast.success(`Max → ${customModel.trim()}`);
              }}
            >
              Appliquer
            </Button>
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">
              Température
            </label>
            <span className="text-sm font-mono">{settings.LLM_TEMPERATURE.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TEMPERATURE]}
            onValueChange={([v]) => update({ LLM_TEMPERATURE: v })}
            min={0}
            max={2}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Déterministe</span>
            <span>2 — Très créatif</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
            <span className="text-sm font-mono">{settings.LLM_MAX_TOKENS}</span>
          </div>
          <Slider
            value={[settings.LLM_MAX_TOKENS]}
            onValueChange={([v]) => update({ LLM_MAX_TOKENS: v })}
            min={50}
            max={2000}
            step={50}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>50 — Très court</span>
            <span>2000 — Long</span>
          </div>
        </div>

        {/* Top P */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Top P</label>
            <span className="text-sm font-mono">{settings.LLM_TOP_P.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TOP_P]}
            onValueChange={([v]) => update({ LLM_TOP_P: v })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Restrictif</span>
            <span>1 — Diversifié</span>
          </div>
        </div>
      </section>

      {/* ===== GAME MASTER MODEL ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-base">🎮 Game Master (analyse JSON)</h3>
        <p className="text-xs text-muted-foreground">
          Le Game Master analyse chaque échange et retourne un JSON. Un modèle rapide/léger suffit.
        </p>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Modèle</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OPENROUTER_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  update({ LLM_MODEL_GM: m.id });
                  setCustomModelGM("");
                  toast.success(`Game Master → ${m.label}`);
                }}
                className={`text-left p-3 border rounded-lg transition-colors ${
                  settings.LLM_MODEL_GM === m.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{m.label}</span>
                  {settings.LLM_MODEL_GM === m.id && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">actif</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customModelGM || (!isPresetModel(settings.LLM_MODEL_GM) ? settings.LLM_MODEL_GM : "")}
              onChange={(e) => setCustomModelGM(e.target.value)}
              placeholder="Modèle custom pour le Game Master"
              className="flex-1 bg-muted/30 border rounded px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!customModelGM.trim()}
              onClick={() => {
                update({ LLM_MODEL_GM: customModelGM.trim() });
                toast.success(`Game Master → ${customModelGM.trim()}`);
              }}
            >
              Appliquer
            </Button>
          </div>
        </div>

        {/* GM Temperature */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Température</label>
            <span className="text-sm font-mono">{settings.LLM_TEMPERATURE_GM.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TEMPERATURE_GM]}
            onValueChange={([v]) => update({ LLM_TEMPERATURE_GM: v })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Strict (JSON fiable)</span>
            <span>1 — Variable</span>
          </div>
        </div>

        {/* GM Max Tokens */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
            <span className="text-sm font-mono">{settings.LLM_MAX_TOKENS_GM}</span>
          </div>
          <Slider
            value={[settings.LLM_MAX_TOKENS_GM]}
            onValueChange={([v]) => update({ LLM_MAX_TOKENS_GM: v })}
            min={50}
            max={500}
            step={25}
            className="w-full"
          />
        </div>
      </section>

      {/* ===== CURRENT CONFIG SUMMARY ===== */}
      <section className="border rounded-lg p-4 bg-muted/20">
        <h3 className="font-semibold text-sm mb-2">📋 Config active</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap">
{JSON.stringify(settings, null, 2)}
        </pre>
      </section>
    </div>
  );
}
