import {
  DEFAULT_SHEET_COMPRESSION,
  normalizeSheetCompressionLevel,
  type SheetCompressionLevel,
} from "@/agents/sheetCompression";
import { loadEnvironmentSetting, readEnvironmentStorage, saveEnvironmentSetting } from "@/services/environmentContext";

/**
 * Compression de la fiche lot 1 — one level per character, saved per environment in
 * `admin_settings` (no migration, no orchestration or Game Master version). The call
 * reads it once while it is prepared (`ensureExperienceSettings` loads the key), so a
 * change applies from the next call.
 */
export const SHEET_COMPRESSION_KEY = "ava_character_sheet_compression";

export interface SheetCompressionSettings {
  byCharacter: Record<string, SheetCompressionLevel>;
}

export const EMPTY_SHEET_COMPRESSION: SheetCompressionSettings = { byCharacter: {} };

export function normalizeSheetCompressionSettings(value: unknown): SheetCompressionSettings {
  const raw = value && typeof value === "object" ? (value as { byCharacter?: unknown }).byCharacter : undefined;
  const byCharacter: Record<string, SheetCompressionLevel> = {};
  if (raw && typeof raw === "object") {
    for (const [key, level] of Object.entries(raw as Record<string, unknown>)) {
      const normalized = normalizeSheetCompressionLevel(level);
      if (normalized !== DEFAULT_SHEET_COMPRESSION) byCharacter[key] = normalized;
    }
  }
  return { byCharacter };
}

export function sheetCompressionFor(settings: SheetCompressionSettings, characterKey: string): SheetCompressionLevel {
  return settings.byCharacter[characterKey] ?? DEFAULT_SHEET_COMPRESSION;
}

/** Last copy loaded in this browser for the active environment (synchronous, for the call). */
export function getSheetCompressionSettings(): SheetCompressionSettings {
  try {
    const stored = readEnvironmentStorage(SHEET_COMPRESSION_KEY);
    return stored ? normalizeSheetCompressionSettings(JSON.parse(stored)) : EMPTY_SHEET_COMPRESSION;
  } catch {
    return EMPTY_SHEET_COMPRESSION;
  }
}

export async function loadSheetCompressionSettings(): Promise<SheetCompressionSettings> {
  return normalizeSheetCompressionSettings(
    await loadEnvironmentSetting(SHEET_COMPRESSION_KEY, EMPTY_SHEET_COMPRESSION, (_defaults, stored) => stored),
  );
}

/** Saves one character's level; the other characters keep the level read from the database. */
export async function saveSheetCompressionLevel(characterKey: string, level: SheetCompressionLevel): Promise<SheetCompressionSettings> {
  const stored = await loadSheetCompressionSettings();
  const next = normalizeSheetCompressionSettings({ byCharacter: { ...stored.byCharacter, [characterKey]: level } });
  await saveEnvironmentSetting(SHEET_COMPRESSION_KEY, next);
  return next;
}
