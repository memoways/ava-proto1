import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import {
  constantTimeEqual,
  normalizeExternalTestCode,
  sha256Hex,
} from "../_shared/externalTestInvitationCore.ts";

const ALLOWED_ORIGINS = new Set([
  "https://proto1.parle-a-ava.com",
  "https://ava-proto1.lovable.app",
]);

interface AccessContext {
  invitationId: string;
  environmentId: string;
  testerLabel: string;
  creatorDisplayName: string;
  accessExpiresAt: string;
}

function headersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    || /^https:\/\/[^/]+\.lovableproject\.com$/.test(origin)
    || /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://proto1.parle-a-ava.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headersFor(req) });
}

async function authenticatedAnonymousUser(req: Request): Promise<{
  user: User;
  caller: ReturnType<typeof createClient>;
} | null> {
  const authorization = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization.startsWith("Bearer ") || !url || !publishableKey) return null;
  const caller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous !== true) return null;
  return { user: data.user, caller };
}

async function loadActiveAccess(
  admin: ReturnType<typeof createClient>,
  userId: string,
  invitationId: string,
): Promise<AccessContext | null> {
  const { data: grant } = await admin
    .from("external_test_access_grants")
    .select("invitation_id,expires_at")
    .eq("anonymous_user_id", userId)
    .eq("invitation_id", invitationId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!grant) return null;

  const { data: invitation } = await admin
    .from("external_test_invitations")
    .select("id,environment_id,tester_label,created_by_user_id,redeemed_by_user_id,redeemed_at,revoked_at")
    .eq("id", invitationId)
    .eq("redeemed_by_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!invitation?.redeemed_at) return null;
  const { data: creator } = await admin
    .from("admin_users")
    .select("display_name")
    .eq("user_id", invitation.created_by_user_id)
    .single();
  if (!creator) return null;
  return {
    invitationId: invitation.id,
    environmentId: invitation.environment_id,
    testerLabel: invitation.tester_label,
    creatorDisplayName: creator.display_name,
    accessExpiresAt: grant.expires_at,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headersFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const identity = await authenticatedAnonymousUser(req);
  if (!identity) return json(req, { error: "Anonymous authentication required" }, 401);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const invitationId = typeof body?.invitationId === "string" ? body.invitationId : "";
  if ((action !== "status" && action !== "redeem") || !invitationId) {
    return json(req, { error: "Invalid request" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(req, { error: "Service unavailable" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (action === "status") {
    const access = await loadActiveAccess(admin, identity.user.id, invitationId);
    return json(req, access ? { ok: true, access } : { ok: false });
  }

  const limited = await enforceGameRequest(
    req,
    "redeem-test-invitation",
    headersFor(req),
    null,
    true,
  );
  if (limited) return limited;

  const code = typeof body.code === "string" ? normalizeExternalTestCode(body.code) : "";
  if (code.length < 19 || code.length > 64) return json(req, { ok: false });
  const codeHash = await sha256Hex(code);
  const { data: invitationHash } = await admin
    .from("external_test_invitations")
    .select("code_hash")
    .eq("id", invitationId)
    .maybeSingle();
  const expectedHash = typeof invitationHash?.code_hash === "string"
    ? invitationHash.code_hash
    : "0".repeat(64);
  if (!constantTimeEqual(codeHash, expectedHash)) return json(req, { ok: false });
  const { data, error } = await admin.rpc("redeem_external_test_invitation", {
    p_invitation_id: invitationId,
    p_code_hash: codeHash,
    p_anonymous_user_id: identity.user.id,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return json(req, { ok: false });
  return json(req, {
    ok: true,
    access: {
      invitationId: row.invitation_id,
      environmentId: row.environment_id,
      testerLabel: row.tester_label,
      creatorDisplayName: row.creator_display_name,
      accessExpiresAt: row.access_expires_at,
    } satisfies AccessContext,
  });
});
