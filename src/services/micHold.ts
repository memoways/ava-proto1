/**
 * Keeps the microphone device open across a cinematic.
 *
 * Hands-free capture stops at each cinematic and restarts after it. Closing then reopening the
 * microphone makes Bluetooth headsets switch audio profile (call mode with mic, music mode
 * without), and the operating system cuts every sound for one to two seconds while it switches:
 * the cinematic lost its sound a moment after it started. A second, silent capture of the same
 * device held from the cinematic decision until the capture is back keeps the device open, so
 * no switch happens. No audio is read from it.
 */
export interface MicHold {
  release(): void;
}

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

/** Same processing as the STT capture, so the browser keeps one device configuration. */
const HOLD_CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export function holdMicrophone(
  getUserMedia: GetUserMedia | undefined = typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia
    ? (constraints) => navigator.mediaDevices.getUserMedia(constraints)
    : undefined,
): MicHold {
  let released = false;
  let stream: MediaStream | null = null;
  const stop = (value: MediaStream) => value.getTracks().forEach((track) => track.stop());
  void getUserMedia?.(HOLD_CONSTRAINTS).then((value) => {
    if (released) stop(value);
    else stream = value;
  }).catch(() => { /* No permission or no device: nothing to hold. */ });
  return {
    release() {
      if (released) return;
      released = true;
      if (stream) stop(stream);
      stream = null;
    },
  };
}
