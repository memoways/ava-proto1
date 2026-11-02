import { authenticatedFunctionFetch } from "@/services/gameAuth";
import type {
  AnamAvatarSettings,
  HeyGenAvatarSettings,
  StreamingAvatarProviderId,
  TavusAvatarSettings,
} from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/streaming-avatar-session`;

export type AvatarSessionStartResponse =
  | {
      provider: "heygen";
      externalSessionId: string;
      sessionToken: string;
    }
  | {
      provider: "tavus";
      externalSessionId: string;
      conversationUrl: string;
      meetingToken: string;
    }
  | {
      provider: "anam";
      /** Ava-side binding id: Anam returns no session id with the token. */
      externalSessionId: string;
      sessionToken: string;
    };

export async function startAvatarSession(input: {
  provider: StreamingAvatarProviderId;
  sessionId: string;
  heygen?: HeyGenAvatarSettings;
  tavus?: TavusAvatarSettings;
  anam?: AnamAvatarSettings;
  signal?: AbortSignal;
}): Promise<AvatarSessionStartResponse> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      provider: input.provider,
      sessionId: input.sessionId,
      config: input[input.provider],
    }),
    signal: input.signal,
  });
  if (!response.ok) throw new Error(await readAvatarError(response));
  return response.json() as Promise<AvatarSessionStartResponse>;
}

export async function endAvatarSession(input: {
  provider: StreamingAvatarProviderId;
  sessionId: string;
  externalSessionId: string;
  sessionToken?: string;
}): Promise<void> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "end", ...input }),
    keepalive: true,
  });
  if (!response.ok && response.status !== 404 && response.status !== 409) {
    throw new Error(await readAvatarError(response));
  }
}

export interface TavusConfigurationCheck {
  ok: boolean;
  conversationStatus: string;
  properties: Record<string, unknown>;
  policy: string | null;
  /** PAL `layers.tts`, read only (D3: Ava never writes the PAL). */
  palVoice: Record<string, unknown>;
}

/** Admin only: Tavus `test_mode` conversation (no room, the PAL never joins). */
export async function checkTavusConfiguration(
  tavus: TavusAvatarSettings,
): Promise<TavusConfigurationCheck> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "check",
      provider: "tavus",
      config: tavus,
    }),
  });
  if (!response.ok) throw new Error(await readAvatarError(response));
  return response.json() as Promise<TavusConfigurationCheck>;
}

export interface AnamConfigurationCheck {
  ok: boolean;
  /** Whitelisted personaConfig and sessionOptions actually accepted by Anam (no token). */
  personaConfig: Record<string, unknown>;
  sessionOptions: Record<string, unknown>;
}

/** Admin only: Anam issues a session token for these settings; the token is discarded. */
export async function checkAnamConfiguration(
  anam: AnamAvatarSettings,
): Promise<AnamConfigurationCheck> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "check", provider: "anam", config: anam }),
  });
  if (!response.ok) throw new Error(await readAvatarError(response));
  return response.json() as Promise<AnamConfigurationCheck>;
}

export async function getAvatarProviderStatus(): Promise<Record<StreamingAvatarProviderId, boolean>> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  });
  if (!response.ok) throw new Error(await readAvatarError(response));
  const body = (await response.json()) as {
    configured?: Partial<Record<StreamingAvatarProviderId, boolean>>;
  };
  return {
    heygen: body.configured?.heygen === true,
    tavus: body.configured?.tavus === true,
    anam: body.configured?.anam === true,
  };
}

async function readAvatarError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    return body.error || body.message || `Avatar provider error (${response.status})`;
  } catch {
    return text || `Avatar provider error (${response.status})`;
  }
}
