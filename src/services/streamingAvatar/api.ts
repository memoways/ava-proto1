import { authenticatedFunctionFetch } from "@/services/gameAuth";
import type {
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
    };

export async function startAvatarSession(input: {
  provider: StreamingAvatarProviderId;
  sessionId: string;
  heygen?: HeyGenAvatarSettings;
  tavus?: TavusAvatarSettings;
  signal?: AbortSignal;
}): Promise<AvatarSessionStartResponse> {
  const response = await authenticatedFunctionFetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      provider: input.provider,
      sessionId: input.sessionId,
      config: input.provider === "heygen" ? input.heygen : input.tavus,
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
