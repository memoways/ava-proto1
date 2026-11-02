import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceGameRequest } from "../_shared/gameRequestGuard.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import {
  buildHeyGenSessionRequest,
  buildTavusConversationRequest,
  safeProviderId,
  SELECTABLE_STREAMING_AVATAR_PROVIDERS,
  type KnownStreamingAvatarProvider,
  type SelectableStreamingAvatarProvider,
  summarizeTavusPalVoice,
} from "../_shared/streamingAvatarRequest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Anam and LemonSlice are known (AV2/AV3) but refused until they have a factory and a secret.
type Provider = SelectableStreamingAvatarProvider;

interface AvatarRequest {
  action?: "start" | "end" | "check";
  provider?: KnownStreamingAvatarProvider;
  sessionId?: string;
  externalSessionId?: string;
  sessionToken?: string;
  config?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("probe") === "tavus-catalog") {
      const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const isService = bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!isService) {
        const auth = await requireAdmin(req, corsHeaders);
        if (!auth.ok) return auth.response!;
      }
      const key = Deno.env.get("TAVUS_API_KEY");
      if (!key) return json({ error: "missing TAVUS_API_KEY" });
      const fetchList = async (path: string) => {
        try {
          const res = await fetch(`https://tavusapi.com/v2/${path}`, {
            headers: { "x-api-key": key },
          });
          const text = await res.text();
          return { status: res.status, body: text.slice(0, 4000) };
        } catch (error) {
          return { status: 0, body: String(error) };
        }
      };
      return json({
        pals: await fetchList("pals?limit=25"),
        personas: await fetchList("personas?limit=25"),
        faces: await fetchList("faces?limit=25"),
        replicas: await fetchList("replicas?limit=25"),
      });
    }
    if (url.searchParams.get("probe") === "session") {

      const auth = await requireAdmin(req, corsHeaders);
      if (!auth.ok) return auth.response!;
      const { data } = await callerClient(req)
        .from("admin_settings")
        .select("value")
        .eq("key", "ava_streaming_avatar_settings")
        .eq("environment_id", "prod")
        .maybeSingle();
      const settings = asRecord((data as { value?: unknown } | null)?.value);
      const heygen = asRecord(settings.heygen);
      const sandboxOverride = url.searchParams.get("sandbox");
      if (sandboxOverride === "0") heygen.sandbox = false;
      if (sandboxOverride === "1") heygen.sandbox = true;
      return json({ heygenStart: await probeHeyGenStart(heygen) });
    }
    if (url.searchParams.get("probe") === "1") {
      const auth = await requireAdmin(req, corsHeaders);
      if (!auth.ok) return auth.response!;
      return json({
        heygen: await probeProvider(
          "https://api.liveavatar.com/v1/avatars",
          "X-API-KEY",
          Deno.env.get("LIVEAVATAR_API_KEY"),
        ),
        heygenCore: await probeProvider(
          "https://api.heygen.com/v3/avatars",
          "X-Api-Key",
          Deno.env.get("LIVEAVATAR_API_KEY"),
        ),
        tavus: await probeProvider(
          "https://tavusapi.com/v2/faces?limit=1",
          "x-api-key",
          Deno.env.get("TAVUS_API_KEY"),
        ),
      });
    }
    const denied = await enforceGameRequest(
      req,
      "streaming-avatar-status",
      corsHeaders,
      null,
      true,
    );
    if (denied) return denied;
    return json({
      configured: {
        heygen: Boolean(Deno.env.get("LIVEAVATAR_API_KEY")),
        tavus: Boolean(Deno.env.get("TAVUS_API_KEY")),
      },
    });
  }


  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  const body = (await req.json().catch(() => null)) as AvatarRequest | null;
  if (!body || (body.action !== "start" && body.action !== "end" && body.action !== "check")) {
    return jsonError("Invalid action", 400);
  }
  if (!SELECTABLE_STREAMING_AVATAR_PROVIDERS.includes(body.provider as Provider)) {
    return jsonError("Invalid provider", 400);
  }
  if (body.action === "check") {
    // Admin configuration check: Tavus test_mode conversation, no room, no binding.
    const auth = await requireAdmin(req, corsHeaders);
    if (!auth.ok) return auth.response!;
    if (body.provider !== "tavus") return jsonError("Only Tavus supports a configuration check", 400);
    try {
      return await checkTavus(body.config ?? {});
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Tavus check failed", 502);
    }
  }
  if (!isUuid(body.sessionId)) return jsonError("Valid Ava sessionId required", 400);

  const denied = await enforceGameRequest(
    req,
    body.action === "start" ? "streaming-avatar-start" : "streaming-avatar-end",
    corsHeaders,
    body.sessionId!,
    true,
  );
  if (denied) return denied;

  try {
    if (body.action === "start") {
      if (await hasExternalSession(req, body.sessionId!)) {
        return jsonError("An avatar session is already bound to this Ava session", 409);
      }
      const response = body.provider === "heygen"
        ? await startHeyGen(body.config ?? {})
        : await startTavus(body.config ?? {}, body.sessionId!);
      if (!response.ok) return response;
      const started = await response.clone().json() as {
        externalSessionId?: string;
        sessionToken?: string;
      };
      if (!started.externalSessionId) throw new Error("Provider session binding is missing");
      try {
        await bindExternalSession(
          req,
          body.sessionId!,
          body.provider,
          started.externalSessionId,
        );
      } catch (error) {
        if (body.provider === "heygen") {
          await endHeyGen(started.externalSessionId, started.sessionToken).catch(() => {});
        } else {
          await endTavus(started.externalSessionId).catch(() => {});
        }
        throw error;
      }
      return response;
    }
    const externalSessionId = safeId(body.externalSessionId);
    if (externalSessionId && !await ownsExternalSession(
      req,
      body.sessionId!,
      body.provider,
      externalSessionId,
    )) {
      return jsonError("External session ownership mismatch", 403);
    }
    return body.provider === "heygen"
      ? await endHeyGen(body.externalSessionId, body.sessionToken)
      : await endTavus(body.externalSessionId);
  } catch (error) {
    console.error(`[streaming-avatar-session] ${body.provider}/${body.action} failed`, error);
    return jsonError(
      error instanceof Error ? error.message : "Streaming avatar request failed",
      502,
    );
  }
});

function callerClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Lovable Cloud database environment is incomplete");
  }
  return createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function bindExternalSession(
  req: Request,
  sessionId: string,
  provider: Provider,
  externalSessionId: string,
): Promise<void> {
  const { data, error } = await callerClient(req)
    .from("sessions")
    .update({
      output_mode: "streaming_avatar",
      streaming_avatar_provider: provider,
      streaming_avatar_session_id: externalSessionId,
    })
    .eq("id", sessionId)
    .select("id")
    .single();
  if (error || !data) throw new Error("Unable to bind the provider session to Ava");
}

async function ownsExternalSession(
  req: Request,
  sessionId: string,
  provider: Provider,
  externalSessionId: string,
): Promise<boolean> {
  const { data, error } = await callerClient(req)
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("streaming_avatar_provider", provider)
    .eq("streaming_avatar_session_id", externalSessionId)
    .maybeSingle();
  if (error) throw new Error("Unable to verify provider session ownership");
  return Boolean(data);
}

async function hasExternalSession(req: Request, sessionId: string): Promise<boolean> {
  const { data, error } = await callerClient(req)
    .from("sessions")
    .select("streaming_avatar_session_id")
    .eq("id", sessionId)
    .single();
  if (error) throw new Error("Unable to inspect the Ava session");
  return typeof data?.streaming_avatar_session_id === "string"
    && data.streaming_avatar_session_id.length > 0;
}

async function startHeyGen(config: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get("LIVEAVATAR_API_KEY");
  if (!apiKey) return jsonError("HeyGen LiveAvatar is not configured", 503);
  const request = buildHeyGenSessionRequest(config);
  if ("error" in request) return jsonError(request.error, 400);
  const upstream = await fetch("https://api.liveavatar.com/v1/sessions/token", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
  });
  const payload = await readUpstream(upstream, "HeyGen session creation failed");
  const data = asRecord(payload.data);
  const sessionToken = safeString(data.session_token);
  const externalSessionId = safeString(data.session_id);
  if (!sessionToken || !externalSessionId) {
    throw new Error("HeyGen returned an incomplete session");
  }
  return json({ provider: "heygen", externalSessionId, sessionToken });
}

async function startTavus(
  config: Record<string, unknown>,
  avaSessionId: string,
): Promise<Response> {
  const apiKey = Deno.env.get("TAVUS_API_KEY");
  if (!apiKey) return jsonError("Tavus is not configured", 503);
  const target = await loadTavusPal(apiKey, config);
  if (target instanceof Response) return target;
  const requestBody = buildTavusConversationRequest(config, {
    avaSessionId,
    palId: target.palId,
    faceId: target.faceId,
    legacyPersona: target.legacyPersona,
  });

  const upstream = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const payload = await readUpstream(upstream, "Tavus conversation creation failed");
  const externalSessionId = safeString(payload.conversation_id);
  const conversationUrl = safeHttpsUrl(payload.conversation_url);
  const meetingToken = safeString(payload.meeting_token);
  if (!externalSessionId || !conversationUrl || !meetingToken) {
    throw new Error("Tavus returned an incomplete conversation");
  }
  return json({
    provider: "tavus",
    externalSessionId,
    conversationUrl,
    meetingToken,
  });
}

interface TavusPalTarget {
  palId: string;
  faceId: string;
  legacyPersona: boolean;
  pal: Record<string, unknown>;
}

async function loadTavusPal(
  apiKey: string,
  config: Record<string, unknown>,
): Promise<TavusPalTarget | Response> {
  // Tavus renamed `replica` -> `face` and `persona` -> `pal` in the v2 API.
  const faceId = safeId(config.replicaId);
  const palId = safeId(config.personaId);
  if (!palId) return jsonError("A Tavus Echo PAL id (persona id) is required", 400);

  // Current API path first, legacy personas path as a fallback for older accounts.
  let palResponse = await fetch(
    `https://tavusapi.com/v2/pals/${encodeURIComponent(palId)}`,
    { headers: { "x-api-key": apiKey } },
  );
  let legacyPersona = false;
  if (palResponse.status === 404) {
    palResponse = await fetch(
      `https://tavusapi.com/v2/personas/${encodeURIComponent(palId)}`,
      { headers: { "x-api-key": apiKey } },
    );
    legacyPersona = palResponse.ok;
  }
  const pal = await readUpstream(palResponse, "Tavus PAL validation failed");
  if (safeString(pal.pipeline_mode).toLowerCase() !== "echo") {
    return jsonError("The Tavus PAL (persona) must use pipeline_mode=echo", 400);
  }
  return { palId, faceId, legacyPersona, pal };
}

/** test_mode conversation: validates the settings without a room; PAL voice read-only (D3). */
async function checkTavus(config: Record<string, unknown>): Promise<Response> {
  const apiKey = Deno.env.get("TAVUS_API_KEY");
  if (!apiKey) return jsonError("Tavus is not configured", 503);
  const target = await loadTavusPal(apiKey, config);
  if (target instanceof Response) return target;
  const requestBody = buildTavusConversationRequest(config, {
    avaSessionId: "check000",
    palId: target.palId,
    faceId: target.faceId,
    legacyPersona: target.legacyPersona,
    testMode: true,
  });
  const upstream = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const payload = await readUpstream(upstream, "Tavus test conversation failed");
  return json({
    provider: "tavus",
    ok: true,
    conversationStatus: safeString(payload.status).slice(0, 40),
    properties: requestBody.properties,
    policy: requestBody.policy ?? null,
    palVoice: summarizeTavusPalVoice(target.pal),
  });
}

async function endHeyGen(
  externalSessionId: unknown,
  sessionToken: unknown,
): Promise<Response> {
  const id = safeId(externalSessionId);
  const token = safeString(sessionToken);
  if (!id || !token) return json({ ok: true, alreadyEnded: true });
  const upstream = await fetch("https://api.liveavatar.com/v1/sessions/stop", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (upstream.ok || upstream.status === 404 || upstream.status === 409) return json({ ok: true });
  await readUpstream(upstream, `HeyGen session ${id} cleanup failed`);
  return json({ ok: true });
}

async function endTavus(externalSessionId: unknown): Promise<Response> {
  const apiKey = Deno.env.get("TAVUS_API_KEY");
  const id = safeId(externalSessionId);
  if (!apiKey || !id) return json({ ok: true, alreadyEnded: true });
  const upstream = await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(id)}/end`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
  });
  if (upstream.ok || upstream.status === 404 || upstream.status === 409) return json({ ok: true });
  await readUpstream(upstream, "Tavus conversation cleanup failed");
  return json({ ok: true });
}

async function readUpstream(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Preserve only a short, non-secret upstream diagnostic.
  }
  if (!response.ok) {
    console.error(
      `[streaming-avatar-session] upstream ${response.status} ${fallback}: ${text.slice(0, 500)}`,
    );
    const message =
      safeString(body.message) ||
      safeString(body.error) ||
      `${fallback} (${response.status})`;
    throw new Error(`${message.slice(0, 300)} [${response.status}]`);
  }
  return body;
}

async function probeHeyGenStart(
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("LIVEAVATAR_API_KEY");
  if (!apiKey) return { ok: false, error: "missing secret" };
  const request = buildHeyGenSessionRequest(config);
  if ("error" in request) return { ok: false, error: request.error };
  const requestBody = request.body;
  try {
    const upstream = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const text = (await upstream.text()).slice(0, 800);
    return { ok: upstream.ok, status: upstream.status, body: text, request: requestBody };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 200) : "network error",
      request: requestBody,
    };
  }
}

const safeId = safeProviderId;

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function probeProvider(
  url: string,
  headerName: string,
  apiKey: string | undefined,
): Promise<{ configured: boolean; reachable: boolean; status?: number; error?: string }> {
  if (!apiKey) return { configured: false, reachable: false, error: "missing secret" };
  try {
    const response = await fetch(url, { headers: { [headerName]: apiKey } });
    const body = (await response.text()).slice(0, 200);
    return {
      configured: true,
      reachable: response.ok,
      status: response.status,
      error: response.ok ? undefined : body,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message.slice(0, 200) : "network error",
    };
  }
}
