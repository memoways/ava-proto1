/**
 * Binds the pure follow-up logic to proxy-llm and the editorial prompt
 * (admin_settings / localStorage override, default in settingsService.ts).
 */
import { callLLM } from "./openRouterLLM";
import { getLLMSettings, getQuestionnaireFollowUpSettings, loadQuestionnaireFollowUpSettingsFromDB } from "./settingsService";
import { withTimeout } from "./asyncUtils";
import { requestFollowUp, type FollowUpRequest } from "./conversationalFollowUp";

export async function requestQuestionnaireFollowUp(request: FollowUpRequest, signal?: AbortSignal): Promise<string | null> {
  const settings = await withTimeout("questionnaire follow-up settings", loadQuestionnaireFollowUpSettingsFromDB(), 1500).catch(() => getQuestionnaireFollowUpSettings());
  if (signal?.aborted) return null;
  return requestFollowUp(request, {
    prompt: settings.prompt,
    timeoutMs: settings.timeoutMs,
    model: settings.model || getLLMSettings().LLM_MODEL,
    signal,
    llm: (messages, options) =>
      callLLM(messages, {
        model: options.model,
        timeoutMs: options.timeoutMs,
        signal: options.signal,
        temperature: 0.2,
        max_tokens: 120,
        reasoning: false,
        feature_key: "questionnaire_follow_up",
        session_id: request.context.session_id,
      }),
  });
}
