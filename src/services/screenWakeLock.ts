/**
 * Keeps the phone screen on during the experience (a sleeping screen suspends the page, cuts the
 * microphone and the audio). Two layers:
 * 1. Screen Wake Lock API (Android Chrome, iOS/iPadOS Safari 16.4+). The lock is released by the
 *    browser whenever the page is hidden, so it is re-requested on return and on any user gesture.
 * 2. Fallback where the API is missing or refused (older iOS, some in-app webviews): a muted,
 *    looping, invisible video fed by a canvas stream, which browsers treat as active playback.
 * Best effort and silent: failure must never block the experience.
 */
type WakeLockSentinelLike = { release(): Promise<void>; addEventListener?(type: "release", cb: () => void): void };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } };

let wanted = false;
let sentinel: WakeLockSentinelLike | null = null;
let fallbackVideo: HTMLVideoElement | null = null;
let listenersInstalled = false;

export interface WakeLockStatus {
  wanted: boolean;
  apiHeld: boolean;
  fallbackPlaying: boolean;
}

export function getWakeLockStatus(): WakeLockStatus {
  return { wanted, apiHeld: sentinel !== null, fallbackPlaying: !!fallbackVideo && !fallbackVideo.paused };
}

async function requestApiLock(): Promise<boolean> {
  const wl = typeof navigator !== "undefined" ? (navigator as NavigatorWithWakeLock).wakeLock : undefined;
  if (!wl) return false;
  if (sentinel) return true;
  try {
    const lock = await wl.request("screen");
    if (!wanted) {
      void lock.release().catch(() => { /* already released */ });
      return false;
    }
    sentinel = lock;
    lock.addEventListener?.("release", () => { if (sentinel === lock) sentinel = null; });
    return true;
  } catch {
    return false; // refused (battery saver, hidden page): retried on the next gesture/visibility change
  }
}

function startFallback(): void {
  if (typeof document === "undefined") return;
  if (fallbackVideo) {
    void fallbackVideo.play().catch(() => { /* needs a gesture: retried */ });
    return;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    if (!ctx || !capture) return;
    const stream = capture.call(canvas, 1);
    const tick = window.setInterval(() => {
      if (!wanted) { window.clearInterval(tick); return; }
      ctx.fillStyle = Math.random() < 0.5 ? "#000" : "#010101";
      ctx.fillRect(0, 0, 16, 16);
    }, 1000);
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("data-wake-lock", "");
    video.muted = true;
    video.loop = true;
    video.srcObject = stream;
    Object.assign(video.style, { position: "fixed", width: "1px", height: "1px", opacity: "0.01", pointerEvents: "none", left: "0", top: "0" });
    document.body.appendChild(video);
    fallbackVideo = video;
    void video.play().catch(() => { /* needs a gesture: retried */ });
  } catch { /* no fallback available */ }
}

function stopFallback(): void {
  if (!fallbackVideo) return;
  try { fallbackVideo.pause(); } catch { /* ignore */ }
  fallbackVideo.srcObject = null;
  fallbackVideo.remove();
  fallbackVideo = null;
}

async function acquire(): Promise<void> {
  if (!wanted) return;
  const ok = await requestApiLock();
  if (!ok && wanted) startFallback();
}

function onVisibility(): void {
  if (wanted && document.visibilityState === "visible") void acquire();
}
function onGesture(): void {
  if (wanted && !sentinel) void acquire();
}

/** Call from a user gesture (« Commencer »). Idempotent. */
export function enableScreenWakeLock(): void {
  wanted = true;
  if (typeof document !== "undefined" && !listenersInstalled) {
    listenersInstalled = true;
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerdown", onGesture, { passive: true });
    document.addEventListener("touchend", onGesture, { passive: true });
  }
  void acquire();
}

/** End of the experience: let the screen sleep again. */
export function disableScreenWakeLock(): void {
  wanted = false;
  const lock = sentinel;
  sentinel = null;
  if (lock) void lock.release().catch(() => { /* already released */ });
  stopFallback();
}
