/**
 * Registry of TTS providers. Lookup by id.
 * Active provider is read from providerSettings.getActiveProviderId().
 */

import type { TTSProvider, TTSProviderId } from "@/services/tts/types";
import { elevenLabsProvider } from "@/services/tts/providers/elevenlabs";
import { inworldProvider } from "@/services/tts/providers/inworld";
import { humeProvider } from "@/services/tts/providers/hume";
import { getActiveProviderId } from "@/services/tts/providerSettings";

export const TTS_PROVIDERS: Record<TTSProviderId, TTSProvider> = {
  elevenlabs: elevenLabsProvider,
  inworld: inworldProvider,
  hume: humeProvider,
};

export const TTS_PROVIDER_LIST: TTSProvider[] = [
  elevenLabsProvider,
  inworldProvider,
  humeProvider,
];

export function getActiveProvider(): TTSProvider {
  const id = getActiveProviderId();
  return TTS_PROVIDERS[id] ?? elevenLabsProvider;
}

export function getProviderById(id: TTSProviderId): TTSProvider {
  return TTS_PROVIDERS[id] ?? elevenLabsProvider;
}
