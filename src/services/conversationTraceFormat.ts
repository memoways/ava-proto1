import type {
  ConversationTurnTrace,
  ConversationTurnTraceV1,
  ConversationTurnTraceV2,
  LLMCallDiagnosticTraceV2,
  TraceTextReference,
} from "@/types";

function withoutMessages(payload: Record<string, unknown>): Record<string, unknown> {
  const { messages: _messages, ...rest } = payload;
  return rest;
}

export function compactConversationTurnTrace(trace: ConversationTurnTraceV1): ConversationTurnTraceV2 {
  const textBlobs: Record<string, string> = {};
  const references = new Map<string, string>();
  let nextBlob = 1;
  const reference = (text: string): TraceTextReference => {
    const existing = references.get(text);
    if (existing) return { blobRef: existing };
    const blobRef = `b${nextBlob++}`;
    references.set(text, blobRef);
    textBlobs[blobRef] = text;
    return { blobRef };
  };

  const prompt = trace.prompt ? {
    ...trace.prompt,
    baseSystemPrompt: reference(trace.prompt.baseSystemPrompt),
    characterPrompt: {
      ...trace.prompt.characterPrompt,
      renderedSections: reference(trace.prompt.characterPrompt.renderedSections),
    },
    technicalRules: reference(trace.prompt.technicalRules),
    injectedSections: trace.prompt.injectedSections.map((section) => ({
      ...section,
      content: reference(section.content),
    })),
    finalSystemPrompt: reference(trace.prompt.finalSystemPrompt),
  } : null;

  const diagnostic: LLMCallDiagnosticTraceV2 | null = trace.maxCall.diagnostic ? {
    ...trace.maxCall.diagnostic,
    clientPayload: withoutMessages(trace.maxCall.diagnostic.clientPayload),
    upstreamPayload: withoutMessages(trace.maxCall.diagnostic.upstreamPayload),
    clientPayloadKeyOrder: Object.keys(trace.maxCall.diagnostic.clientPayload),
    upstreamPayloadKeyOrder: Object.keys(trace.maxCall.diagnostic.upstreamPayload),
  } : null;

  return {
    ...trace,
    schemaVersion: 2,
    textBlobs,
    prompt,
    maxCall: {
      ...trace.maxCall,
      messages: trace.maxCall.messages.map((message) => ({
        role: message.role,
        content: reference(message.content),
      })),
      diagnostic,
    },
    timings: {
      ...trace.timings,
      traceEnqueueMs: null,
      traceUploadMs: null,
      traceUploadBytes: null,
      traceUploadBps: null,
    },
  };
}

function resolveText(trace: ConversationTurnTraceV2, reference: TraceTextReference): string {
  return trace.textBlobs[reference.blobRef] ?? "";
}

export function materializeConversationTurnTrace(trace: ConversationTurnTrace): ConversationTurnTraceV1 {
  if (trace.schemaVersion === 1) return trace;

  const messages = trace.maxCall.messages.map((message) => ({
    role: message.role,
    content: resolveText(trace, message.content),
  }));
  const diagnostic = trace.maxCall.diagnostic ? (() => {
    const {
      clientPayloadKeyOrder,
      upstreamPayloadKeyOrder,
      clientPayload,
      upstreamPayload,
      ...metadata
    } = trace.maxCall.diagnostic;
    return {
      ...metadata,
      clientPayload: restorePayload(clientPayload, clientPayloadKeyOrder, messages),
      upstreamPayload: restorePayload(upstreamPayload, upstreamPayloadKeyOrder, messages),
    };
  })() : null;

  return {
    ...trace,
    schemaVersion: 1,
    prompt: trace.prompt ? {
      ...trace.prompt,
      baseSystemPrompt: resolveText(trace, trace.prompt.baseSystemPrompt),
      characterPrompt: {
        ...trace.prompt.characterPrompt,
        renderedSections: resolveText(trace, trace.prompt.characterPrompt.renderedSections),
      },
      technicalRules: resolveText(trace, trace.prompt.technicalRules),
      injectedSections: trace.prompt.injectedSections.map((section) => ({
        ...section,
        content: resolveText(trace, section.content),
      })),
      finalSystemPrompt: resolveText(trace, trace.prompt.finalSystemPrompt),
    } : null,
    maxCall: {
      ...trace.maxCall,
      messages,
      diagnostic,
    },
    timings: trace.timings,
  };
}

function restorePayload(
  payload: Record<string, unknown>,
  keyOrder: string[] | undefined,
  messages: Array<{ role: string; content: string }>,
): Record<string, unknown> {
  const restored: Record<string, unknown> = {};
  const orderedKeys = keyOrder?.length ? keyOrder : [...Object.keys(payload), "messages"];
  for (const key of orderedKeys) {
    if (key === "messages") restored.messages = messages;
    else if (key in payload) restored[key] = payload[key];
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!(key in restored)) restored[key] = value;
  }
  if (!("messages" in restored)) restored.messages = messages;
  return restored;
}

export function conversationTracePayloadBytes(trace: ConversationTurnTrace): number {
  return new TextEncoder().encode(JSON.stringify(trace)).byteLength;
}
