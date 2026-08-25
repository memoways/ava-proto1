import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, RotateCcw, ChevronDown, ChevronUp, Zap, Scale, Sparkles, Brain } from "lucide-react";
import {
  getLLMSettings,
  saveLLMSettingsLocal,
  saveLLMSettingsToDB,
  loadLLMSettingsFromDB,
  resetLLMSettings,
  listLlmConfigModels,
  getLastLLMValidationIssues,
  getLLMValidationErrorMessage,
  isSupportedOpenRouterModel,
  type LLMSettings,
  type OpenRouterModel,
} from "@/services/settingsService";

const TIER_META: Record<string, { icon: typeof Zap; label: string; className: string }> = {
  fast: { icon: Zap, label: "Rapide", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  balanced: { icon: Scale, label: "Équilibré", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  premium: { icon: Sparkles, label: "Premium", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

function ModelCard({
  model,
  active,
  expanded,
  reasoningEnabled,
  onSelect,
  onToggle,
  onToggleReasoning,
}: {
  model: OpenRouterModel;
  active: boolean;
  expanded: boolean;
  reasoningEnabled: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onToggleReasoning: (enabled: boolean) => void;
}) {
  const tier = TIER_META[model.tier] ?? TIER_META.balanced;
  const TierIcon = tier.icon;
  return (
    <div
      className={`text-left border rounded-lg transition-colors ${
        active ? "bg-primary/10 border-primary" : "hover:bg-accent/50"
      }`}
    >
      <button onClick={onSelect} className="w-full text-left p-3">
        <div className="flex justify-between items-center gap-2">
          <span className="font-medium text-sm">{model.label}</span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${tier.className}`}>
              <TierIcon className="w-2.5 h-2.5" />
              {tier.label}
            </span>
            {active && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">actif</span>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
        <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{model.id}</p>
      </button>
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground"
          title="Active le mode raisonnement du modèle (plus lent, plus coûteux, meilleure analyse). Désactivé par défaut."
        >
          <Brain className="w-3 h-3" />
          <span>Reasoning</span>
          <Switch checked={reasoningEnabled} onCheckedChange={onToggleReasoning} className="scale-75 ml-1" />
          <span className={reasoningEnabled ? "text-primary" : "text-muted-foreground/60"}>
            {reasoningEnabled ? "ON" : "OFF"}
          </span>
        </label>
      </div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-t border-border/50 hover:bg-accent/30"
      >
        <span>
          💰 In {model.costInput} · Out {model.costOutput} <span className="text-muted-foreground/60">/ 1M tok</span>
        </span>
        <span className="flex items-center gap-1">
          {expanded ? "Masquer" : "Détails"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-border/50">
          <div>
            <div className="font-semibold text-emerald-400 mb-1">✓ Avantages</div>
            <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
              {model.pros.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-orange-400 mb-1">✗ Inconvénients</div>
            <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
              {model.cons.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LLMConfigTab() {
  const [settings, setSettings] = useState<LLMSettings>(getLLMSettings());
  const [savedSettings, setSavedSettings] = useState<LLMSettings>(getLLMSettings());
  const [customModel, setCustomModel] = useState("");
  const [customModelGM, setCustomModelGM] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedMax, setExpandedMax] = useState<string | null>(null);
  const [expandedGM, setExpandedGM] = useState<string | null>(null);

  useEffect(() => {
    loadLLMSettingsFromDB().then((s) => {
      const validationIssues = getLastLLMValidationIssues();
      setSettings(s);
      setSavedSettings(s);
      if (validationIssues.length) {
        toast.error(getLLMValidationErrorMessage(validationIssues));
      }
    });
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function updateLocal(patch: Partial<LLMSettings>) {
    const updated = saveLLMSettingsLocal(patch);
    setSettings(updated);
  }

  async function handleSave() {
    setSaving(true);
    await saveLLMSettingsToDB(settings);
    setSavedSettings(settings);
    toast.success("Réglages LLM sauvegardés ✓");
    setSaving(false);
  }

  function handleReset() {
    const defaults = resetLLMSettings();
    setSettings(defaults);
    setSavedSettings(defaults);
    setCustomModel("");
    setCustomModelGM("");
    toast.success("Paramètres LLM réinitialisés");
  }

  const catalog = listLlmConfigModels();

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configuration LLM</h2>
          <p className="text-sm text-muted-foreground">
            Modèles OpenRouter, température, tokens — clique "Sauvegarder" pour persister les changements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" /> Réinitialiser
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}
            className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
            <Save className="w-3 h-3 mr-1" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 text-sm text-yellow-300">
          ⚠️ Modifications non sauvegardées — clique "Sauvegarder" pour persister en base de données.
        </div>
      )}

      {/* ===== MAX AGENT MODEL ===== */}
      <section className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-base">🎭 Agent Max (conversation)</h3>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Modèle</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {catalog.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                active={settings.LLM_MODEL === m.id}
                expanded={expandedMax === m.id}
                reasoningEnabled={settings.LLM_REASONING?.[m.id] === true}
                onSelect={() => {
                  updateLocal({ LLM_MODEL: m.id });
                  setCustomModel("");
                }}
                onToggle={() => setExpandedMax(expandedMax === m.id ? null : m.id)}
                onToggleReasoning={(enabled) =>
                  updateLocal({ LLM_REASONING: { ...settings.LLM_REASONING, [m.id]: enabled } })
                }
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Modèle custom OpenRouter (ex: deepseek/deepseek-r1)"
              className="flex-1 bg-muted/30 border rounded px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!customModel.trim()}
              onClick={() => {
                const modelId = customModel.trim();
                if (!isSupportedOpenRouterModel(modelId)) {
                  toast.error(`Modèle OpenRouter non supporté : ${modelId}`);
                  return;
                }
                updateLocal({ LLM_MODEL: modelId });
                setCustomModel("");
              }}
            >
              Appliquer
            </Button>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Température</label>
            <span className="text-sm font-mono">{settings.LLM_TEMPERATURE.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TEMPERATURE]}
            onValueChange={([v]) => updateLocal({ LLM_TEMPERATURE: v })}
            min={0} max={2} step={0.05}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Déterministe</span>
            <span>2 — Très créatif</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
            <span className="text-sm font-mono">{settings.LLM_MAX_TOKENS}</span>
          </div>
          <Slider
            value={[settings.LLM_MAX_TOKENS]}
            onValueChange={([v]) => updateLocal({ LLM_MAX_TOKENS: v })}
            min={50} max={2000} step={50}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>50 — Très court</span>
            <span>2000 — Long</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Top P</label>
            <span className="text-sm font-mono">{settings.LLM_TOP_P.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TOP_P]}
            onValueChange={([v]) => updateLocal({ LLM_TOP_P: v })}
            min={0} max={1} step={0.05}
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
            {catalog.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                active={settings.LLM_MODEL_GM === m.id}
                expanded={expandedGM === m.id}
                reasoningEnabled={settings.LLM_REASONING?.[m.id] === true}
                onSelect={() => {
                  updateLocal({ LLM_MODEL_GM: m.id });
                  setCustomModelGM("");
                }}
                onToggle={() => setExpandedGM(expandedGM === m.id ? null : m.id)}
                onToggleReasoning={(enabled) =>
                  updateLocal({ LLM_REASONING: { ...settings.LLM_REASONING, [m.id]: enabled } })
                }
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customModelGM}
              onChange={(e) => setCustomModelGM(e.target.value)}
              placeholder="Modèle custom pour le Game Master"
              className="flex-1 bg-muted/30 border rounded px-3 py-2 text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!customModelGM.trim()}
              onClick={() => {
                const modelId = customModelGM.trim();
                if (!isSupportedOpenRouterModel(modelId)) {
                  toast.error(`Modèle OpenRouter non supporté : ${modelId}`);
                  return;
                }
                updateLocal({ LLM_MODEL_GM: modelId });
                setCustomModelGM("");
              }}
            >
              Appliquer
            </Button>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Température</label>
            <span className="text-sm font-mono">{settings.LLM_TEMPERATURE_GM.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.LLM_TEMPERATURE_GM]}
            onValueChange={([v]) => updateLocal({ LLM_TEMPERATURE_GM: v })}
            min={0} max={1} step={0.05}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 — Strict (JSON fiable)</span>
            <span>1 — Variable</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
            <span className="text-sm font-mono">{settings.LLM_MAX_TOKENS_GM}</span>
          </div>
          <Slider
            value={[settings.LLM_MAX_TOKENS_GM]}
            onValueChange={([v]) => updateLocal({ LLM_MAX_TOKENS_GM: v })}
            min={50} max={500} step={25}
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
