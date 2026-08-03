/**
 * Certains modèles OpenAI récents (gpt-5-mini, famille gpt-5.6) rejettent
 * `temperature` / `top_p` : OpenRouter renvoie une erreur 400 si on les envoie.
 */
const MODELS_WITHOUT_SAMPLING = [
  /^openai\/gpt-5-mini(?:$|[-:])/,
  /^openai\/gpt-5\.6-/,
];

export function supportsSamplingParameters(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return !MODELS_WITHOUT_SAMPLING.some((pattern) => pattern.test(normalized));
}

export function getSupportedSamplingParameters(
  model: string,
  temperature?: number,
  topP?: number,
): { temperature?: number; top_p?: number } {
  if (!supportsSamplingParameters(model)) return {};
  return {
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { top_p: topP } : {}),
  };
}
