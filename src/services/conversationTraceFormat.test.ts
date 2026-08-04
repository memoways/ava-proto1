import { describe, expect, it } from "vitest";
import { makeConversationTraceV1 } from "@/test/conversationTraceFixture";
import {
  compactConversationTurnTrace,
  conversationTracePayloadBytes,
  materializeConversationTurnTrace,
} from "./conversationTraceFormat";

describe("ConversationTurnTraceV2", () => {
  it("stores repeated large strings once and materially reduces the payload", () => {
    const v1 = makeConversationTraceV1();
    const v2 = compactConversationTurnTrace(v1);

    expect(Object.values(v2.textBlobs).filter((value) => value === v1.prompt?.finalSystemPrompt)).toHaveLength(1);
    expect(v2.maxCall.diagnostic?.clientPayload).not.toHaveProperty("messages");
    expect(v2.maxCall.diagnostic?.upstreamPayload).not.toHaveProperty("messages");
    expect(conversationTracePayloadBytes(v2)).toBeLessThan(conversationTracePayloadBytes(v1) * 0.45);
  });

  it("reconstructs the exact OpenRouter payload, including property order", () => {
    const v1 = makeConversationTraceV1();
    const v2 = compactConversationTurnTrace(v1);
    const materialized = materializeConversationTurnTrace(v2);

    expect(materialized.prompt).toEqual(v1.prompt);
    expect(materialized.maxCall.messages).toEqual(v1.maxCall.messages);
    expect(JSON.stringify(materialized.maxCall.diagnostic?.clientPayload))
      .toBe(JSON.stringify(v1.maxCall.diagnostic?.clientPayload));
    expect(JSON.stringify(materialized.maxCall.diagnostic?.upstreamPayload))
      .toBe(JSON.stringify(v1.maxCall.diagnostic?.upstreamPayload));
  });

  it("keeps archived V1 traces readable without transformation", () => {
    const v1 = makeConversationTraceV1();
    expect(materializeConversationTurnTrace(v1)).toBe(v1);
  });
});
