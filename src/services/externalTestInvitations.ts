import { supabase } from "@/integrations/supabase/client";
import { ensureAnonymousTestAuth } from "@/services/gameAuth";
import type { EnvironmentId, ExternalTestAccessContext } from "@/services/environmentContext";

export type ExternalTestInvitationStatus = "scheduled" | "available" | "activated" | "expired" | "revoked";

export interface ExternalTestInvitationSummary {
  id: string;
  environment_id: EnvironmentId;
  tester_label: string;
  created_at: string;
  valid_from: string | null;
  multi_use?: boolean;
  expires_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
  status: ExternalTestInvitationStatus;
  sessionCount: number;
  /** The password can be shown again from the console (invitations created after 8 Nov 2026). */
  codeRecoverable?: boolean;
}

export interface ExternalTestInvitationSecret {
  link: string;
  code: string;
  /** False when the new code could not be kept for later display (migration pending). */
  recoverable?: boolean;
}

interface InvocationError {
  error?: string;
}

function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as InvocationError).error;
    if (message) return message;
  }
  return fallback;
}

export async function listExternalTestInvitations(): Promise<ExternalTestInvitationSummary[]> {
  const { data, error } = await supabase.functions.invoke<{
    invitations?: ExternalTestInvitationSummary[];
    error?: string;
  }>("manage-test-invitations", { body: { action: "list" } });
  if (error || !data?.invitations) throw new Error(messageFrom(data, "Impossible de charger les invitations."));
  return data.invitations;
}

export async function createExternalTestInvitation(input: {
  environmentId: EnvironmentId;
  testerLabel: string;
  validFrom: string;
  validUntil: string;
  multiUse: boolean;
}): Promise<{
  invitation: ExternalTestInvitationSummary;
  link: string;
  code: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    invitation?: ExternalTestInvitationSummary;
    link?: string;
    code?: string;
    error?: string;
  }>("manage-test-invitations", { body: { action: "create", ...input } });
  if (error || !data?.invitation || !data.link || !data.code) {
    throw new Error(messageFrom(data, "Impossible de créer l’invitation."));
  }
  return { invitation: data.invitation, link: data.link, code: data.code };
}

/** Link and password of one of my invitations, when the password was kept. */
export async function revealExternalTestInvitation(invitationId: string): Promise<ExternalTestInvitationSecret> {
  const { data, error } = await supabase.functions.invoke<{ link?: string; code?: string; error?: string }>(
    "manage-test-invitations",
    { body: { action: "reveal", invitationId } },
  );
  if (error || !data?.link || !data.code) {
    throw new Error(messageFrom(data, "Mot de passe non disponible pour cette invitation."));
  }
  return { link: data.link, code: data.code };
}

/** New password for the same link; the previous password stops working. */
export async function renewExternalTestInvitationCode(invitationId: string): Promise<ExternalTestInvitationSecret> {
  const { data, error } = await supabase.functions.invoke<{ link?: string; code?: string; recoverable?: boolean; error?: string }>(
    "manage-test-invitations",
    { body: { action: "rotate", invitationId } },
  );
  if (error || !data?.link || !data.code) throw new Error(messageFrom(data, "Impossible de générer un nouveau mot de passe."));
  return { link: data.link, code: data.code, recoverable: data.recoverable };
}

export async function revokeExternalTestInvitation(invitationId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    "manage-test-invitations",
    { body: { action: "revoke", invitationId } },
  );
  if (error || data?.ok !== true) throw new Error(messageFrom(data, "Impossible de révoquer l’invitation."));
}

async function invokeExternalAccess(input: {
  action: "status" | "redeem";
  invitationId: string;
  code?: string;
}): Promise<ExternalTestAccessContext | null> {
  await ensureAnonymousTestAuth();
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    access?: ExternalTestAccessContext;
  }>("redeem-test-invitation", { body: input });
  if (error) throw error;
  return data?.ok === true && data.access ? data.access : null;
}

export function getExternalTestAccessStatus(invitationId: string) {
  return invokeExternalAccess({ action: "status", invitationId });
}

export function redeemExternalTestInvitation(invitationId: string, code: string) {
  return invokeExternalAccess({ action: "redeem", invitationId, code });
}
