/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// Native-rate capture, continuous resampling and bounded provider frames.
class AvaPcmCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions;
    this.targetRate = config.targetRate;
    this.frame = new Float32Array(config.frameSamples);
    this.used = 0;
    this.position = 0;
    this.nextOutput = 0;
    this.previous = 0;
    this.enabled = true;
    this.port.onmessage = ({ data }) => {
      if (data.type === "enabled") { this.enabled = data.value; this.used = 0; }
      if (data.type === "flush") {
        if (this.used) { this.frame.fill(0, this.used); this.emit(); }
        this.port.postMessage({ type: "flushed", id: data.id });
      }
      if (data.type === "reset") this.used = 0;
    };
  }
  emit() {
    const frame = this.frame;
    // Transfer detaches frame.buffer synchronously. Allocate before detaching.
    this.frame = new Float32Array(frame.length);
    this.used = 0;
    this.port.postMessage({ type: "frame", samples: frame }, [frame.buffer]);
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const value of channel) {
      while (this.nextOutput <= this.position) {
        if (this.enabled) {
          const fraction = Math.max(0, Math.min(1, this.nextOutput - (this.position - 1)));
          this.frame[this.used++] = this.previous + (value - this.previous) * fraction;
          if (this.used === this.frame.length) this.emit();
        }
        this.nextOutput += sampleRate / this.targetRate;
      }
      this.previous = value;
      this.position++;
    }
    return true; // Output is silent; the microphone is never routed to speakers.
  }
}
registerProcessor("ava-pcm-capture", AvaPcmCapture);
