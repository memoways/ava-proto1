import { describe, expect, it } from "vitest";
import { createEmptyConversationMemory, normalizeConversationMemory, mergeConversationMemory } from "./conversationMemoryV1";
import { normalizeHandsFreeSettings } from "./handsFreeVoice";

describe("P2 voice preset through V4 memory", () => {
  it("keeps strategy and UI pinned through character deltas and serialization", () => {
    const voicePreset = { handsFree: normalizeHandsFreeSettings({ enabled: true, interruptionStrategy: "acoustic_confirmed", bargeInMinWords: 3 }), voiceOnly: true };
    const before = { ...createEmptyConversationMemory(), voicePreset, incrementalOutputEnabled: true };
    const max = mergeConversationMemory(before, { topics: ["famille"] }, 1, "max");
    const emma = mergeConversationMemory(max, { topics: ["Ava"] }, 2, "emma");
    const restored = normalizeConversationMemory(JSON.parse(JSON.stringify(emma)));
    expect(restored.voicePreset).toEqual(voicePreset);expect(restored.incrementalOutputEnabled).toBe(true);
  });
  it("retains legacy memory and defaults unknown strategies to text", () => {
    expect(normalizeConversationMemory({ version: 1 }).voicePreset).toBeUndefined();
    expect(normalizeHandsFreeSettings({ interruptionStrategy: "unknown" } as never).interruptionStrategy).toBe("text");
  });
});
