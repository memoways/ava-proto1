import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const ALLOWED_ORIGINS = new Set([
  "https://proto1.parle-a-ava.com",
  "https://ava-proto1.lovable.app",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    || /^https:\/\/[^/]+\.lovableproject\.com$/.test(origin)
    || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)
    ? origin
    : "https://proto1.parle-a-ava.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length === 0 || password.length > 256) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client
      .from("admin_settings")
      .select("value")
      .eq("key", "public_access.password")
      .eq("environment_id", "prod")
      .maybeSingle();

    const stored = data?.value && typeof data.value === "object" && !Array.isArray(data.value)
      ? (data.value as { sha256?: unknown }).sha256
      : null;
    const passwordHash = await sha256(password);
    const ok = !error && typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored)
      && constantTimeEqual(passwordHash, stored);
    return new Response(JSON.stringify({ ok }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
