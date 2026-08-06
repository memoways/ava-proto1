import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let pendingGameAuth: Promise<Session> | null = null;

// Every concurrent `supabase.auth.getSession()` competes for the same Web Lock
// ("lock:sb-…-auth-token"). Admin panels fan out dozens of parallel calls, which
// produced "Lock was not released within 5000ms" storms. A single shared,
// short-lived read collapses them into one lock acquisition.
const SESSION_CACHE_TTL_MS = 5_000;
let cachedSession: Session | null = null;
let cachedSessionAt = 0;
let inflightSessionRead: Promise<Session | null> | null = null;

/** Deduplicated, briefly cached read of the current Supabase session. */
export async function getCachedSession(): Promise<Session | null> {
  if (Date.now() - cachedSessionAt < SESSION_CACHE_TTL_MS) return cachedSession;
  if (inflightSessionRead) return inflightSessionRead;

  inflightSessionRead = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      cachedSession = data.session ?? null;
      cachedSessionAt = Date.now();
      return cachedSession;
    } finally {
      inflightSessionRead = null;
    }
  })();

  return inflightSessionRead;
}

/** Drop the cached session (sign-in, sign-out, token refresh). */
export function invalidateCachedSession(): void {
  cachedSession = null;
  cachedSessionAt = 0;
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedSession = session ?? null;
  cachedSessionAt = session ? Date.now() : 0;
});


export function isGameSecurityEnabled(): boolean {
  return import.meta.env.VITE_GAME_SECURITY_ENABLED === "true";
}

export function isGameCaptchaEnabled(): boolean {
  return isGameSecurityEnabled() && Boolean(import.meta.env.VITE_HCAPTCHA_SITE_KEY);
}

/**
 * Gives public participants a Supabase identity without adding a sign-up step.
 * The identity is required by session ownership RLS and protected Edge Functions.
 */
export async function ensureGameAuth(captchaToken?: string): Promise<Session | null> {
  if (!isGameSecurityEnabled()) return null;
  if (pendingGameAuth) return pendingGameAuth;

  pendingGameAuth = (async () => {
    const { data: existing, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (existing.session) return existing.session;

    const { data, error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
    if (error) throw error;
    if (!data.session) throw new Error("Anonymous game authentication returned no session");
    return data.session;
  })();

  try {
    return await pendingGameAuth;
  } catch (error) {
    pendingGameAuth = null;
    throw error;
  }
}

/** Fetch an Edge Function with the current short-lived user JWT. */
export async function authenticatedFunctionFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const gameSession = await ensureGameAuth();
  // Admin diagnostic mode can be enabled while public anonymous security is off.
  // Preserve an already authenticated admin JWT for privileged Edge Functions.
  const existing = gameSession ? null : await supabase.auth.getSession();
  const session = gameSession ?? existing?.data?.session ?? null;
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}

/** Server-backed authorization check used before honoring privileged game modes. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  // Diagnostic mode is an admin concern, independent from the public game's
  // anonymous-auth feature flag. An admin session may therefore exist even
  // when VITE_GAME_SECURITY_ENABLED is disabled.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return false;
  const session = sessionData.session;
  if (!session?.user) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data?.role === "admin";
}

/** Test-only reset for deterministic auth lifecycle specs. */
export function resetGameAuthForTests(): void {
  pendingGameAuth = null;
}
