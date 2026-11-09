import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEVICE_CLASSES, DEVICE_CLASS_LABELS, type DeviceClass } from "@/services/deviceClass";
import {
  DEVICE_TTS_PROVIDERS,
  TTS_PROVIDER_LABELS,
  VOICE_CHARACTERS,
  dropRedundantLegacyVoices,
  getDeviceServices,
  isLegacyDeviceServices,
  legacyVoiceConflicts,
  loadDeviceServicesRawFromDB,
  saveDeviceServicesToDB,
  type DeviceOutputChoice,
  type DeviceServiceSettings,
  type DeviceServicesSettings,
  type VoiceCharacter,
} from "@/services/deviceServices";
import type { TTSProviderId } from "@/services/tts/types";
import { getCharacterVoices, loadCharacterVoicesFromDB, type CharacterVoiceCatalogue } from "@/services/tts/characterVoices";
import { getActiveProviderId, loadActiveProviderFromDB, setActiveProvider } from "@/services/tts/providerSettings";
import { getSTTSettings, loadSTTSettingsFromDB } from "@/services/stt/settings";
import { getSTTProviderDefinition } from "@/services/stt/registry";
import { adminTabPath } from "@/services/adminNavigation";
import { shortVoiceId } from "@/services/effectiveVoice";
import {
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type SelectableStreamingAvatarProvider,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";
import { EffectiveVoiceLine, useVoiceProfiles } from "@/components/admin/EffectiveVoiceSummary";

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

const CHARACTER_LABELS: Record<VoiceCharacter, string> = { max: "Max", emma: "Emma" };

const OWN_VOICE = "own";

/**
 * Admin Expérience › Appareils (per-device settings plan, lot 2): one hierarchy
 * Device → Character → Engine. For each device: output, avatar provider and the
 * speech-to-text engine (shown, set in STT Config); then Max's and Emma's speech
 * engine. The voice comes from the TTS Config catalogue. Each choice shows what
 * will really be played (same function as the experience). Read when each call starts.
 */
export default function DevicesTab() {
  const [value, setValue] = useState<DeviceServicesSettings>(getDeviceServices);
  const [saved, setSaved] = useState(value);
  const [legacyFormat, setLegacyFormat] = useState(false);
  const [catalogue, setCatalogue] = useState<CharacterVoiceCatalogue>(getCharacterVoices);
  const [fallbackEngine, setFallbackEngine] = useState<TTSProviderId>(getActiveProviderId);
  const [sttProvider, setSttProvider] = useState(() => getSTTSettings().activeProvider);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profiles } = useVoiceProfiles();

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadDeviceServicesRawFromDB(),
      loadCharacterVoicesFromDB().catch(() => getCharacterVoices()),
      loadActiveProviderFromDB().catch(() => getActiveProviderId()),
      loadSTTSettingsFromDB().catch(() => getSTTSettings()),
    ])
      .then(([services, voices, engine, stt]) => {
        if (!active) return;
        setValue(services.value);
        setSaved(services.value);
        setLegacyFormat(isLegacyDeviceServices(services.raw));
        setCatalogue(voices);
        setFallbackEngine(engine);
        setSttProvider(stt.activeProvider);
      })
      .catch(() => { /* local copy or defaults stay shown */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [saved, value]);
  const conflicts = useMemo(() => legacyVoiceConflicts(value, catalogue), [catalogue, value]);

  const patch = (device: DeviceClass, next: Partial<DeviceServiceSettings>) =>
    setValue((current) => ({ ...current, [device]: { ...current[device], ...next } }));

  const setEngine = (device: DeviceClass, character: VoiceCharacter, engine: TTSProviderId | null) =>
    setValue((current) => {
      const previous = current[device].characters[character];
      // A former typed voice only makes sense for its own engine.
      const legacyVoiceId = engine && engine === previous.ttsProvider ? previous.legacyVoiceId : "";
      return {
        ...current,
        [device]: {
          ...current[device],
          characters: { ...current[device].characters, [character]: { ttsProvider: engine, legacyVoiceId } },
        },
      };
    });

  const adoptCatalogueVoice = (device: DeviceClass, character: VoiceCharacter) =>
    setValue((current) => ({
      ...current,
      [device]: {
        ...current[device],
        characters: {
          ...current[device].characters,
          [character]: { ...current[device].characters[character], legacyVoiceId: "" },
        },
      },
    }));

  const save = async () => {
    setSaving(true);
    try {
      const confirmed = await saveDeviceServicesToDB(dropRedundantLegacyVoices(value, catalogue));
      setValue(confirmed);
      setSaved(confirmed);
      setLegacyFormat(false);
      toast.success("Appareils sauvegardés");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  };

  const changeFallbackEngine = async (engine: TTSProviderId) => {
    const previous = fallbackEngine;
    setFallbackEngine(engine);
    try {
      await setActiveProvider(engine);
      toast.success(`Moteur de repli : ${TTS_PROVIDER_LABELS[engine]}`);
    } catch (error) {
      setFallbackEngine(previous);
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    }
  };

  const sttLabel = getSTTProviderDefinition(sttProvider)?.label ?? sttProvider;

  return (
    <Card data-testid="device-services-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorSmartphone className="h-4 w-4" />
          Appareils
        </CardTitle>
        <CardDescription>
          Appareil → personnage → moteur. Pour chaque type d'écran : sortie, avatar et transcription, puis le moteur de
          voix de Max et d'Emma. La voix vient du catalogue de TTS Config ; les réglages fins de chaque moteur restent
          dans Technique avancée. Lu au début de chaque appel. Emma démarre toujours en voix seule ; un avatar Anam ou
          HeyGen garde sa propre voix.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        ) : null}

        {legacyFormat ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs" data-testid="device-services-legacy">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Ancien format lu sans perte : le moteur commun de chaque appareil s'applique à Max et à Emma, et les ID de voix
            saisis sont conservés. Sauvegardez pour enregistrer le nouveau format.
          </p>
        ) : null}

        <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="device-fallback-engine">Moteur de repli</Label>
            <Select value={fallbackEngine} onValueChange={(engine) => void changeFallbackEngine(engine as TTSProviderId)}>
              <SelectTrigger id="device-fallback-engine"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEVICE_TTS_PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>{TTS_PROVIDER_LABELS[provider]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Utilisé quand un personnage n'a pas de moteur dans Réglages personnages. Sauvegardé immédiatement.
            </p>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>
              <a className="underline" href={adminTabPath("voice")}>Catalogue des voix et réglages fins (TTS Config)</a>
            </p>
            <p>
              <a className="underline" href={adminTabPath("character-runtime")}>Voix propre de chaque personnage (Réglages personnages)</a>
            </p>
          </div>
        </div>

        {DEVICE_CLASSES.map((device) => {
          const settings = value[device];
          return (
            <fieldset key={device} className="grid gap-3 rounded-md border p-3 md:grid-cols-3" aria-label={DEVICE_CLASS_LABELS[device]}>
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
                  value={settings.avatarProvider ?? "default"}
                  onValueChange={(provider) => patch(device, {
                    avatarProvider: provider === "default" ? null : provider as SelectableStreamingAvatarProvider,
                  })}
                  disabled={settings.output === "voice"}
                >
                  <SelectTrigger id={`device-${device}-avatar`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Fournisseur actif (Streaming Avatar)</SelectItem>
                    {SELECTABLE_STREAMING_AVATAR_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>{AVATAR_LABELS[provider]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-none">Transcription (STT)</p>
                <p className="pt-2 text-sm" data-testid={`device-${device}-stt`}>
                  {sttLabel}{" "}
                  <a className="text-xs text-muted-foreground underline" href={adminTabPath("stt")}>réglé dans STT Config</a>
                </p>
              </div>

              {VOICE_CHARACTERS.map((character) => {
                const entry = settings.characters[character];
                const engine = entry.ttsProvider;
                const catalogueVoice = engine ? catalogue[character]?.[engine]?.trim() || null : null;
                const conflict = conflicts.find((item) => item.device === device && item.character === character);
                return (
                  <div key={character} className="space-y-1.5 rounded-md bg-muted/30 p-2 md:col-span-3">
                    <div className="grid gap-2 md:grid-cols-3 md:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor={`device-${device}-tts-${character}`}>Moteur de voix — {CHARACTER_LABELS[character]}</Label>
                        <Select
                          value={engine ?? OWN_VOICE}
                          onValueChange={(choice) => setEngine(device, character, choice === OWN_VOICE ? null : choice as TTSProviderId)}
                        >
                          <SelectTrigger id={`device-${device}-tts-${character}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={OWN_VOICE}>Voix du personnage (Réglages personnages)</SelectItem>
                            {DEVICE_TTS_PROVIDERS.map((provider) => (
                              <SelectItem key={provider} value={provider}>{TTS_PROVIDER_LABELS[provider]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground md:col-span-2" data-testid={`device-${device}-catalogue-${character}`}>
                        {!engine
                          ? "Moteur et voix du personnage."
                          : catalogueVoice
                            ? <>Voix du catalogue : <span title={catalogueVoice}>{shortVoiceId(catalogueVoice)}</span></>
                            : <>Aucune voix {CHARACTER_LABELS[character]} pour {TTS_PROVIDER_LABELS[engine]} dans le catalogue : voix du personnage si elle utilise ce moteur, sinon voix par défaut du moteur. <a className="underline" href={adminTabPath("voice")}>Compléter le catalogue</a></>}
                      </p>
                    </div>
                    {conflict ? (
                      <p className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs" data-testid={`device-${device}-legacy-${character}`}>
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        ID saisi conservé ({shortVoiceId(conflict.legacyVoiceId)}), différent du catalogue
                        {conflict.catalogueVoiceId ? ` (${shortVoiceId(conflict.catalogueVoiceId)})` : " (vide)"} : c'est lui qui est joué.
                        <Button size="sm" variant="outline" className="h-7" onClick={() => adoptCatalogueVoice(device, character)}>
                          Utiliser le catalogue
                        </Button>
                      </p>
                    ) : null}
                    <EffectiveVoiceLine
                      device={device}
                      character={character}
                      profile={profiles[character]}
                      overrides={{ deviceServices: settings, catalogue }}
                    />
                  </div>
                );
              })}
            </fieldset>
          );
        })}
        <div className="flex justify-end">
          <Button onClick={save} disabled={(!dirty && !legacyFormat) || saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
