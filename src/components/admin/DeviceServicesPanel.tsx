import { useEffect, useMemo, useState } from "react";
import { Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEVICE_CLASSES, DEVICE_CLASS_LABELS, type DeviceClass } from "@/services/deviceClass";
import {
  DEVICE_TTS_PROVIDERS,
  TTS_PROVIDER_LABELS,
  getDeviceServices,
  loadDeviceServicesFromDB,
  saveDeviceServicesToDB,
  type DeviceOutputChoice,
  type DeviceServiceSettings,
  type DeviceServicesSettings,
} from "@/services/deviceServices";
import type { TTSProviderId } from "@/services/tts/types";
import {
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type SelectableStreamingAvatarProvider,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";
import { EffectiveVoiceBlock, useVoiceProfiles } from "@/components/admin/EffectiveVoiceSummary";

const OUTPUT_LABELS: Record<DeviceOutputChoice, string> = {
  settings: "Suivre l'interrupteur Voix TTS / Avatar vidéo",
  voice: "Appel vocal (voix seule)",
  avatar: "Avatar vidéo en direct",
};

const AVATAR_LABELS: Record<SelectableStreamingAvatarProvider, string> = {
  heygen: "HeyGen",
  tavus: "Tavus",
  anam: "Anam",
  lemonslice: "LemonSlice",
};

const DEFAULT_CHOICE = "default";

/**
 * Admin « Services par appareil » : output, avatar provider, speech engine and
 * voice for smartphone, tablet and desktop. Read when each call starts.
 */
export default function DeviceServicesPanel() {
  const [value, setValue] = useState<DeviceServicesSettings>(getDeviceServices);
  const [saved, setSaved] = useState(value);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profiles } = useVoiceProfiles();

  useEffect(() => {
    void loadDeviceServicesFromDB()
      .then((loaded) => { setValue(loaded); setSaved(loaded); })
      .catch(() => { /* local copy or defaults stay shown */ })
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [saved, value]);

  const patch = (device: DeviceClass, next: Partial<DeviceServiceSettings>) =>
    setValue((current) => ({ ...current, [device]: { ...current[device], ...next } }));

  const save = async () => {
    setSaving(true);
    try {
      await saveDeviceServicesToDB(value);
      setSaved(value);
      toast.success("Services par appareil sauvegardés");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="device-services-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorSmartphone className="h-4 w-4" />
          Services par appareil
        </CardTitle>
        <CardDescription>
          Sortie, avatar et voix de chaque type d'écran, lus au début de chaque appel. « Voix du personnage » garde le
          moteur et la voix réglés dans Orchestration. Un moteur choisi ici s'applique à la voix seule et aux replis ;
          un avatar Anam ou HeyGen garde sa propre voix. Emma démarre toujours en voix seule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : null}
        {DEVICE_CLASSES.map((device) => {
          const settings = value[device];
          return (
            <fieldset key={device} className="grid gap-3 rounded-md border p-3 md:grid-cols-2" aria-label={DEVICE_CLASS_LABELS[device]}>
              <legend className="px-1 text-sm font-semibold">{DEVICE_CLASS_LABELS[device]}</legend>
              <div className="space-y-1.5">
                <Label htmlFor={`device-${device}-output`}>Sortie</Label>
                <Select value={settings.output} onValueChange={(output) => patch(device, { output: output as DeviceOutputChoice })}>
                  <SelectTrigger id={`device-${device}-output`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OUTPUT_LABELS) as DeviceOutputChoice[]).map((choice) => (
                      <SelectItem key={choice} value={choice}>{OUTPUT_LABELS[choice]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`device-${device}-avatar`}>Avatar vidéo</Label>
                <Select
                  value={settings.avatarProvider ?? DEFAULT_CHOICE}
                  onValueChange={(provider) => patch(device, {
                    avatarProvider: provider === DEFAULT_CHOICE ? null : provider as SelectableStreamingAvatarProvider,
                  })}
                  disabled={settings.output === "voice"}
                >
                  <SelectTrigger id={`device-${device}-avatar`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_CHOICE}>Fournisseur actif (Streaming Avatar)</SelectItem>
                    {SELECTABLE_STREAMING_AVATAR_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>{AVATAR_LABELS[provider]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`device-${device}-tts`}>Moteur de voix</Label>
                <Select
                  value={settings.ttsProvider ?? DEFAULT_CHOICE}
                  onValueChange={(provider) => patch(device, {
                    ttsProvider: provider === DEFAULT_CHOICE ? null : provider as TTSProviderId,
                  })}
                >
                  <SelectTrigger id={`device-${device}-tts`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_CHOICE}>Voix du personnage (Orchestration)</SelectItem>
                    {DEVICE_TTS_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>{TTS_PROVIDER_LABELS[provider]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["max", "emma"] as const).map((character) => (
                  <div key={character} className="space-y-1.5">
                    <Label htmlFor={`device-${device}-voice-${character}`}>Voix {character === "max" ? "Max" : "Emma"}</Label>
                    <Input
                      id={`device-${device}-voice-${character}`}
                      value={settings.voiceIds[character]}
                      placeholder={settings.ttsProvider ? "ID de voix (vide : voix du personnage ou par défaut)" : "—"}
                      disabled={!settings.ttsProvider}
                      onChange={(event) => patch(device, { voiceIds: { ...settings.voiceIds, [character]: event.target.value } })}
                    />
                  </div>
                ))}
              </div>
              <div className="md:col-span-2">
                <EffectiveVoiceBlock devices={[device]} profiles={profiles} overrides={() => ({ deviceServices: settings })} />
              </div>
            </fieldset>
          );
        })}
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
