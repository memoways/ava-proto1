import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(async () => {}), env: vi.fn(() => "sandbox-ulrich") }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/services/gameAuth", () => ({ ensureGameAuth: mocks.auth }));
vi.mock("@/services/environmentContext", () => ({ getActiveEnvironment: mocks.env }));
import { fetchCharacterSpeechRuntime } from "./experienceOrchestration";

describe("session speech settings", () => {
  beforeEach(() => { mocks.rpc.mockReset(); });
  it("reads saved Max level 3 through the authorized session RPC, not the admin table", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ rugosite: 3, settings_version: "v1", environment_id: "sandbox-ulrich", recent_states: ["Bloqué", null] }], error: null });
    const result = await fetchCharacterSpeechRuntime("max", "session-1");
    expect(mocks.rpc).toHaveBeenCalledWith("get_character_speech_runtime", { p_character_key: "max", p_environment_id: "sandbox-ulrich", p_session_id: "session-1" });
    expect(result).toEqual({ rugosite: 3, settingsVersion: "v1", environmentId: "sandbox-ulrich", recentStates: ["Bloqué", null] });
  });
  it("does not reuse an old browser value when a new session reads level 2", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ rugosite: 3, settings_version: "v1", environment_id: "sandbox-ulrich", recent_states: [] }] });
    mocks.rpc.mockResolvedValueOnce({ data: [{ rugosite: 2, settings_version: "v2", environment_id: "sandbox-ulrich", recent_states: [] }] });
    expect((await fetchCharacterSpeechRuntime("max", "session-1")).rugosite).toBe(3);
    expect((await fetchCharacterSpeechRuntime("max", "session-2")).rugosite).toBe(2);
  });
  it("never converts missing settings or permission failures silently into level zero", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchCharacterSpeechRuntime("max", null)).rejects.toThrow();
    mocks.rpc.mockResolvedValueOnce({ error: new Error("denied") });
    await expect(fetchCharacterSpeechRuntime("max", null)).rejects.toThrow("denied");
  });
});