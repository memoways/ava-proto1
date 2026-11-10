/**
 * Reading the post-turn GM output (one JSON object per call).
 *
 * Pure functions: extraction of the JSON object and a bounded description of
 * an unreadable output (shape, stop reason, sizes), never its text.
 */

/** Why an output could not be read, without any of its content. */
export type GmOutputShape =
  /** Nothing usable came back (empty content). */
  | "empty"
  /** The object starts but never closes: cut by the token budget. */
  | "truncated"
  /** No JSON object at all (prose only). */
  | "no_object"
  /** A closed object that JSON.parse refuses (syntax). */
  | "syntax";

export interface GmOutputDiagnostic {
  output_shape: GmOutputShape;
  finish_reason: string | null;
  output_chars: number;
  completion_tokens: number | null;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

interface ObjectScan {
  /** Balanced top-level objects, in order. */
  objects: string[];
  /** An object was opened and never closed (or a string never ended). */
  unterminated: boolean;
}

function scanObjects(text: string): ObjectScan {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      if (depth > 0) inString = true;
    } else if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) objects.push(text.slice(start, i + 1));
    }
  }
  return { objects, unterminated: depth > 0 };
}

/**
 * Returns the parsed GM object, or `undefined` when no object can be read.
 * Accepts a fenced block and text around a single object.
 */
export function extractGmJson(text: string): unknown {
  const trimmed = stripFences(text);
  try { return JSON.parse(trimmed); } catch { /* scan below */ }

  for (const candidate of scanObjects(trimmed).objects) {
    try { return JSON.parse(candidate); } catch { /* try next balanced object */ }
  }
  return undefined;
}

/** Bounded description of an output that `extractGmJson` could not read. */
export function describeUnreadableGmOutput(
  text: string,
  finishReason: string | null | undefined,
  completionTokens: number | null | undefined,
): GmOutputDiagnostic {
  const trimmed = stripFences(text);
  const scan = scanObjects(trimmed);
  const shape: GmOutputShape = !trimmed
    ? "empty"
    : finishReason === "length" || (scan.unterminated && !scan.objects.length)
      ? "truncated"
      : !scan.objects.length
        ? "no_object"
        : "syntax";
  return {
    output_shape: shape,
    finish_reason: finishReason ?? null,
    output_chars: text.length,
    completion_tokens: typeof completionTokens === "number" ? completionTokens : null,
  };
}
