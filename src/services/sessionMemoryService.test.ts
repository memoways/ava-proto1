import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  },
}));
vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock("./debugLogger", () => ({
  debugLogger: {
    logFetch: vi.fn(() => "debug-id"),
    logResponse: vi.fn(),
    logError: vi.fn(),
  },
}));

import { authenticatedFunctionFetch } from "./gameAuth";
import {
  clearSessionSummaryCache,
  fetchSessionSummary,
  summarizeSessionAsync,
} from "./sessionMemoryService";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const conversation = [
  { role: "user" as const, content: "Où est Ava ?", timestamp: 1 },
  { role: "max" as const, content: "Je la cherche moi aussi.", timestamp: 2 },
];

describe("sessionMemoryService — cache mémoire des résumés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionSummaryCache();
    // Comportement live : RLS admin-only → 0 ligne, sans erreur.
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("retourne null quand la BDD ne renvoie rien (joueur anonyme, RLS)", async () => {
    const record = await fetchSessionSummary(SESSION_ID);
    expect(record).toBeNull();
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it("relit le résumé depuis le cache après une summarisation réussie, sans requête BDD", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ summary: "- L'utilisateur dit s'appeler Léa.", last_turn: 4 }),
    } as unknown as Response);

    await summarizeSessionAsync(SESSION_ID, conversation, 4);
    const record = await fetchSessionSummary(SESSION_ID);

    expect(record).toMatchObject({
      session_id: SESSION_ID,
      summary: "- L'utilisateur dit s'appeler Léa.",
      last_turn: 4,
    });
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("garde last_turn = turnCount si la réponse ne le fournit pas", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ summary: "- Résumé sans last_turn." }),
    } as unknown as Response);

    await summarizeSessionAsync(SESSION_ID, conversation, 8);
    const record = await fetchSessionSummary(SESSION_ID);

    expect(record?.last_turn).toBe(8);
  });

  it("ne met pas en cache un échec de summarisation", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "llm_502",
    } as unknown as Response);

    await summarizeSessionAsync(SESSION_ID, conversation, 4);
    const record = await fetchSessionSummary(SESSION_ID);

    expect(record).toBeNull();
  });

  it("isole les résumés par session", async () => {
    vi.mocked(authenticatedFunctionFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ summary: "- Session A.", last_turn: 4 }),
    } as unknown as Response);

    await summarizeSessionAsync(SESSION_ID, conversation, 4);
    const other = await fetchSessionSummary("22222222-2222-4222-8222-222222222222");

    expect(other).toBeNull();
  });

  it("isole les résumés Max et Emma d'une même session", async () => {
    vi.mocked(authenticatedFunctionFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: "- Conversation avec Max.", last_turn: 4 }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: "- Conversation avec Emma.", last_turn: 6 }),
      } as unknown as Response);

    await summarizeSessionAsync(SESSION_ID, conversation, 4, "max");
    await summarizeSessionAsync(SESSION_ID, [
      { role: "emma", content: "Oui ?", timestamp: 3 },
      { role: "user", content: "Bonjour Emma", timestamp: 4 },
    ], 6, "emma");

    const maxRecord = await fetchSessionSummary(SESSION_ID, "max");
    const emmaRecord = await fetchSessionSummary(SESSION_ID, "emma");

    expect(maxRecord?.summary).toBe("- Conversation avec Max.");
    expect(emmaRecord?.summary).toBe("- Conversation avec Emma.");
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("met en cache une lecture BDD réussie (contexte admin/banc d'essai)", async () => {
    maybeSingle.mockResolvedValue({
      data: { session_id: SESSION_ID, summary: "- Depuis la BDD.", last_turn: 12, updated_at: "2026-07-16T00:00:00Z" },
      error: null,
    });

    const first = await fetchSessionSummary(SESSION_ID);
    const second = await fetchSessionSummary(SESSION_ID);

    expect(first?.summary).toBe("- Depuis la BDD.");
    expect(second?.summary).toBe("- Depuis la BDD.");
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});
