import { CHARACTER_PROMPT_FIELDS, type CharacterPrompt } from "@/services/characterPromptService";

export interface CharacterSyncFieldChange {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
}

export interface CharacterSyncReport {
  /** updated_at of the observed version (ISO) */
  at: string;
  /** updated_at of the previously observed version (ISO) */
  previousAt: string;
  changes: CharacterSyncFieldChange[];
  totalBefore: number;
  totalAfter: number;
}

interface Snapshot {
  at: string;
  fields: Record<string, number>;
}

const TRACKED: Array<{ key: string; label: string }> = [
  ...CHARACTER_PROMPT_FIELDS.map((f) => ({ key: f.key as string, label: f.label })),
  { key: "situation_summary", label: "Situation actuelle (résumé)" },
];

const snapKey = (id: string) => `ava_character_snapshot_${id}`;
const reportKey = (id: string) => `ava_character_sync_report_${id}`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — non bloquant */
  }
}

function measure(prompt: CharacterPrompt): Snapshot {
  const fields: Record<string, number> = {};
  TRACKED.forEach(({ key }) => {
    fields[key] = ((prompt as any)[key] as string | undefined)?.length ?? 0;
  });
  return { at: prompt.updated_at || "", fields };
}

/**
 * Compare the freshly loaded prompt with the last version observed in this browser.
 * When the DB version changed, persist a human-readable diff (char counts per field)
 * so the Personnages panel can show what the last sync actually changed.
 */
export function observeCharacterPrompt(
  characterId: string,
  prompt: CharacterPrompt,
): CharacterSyncReport | null {
  const current = measure(prompt);
  const previous = readJSON<Snapshot>(snapKey(characterId));

  if (previous && previous.at !== current.at) {
    const changes = TRACKED.map(({ key, label }) => {
      const before = previous.fields[key] ?? 0;
      const after = current.fields[key] ?? 0;
      return { key, label, before, after, delta: after - before };
    }).filter((c) => c.delta !== 0);

    const report: CharacterSyncReport = {
      at: current.at,
      previousAt: previous.at,
      changes,
      totalBefore: Object.values(previous.fields).reduce((s, v) => s + v, 0),
      totalAfter: Object.values(current.fields).reduce((s, v) => s + v, 0),
    };
    writeJSON(snapKey(characterId), current);
    writeJSON(reportKey(characterId), report);
    return report;
  }

  writeJSON(snapKey(characterId), current);
  return readJSON<CharacterSyncReport>(reportKey(characterId));
}

export function getStoredSyncReport(characterId: string): CharacterSyncReport | null {
  return readJSON<CharacterSyncReport>(reportKey(characterId));
}

export function formatSyncDate(iso?: string | null): string {
  if (!iso) return "inconnue";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "inconnue";
  return d.toLocaleString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
