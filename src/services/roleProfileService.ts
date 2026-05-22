/**
 * roleProfileService — PRD4 Phase 2
 * Appelle l'edge function `summarize-role` pour transformer un transcript brut
 * en `UserRoleProfile` structuré.
 */
import type { UserRoleProfile } from "@/types";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export interface SummarizeRoleResult {
  profile: UserRoleProfile;
  model: string;
  latency_ms: number;
}

export async function summarizeRole(rawInput: string): Promise<SummarizeRoleResult> {
  const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/summarize-role`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_input: rawInput }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`summarize-role HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data?.profile) throw new Error("summarize-role: missing profile in response");
  return data as SummarizeRoleResult;
}
