import { audioContextNeedsResume, getSharedAudioContext } from "@/services/audioPlayback";

/**
 * Volume control for a media element where `HTMLMediaElement.volume` is ignored (iOS).
 * The element is routed once through the shared AudioContext (MediaElementSource → GainNode),
 * which is the only attenuation iOS honours.
 *
 * Known limits, hence the conservative `canRouteThroughGain`:
 * - once connected, an element only sounds while the context is `running` (iOS "interrupts" it
 *   when the microphone starts; the shared unlock/statechange handlers resume it);
 * - native HLS on WebKit and cross-origin sources without CORS produce silence through Web Audio.
 */
export interface VideoGain {
  /** Linear gain 0..1, ramped to avoid clicks. */
  setLinear(value: number): void;
}

export type VideoGainEngine = "hls.js" | "native-file" | "native-hls" | "pending" | "unsupported";

const attached = new WeakMap<HTMLMediaElement, VideoGain>();
const failed = new WeakSet<HTMLMediaElement>();

/** Sources whose audio survives a MediaElementSource: MSE (hls.js blob) or same-origin files. */
export function canRouteThroughGain(
  engine: VideoGainEngine,
  src: string,
  pageOrigin: string = typeof location !== "undefined" ? location.origin : "",
): boolean {
  if (engine === "hls.js") return true;
  if (engine !== "native-file") return false;
  try {
    return new URL(src, pageOrigin).origin === pageOrigin;
  } catch {
    return false;
  }
}

/** The gain already attached to this element, if any. */
export function getVideoGain(video: HTMLMediaElement): VideoGain | null {
  return attached.get(video) ?? null;
}

/**
 * Routes the element through a GainNode. Resolves `null` (the caller keeps the element muted)
 * when Web Audio is missing, the context cannot run, or the connection throws.
 * Never retried for an element that failed: a half-connected element must stay silent.
 */
export async function attachVideoGain(video: HTMLMediaElement): Promise<VideoGain | null> {
  const existing = attached.get(video);
  if (existing) return existing;
  if (failed.has(video)) return null;
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  try {
    if (audioContextNeedsResume(ctx)) await ctx.resume();
    // Connecting while the context is stopped would leave the element silent for good.
    if (ctx.state !== "running") return null;
    const again = attached.get(video);
    if (again) return again;
    const source = ctx.createMediaElementSource(video);
    const node = ctx.createGain();
    source.connect(node);
    node.connect(ctx.destination);
    const gain: VideoGain = {
      setLinear(value) {
        const target = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
        const now = ctx.currentTime;
        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime(target, now + 0.05);
      },
    };
    attached.set(video, gain);
    return gain;
  } catch (error) {
    failed.add(video);
    console.warn("[Video] Web Audio gain unavailable, video stays muted when attenuated:", error);
    return null;
  }
}

/** Best effort: a gain-routed element is silent while the shared context is not running. */
export function keepVideoGainAudible(video: HTMLMediaElement): void {
  if (!attached.has(video)) return;
  const ctx = getSharedAudioContext();
  if (ctx && audioContextNeedsResume(ctx)) void ctx.resume().catch(() => { /* the next gesture retries */ });
}
