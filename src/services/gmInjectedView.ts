import type { GmMode, PRD4PostTurnEvaluation } from "@/types";

/**
 * "GM -> personnage" column of the sessions history and of the Markdown export:
 * the exact text the GM handed to the character on a turn, or why nothing was.
 */

export const GM_MODE_LABELS: Record<GmMode, string> = { off: "off", light: "léger", full: "fort" };

type InjectedEntry = Pick<PRD4PostTurnEvaluation, "gm_mode" | "injected" | "speech_guidance">;

/** Mode of an entry; entries logged before lot C only carry the speech_guidance flag. */
export function entryGmMode(entry: InjectedEntry | null | undefined): GmMode | null {
  if (!entry) return null;
  if (entry.gm_mode) return entry.gm_mode;
  return entry.speech_guidance === "off" ? "light" : "full";
}

/** Summary of the modes seen in a session log, e.g. "fort" or "léger" (null when no entry). */
export function sessionGmModeLabel(entries: readonly InjectedEntry[] | null | undefined): string | null {
  const modes = [...new Set((entries ?? []).map(entryGmMode).filter((mode): mode is GmMode => Boolean(mode)))];
  return modes.length ? modes.map((mode) => GM_MODE_LABELS[mode]).join(" / ") : null;
}

export function describeGmToCharacter(entry: InjectedEntry | null | undefined): string {
  if (!entry) return "non enregistré (aucune entrée GM pour ce tour)";
  const injected = entry.injected;
  const parts: string[] = [];
  if (injected?.text?.trim()) parts.push(injected.text.trim());
  if (injected?.speechState) parts.push(`[état de parole proposé : ${injected.speechState}]`);
  if (injected?.topicsCovered?.length) parts.push(`[sujets déjà abordés : ${injected.topicsCovered.join(", ")}]`);
  if (parts.length) return parts.join(" ");
  const mode = entryGmMode(entry);
  if (mode === "off" || mode === "light") return `rien : mode ${GM_MODE_LABELS[mode]}`;
  return injected ? "rien (le GM n'a rien transmis à ce tour)" : "non enregistré (entrée antérieure au suivi du texte transmis)";
}

/** Finds the GM entry of a character reply: same global user-turn index and same character. */
export function findGmEntryForReply<T extends { turn_index?: number; character_key?: string }>(
  entries: readonly T[] | null | undefined,
  turnIndex: number,
  character: string | null,
): T | null {
  if (!entries?.length || turnIndex <= 0) return null;
  const sameTurn = entries.filter((entry) => entry.turn_index === turnIndex);
  return sameTurn.find((entry) => entry.character_key === character) ?? (character ? null : sameTurn[0] ?? null);
}
