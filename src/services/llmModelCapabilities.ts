export function supportsSamplingParameters(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return !/^openai\/gpt-5-mini(?:$|[-:])/.test(normalized);
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
