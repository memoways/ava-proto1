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
    variant: "legacy" | "compact_v1" | "rich_v2";
    limitChars: number;
    staticLimitChars: number;
    staticChars: number;
    totalSystemChars: number;
    historyChars: number;
    currentUserChars: number;
    totalMessageChars: number;
    systemToConversationRatio: number | null;
    withinBudget: boolean;
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
    };
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
    rerankUsed: boolean;
    error: string | null;
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

export interface ConversationTurnTraceRow {
  id: string;
  session_id: string;
  turn_id: string;
  turn_index: number;
  schema_version: number;
  character_name: string;
  status: string;
  trace: ConversationTurnTraceV1;
  created_at: string;
  updated_at: string;
}
