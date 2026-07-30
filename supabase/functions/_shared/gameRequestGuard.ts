import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retry_after: number;
}

function jsonError(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * The Edge gateway verifies the JWT before the handler runs. This second layer
 * consumes the caller's atomic PostgreSQL quota using auth.uid() from that JWT.
 */
export async function enforceGameRequest(
  req: Request,
  bucket: string,
  corsHeaders: Record<string, string>,
  sessionId: string | null = null,
  alwaysEnforce = false,
): Promise<Response | null> {
  // Lovable must enable this only after the migration and Anonymous Sign-Ins
  // are active. The default keeps the existing internal preview compatible.
  if (!alwaysEnforce && Deno.env.get("GAME_SECURITY_ENFORCED") !== "true") return null;

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonError("Authentication required", 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) {
    console.error("[game-guard] Supabase environment is incomplete");
    return jsonError("Security service unavailable", 503, corsHeaders);
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("consume_game_rate_limit", {
    p_bucket: bucket,
    p_session_id: sessionId,
  });

  if (error) {
    console.error(`[game-guard] ${bucket} rate-limit error:`, error.code, error.message);
    const status = error.code === "42501" ? 401 : 503;
    return jsonError(
      status === 401 ? "Invalid game identity" : "Security service unavailable",
      status,
      corsHeaders,
    );
  }

  const limit = data as unknown as RateLimitResult;
  if (!limit?.allowed) {
    return jsonError("Rate limit exceeded", 429, corsHeaders, {
      "Retry-After": String(Math.max(1, limit?.retry_after ?? 60)),
      "X-RateLimit-Limit": String(limit?.limit ?? 0),
      "X-RateLimit-Remaining": "0",
    });
  }

  return null;
}
