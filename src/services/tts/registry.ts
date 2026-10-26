/**
 * Registry of TTS providers. Lookup by id.
 * Active provider is read from providerSettings.getActiveProviderId().
 */

import type { TTSProvider, TTSProviderId } from "@/services/tts/types";
import { elevenLabsProvider } from "@/services/tts/providers/elevenlabs";
import { inworldProvider } from "@/services/tts/providers/inworld";
import { fishProvider } from "@/services/tts/providers/fish";
import { gradiumProvider } from "@/services/tts/providers/gradium";
import { cartesiaProvider } from "@/services/tts/providers/cartesia";
import { getActiveProviderId } from "@/services/tts/providerSettings";

export const TTS_PROVIDERS: Record<TTSProviderId, TTSProvider> = {
  elevenlabs: elevenLabsProvider,
  inworld: inworldProvider,
  fish: fishProvider,
  gradium: gradiumProvider,
  cartesia: cartesiaProvider,
};

export const TTS_PROVIDER_LIST: TTSProvider[] = [
  elevenLabsProvider,
  inworldProvider,
  fishProvider,
  gradiumProvider,
  cartesiaProvider,
];

export function getActiveProvider(): TTSProvider {
  const id = getActiveProviderId();
  return TTS_PROVIDERS[id] ?? elevenLabsProvider;
}

export function getProviderById(id: TTSProviderId): TTSProvider {
  return TTS_PROVIDERS[id] ?? elevenLabsProvider;
}
