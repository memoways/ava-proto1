/**
 * What a character will really sound like on a device (per-device settings plan, lot 1).
 *
 * `describeEffectiveVoice()` is pure: it takes the settings the experience uses
 * and applies the same rules (output per device, speech engine of the device or
 * of the character profile, voice) so the admin summaries and the session
 * record never contradict what is played. `currentEffectiveVoiceInput()` reads
 * the current local copy of the settings (filled from the database by
 * `hydrateExperienceSettings()` for the player, and by the admin page).
 */
import { resolveCallOutputMode, type OutputModeReason } from "./callOutputMode";
import type { DeviceClass } from "./deviceClass";
import type { DeviceServiceSettings } from "./deviceServices";
import type { TTSProviderId } from "./tts/types";
import type { CharacterVoiceCatalogue } from "./tts/characterVoices";
import type { CartesiaSettings, FishSettings, GradiumSettings, InworldSettings } from "./tts/providerSettings";
import type { TTSSettings } from "./settingsService";
import type { OutputMode, StreamingAvatarProviderId, StreamingAvatarSettings } from "./streamingAvatar/types";

export type VoiceCharacter = "max" | "emma";

/** Where the played voice comes from. */
export type EffectiveVoiceSource =
  /** Voice chosen for this device (Services par appareil). */
  | "device"
  /** Character profile voice, as chosen in the TTS Config catalogue. */
  | "catalogue"
  /** Character profile voice (Réglages personnages), not in the catalogue. */
  | "profile"
  /** No voice chosen: the engine's own default voice. */
  | "engine_default"
  /** The avatar provider speaks with its own voice. */
  | "avatar";

export interface EffectiveVoiceEngines {
  elevenlabs: TTSSettings;
  gradium: GradiumSettings;
  fish: FishSettings;
  inworld: InworldSettings;
  cartesia: CartesiaSettings;
}

export interface EffectiveVoiceInput {
  device: DeviceClass;
  character: VoiceCharacter;
  /** Character runtime profile (engine and voice), `null` when unavailable. */
  profile: { ttsProvider: string | null; ttsVoiceId: string | null } | null;
  /** This device's services (Services par appareil). */
  deviceServices: DeviceServiceSettings;
  /** Global switch "Voix TTS / Avatar vidéo". */
  configuredOutput: OutputMode;
  avatar: StreamingAvatarSettings;
  /** TTS Config active engine (used when the profile names none). */
  activeProvider: TTSProviderId;
  catalogue: CharacterVoiceCatalogue;
  engines: EffectiveVoiceEngines;
}

export interface EffectiveVoiceSetting {
  label: string;
  value: string;
}

export interface EffectiveVoice {
  device: DeviceClass;
  character: VoiceCharacter;
  output: OutputMode;
  outputReason: OutputModeReason;
  /** Avatar provider when the output is the live avatar. */
  avatarProvider: StreamingAvatarProviderId | null;
  /** `ava`: Ava's speech engine plays the line (voice call, Tavus "voix Ava", LemonSlice); `avatar`: the provider's own voice. */
  speaker: "ava" | "avatar";
  /** Engine that produces the audio (Ava engine, or the avatar's engine when known). */
  engine: string;
  model: string | null;
  settings: EffectiveVoiceSetting[];
  voiceId: string | null;
  voiceSource: EffectiveVoiceSource;
  /** One line, the same everywhere: "ElevenLabs · eleven_v4_turbo · stabilité 0,38 · …". */
  summary: string;
}

export const ENGINE_LABELS: Record<TTSProviderId, string> = {
  elevenlabs: "ElevenLabs",
  gradium: "Gradium",
  fish: "Fish Audio",
  inworld: "Inworld",
  cartesia: "Cartesia",
};

export const AVATAR_LABELS: Record<StreamingAvatarProviderId, string> = {
  heygen: "HeyGen",
  tavus: "Tavus",
  anam: "Anam",
  lemonslice: "LemonSlice",
};

const VOICE_SOURCE_LABELS: Record<EffectiveVoiceSource, string> = {
  device: "appareil",
  catalogue: "catalogue",
  profile: "profil",
  engine_default: "défaut du moteur",
  avatar: "avatar",
};

const TTS_PROVIDERS: readonly TTSProviderId[] = ["elevenlabs", "gradium", "fish", "inworld", "cartesia"];

function asProvider(value: string | null | undefined): TTSProviderId | null {
  return TTS_PROVIDERS.includes(value as TTSProviderId) ? value as TTSProviderId : null;
}

function num(value: unknown, digits = 2): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

export function shortVoiceId(id: string | null): string {
  if (!id) return "";
  return id.length > 8 ? `${id.slice(0, 4)}…` : id;
}

/** Engine voice and settings, mirroring the provider requests (`ctx.voiceId || settings.voiceId`). */
function engineDetails(
  engine: TTSProviderId,
  character: VoiceCharacter,
  engines: EffectiveVoiceEngines,
): { model: string | null; settings: EffectiveVoiceSetting[]; engineVoice: string | null } {
  switch (engine) {
    case "elevenlabs": {
      const s = engines.elevenlabs;
      return {
        model: s.modelId,
        settings: [
          { label: "stabilité", value: num(s.stability) },
          { label: "style", value: num(s.style) },
          { label: "vitesse", value: num(s.speed) },
        ],
        // The ElevenLabs proxy applies its server default voice.
        engineVoice: null,
      };
    }
    case "gradium": {
      const s = engines.gradium;
      const override = s.byCharacter?.[character] ?? {};
      return {
        model: null,
        settings: [
          { label: "température", value: num(override.temp ?? s.temp) },
          { label: "similarité", value: num(override.cfgCoef ?? s.cfgCoef) },
          { label: "rythme", value: num(override.paddingBonus ?? s.paddingBonus) },
        ],
        engineVoice: s.voiceId || null,
      };
    }
    case "fish": {
      const s = engines.fish;
      return {
        model: s.model,
        settings: [
          { label: "température", value: num(s.temperature) },
          { label: "vitesse", value: num(s.speed) },
        ],
        engineVoice: s.referenceId || null,
      };
    }
    case "inworld": {
      const s = engines.inworld;
      return {
        model: s.modelId,
        settings: [
          { label: "rendu", value: s.deliveryMode },
          { label: "débit", value: num(s.speakingRate) },
        ],
        engineVoice: s.voiceId || null,
      };
    }
    case "cartesia": {
      const s = engines.cartesia;
      return { model: s.modelId, settings: [{ label: "langue", value: s.language }], engineVoice: s.voiceId || null };
    }
  }
}

/** Ava's speech engine and voice for a character on a device (same rule as `resolveDeviceVoice`). */
function avaSpeech(input: EffectiveVoiceInput): {
  engine: TTSProviderId;
  voiceId: string | null;
  voiceSource: EffectiveVoiceSource;
  model: string | null;
  settings: EffectiveVoiceSetting[];
} {
  const { profile, deviceServices, character, catalogue } = input;
  const deviceEngine = deviceServices.ttsProvider;
  const profileEngine = asProvider(profile?.ttsProvider);
  let engine: TTSProviderId;
  let voiceId: string | null;
  let voiceSource: EffectiveVoiceSource;
  if (deviceEngine) {
    engine = deviceEngine;
    const own = deviceServices.voiceIds[character]?.trim() || "";
    if (own) {
      voiceId = own;
      voiceSource = "device";
    } else if (profileEngine === deviceEngine && profile?.ttsVoiceId) {
      voiceId = profile.ttsVoiceId;
      voiceSource = "profile";
    } else {
      voiceId = null;
      voiceSource = "engine_default";
    }
  } else {
    // The experience passes the profile engine (else the TTS Config active engine) and the profile voice.
    engine = profileEngine ?? input.activeProvider;
    voiceId = profile?.ttsVoiceId || null;
    voiceSource = voiceId ? "profile" : "engine_default";
  }
  if (voiceSource === "profile" && voiceId && catalogue[character]?.[engine]?.trim() === voiceId) {
    voiceSource = "catalogue";
  }
  const details = engineDetails(engine, character, input.engines);
  if (!voiceId && details.engineVoice) voiceId = details.engineVoice;
  return { engine, voiceId, voiceSource, model: details.model, settings: details.settings };
}

function line(parts: Array<string | null | undefined | false>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function avaSummary(speech: ReturnType<typeof avaSpeech>): string {
  const voice = speech.voiceSource === "engine_default" && !speech.voiceId
    ? "voix par défaut du moteur"
    : `voix ${shortVoiceId(speech.voiceId)} (${VOICE_SOURCE_LABELS[speech.voiceSource]})`;
  return line([
    ENGINE_LABELS[speech.engine],
    speech.model,
    ...speech.settings.map((setting) => `${setting.label} ${setting.value}`),
    voice,
  ]);
}

export function describeEffectiveVoice(input: EffectiveVoiceInput): EffectiveVoice {
  const { device, character, deviceServices, avatar } = input;
  const decision = resolveCallOutputMode({
    startingCharacter: character,
    configuredMode: input.configuredOutput,
    deviceClass: device,
    deviceOutput: deviceServices.output,
  });
  const base = { device, character, output: decision.mode, outputReason: decision.reason };
  const avaVoice = (avatarProvider: StreamingAvatarProviderId | null, prefix?: string): EffectiveVoice => {
    const speech = avaSpeech(input);
    const summary = avaSummary(speech);
    return {
      ...base,
      avatarProvider,
      speaker: "ava",
      engine: speech.engine,
      model: speech.model,
      settings: speech.settings,
      voiceId: speech.voiceId,
      voiceSource: speech.voiceSource,
      summary: prefix ? `${prefix} : ${summary}` : summary,
    };
  };
  if (decision.mode !== "streaming_avatar") return avaVoice(null);

  const provider: StreamingAvatarProviderId = deviceServices.avatarProvider ?? avatar.activeProvider;
  const label = AVATAR_LABELS[provider] ?? provider;
  const avatarVoice = (engine: string, model: string | null, settings: EffectiveVoiceSetting[], voiceId: string | null, detail: string): EffectiveVoice => ({
    ...base,
    avatarProvider: provider,
    speaker: "avatar",
    engine,
    model,
    settings,
    voiceId,
    voiceSource: "avatar",
    summary: line([label, ...(model ? [model] : []), ...settings.map((s) => `${s.label} ${s.value}`), detail]),
  });

  if (provider === "tavus") {
    const override = avatar.tavus.characters?.[character] ?? {};
    const source = override.voiceSource ?? avatar.tavus.voiceSource ?? "ava";
    return source === "ava"
      ? avaVoice(provider, "Tavus · voix Ava")
      : avatarVoice("tavus", null, [], null, "voix de la source Tavus (PAL)");
  }
  if (provider === "lemonslice") return avaVoice(provider, "LemonSlice · voix Ava");
  if (provider === "anam") {
    const voiceId = avatar.anam.voiceId || null;
    return avatarVoice("anam", null, [], voiceId, voiceId ? `voix de l'avatar ${shortVoiceId(voiceId)}` : "voix de l'avatar Anam");
  }
  // HeyGen: its own engine; ElevenLabs settings are sent when chosen.
  const heygen = avatar.heygen;
  const voiceId = heygen.voiceId || null;
  const voice = voiceId ? `voix HeyGen ${shortVoiceId(voiceId)}` : "voix de l'avatar HeyGen";
  const engine = heygen.voiceSettings.engine;
  if (engine === "elevenLabs") {
    const eleven = heygen.voiceSettings.elevenLabs;
    return avatarVoice("heygen:elevenlabs", eleven.model, [
      { label: "stabilité", value: num(eleven.stability) },
      { label: "style", value: num(eleven.style) },
      { label: "vitesse", value: num(eleven.speed) },
    ], voiceId, `ElevenLabs via HeyGen · ${voice}`);
  }
  if (engine === "fish") {
    return avatarVoice("heygen:fish", heygen.voiceSettings.fish.model, [], voiceId, `Fish via HeyGen · ${voice}`);
  }
  if (engine === "cartesia") {
    return avatarVoice("heygen:cartesia", heygen.voiceSettings.cartesia.model, [], voiceId, `Cartesia via HeyGen · ${voice}`);
  }
  return avatarVoice("heygen", null, [], voiceId, voice);
}
