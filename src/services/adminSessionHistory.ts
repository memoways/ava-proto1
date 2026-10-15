import { supabase } from "@/integrations/supabase/client";
import { sessionCharacterMetadata, type SessionCharacterInput, type SessionCharacterMetadata } from "./sessionCharacters";

const PAGE_SIZE = 100;

/** Admin only. Cursor pagination also tolerates deletions between pages. */
export async function fetchAdminSessionHistory<T extends { id: string; started_at: string | null }>(options: {
  columns?: string;
  includeSandbox?: boolean;
  signal?: AbortSignal;
} = {}): Promise<Array<T & { character_metadata: SessionCharacterMetadata }>> {
  const sessions = new Map<string, T>();
  let after: string | undefined;
  for (;;) {
    if (options.signal?.aborted) throw new DOMException("Chargement annulé", "AbortError");
    let query = supabase.from("sessions").select(options.columns ?? "*")
      .order("id", { ascending: true }).limit(PAGE_SIZE);
    if (after) query = query.gt("id", after);
    if (options.includeSandbox === false) query = query.neq("context_type", "sandbox");
    if (options.signal) query = query.abortSignal(options.signal);
    const { data, error } = await query;
    if (options.signal?.aborted) throw new DOMException("Chargement annulé", "AbortError");
    if (error) throw new Error(`Historique des sessions : ${error.message}`);
    const page = (data ?? []) as unknown as T[];
    for (const session of page) sessions.set(session.id, session);
    if (page.length < PAGE_SIZE) break;
    const next = page.at(-1)?.id;
    if (!next || (after && next <= after)) throw new Error("La pagination des sessions n'avance plus.");
    after = next;
  }
  return [...sessions.values()].sort((a, b) => (
    (b.started_at ?? "").localeCompare(a.started_at ?? "") || b.id.localeCompare(a.id)
  )).map(session => ({ ...session, character_metadata: sessionCharacterMetadata(session as T & SessionCharacterInput) }));
}
