/**
 * Active lip sync for a WebRTC avatar stream (Anam).
 *
 * The browser plays audio and video from separate jitter buffers. A fixed, equal playout target
 * on both receivers does not keep them aligned: the video pipeline adds its own decode latency,
 * and when the browser's A/V sync does not engage (sender clocks, playout-delay hints), the two
 * tracks start apart and drift during the session.
 *
 * `estimatedPlayoutTimestamp` (WebRTC stats, sender NTP clock) tells which media instant each
 * track is playing right now; their difference is the offset the viewer sees. The controller
 * delays whichever track is ahead through `jitterBufferTarget`, a little at a time, and stops
 * itself when its corrections have no effect (browser sync fighting back), so it never runs away.
 *
 * The caller only feeds samples while the media really plays with audio flowing (never during a
 * cinematic, with the element detached), and applies new targets between two lines: a target
 * moved mid-line stretches the voice and freezes the face, which reads as a floating delivery.
 */

export interface PlayoutTargets {
  audioMs: number;
  videoMs: number;
}

export interface AvSyncOptions {
  /** Playout floor on both tracks: absorbs network jitter from the first frame. */
  baseMs: number;
  /** Offset left alone (lip sync is hard to notice below ~60 ms, 1.5 frames at 25 fps). */
  toleranceMs: number;
  /** Share of the measured offset corrected per step, below 1 to avoid overshoot. */
  gain: number;
  /** Highest delay added to one track over the other. */
  maxShiftMs: number;
  /** Samples (median) needed before a correction. */
  window: number;
  /** Wait after a correction so both buffers reach their new target before measuring again. */
  cooldownMs: number;
  /** Corrections in a row without improvement before the controller gives up. */
  maxIneffective: number;
  /** Interval between two stats samples. */
  pollMs: number;
}

export const DEFAULT_AV_SYNC: AvSyncOptions = {
  baseMs: 400,
  toleranceMs: 60,
  gain: 0.7,
  maxShiftMs: 2_500,
  window: 4,
  cooldownMs: 2_500,
  maxIneffective: 3,
  pollMs: 250,
};

/** Upper bound accepted by `RTCRtpReceiver.jitterBufferTarget`. */
const MAX_TARGET_MS = 4_000;

export interface AvSample {
  /**
   * Video playout instant minus audio playout instant, in ms: positive when the image is ahead of
   * the voice. Null when the browser does not expose both timestamps (no sender report yet).
   */
  offsetMs: number | null;
  /** Audio packets received so far: a sample only counts when it grew since the previous one. */
  audioPackets: number;
  /** Playout level of the voice (0..1), null when the browser does not report it. */
  audioLevel: number | null;
}

export async function readAvSample(pc: RTCPeerConnection): Promise<AvSample> {
  let audio: number | null = null;
  let video: number | null = null;
  let audioPackets = 0;
  let audioLevel: number | null = null;
  (await pc.getStats()).forEach((report: Record<string, unknown>) => {
    if (report.type !== "inbound-rtp") return;
    if (report.kind === "audio") {
      audioPackets += Number(report.packetsReceived ?? 0);
      const level = Number(report.audioLevel);
      if (Number.isFinite(level)) audioLevel = Math.max(audioLevel ?? 0, level);
    }
    const value = Number(report.estimatedPlayoutTimestamp);
    if (!Number.isFinite(value) || value <= 0) return;
    if (report.kind === "audio") audio = value;
    else if (report.kind === "video") video = value;
  });
  const offsetMs = audio === null || video === null ? null : Math.round((video as number) - (audio as number));
  return { offsetMs, audioPackets, audioLevel };
}

export async function readPlayoutOffset(pc: RTCPeerConnection): Promise<number | null> {
  return (await readAvSample(pc)).offsetMs;
}

/** Voice level above which the avatar is considered speaking (silence and breath stay below). */
export const VOICED_LEVEL = 0.02;

/** Per-line summary: what the viewer saw while the voice was audible. */
export interface AvLineStats {
  samples: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  /** Spread inside the line (max - min): high when the offset floats during the line itself. */
  spreadMs: number | null;
}

export function summarizeLine(offsets: number[]): AvLineStats {
  if (!offsets.length) return { samples: 0, medianMs: null, minMs: null, maxMs: null, spreadMs: null };
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  return {
    samples: offsets.length,
    medianMs: Math.round(median(offsets)),
    minMs: Math.round(min),
    maxMs: Math.round(max),
    spreadMs: Math.round(max - min),
  };
}

export class AvSyncController {
  private readonly options: AvSyncOptions;
  private samples: number[] = [];
  /** Video target minus audio target. */
  private relativeMs = 0;
  private coolUntil = 0;
  private lastCorrectedOffset: number | null = null;
  private ineffective = 0;
  private _stopped = false;
  private _lastOffsetMs: number | null = null;

  constructor(options: AvSyncOptions = DEFAULT_AV_SYNC) {
    this.options = options;
  }

  get targets(): PlayoutTargets {
    const { baseMs } = this.options;
    return {
      audioMs: clampTarget(baseMs + Math.max(0, -this.relativeMs)),
      videoMs: clampTarget(baseMs + Math.max(0, this.relativeMs)),
    };
  }

  get lastOffsetMs(): number | null {
    return this._lastOffsetMs;
  }

  /** True once corrections stopped working: targets stay where they are. */
  get stopped(): boolean {
    return this._stopped;
  }

  /** Targets applied later than computed (end of line): measure again only after they settle. */
  restartCooldown(now: number): void {
    this.samples = [];
    this.coolUntil = now + this.options.cooldownMs;
  }

  /** Drops the samples gathered so far: the media paused, or audio stopped flowing. */
  discard(): void {
    this.samples = [];
  }

  /** In sync: last measure within tolerance, or not measurable (nothing to wait for). */
  isSettled(now: number): boolean {
    if (this._stopped || this._lastOffsetMs === null) return true;
    return now >= this.coolUntil && Math.abs(this._lastOffsetMs) <= this.options.toleranceMs;
  }

  /** Feeds one measured offset; returns the new targets when a correction is due. */
  observe(offsetMs: number, now: number): PlayoutTargets | null {
    this._lastOffsetMs = offsetMs;
    if (this._stopped || now < this.coolUntil) return null;
    this.samples.push(offsetMs);
    if (this.samples.length > this.options.window) this.samples.shift();
    if (this.samples.length < this.options.window) return null;
    const offset = median(this.samples);
    if (Math.abs(offset) <= this.options.toleranceMs) {
      this.lastCorrectedOffset = null;
      this.ineffective = 0;
      return null;
    }
    // Same direction and no real gain since the last step: the browser undid it.
    const previous = this.lastCorrectedOffset;
    if (previous !== null && Math.sign(previous) === Math.sign(offset) && Math.abs(offset) > Math.abs(previous) * 0.7) {
      this.ineffective++;
      if (this.ineffective >= this.options.maxIneffective) {
        this._stopped = true;
        return null;
      }
    } else {
      this.ineffective = 0;
    }
    const limit = this.options.maxShiftMs;
    const next = Math.max(-limit, Math.min(limit, this.relativeMs + offset * this.options.gain));
    this.samples = [];
    this.lastCorrectedOffset = offset;
    this.coolUntil = now + this.options.cooldownMs;
    if (Math.round(next) === Math.round(this.relativeMs)) return null; // Already at the limit.
    this.relativeMs = next;
    return this.targets;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clampTarget(ms: number): number {
  return Math.round(Math.max(0, Math.min(MAX_TARGET_MS, ms)));
}
