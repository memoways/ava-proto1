export interface SpeechState { name: string; description: string }

/**
 * Extracts "- Nom : description" lines following a "Tes états de parole" heading
 * inside the « Manière de parler » field. Stops at the next non-list paragraph.
 */
export function parseSpeechStates(text: string): SpeechState[] {
  const lines = (text || "").split(/\r?\n/);
  const start = lines.findIndex((l) => /tes\s+[ée]tats\s+de\s+parole/i.test(l));
  if (start < 0) return [];
  const out: SpeechState[] = [];
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (!line) { if (out.length) continue; else continue; }
    const m = line.match(/^[-*•]\s*\**([^:*]+?)\**\s*[:：]\s*(.+)$/);
    if (!m) { if (out.length) break; continue; }
    const name = m[1].trim().replace(/^«\s*|\s*»$/g, "");
    if (name && !out.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      out.push({ name: name.slice(0, 60), description: m[2].trim() });
    }
  }
  return out;
}
