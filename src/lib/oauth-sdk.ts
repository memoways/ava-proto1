import { supabase } from "@/integrations/supabase/client";

export interface OAuthClientInfo {
  name?: string | null;
  url?: string | null;
}

export interface OAuthDetails {
  redirect_url?: string | null;
  redirect_to?: string | null;
  client?: OAuthClientInfo | null;
}

export interface OAuthOutcome {
  data: OAuthDetails | null;
  error: { message: string } | null;
}

interface OAuthApi {
  getAuthorizationDetails(id: string): Promise<OAuthOutcome>;
  approveAuthorization(id: string): Promise<OAuthOutcome>;
  denyAuthorization(id: string): Promise<OAuthOutcome>;
}

function api(): OAuthApi {
  const auth = supabase.auth as unknown as { oauth?: OAuthApi };
  if (!auth.oauth) {
    throw new Error("Le serveur d'autorisation n'est pas activé sur ce backend.");
  }
  return auth.oauth;
}

export const oauth = {
  getAuthorizationDetails: (id: string) => api().getAuthorizationDetails(id),
  approveAuthorization: (id: string) => api().approveAuthorization(id),
  denyAuthorization: (id: string) => api().denyAuthorization(id),
};
