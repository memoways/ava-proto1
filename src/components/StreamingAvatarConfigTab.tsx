import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getAvatarProviderStatus } from "@/services/streamingAvatar/api";
import {
  getStreamingAvatarSettings,
  loadStreamingAvatarSettingsFromDB,
  saveStreamingAvatarSettingsToDB,
  type StreamingAvatarProviderId,
  type StreamingAvatarSettings,
} from "@/services/streamingAvatar";

const providerCopy: Record<StreamingAvatarProviderId, { title: string; description: string }> = {
  heygen: {
    title: "HeyGen LiveAvatar",
    description: "Le texte Ava est envoyé avec avatar.speak_text. Le LLM HeyGen n'est pas utilisé.",
  },
  tavus: {
    title: "Tavus",
    description: "Une persona Echo reçoit conversation.echo : Perception, STT et LLM Tavus restent désactivés.",
  },
};

export default function StreamingAvatarConfigTab() {
  const [settings, setSettings] = useState<StreamingAvatarSettings>(
    getStreamingAvatarSettings,
  );
  const [saved, setSaved] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<StreamingAvatarProviderId, boolean> | null>(null);

  useEffect(() => {
    void loadStreamingAvatarSettingsFromDB()
      .then((value) => {
        setSettings(value);
        setSaved(value);
      })
      .finally(() => setLoading(false));
    void getAvatarProviderStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [saved, settings],
  );

  const update = (patch: Partial<StreamingAvatarSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await saveStreamingAvatarSettingsToDB(settings);
      setSaved(settings);
      toast.success("Configuration Streaming Avatar sauvegardée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Video className="h-5 w-5" />
          Streaming Avatar Config
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ava produit le texte final. Le fournisseur sélectionné ne fait que le prononcer et le rendre en vidéo temps réel.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(["heygen", "tavus"] as const).map((provider) => {
          const active = settings.activeProvider === provider;
          return (
            <button
              type="button"
              key={provider}
              onClick={() => update({ activeProvider: provider })}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{providerCopy[provider].title}</span>
                <ProviderStatus configured={status?.[provider]} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {providerCopy[provider].description}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexion et repli</CardTitle>
          <CardDescription>Les délais sont figés au début de chaque appel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="Timeout de connexion (ms)"
            value={settings.connectionTimeoutMs}
            min={3000}
            max={30000}
            onChange={(connectionTimeoutMs) => update({ connectionTimeoutMs })}
          />
          <NumberField
            label="Délai avant repli TTS (ms)"
            value={settings.fallbackTimeoutMs}
            min={1000}
            max={15000}
            onChange={(fallbackTimeoutMs) => update({ fallbackTimeoutMs })}
          />
        </CardContent>
      </Card>

      {settings.activeProvider === "heygen" ? (
        <HeyGenFields
          value={settings.heygen}
          onChange={(heygen) => update({ heygen })}
        />
      ) : (
        <TavusFields
          value={settings.tavus}
          onChange={(tavus) => update({ tavus })}
        />
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}

function HeyGenFields({
  value,
  onChange,
}: {
  value: StreamingAvatarSettings["heygen"];
  onChange: (value: StreamingAvatarSettings["heygen"]) => void;
}) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">HeyGen LiveAvatar</CardTitle>
        <CardDescription>Mode FULL commandé uniquement par avatar.speak_text.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <TextField label="Avatar ID" value={value.avatarId} onChange={(avatarId) => patch({ avatarId })} />
        <TextField label="Voice ID" value={value.voiceId} onChange={(voiceId) => patch({ voiceId })} />
        <TextField label="Context ID (optionnel)" value={value.contextId} onChange={(contextId) => patch({ contextId })} />
        <TextField label="Langue" value={value.language} onChange={(language) => patch({ language })} />
        <div className="space-y-2">
          <Label>Qualité</Label>
          <Select value={value.quality} onValueChange={(quality: typeof value.quality) => patch({ quality })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div><Label>Sandbox</Label><p className="text-xs text-muted-foreground">À garder actif pendant les essais.</p></div>
          <Switch checked={value.sandbox} onCheckedChange={(sandbox) => patch({ sandbox })} />
        </div>
      </CardContent>
    </Card>
  );
}

function TavusFields({
  value,
  onChange,
}: {
  value: StreamingAvatarSettings["tavus"];
  onChange: (value: StreamingAvatarSettings["tavus"]) => void;
}) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tavus</CardTitle>
        <CardDescription>La Persona ID doit être configurée en pipeline_mode « echo » dans Tavus. Elle porte la voix ; Ava fournit exclusivement le texte.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <TextField label="Replica ID" value={value.replicaId} onChange={(replicaId) => patch({ replicaId })} />
        <TextField label="Persona ID" value={value.personaId} onChange={(personaId) => patch({ personaId })} />
        <TextField label="Langue" value={value.language} onChange={(language) => patch({ language })} />
        <NumberField label="Durée maximale (s)" value={value.maxDurationSeconds} min={60} max={3600} onChange={(maxDurationSeconds) => patch({ maxDurationSeconds })} />
      </CardContent>
    </Card>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function ProviderStatus({ configured }: { configured?: boolean }) {
  if (configured === undefined) return <span className="text-xs text-muted-foreground">Statut inconnu</span>;
  return configured
    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Secret configuré</span>
    : <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />Secret absent</span>;
}
