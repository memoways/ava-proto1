import posthog from "posthog-js";

const POSTHOG_KEY = "phc_x9m2HnIiFcKH9kFDH5qujx10qEG2ENylEicki7sPyZr";
const POSTHOG_HOST = "https://eu.i.posthog.com";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
    },
  });
  initialized = true;
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(sessionId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(sessionId, properties);
}

export { posthog };
