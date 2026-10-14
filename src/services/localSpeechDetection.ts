import { createPcmCapture } from "./stt/pcmCapture";

/** Conservative acoustic evidence. Recognition is still required to interrupt. */
export function speechFeatures(samples: Float32Array, sampleRate: number) {
  let energy = 0, crossings = 0;
  for (let i = 0; i < samples.length; i++) {
    energy += samples[i] * samples[i];
    if (i && (samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
  }
  let periodicity = 0;
  for (let lag = Math.ceil(sampleRate / 350); lag <= Math.min(samples.length / 2, sampleRate / 70); lag += 3) {
    let correlation = 0, a = 0, b = 0;
    for (let i = lag; i < samples.length; i++) {
      correlation += samples[i] * samples[i - lag]; a += samples[i] ** 2; b += samples[i - lag] ** 2;
    }
    periodicity = Math.max(periodicity, correlation / Math.sqrt(a * b || 1));
  }
  return { rms: Math.sqrt(energy / Math.max(1, samples.length)), crossings: crossings / Math.max(1, samples.length), periodicity };
}

export async function createLocalSpeechDetector(stream: MediaStream, onSpeech: (voiced: boolean, at: number) => void, onFailure?: () => void) {
  const settings = stream.getAudioTracks()[0]?.getSettings();
  // Do not present requested DSP as applied. Without AEC use the text strategy.
  if (settings?.echoCancellation !== true) return null;
  let noise = 0.003, consecutive = 0, lastVoice = -Infinity;
  let lastFrame = performance.now(), stopped = false;
  const capture = await createPcmCapture(stream, 16000, 320, samples => {
    const at = performance.now(), f = speechFeatures(samples, 16000);
    lastFrame = at;
    const speechLike = f.rms > Math.max(0.008, noise * 3) && f.crossings > 0.006 && f.crossings < 0.35
      && (f.periodicity > 0.38 || (f.crossings > 0.08 && f.crossings < 0.24));
    consecutive = speechLike ? consecutive + 1 : 0;
    if (consecutive >= 2) lastVoice = at;
    if (!speechLike) noise = Math.min(0.02, noise * 0.98 + f.rms * 0.02);
    onSpeech(at - lastVoice < 120, at);
  });
  const watchdog = setInterval(() => {
    if (!stopped && performance.now() - lastFrame > 1500) { stop(); onFailure?.(); }
  }, 250);
  function stop() { if (stopped) return; stopped = true; clearInterval(watchdog); capture.stop(); }
  return { stop, dsp: { echoCancellation: true,
    noiseSuppression: settings.noiseSuppression ?? null, autoGainControl: settings.autoGainControl ?? null,
    trackSampleRate: settings.sampleRate ?? null, contextSampleRate: capture.sampleRate } };
}
