import { getRuntimeContext } from "@/services/environmentContext";

const POSTHOG_KEY = "phc_x9m2HnIiFcKH9kFDH5qujx10qEG2ENylEicki7sPyZr";
const POSTHOG_HOST = "https://eu.i.posthog.com";

type PostHogClient = typeof import("posthog-js")["default"];

let posthog: PostHogClient | null = null;
let posthogLoadPromise: Promise<PostHogClient> | null = null;
let initialized = false;
let analyticsEnabled = false;
let analyticsRequested = false;
let pageViewCaptured = false;

type PendingAnalyticsOperation =
  | { kind: "capture"; event: string; properties?: Record<string, unknown> }
  | { kind: "identify"; sessionId: string; properties?: Record<string, unknown> };

const MAX_PENDING_OPERATIONS = 200;
const pendingOperations: PendingAnalyticsOperation[] = [];

const SENSITIVE_ANALYTICS_KEYS = new Set([
  "content",
  "raw_response",
  "response",
  "text",
  "transcript",
  "transcription",
  "user_posture_raw",
]);

const TECHNICAL_LOG_KEYS = new Set(["error", "error_message", "message", "stack"]);

function redactTechnicalLog(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_-]?key|authorization|secret|token)\s*[:=]\s*["']?[^\s,"']+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]")
    .slice(0, 1_000);
}

function sanitizeAnalyticsValue(value: unknown, parentKey?: string): unknown {
  if (typeof value === "string" && parentKey && TECHNICAL_LOG_KEYS.has(parentKey.toLowerCase())) {
    return redactTechnicalLog(value);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeAnalyticsValue(item, parentKey));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_ANALYTICS_KEYS.has(key.toLowerCase()))
      .map(([key, nestedValue]) => [key, sanitizeAnalyticsValue(nestedValue, key)]),
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

function enqueue(operation: PendingAnalyticsOperation): void {
  if (pendingOperations.length >= MAX_PENDING_OPERATIONS) pendingOperations.shift();
  pendingOperations.push(operation);
}

function flushPendingOperations(): void {
  if (!posthog || !analyticsEnabled) return;
  for (const operation of pendingOperations.splice(0)) {
    if (operation.kind === "capture") {
      posthog.capture(operation.event, operation.properties);
    } else {
      posthog.identify(operation.sessionId, operation.properties);
    }
  }
}

export function enablePostHog(): void {
  analyticsRequested = true;
  void loadPostHog().then((client) => {
    if (!analyticsRequested) return;
    if (!initialized) {
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        // Pageview is emitted explicitly after opt-in so it cannot be lost
        // during asynchronous SDK loading. Pageleave remains automatic.
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_feature_flags: true,
        person_profiles: "never",
        persistence: "memory",
        // This module is loaded only after analytics have been authorized by
        // the app policy. Starting the SDK opted-out here can strand its own
        // request queue, so the wrapper — not the SDK default — owns consent.
        opt_out_capturing_by_default: false,
        opt_out_persistence_by_default: false,
      });
      initialized = true;
    }
    client.opt_in_capturing({ captureEventName: false });
    analyticsEnabled = true;
    if (!pageViewCaptured) {
      client.capture("$pageview", { $current_url: window.location.href });
      pageViewCaptured = true;
    }
    flushPendingOperations();
  }).catch((error) => {
    analyticsEnabled = false;
    posthogLoadPromise = null;
    console.warn("[PostHog] Optional analytics failed to load:", error);
  });
}

export function disablePostHog() {
  analyticsRequested = false;
  analyticsEnabled = false;
  pendingOperations.length = 0;
  if (initialized) posthog?.opt_out_capturing();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!analyticsRequested) return;
  const runtime = getRuntimeContext();
  const sanitized = sanitizeAnalyticsProperties({
    ...properties,
    environment: runtime.environmentId,
    context_type: runtime.contextType,
    campaign: runtime.campaignId,
    started_by: runtime.startedBy,
  });
  if (!initialized || !analyticsEnabled || !posthog) {
    enqueue({ kind: "capture", event, properties: sanitized });
    return;
  }
  posthog.capture(event, sanitized);
}

export function identifyUser(sessionId: string, properties?: Record<string, unknown>) {
  if (!analyticsRequested) return;
  const sanitized = sanitizeAnalyticsProperties(properties);
  if (!initialized || !analyticsEnabled || !posthog) {
    enqueue({ kind: "identify", sessionId, properties: sanitized });
    return;
  }
  posthog.identify(sessionId, sanitized);
}
