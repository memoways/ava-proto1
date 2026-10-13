import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchResumablePRD4Session, clearConversationMemoryCache } from "./sessionConversationMemory";
import { parseGmApprovedHandoffOffer } from "./characterConversation";

const lookup = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/services/gameAuth", () => ({ ensureGameAuth: vi.fn(async () => {}) }));
vi.mock("@/integrations/supabase/client", () => {
  const query = { select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: lookup.maybeSingle };
  return { supabase: { from: vi.fn(() => query) } };
});

describe("saved GM offers through the session loading boundary", () => {
  beforeEach(() => { clearConversationMemoryCache(); lookup.maybeSingle.mockReset(); });

  it.each([true, false])("restores an offer only if approved: %s", async approved => {
    const gmApproval = { turnId: "turn-4", orchestrationVersionId: "version-1" };
    lookup.maybeSingle.mockResolvedValue({ error: null, data: {
      id: "saved-session", started_at: "2026-10-13T09:00:00Z", resume_expires_at: "2026-10-13T09:20:00Z",
      active_character: "emma", orchestration_version_id: "version-1",
      conversation_log: [{ role: "emma", content: "Je peux te passer Max.", timestamp: 1 }],
      pending_handoff: { targetCharacter: "max", reason: "Max peut éclairer ce sujet.",
        ...(approved ? { gmApproval } : {}) },
    } });
    const session = await fetchResumablePRD4Session(new Date("2026-10-13T09:10:00Z"));
    const restored = parseGmApprovedHandoffOffer(session?.pending_handoff, "max", session?.orchestration_version_id);
    if (approved) expect(restored?.gmApproval).toEqual(gmApproval);
    else expect(restored).toBeNull();
    expect(parseGmApprovedHandoffOffer(session?.pending_handoff, "max", "another-version")).toBeNull();
  });
});
