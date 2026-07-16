import { useState } from "react";
import { RotateCcw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_STT_PROVIDER_SETTINGS,
  getSTTProviderSettings,
  saveSTTProviderSettings,
  type STTProviderSettingsMap,
} from "@/services/stt/providerSettings";
import type { STTProviderId } from "@/services/stt";

interface Props {
  providerId: STTProviderId;
}

/** Small labelled row helper. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
      <div className="min-w-0">
        <span className="block font-medium text-muted-foreground">{label}</span>
        {hint && <span className="block text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      <div className="justify-self-end">{children}</div>
    </label>
  );
}

function NumberInput({ value, onChange, min, max, step, width = 90 }: {
  value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; width?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number.parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
      className="rounded-md border bg-background px-2 py-1 text-right font-mono text-xs"
      style={{ width }}
    />
  );
}

function TextInput({ value, onChange, placeholder, width = 130 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-md border bg-background px-2 py-1 text-right font-mono text-xs"
      style={{ width }}
    />
  );
}

function Select<T extends string>({ value, onChange, options, width = 150 }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; width?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border bg-background px-2 py-1 text-xs"
      style={{ width }}
    >
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-md border px-2 py-1 text-xs font-mono ${value ? "bg-primary/20 border-primary/50 text-primary" : "bg-background text-muted-foreground"}`}
    >
      {value ? "true" : "false"}
    </button>
  );
}

export default function STTProviderSettingsPanel({ providerId }: Props) {
  const [settings, setSettings] = useState(() => getSTTProviderSettings(providerId));
  const [saved, setSaved] = useState(() => getSTTProviderSettings(providerId));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  function update<K extends keyof typeof settings>(patch: Partial<typeof settings>) {
    setSettings((prev) => ({ ...prev, ...patch }) as typeof settings);
  }

  async function save() {
    setSaving(true);
    try {
      const all = await saveSTTProviderSettings(providerId, settings as never);
      setSaved(all[providerId] as typeof settings);
      toast.success(`Réglages ${providerId} sauvegardés`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const defaults = DEFAULT_STT_PROVIDER_SETTINGS[providerId] as typeof settings;
    setSettings({ ...defaults });
    toast.info("Réglages réinitialisés — sauvegarde nécessaire");
  }

  const body = renderBody(providerId, settings, update);
  if (body === null) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Aucun réglage API exposé pour ce provider.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        <span>Réglages API — persistés en base pour toutes les sessions.</span>
      </div>
      <div className="space-y-2 rounded-md border border-border/50 bg-background/40 p-3">
        {body}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !dirty} className={dirty ? "bg-green-600 hover:bg-green-700" : ""}>
          <Save className="mr-2 h-3.5 w-3.5" />
          {saving ? "..." : "Sauver"}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Réinitialiser
        </Button>
        {dirty && <span className="text-[10px] text-amber-400">Non sauvegardé</span>}
      </div>
    </div>
  );
}

function renderBody<K extends STTProviderId>(
  providerId: K,
  s: STTProviderSettingsMap[K],
  update: (patch: Partial<STTProviderSettingsMap[K]>) => void,
): React.ReactNode | null {
  switch (providerId) {
    case "deepgram": {
      const dg = s as STTProviderSettingsMap["deepgram"];
      const set = update as (p: Partial<STTProviderSettingsMap["deepgram"]>) => void;
      return (
        <>
          <Row label="model" hint="nova-3 recommandé (supporte keyterm)">
            <Select
              value={dg.model}
              onChange={(v) => set({ model: v })}
              options={[
                { value: "nova-3", label: "nova-3" },
                { value: "nova-2", label: "nova-2" },
                { value: "nova-2-general", label: "nova-2-general" },
                { value: "enhanced", label: "enhanced" },
              ]}
            />
          </Row>
          <Row label="language" hint="fr-FR, en-US, multi…">
            <TextInput value={dg.language} onChange={(v) => set({ language: v })} placeholder="fr-FR" />
          </Row>
          <Row label="smart_format"><Toggle value={dg.smartFormat} onChange={(v) => set({ smartFormat: v })} /></Row>
          <Row label="punctuate"><Toggle value={dg.punctuate} onChange={(v) => set({ punctuate: v })} /></Row>
          <Row label="interim_results"><Toggle value={dg.interimResults} onChange={(v) => set({ interimResults: v })} /></Row>
          <Row label="vad_events"><Toggle value={dg.vadEvents} onChange={(v) => set({ vadEvents: v })} /></Row>
          <Row label="filler_words"><Toggle value={dg.fillerWords} onChange={(v) => set({ fillerWords: v })} /></Row>
          <Row label="numerals"><Toggle value={dg.numerals} onChange={(v) => set({ numerals: v })} /></Row>
          <Row label="endpointing (ms)" hint="0 = désactivé">
            <NumberInput value={dg.endpointing} onChange={(v) => set({ endpointing: Math.max(0, Math.min(2000, v)) })} min={0} max={2000} step={10} />
          </Row>
          <Row label="utterance_end_ms" hint="silence avant fin d'utterance">
            <NumberInput value={dg.utteranceEndMs} onChange={(v) => set({ utteranceEndMs: Math.max(0, Math.min(5000, v)) })} min={0} max={5000} step={100} />
          </Row>
        </>
      );
    }
    case "assemblyai": {
      const aa = s as STTProviderSettingsMap["assemblyai"];
      const set = update as (p: Partial<STTProviderSettingsMap["assemblyai"]>) => void;
      return (
        <>
          <Row label="format_turns" hint="Formatage ponctuation/casse"><Toggle value={aa.formatTurns} onChange={(v) => set({ formatTurns: v })} /></Row>
          <Row label="min_end_of_turn_silence (ms)" hint="200–2000">
            <NumberInput value={aa.minEndOfTurnSilenceWhenConfident} onChange={(v) => set({ minEndOfTurnSilenceWhenConfident: Math.max(200, Math.min(2000, v)) })} min={200} max={2000} step={50} />
          </Row>
          <Row label="end_of_turn_confidence" hint="0.1–1.0">
            <NumberInput value={aa.endOfTurnConfidenceThreshold} onChange={(v) => set({ endOfTurnConfidenceThreshold: Math.max(0.1, Math.min(1.0, v)) })} min={0.1} max={1.0} step={0.05} />
          </Row>
        </>
      );
    }
    case "openai_whisper": {
      const w = s as STTProviderSettingsMap["openai_whisper"];
      const set = update as (p: Partial<STTProviderSettingsMap["openai_whisper"]>) => void;
      return (
        <>
          <Row label="model">
            <Select
              value={w.model}
              onChange={(v) => set({ model: v })}
              options={[
                { value: "whisper-1", label: "whisper-1" },
                { value: "gpt-4o-transcribe", label: "gpt-4o-transcribe" },
                { value: "gpt-4o-mini-transcribe", label: "gpt-4o-mini-transcribe" },
              ]}
            />
          </Row>
          <Row label="language" hint="fr, en, auto">
            <TextInput value={w.language} onChange={(v) => set({ language: v })} placeholder="fr" width={80} />
          </Row>
          <Row label="temperature" hint="0.0 = déterministe">
            <NumberInput value={w.temperature} onChange={(v) => set({ temperature: Math.max(0, Math.min(1, v)) })} min={0} max={1} step={0.05} />
          </Row>
        </>
      );
    }
    case "gradium": {
      const g = s as STTProviderSettingsMap["gradium"];
      const set = update as (p: Partial<STTProviderSettingsMap["gradium"]>) => void;
      return (
        <>
          <Row label="language" hint="Hint envoyé via json_config">
            <TextInput value={g.language} onChange={(v) => set({ language: v })} placeholder="fr" width={80} />
          </Row>
          <p className="text-[10px] italic text-muted-foreground/70">
            L'API REST Gradium ne documente pas d'autres réglages STT à ce jour.
          </p>
        </>
      );
    }
    case "gamilab":
      return null;
    default:
      return null;
  }
}
