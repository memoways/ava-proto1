/** An independent mic context: pausing output cannot suspend capture. */
export async function createPcmCapture(stream: MediaStream, targetRate: number, frameSamples: number,
  onFrame: (samples: Float32Array) => void, onError?: (error: Error) => void) {
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | null = null;
  let node: AudioWorkletNode | null = null;
  let closed = false;
  let flushId = 0;
  const flushes = new Map<number, () => void>();
  try {
    await context.audioWorklet.addModule("/audio/pcm-capture-worklet.js");
    if (context.state === "suspended") await context.resume();
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, "ava-pcm-capture", { numberOfInputs: 1, numberOfOutputs: 1,
      outputChannelCount: [1], processorOptions: { targetRate, frameSamples } });
    node.port.onmessage = ({ data }) => {
      if (closed) return;
      if (data.type === "frame" && data.samples instanceof Float32Array) onFrame(data.samples);
      if (data.type === "flushed") { flushes.get(data.id)?.(); flushes.delete(data.id); }
    };
    node.onprocessorerror = () => { if (!closed) onError?.(new Error("Microphone AudioWorklet failed")); };
    source.connect(node); node.connect(context.destination);
  } catch (error) {
    source?.disconnect(); node?.disconnect(); await context.close().catch(() => {}); throw error;
  }
  return {
    sampleRate: context.sampleRate,
    enabled(value: boolean) { if (!closed) node!.port.postMessage({ type: "enabled", value }); },
    reset() { if (!closed) node!.port.postMessage({ type: "reset" }); },
    flush(): Promise<void> {
      if (closed) return Promise.resolve();
      return new Promise(resolve => {
        const id = ++flushId;
        const timer = setTimeout(() => { flushes.delete(id); resolve(); }, 200);
        flushes.set(id, () => { clearTimeout(timer); resolve(); });
        node!.port.postMessage({ type: "flush", id });
      });
    },
    stop() {
      closed = true; for (const resolve of flushes.values()) resolve(); flushes.clear();
      node!.port.onmessage = null; node!.port.close(); node!.disconnect(); source!.disconnect();
      node!.onprocessorerror = null;
      void context.close().catch(() => {});
    },
  };
}

export function encodePcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2), view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}

export function pcmBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(encodePcm16(samples));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
