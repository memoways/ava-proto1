import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { requireAdmin } from "../_shared/adminAuth.ts";
import {
  externalTestInvitationStatus,
  generateExternalTestCode,
  normalizeExternalTestCode,
  sha256Hex,
} from "../_shared/externalTestInvitationCore.ts";

const ALLOWED_ORIGINS = new Set([
  "https://proto1.parle-a-ava.com",
  "https://ava-proto1.lovable.app",
]);
const ENVIRONMENT_SWITCH_EMAIL = "ulrich.fischer@memoways.com";

type Action = "list" | "create" | "revoke";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headersFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req, headersFor(req));
  if (!auth.ok || !auth.userId) return auth.response!;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action as Action | undefined;
  if (!action || !["list", "create", "revoke"].includes(action)) {
    return json(req, { error: "Invalid action" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(req, { error: "Service unavailable" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: profile, error: profileError } = await admin
    .from("admin_users")
    .select("user_id,default_environment_id")
    .eq("user_id", auth.userId)
    .single();
  const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
  if (profileError || !profile || !authUser?.user) {
    return json(req, { error: "Admin profile unavailable" }, 403);
  }

  if (action === "list") {
    const { data, error } = await admin
      .from("external_test_invitations")
      .select("id,environment_id,tester_label,created_at,expires_at,redeemed_at,revoked_at")
      .eq("created_by_user_id", auth.userId)
      .order("created_at", { ascending: false });
    if (error) return json(req, { error: "Unable to list invitations" }, 500);

    const ids = (data ?? []).map((row) => row.id);
    const sessionCounts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: sessions } = await admin
        .from("sessions")
        .select("test_invitation_id")
        .in("test_invitation_id", ids);
      for (const session of sessions ?? []) {
        if (!session.test_invitation_id) continue;
        sessionCounts.set(
          session.test_invitation_id,
          (sessionCounts.get(session.test_invitation_id) ?? 0) + 1,
        );
      }
    }
    return json(req, {
      invitations: (data ?? []).map((row) => ({
        ...row,
        status: externalTestInvitationStatus(row),
        sessionCount: sessionCounts.get(row.id) ?? 0,
      })),
    });
  }

  if (action === "revoke") {
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    const { data, error } = await admin
      .from("external_test_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("created_by_user_id", auth.userId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) return json(req, { error: "Unable to revoke invitation" }, 500);
    if (!data) return json(req, { error: "Invitation not found" }, 404);
    return json(req, { ok: true });
  }

  const environmentId = typeof body.environmentId === "string" ? body.environmentId : "";
  const testerLabel = typeof body.testerLabel === "string" ? body.testerLabel.trim() : "";
  if (!testerLabel || testerLabel.length > 80) {
    return json(req, { error: "Tester label must contain 1 to 80 characters" }, 400);
  }
  const { data: environment } = await admin
    .from("environments")
    .select("id,type")
    .eq("id", environmentId)
    .eq("type", "sandbox")
    .maybeSingle();
  const email = (authUser.user.email ?? "").trim().toLowerCase();
  const mayUseEnvironment = environment
    && (email === ENVIRONMENT_SWITCH_EMAIL || profile.default_environment_id === environmentId);
  if (!mayUseEnvironment) {
    return json(req, { error: "Sandbox not available for this account" }, 403);
  }

  const code = generateExternalTestCode();
  const codeHash = await sha256Hex(normalizeExternalTestCode(code));
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error } = await admin
    .from("external_test_invitations")
    .insert({
      environment_id: environmentId,
      created_by_user_id: auth.userId,
      tester_label: testerLabel,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    .select("id,environment_id,tester_label,created_at,expires_at")
    .single();
  if (error || !invitation) return json(req, { error: "Unable to create invitation" }, 500);

  const origin = req.headers.get("origin") ?? "https://proto1.parle-a-ava.com";
  return json(req, {
    invitation: { ...invitation, status: "available", sessionCount: 0 },
    link: `${origin}/test/${invitation.id}`,
    code,
  }, 201);
});
