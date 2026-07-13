import { describe, expect, it } from "vitest";
import { selectRecentConversation, selectUnsummarizedConversation } from "@/services/conversationMemory";
import type { ConversationMessage } from "@/types";

function makeConversation(turns: number): ConversationMessage[] {
  return Array.from({ length: turns }, (_, index) => index + 1).flatMap((turn) => [
    { role: "user" as const, content: `question-${turn}`, timestamp: turn * 2 },
    { role: "max" as const, content: `response-${turn}`, timestamp: turn * 2 + 1 },
  ]);
}

describe("conversationMemory", () => {
  it("caps the live LLM context to ten recent messages", () => {
    const recent = selectRecentConversation(makeConversation(35));

    expect(recent).toHaveLength(10);
    expect(recent[0].content).toBe("question-31");
    expect(recent.at(-1)?.content).toBe("response-35");
  });

  it("sends only turns newer than the persisted summary", () => {
    const pending = selectUnsummarizedConversation(makeConversation(36), 32);

    expect(pending).toHaveLength(8);
    expect(pending[0].content).toBe("question-33");
    expect(pending.at(-1)?.content).toBe("response-36");
  });

  it("stays bounded across thirty virtual 35-turn sessions", () => {
    for (let session = 0; session < 30; session += 1) {
      expect(selectRecentConversation(makeConversation(35))).toHaveLength(10);
      expect(selectUnsummarizedConversation(makeConversation(35), 0)).toHaveLength(24);
    }
  });
});
