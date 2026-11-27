import { describe, expect, it } from "vitest";
import { selectOptimizedConversation, selectRecentConversation, selectUnsummarizedConversation } from "@/services/conversationMemory";
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

describe("selectOptimizedConversation (latency lot 3)", () => {
  it("keeps two short exchanges unchanged", () => {
    const selected = selectOptimizedConversation(makeConversation(5), 5);

    expect(selected.map((message) => message.content)).toEqual(["question-4", "response-4", "question-5", "response-5"]);
  });

  it("keeps the last exchange, cut to the budget, when it alone exceeds 1 200 characters", () => {
    const conversation: ConversationMessage[] = [
      ...makeConversation(2),
      { role: "user", content: "Q".repeat(400), timestamp: 10 },
      { role: "max", content: "R".repeat(1_200), timestamp: 11 },
    ];

    const selected = selectOptimizedConversation(conversation, 3);

    expect(selected).toHaveLength(2);
    expect(selected[0].role).toBe("user");
    expect(selected[1].role).toBe("max");
    expect(selected[0].content.startsWith("QQQ")).toBe(true);
    expect(selected[1].content.endsWith("…")).toBe(true);
    const total = selected.reduce((sum, message) => sum + message.content.length, 0);
    expect(total).toBeLessThanOrEqual(1_200);
    expect(total).toBeGreaterThan(1_100);
  });

  it("does not truncate when an earlier exchange already fits", () => {
    const conversation: ConversationMessage[] = [
      { role: "user", content: "court", timestamp: 1 },
      { role: "max", content: "réponse", timestamp: 2 },
    ];

    expect(selectOptimizedConversation(conversation, 1)).toEqual(conversation);
  });

  it("returns nothing for an empty conversation", () => {
    expect(selectOptimizedConversation([], 0)).toEqual([]);
  });
});
