const POSTHOG_KEY = "phc_x9m2HnIiFcKH9kFDH5qujx10qEG2ENylEicki7sPyZr";
const POSTHOG_HOST = "https://eu.i.posthog.com";

type PostHogClient = typeof import("posthog-js")["default"];

let posthog: PostHogClient | null = null;
let posthogLoadPromise: Promise<PostHogClient> | null = null;
let initialized = false;
let analyticsEnabled = false;
let analyticsRequested = false;

const SENSITIVE_ANALYTICS_KEYS = new Set([
  "content",
  "error",
  "error_message",
  "message",
  "raw_response",
  "response",
  "stack",
  "text",
  "transcript",
  "transcription",
  "user_posture_raw",
]);

function sanitizeAnalyticsValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAnalyticsValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_ANALYTICS_KEYS.has(key.toLowerCase()))
      .map(([key, nestedValue]) => [key, sanitizeAnalyticsValue(nestedValue)]),
  );
}

export function sanitizeAnalyticsProperties(
  properties?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!properties) return undefined;
  return sanitizeAnalyticsValue(properties) as Record<string, unknown>;
}

function loadPostHog(): Promise<PostHogClient> {
  posthogLoadPromise ??= import("posthog-js").then(({ default: client }) => {
    posthog = client;
    return client;
  });
  return posthogLoadPromise;
}

export function enablePostHog(): void {
  analyticsRequested = true;
  void loadPostHog().then((client) => {
    if (!analyticsRequested) return;
    if (!initialized) {
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_feature_flags: true,
        person_profiles: "never",
        persistence: "memory",
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
      });
      initialized = true;
    }
    client.opt_in_capturing({ captureEventName: false });
    analyticsEnabled = true;
  }).catch((error) => {
    analyticsEnabled = false;
    console.warn("[PostHog] Optional analytics failed to load:", error);
  });
}

export function disablePostHog() {
  analyticsRequested = false;
  analyticsEnabled = false;
  if (initialized) posthog?.opt_out_capturing();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized || !analyticsEnabled) return;
  posthog?.capture(event, sanitizeAnalyticsProperties(properties));
}

export function identifyUser(sessionId: string, properties?: Record<string, unknown>) {
  if (!initialized || !analyticsEnabled) return;
  posthog?.identify(sessionId, sanitizeAnalyticsProperties(properties));
}
