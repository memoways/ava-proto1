import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  getGameplaySettings,
  loadGameplaySettingsFromDB,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  type GameplaySettings,
} from "@/services/settingsService";
import {
  MAX_SESSION_DURATION_SECONDS,
  MIN_SESSION_DURATION_SECONDS,
} from "@/config/experienceRuntime";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function GameMasterConfigTab() {
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [savedTimeout, setSavedTimeout] = useState(gameplay.TIMEOUT_SECONDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await loadGameplaySettingsFromDB();
      setGameplay(next);
      setSavedTimeout(next.TIMEOUT_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveTimeout = async () => {
    setSaving(true);
    try {
      const updated = saveGameplaySettings({ TIMEOUT_SECONDS: gameplay.TIMEOUT_SECONDS });
      await saveGameplaySettingsToDB(updated);
      setGameplay(updated);
      setSavedTimeout(updated.TIMEOUT_SECONDS);
      toast.success("Durée de session sauvegardée");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement de l’orchestration…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🎭 Orchestration de l’expérience</h2>
          <p className="text-sm text-muted-foreground">
            Réglages globaux de l’expérience. Le directeur post-tour se règle dans « Réglages GM », les personnages dans
            « Réglages personnages ».
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualiser</Button>
      </div>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Durée de l’expérience</h3>
            <p className="text-xs text-muted-foreground">
              C’est la durée maximale d’une session joueur. Le choix du prompt de Max (variantes legacy / rich_v2 /
              optimized_v3) se règle dans Technique avancée → LLM Config.
            </p>
          </div>
          <Button size="sm" onClick={() => void saveTimeout()} disabled={saving || gameplay.TIMEOUT_SECONDS === savedTimeout}>
            <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
          </Button>
        </div>
        <div className="flex justify-between text-sm">
          <span>Durée maximale de session</span>
          <span className="font-mono">{formatDuration(gameplay.TIMEOUT_SECONDS)} min:sec ({gameplay.TIMEOUT_SECONDS}s)</span>
        </div>
        <Slider
          value={[gameplay.TIMEOUT_SECONDS]}
          min={MIN_SESSION_DURATION_SECONDS}
          max={MAX_SESSION_DURATION_SECONDS}
          step={30}
          onValueChange={([value]) => setGameplay((current) => ({ ...current, TIMEOUT_SECONDS: value }))}
        />
      </section>

      <section className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        D’autres réglages globaux de l’expérience viendront s’ajouter ici.
      </section>
    </div>
  );
}
