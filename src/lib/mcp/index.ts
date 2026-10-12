import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getUsageOverview from "./tools/get-usage-overview";
import getLlmCosts from "./tools/get-llm-costs";
import getVoiceLatencies from "./tools/get-voice-latencies";
import listSessions from "./tools/list-sessions";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ava-prototype-1",
  title: "AVA Prototype 1",
  version: "0.1.0",
  instructions:
    "Read-only statistics of the AVA Prototype 1 voice narrative experience: session usage, language-model costs and voice latencies. Every tool needs a signed-in account and reads the database through that account's own access rights. Conversation transcripts are never exposed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getUsageOverview, getLlmCosts, getVoiceLatencies, listSessions],
});
