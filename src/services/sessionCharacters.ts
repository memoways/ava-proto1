import { AVA_CHARACTER_REGISTRY, displayNameForCharacter } from "./characterRegistry";

export interface SessionCharacterInput {
  conversation_log?: Array<{ role?: string; spokenWith?: string; content?: string }> | null;
  personnage_appele?: string | null;
  active_character?: string | null;
}

/** Metadata reconstructed from the persisted conversation, never from today's selection. */
export interface SessionCharacterMetadata {
  character_keys: string[];
  character_sequence: string[];
  character_switch_count: number;
  source: "conversation_log";
}

const NON_CHARACTER_ROLES = new Set(["user", "assistant", "system", "tool", "function", "gm", "game_master"]);

export function characterKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLocaleLowerCase("fr");
  if (!key || NON_CHARACTER_ROLES.has(key)) return null;
  return AVA_CHARACTER_REGISTRY.entries.find(entry => entry.key === key || entry.displayName.toLocaleLowerCase("fr") === key)?.key ?? key;
}

export function messageCharacter(message: { role?: string; spokenWith?: string }): string | null {
  return characterKey(message.spokenWith) ?? characterKey(message.role);
}

export function sessionCharacterMetadata(session: SessionCharacterInput): SessionCharacterMetadata {
  const sequence: string[] = [];
  let hasUserTurn = false;
  let previousCharacter: string | null = null;
  for (const message of session.conversation_log ?? []) {
    const current = messageCharacter(message);
    if (message.role === "user") hasUserTurn = true;
    // An opening without a user turn is a selection, not a conversation.
    const participant = current ?? (message.role === "user" ? previousCharacter : null);
    if (hasUserTurn && participant && sequence.at(-1) !== participant) sequence.push(participant);
    if (current) previousCharacter = current;
  }
  return {
    character_keys: [...new Set(sequence)],
    character_sequence: sequence,
    character_switch_count: Math.max(0, sequence.length - 1),
    source: "conversation_log",
  };
}

export function sessionCharacterLabel(session: SessionCharacterInput): string {
  const metadata = sessionCharacterMetadata(session);
  if (!metadata.character_keys.length) return "Aucune conversation";
  const path = metadata.character_sequence.map(displayNameForCharacter).join(" → ");
  if (!metadata.character_switch_count) return path;
  return `${path} (${metadata.character_keys.length} personnages, ${metadata.character_switch_count} changement${metadata.character_switch_count > 1 ? "s" : ""})`;
}

export function sessionCharacterOptions(sessions: SessionCharacterInput[]): Array<{ key: string; label: string }> {
  const keys = new Set<string>(AVA_CHARACTER_REGISTRY.entries.map(entry => entry.key));
  for (const session of sessions) for (const key of sessionCharacterMetadata(session).character_keys) keys.add(key);
  return [...keys].map(key => ({ key, label: displayNameForCharacter(key) }));
}
