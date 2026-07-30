import { LocalTTSOutput } from "./localTtsOutput";
import type {
  OutputMode,
  ResponseOutput,
  ResponseOutputCallbacks,
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
};

export async function createResponseOutput(
  context: ResponseOutputFactoryContext,
): Promise<ResponseOutput> {
  if (context.mode === "tts") return new LocalTTSOutput();
  const factory = avatarProviders[context.avatarSettings.activeProvider];
  return factory(context.avatarSettings, context.callbacks ?? {});
}

export function listStreamingAvatarProviders(): StreamingAvatarProviderId[] {
  return Object.keys(avatarProviders) as StreamingAvatarProviderId[];
}
