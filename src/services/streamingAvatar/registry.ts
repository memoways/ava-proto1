import { normalizeCharacterNames } from "@/services/characterNames";
import { LocalTTSOutput } from "./localTtsOutput";
import type {
  OutputMode,
  ResponseOutput,
  ResponseOutputCallbacks,
  ResponseOutputTurnContext,
  StreamingAvatarProviderId,
  StreamingAvatarSettings,
} from "./types";

export interface ResponseOutputFactoryContext {
  mode: OutputMode;
  avatarSettings: StreamingAvatarSettings;
  callbacks?: ResponseOutputCallbacks;
}

type AvatarOutputFactory = (
  settings: StreamingAvatarSettings,
  callbacks: ResponseOutputCallbacks,
) => Promise<ResponseOutput>;

const avatarProviders: Record<StreamingAvatarProviderId, AvatarOutputFactory> = {
  heygen: async (settings, callbacks) => {
    const { HeyGenStreamingAvatarOutput } = await import("./providers/heygen");
    return new HeyGenStreamingAvatarOutput(
      settings.heygen,
      callbacks,
      settings.connectionTimeoutMs,
      settings.fallbackTimeoutMs,
    );
  },
  tavus: async (settings, callbacks) => {
    const { TavusStreamingAvatarOutput } = await import("./providers/tavus");
    return new TavusStreamingAvatarOutput(
      settings.tavus,
      callbacks,
      settings.connectionTimeoutMs,
      settings.fallbackTimeoutMs,
    );
  },
  anam: async (settings, callbacks) => {
    const { AnamStreamingAvatarOutput } = await import("./providers/anam");
    return new AnamStreamingAvatarOutput(
      settings.anam,
      callbacks,
      settings.connectionTimeoutMs,
      settings.fallbackTimeoutMs,
    );
  },
  lemonslice: async (settings, callbacks) => {
    const { LemonSliceStreamingAvatarOutput } = await import("./providers/lemonslice");
    return new LemonSliceStreamingAvatarOutput(
      settings.lemonslice,
      callbacks,
      settings.connectionTimeoutMs,
      settings.fallbackTimeoutMs,
    );
  },
};

/**
 * Last line of defence for character names: whatever the provider (local TTS or a
 * video avatar that voices the text itself), it only ever receives "Ava", never "Eva".
 */
export function withCanonicalCharacterNames(output: ResponseOutput): ResponseOutput {
  return new Proxy(output, {
    get(target, prop) {
      if (prop === "renderText") {
        return (text: string, turn?: ResponseOutputTurnContext) =>
          target.renderText(normalizeCharacterNames(text), turn);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export async function createResponseOutput(
  context: ResponseOutputFactoryContext,
): Promise<ResponseOutput> {
  if (context.mode === "tts") return withCanonicalCharacterNames(new LocalTTSOutput());
  const factory = avatarProviders[context.avatarSettings.activeProvider];
  return withCanonicalCharacterNames(await factory(context.avatarSettings, context.callbacks ?? {}));
}

export function listStreamingAvatarProviders(): StreamingAvatarProviderId[] {
  return Object.keys(avatarProviders) as StreamingAvatarProviderId[];
}
