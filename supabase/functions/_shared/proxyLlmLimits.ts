/**
 * Size guard of `proxy-llm`, shared with the app so the prompt compiler can say
 * when a turn would be refused. Raised from 60 000 to 120 000 characters on
 * 28 November 2026 (Ulrich): the « Fiche entière » level sends 63 000 to 67 000
 * characters of system prompt, which the old guard refused. The guard stays as a
 * bound on what one request can cost.
 */
export const PROXY_LLM_MAX_MESSAGE_CHARS = 120_000;
export const PROXY_LLM_MAX_MESSAGES = 60;
