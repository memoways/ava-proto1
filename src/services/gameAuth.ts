import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let pendingGameAuth: Promise<Session> | null = null;

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
  const session = await ensureGameAuth();
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}

/** Server-backed authorization check used before honoring privileged game modes. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await ensureGameAuth();
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
