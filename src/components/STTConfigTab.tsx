import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_STT_SETTINGS,
  STT_PROVIDER_LIST,
  getSTTProviderRuntimeStatuses,
  getSTTSettings,
  loadSTTSettingsFromDB,
  resetSTTSettings,
  resetSTTRuntimeConfigCache,
  saveSTTSettingsLocal,
  saveSTTSettingsToDB,
  type STTProviderId,
  type STTProviderStatus,
  type STTSettings,
} from "@/services/stt";
import type { STTProviderRuntimeStatus } from "@/services/stt/types";

const STATUS_LABELS: Record<STTProviderStatus, string> = {
  ready: "Configuré",
  missing_config: "Non configuré",
  error: "Erreur",
  disabled: "Préparé",
};

const STATUS_VARIANTS: Record<STTProviderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  missing_config: "outline",
  error: "destructive",
  disabled: "secondary",
};

export default function STTConfigTab() {
  const [settings, setSettings] = useState<STTSettings>(getSTTSettings());
  const [saved, setSaved] = useState<STTSettings>(getSTTSettings());
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState<Record<STTProviderId, STTProviderRuntimeStatus> | null>(null);

  useEffect(() => {
    loadSTTSettingsFromDB().then((loaded) => {
      setSettings(loaded);
      setSaved(loaded);
    });
    refreshStatuses();
  }, []);

  const hasChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  function refreshStatuses() {
    resetSTTRuntimeConfigCache();
    getSTTProviderRuntimeStatuses()
      .then(setStatuses)
      .catch((err) => {
        console.warn("[STT Config] status refresh failed:", err);
        toast.error("Impossible de vérifier les statuts STT");
      });
  }

  function activate(provider: STTProviderId) {
    const next = saveSTTSettingsLocal({ activeProvider: provider });
    setSettings(next);
    toast.info("Provider STT sélectionné — sauvegarde nécessaire");
  }

  async function save() {
    setSaving(true);
    try {
      await saveSTTSettingsToDB(settings);
      setSaved(settings);
      toast.success("Configuration STT sauvegardée");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const next = resetSTTSettings();
    setSettings(next);
    setSaved(next);
    toast.success("Configuration STT réinitialisée sur Deepgram");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">STT Config — Input vocal</h2>
        <p className="text-sm text-muted-foreground">
          Choisis le provider global utilisé pour transcrire le micro avant le pipeline LLM/TTS.
        </p>
      </div>

      {hasChanges && (
        <div className="rounded-md border border-yellow-700/50 bg-yellow-900/30 px-3 py-2 text-xs text-yellow-300">
          Modifications STT non sauvegardées. Le runtime local les voit déjà, mais Lovable/Supabase utilisera la valeur sauvegardée.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {STT_PROVIDER_LIST.map((provider) => {
          const isActive = settings.activeProvider === provider.id;
          const status = statuses?.[provider.id]?.status ?? "missing_config";
          const message = statuses?.[provider.id]?.message;
          const secrets = provider.expectedSecrets.join(", ");

          return (
            <div
              key={provider.id}
              className={`rounded-lg border p-4 transition-colors ${
                isActive ? "border-primary bg-primary/10" : "border-border bg-card/40"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{provider.label}</h3>
                    {isActive && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Mode : {provider.mode}</p>
                <p>Secrets attendus : <span className="font-mono">{secrets}</span></p>
                {message && (
                  <p className={status === "ready" ? "text-primary" : "text-amber-400"}>
                    {status !== "ready" && <AlertCircle className="mr-1 inline h-3 w-3" />}
                    {message}
                  </p>
                )}
                {!provider.implemented && (
                  <p>Provider préparé dans l’admin. Le runtime retombe sur Deepgram tant que l’intégration n’est pas finalisée.</p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "outline"}
                  onClick={() => activate(provider.id)}
                  disabled={isActive}
                >
                  {isActive ? "Actif" : "Activer"}
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving || !hasChanges} className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
        <Button variant="outline" onClick={refreshStatuses}>
          Vérifier les statuts
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Deepgram
        </Button>
        <p className="text-xs text-muted-foreground">
          Défaut sans config : {DEFAULT_STT_SETTINGS.activeProvider}.
        </p>
      </div>
    </div>
  );
}
