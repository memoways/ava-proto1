import type { ConversationMemoryV1 } from "./conversationMemory";
import type { ConversationMessage, MaxTurnKnowledgeContext } from "./index";

export type TraceMessageRole = "system" | "user" | "assistant";

export interface TraceMessage {
  role: TraceMessageRole;
  content: string;
}

export interface LLMUsageTrace {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LLMCallDiagnosticTrace {
  clientPayload: Record<string, unknown>;
  upstreamPayload: Record<string, unknown>;
  requestedModel: string;
  returnedModel: string;
  provider: string | null;
  generationId: string | null;
  usage: LLMUsageTrace | null;
  upstreamLatencyMs: number | null;
  proxyLatencyMs: number | null;
}

export interface LLMCallDiagnosticTraceV2 extends Omit<LLMCallDiagnosticTrace, "clientPayload" | "upstreamPayload"> {
  /** Payload fields excluding messages, which are stored once in maxCall.messages. */
  clientPayload: Record<string, unknown>;
  /** Exact OpenRouter fields excluding messages, reconstructed by the reader. */
  upstreamPayload: Record<string, unknown>;
  /** Preserves JSON.stringify property order for exact payload reconstruction. */
  clientPayloadKeyOrder: string[];
  /** Preserves JSON.stringify property order for exact payload reconstruction. */
  upstreamPayloadKeyOrder: string[];
}

export interface TraceTextReference {
  blobRef: string;
}

export interface MaxPromptAssemblyTrace {
  baseSystemPrompt: string;
  baseSource: {
    kind: "database" | "fallback" | "compiled";
    characterId: string | null;
    canonicalName: string;
    updatedAt: string | null;
  };
  characterPrompt: {
    characterId: string | null;
    canonicalName: string | null;
    updatedAt: string | null;
    renderedSections: string;
  };
  technicalRules: string;
  injectedSections: Array<{
    key: string;
    title: string;
    content: string;
  }>;
  /** Added in compact_v1; optional so archived traces remain readable. */
  budget?: {
    variant: "legacy" | "compact_v1" | "rich_v2" | "optimized_v3";
    limitChars: number;
    staticLimitChars: number;
    staticChars: number;
    totalSystemChars: number;
    historyChars: number;
    currentUserChars: number;
    totalMessageChars: number;
    systemToConversationRatio: number | null;
    withinBudget: boolean;
    /** optimized_v3 — plafond de tout le contexte généré hors message courant. */
    contextLimitChars?: number;
    /** optimized_v3 — dépassement causé uniquement par un message courant conservé intact. */
    oversizedCurrentUser?: boolean;
    /** optimized_v3 — caractères candidats retirés comme doublons. */
    deduplicatedChars?: number;
    sections: Array<{
      key: string;
      title: string;
      chars: number;
      originalChars: number;
      included: boolean;
      truncated: boolean;
      omissionReason?: string;
      /** rich_v2 — ordre de priorité d'injection du champ. */
      priority?: number;
      /** rich_v2 — nombre de sous-parties détectées dans le champ source. */
      subpartsDetected?: number;
      /** rich_v2 — détail des sous-parties incluses ou omises. */
      subparts?: Array<{
        label: string;
        priority: number;
        chars: number;
        included: boolean;
        omissionReason?: string;
      }>;
    }>;
    /** rich_v2 — événements de timeline effectivement injectés, dans l'ordre. */
    timelineEvents?: string[];
    /** rich_v2 — niveau de profondeur ancré et justification déterministe. */
    depthSelection?: {
      level: string;
      reason: string;
      levelsRepresented: string[];
      preambleIncluded?: boolean;
    };
    /** optimized_v3 — décisions unitaires de l'assembleur global. */
    units?: Array<{
      id: string;
      source: "contract" | "static" | "runtime" | "memory" | "rag";
      sourceKey: string;
      chars: number;
      score: number;
      status: "selected" | "duplicate_static" | "duplicate_memory" | "lower_rank" | "budget" | "empty";
      keptBy?: string;
      originalChars?: number;
      removedChars?: number;
      reason?: "included" | "merged_new_sentences" | "duplicate" | "lower_rank" | "budget";
    }>;
    ragSelection?: Array<{
      id: string;
      rank: number;
      chars: number;
      status: "selected" | "duplicate_static" | "duplicate_memory" | "lower_rank" | "budget";
      removedChars?: number;
      reason?: "included" | "merged_new_sentences" | "duplicate" | "lower_rank" | "budget";
    }>;
    memoryLastTurn?: number;
  };

  finalSystemPrompt: string;
}

export interface ConversationTurnTraceV1 {
  schemaVersion: 1;
  identity: {
    sessionId: string;
    turnId: string;
    turnIndex: number;
    characterName: string;
    createdAt: string;
    status: "causal_complete" | "complete" | "error";
  };
  input: {
    userMessage: string;
  };
  memory: {
    totalHistoryMessages: number;
    selectedHistory: ConversationMessage[];
    sessionSummary: string | null;
    summaryLastTurn: number;
    userRoleSummary: string | null;
    userPostureRaw: string | null;
    postVideoContext: string | null;
    temporalContext: {
      timeElapsedSeconds: number;
      sessionDurationSeconds: number;
      turnIndex: number;
    };
    gmGuidance: string | null;
    gmTopicsCovered: string[];
    /** optimized_v3 — état structuré lu avant le tour. */
    structuredMemoryBefore?: ConversationMemoryV1 | null;
    memoryLastTurn?: number;
  };
  rag: {
    request: {
      userMessage: string;
      recentContext: string;
      rewrittenQuery: string | null;
      searchInput: string;
      matchCount: number;
      retrieveK: number;
      matchThreshold: number;
      characterId: string | null;
      provider: string | null;
      rerankRequested: boolean;
    };
    matches: Array<{
      id: string;
      source_table: string;
      source_id: string;
      content: string;
      similarity: number;
      retrieval_similarity?: number;
      rerank_score?: number;
      character_id?: string | null;
    }>;
    formattedContext: string;
    knowledgeContext: MaxTurnKnowledgeContext;
    embeddingProvider: string | null;
    embeddingProfile?: string | null;
    documentEmbeddingModel?: string | null;
    queryEmbeddingModel?: string | null;
    embeddingDimension?: number | null;
    embeddingDtype?: string | null;
    rerankUsed: boolean;
    rerankQuery?: string | null;
    error: string | null;
    /** Nature de l'échec RAG, pour distinguer une coupure d'un vrai échec serveur. */
    errorKind?: "rag_timeout" | "rag_http_error" | "rag_client_error" | "rerank_failed";
    /** Message du rerank Voyage lorsqu'il a échoué sans casser la récupération vectorielle. */
    rerankError?: string | null;
    serverLatencyMs: number | null;

  };
  prompt: MaxPromptAssemblyTrace | null;
  maxCall: {
    messages: TraceMessage[];
    diagnostic: LLMCallDiagnosticTrace | null;
    requestedSettings: {
      model: string;
      temperature: number;
      maxTokens: number;
      topP: number;
      reasoning: boolean;
      timeoutMs: number | null;
    };
    error: string | null;
  };
  response: {
    rawLlmResponse: string | null;
    deliveredResponse: string;
    source: "llm" | "fallback";
  };
  gm: {
    causalGuidance: {
      guidance: string | null;
      topicsCovered: string[];
      source: "previous_post_turn" | "none";
    };
    preTurnPlanner: {
      status: "not_executed";
      reason: "disabled_in_prd4_live";
    };
    validator: {
      status: "not_executed";
      reason: "disabled_in_prd4_live";
    };
    labelPass: Record<string, unknown>;
    postTurn: Record<string, unknown>;
  };
  timings: {
    summaryFetchMs: number;
    ragMs: number;
    promptBuildMs: number;
    maxClientMs: number;
    maxProxyMs: number | null;
    maxUpstreamMs: number | null;
    pipelineUninstrumentedMs: number;
    coreTotalMs: number;
    traceWriteMs: number | null;
    observedTotalMs: number;
  };
}

type PromptTraceV2 = Omit<MaxPromptAssemblyTrace, "baseSystemPrompt" | "characterPrompt" | "technicalRules" | "injectedSections" | "finalSystemPrompt"> & {
  baseSystemPrompt: TraceTextReference;
  characterPrompt: Omit<MaxPromptAssemblyTrace["characterPrompt"], "renderedSections"> & {
    renderedSections: TraceTextReference;
  };
  technicalRules: TraceTextReference;
  injectedSections: Array<Omit<MaxPromptAssemblyTrace["injectedSections"][number], "content"> & {
    content: TraceTextReference;
  }>;
  finalSystemPrompt: TraceTextReference;
};

export interface ConversationTurnTraceV2 extends Omit<ConversationTurnTraceV1, "schemaVersion" | "prompt" | "maxCall" | "timings"> {
  schemaVersion: 2;
  /** Deduplicated exact strings. References are local to this trace. */
  textBlobs: Record<string, string>;
  prompt: PromptTraceV2 | null;
  maxCall: Omit<ConversationTurnTraceV1["maxCall"], "messages" | "diagnostic"> & {
    messages: Array<Omit<TraceMessage, "content"> & { content: TraceTextReference }>;
    diagnostic: LLMCallDiagnosticTraceV2 | null;
  };
  timings: ConversationTurnTraceV1["timings"] & {
    traceEnqueueMs: number | null;
    traceUploadMs: number | null;
    traceUploadBytes: number | null;
    traceUploadBps: number | null;
  };
}

export type ConversationTurnTrace = ConversationTurnTraceV1 | ConversationTurnTraceV2;

export interface ConversationTurnTraceRow {
  id: string;
  session_id: string;
  turn_id: string;
  turn_index: number;
  schema_version: number;
  character_name: string;
  status: string;
  trace: ConversationTurnTrace;
  created_at: string;
  updated_at: string;
}
