import { useEffect, useState } from "react";
import type { DeviceClass } from "@/services/deviceClass";
import { DEVICE_CLASS_LABELS } from "@/services/deviceClass";
import type { VoiceCharacter } from "@/services/effectiveVoice";
import { describeCurrentEffectiveVoice, type EffectiveVoiceOverrides } from "@/services/effectiveVoiceCurrent";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { startExperienceSettingsLoad } from "@/services/experienceSettings";

export type VoiceProfiles = Record<VoiceCharacter, { ttsProvider: string | null; ttsVoiceId: string | null } | null>;

const CHARACTER_LABELS: Record<VoiceCharacter, string> = { max: "Max", emma: "Emma" };

/**
 * Max and Emma runtime profiles for the active environment (same RPC as the
 * experience), after the experience settings load so the summary reads the
 * database values. `overrideProfiles` lets an editor show its unsaved choice.
 */
export function useVoiceProfiles(): { profiles: VoiceProfiles; ready: boolean } {
  const [profiles, setProfiles] = useState<VoiceProfiles>({ max: null, emma: null });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      await startExperienceSettingsLoad().catch(() => null);
      const [max, emma] = await Promise.all([
        getCharacterRuntimeReadiness("max").catch(() => null),
        getCharacterRuntimeReadiness("emma").catch(() => null),
      ]);
      if (!active) return;
      setProfiles({
        max: max ? { ttsProvider: max.ttsProvider, ttsVoiceId: max.ttsVoiceId } : null,
        emma: emma ? { ttsProvider: emma.ttsProvider, ttsVoiceId: emma.ttsVoiceId } : null,
      });
      setReady(true);
    })();
    return () => { active = false; };
  }, []);
  return { profiles, ready };
}

interface LineProps {
  device: DeviceClass;
  character: VoiceCharacter;
  profile: VoiceProfiles[VoiceCharacter];
  overrides?: EffectiveVoiceOverrides;
  showDevice?: boolean;
}

/** One line: what this character will really play on this device. */
export function EffectiveVoiceLine({ device, character, profile, overrides, showDevice }: LineProps) {
  const voice = describeCurrentEffectiveVoice(device, character, profile, overrides);
  return (
    <p
      className="text-xs text-muted-foreground"
      data-testid={`effective-voice-${device}-${character}`}
      title={voice.voiceId ?? undefined}
    >
      <span className="font-medium text-foreground">
        Joué{showDevice ? ` · ${DEVICE_CLASS_LABELS[device]}` : ""} · {CHARACTER_LABELS[character]} :
      </span>{" "}
      {voice.summary}
    </p>
  );
}

interface BlockProps {
  devices: readonly DeviceClass[];
  characters?: readonly VoiceCharacter[];
  profiles: VoiceProfiles;
  overrides?: (device: DeviceClass) => EffectiveVoiceOverrides | undefined;
  title?: string;
}

/** Summary lines for several devices and characters (Max and Emma by default). */
export function EffectiveVoiceBlock({ devices, characters = ["max", "emma"], profiles, overrides, title }: BlockProps) {
  return (
    <div className="space-y-1 rounded-md bg-muted/40 p-2" data-testid="effective-voice-block">
      {title ? <p className="text-xs font-semibold">{title}</p> : null}
      {devices.map((device) => characters.map((character) => (
        <EffectiveVoiceLine
          key={`${device}-${character}`}
          device={device}
          character={character}
          profile={profiles[character]}
          overrides={overrides?.(device)}
          showDevice={devices.length > 1}
        />
      )))}
    </div>
  );
}
