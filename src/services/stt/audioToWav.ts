// Decode any browser-recorded audio blob (webm/opus, mp4, ogg, wav, …) to a
// 16 kHz mono 16-bit PCM WAV blob. Used for STT providers that don't accept
// webm/opus (e.g. Gradium: audio/wav, audio/pcm, audio/ogg only).

const TARGET_SAMPLE_RATE = 16_000;

export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  // Use an offline context for decoding; some browsers refuse decodeAudioData on
  // a suspended AudioContext. A short live context works everywhere.
  const decodeCtx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try { await decodeCtx.close(); } catch { /* ignore */ }
  }

  // Downmix to mono
  const channels = decoded.numberOfChannels;
  const inLen = decoded.length;
  const mono = new Float32Array(inLen);
  for (let ch = 0; ch < channels; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < inLen; i++) mono[i] += data[i] / channels;
  }

  // Resample to 16 kHz using OfflineAudioContext (linear-quality resampler in-browser).
  const targetLen = Math.max(1, Math.round(inLen * TARGET_SAMPLE_RATE / decoded.sampleRate));
  const offline = new OfflineAudioContext(1, targetLen, TARGET_SAMPLE_RATE);
  const monoBuffer = offline.createBuffer(1, inLen, decoded.sampleRate);
  monoBuffer.copyToChannel(mono, 0);
  const src = offline.createBufferSource();
  src.buffer = monoBuffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const pcm = rendered.getChannelData(0);

  return encodeWavPcm16(pcm, TARGET_SAMPLE_RATE);
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);          // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
