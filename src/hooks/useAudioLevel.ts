import { useEffect, useState } from "react";

/**
 * Returns a normalized RMS level [0..1] from a live MediaStream.
 * When `stream` is null or `enabled` is false, level stays at 0.
 */
export function useAudioLevel(stream: MediaStream | null, enabled: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled || !stream) {
      setLevel(0);
      return;
    }

    let raf = 0;
    let cancelled = false;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const buf = new Uint8Array(analyser.fftSize);
    let smoothed = 0;

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(buf);
      // RMS over centered samples
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Boost + clamp so normal speech ~0.4..0.9
      const boosted = Math.min(1, rms * 3.5);
      // Simple low-pass for stability
      smoothed = smoothed * 0.7 + boosted * 0.3;
      setLevel(smoothed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try { source.disconnect(); } catch { /* noop */ }
      ctx.close().catch(() => { /* noop */ });
    };
  }, [stream, enabled]);

  return level;
}
