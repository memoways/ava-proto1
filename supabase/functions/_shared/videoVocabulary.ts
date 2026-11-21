// Vocabulary shared by videos and the Game Master.
// Source of truth: Notion multi-select options on "🎬 Vidéos AVA".
// When the property has no options, the union of values on the synced pages is used.
// A missing property exports an empty list. Callers replace the stored list;
// nothing here merges with a previous export, so a deleted term does not linger.

export const VIDEO_LABEL_COLUMNS = ["emotions", "stakes", "on_screen"] as const;

export const THEME_PROPERTY_NAMES = ["Thèmes", "Themes"] as const;
export const EMOTION_PROPERTY_NAMES = ["Émotion", "Emotion", "Émotions", "Emotions"] as const;
export const STAKE_PROPERTY_NAMES = ["Enjeu", "Enjeux"] as const;
export const ON_SCREEN_PROPERTY_NAMES = ["À l'écran", "A l'écran", "À l’écran", "A l’écran"] as const;

/** Database property, as returned by GET /v1/databases. */
export interface NotionMultiSelectSchema {
  type?: string;
  multi_select?: { options?: Array<{ name?: string | null }> | null } | null;
}

/** Page property, as returned by a database query. */
export interface NotionMultiSelectValue {
  multi_select?: Array<{ name?: string | null }> | null;
}

export interface VideoLabelLists {
  themes: string[];
  emotions: string[];
  stakes: string[];
  on_screen: string[];
}

function cleanName(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function uniqueLabels(values: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const name = cleanName(value);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function propertyByNames<T>(
  record: Record<string, T> | null | undefined,
  names: readonly string[],
): { present: boolean; value: T | undefined } {
  if (!record) return { present: false, value: undefined };
  const name = names.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  if (!name) return { present: false, value: undefined };
  return { present: true, value: record[name] };
}

/** Names selected on one Notion page. Absent property → []. */
export function multiSelectNames(property: NotionMultiSelectValue | null | undefined): string[] {
  if (!property?.multi_select) return [];
  return uniqueLabels(property.multi_select.map((option) => option.name));
}

function optionNames(property: NotionMultiSelectSchema | undefined): string[] {
  const multi = property?.multi_select;
  if (!multi || Array.isArray(multi)) return [];
  return uniqueLabels((multi.options ?? []).map((option) => option.name));
}

/**
 * Current vocabulary for one list.
 * - schema present, property absent → [] (never a leftover)
 * - schema present, options filled → those options, even if no video uses them yet
 * - schema present, options empty → union of the page values
 * - schema unavailable → union of the page values (empty when the pages do not carry the property)
 */
export function exportLabelList(
  schema: Record<string, NotionMultiSelectSchema> | null,
  names: readonly string[],
  pageValues: readonly (readonly string[])[],
): string[] {
  if (schema) {
    const found = propertyByNames(schema, names);
    if (!found.present) return [];
    const options = optionNames(found.value);
    if (options.length > 0) return options;
  }
  return uniqueLabels(pageValues.flat());
}

export function exportVideoVocabulary(
  schema: Record<string, NotionMultiSelectSchema> | null,
  pages: {
    themes: readonly (readonly string[])[];
    emotions: readonly (readonly string[])[];
    stakes: readonly (readonly string[])[];
    on_screen: readonly (readonly string[])[];
  },
): VideoLabelLists {
  return {
    themes: exportLabelList(schema, THEME_PROPERTY_NAMES, pages.themes),
    emotions: exportLabelList(schema, EMOTION_PROPERTY_NAMES, pages.emotions),
    stakes: exportLabelList(schema, STAKE_PROPERTY_NAMES, pages.stakes),
    on_screen: exportLabelList(schema, ON_SCREEN_PROPERTY_NAMES, pages.on_screen),
  };
}

/** True when a write failed only because the vocabulary columns are not migrated yet. */
export function isMissingVideoLabelColumnError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) return false;
  const message = error.message ?? "";
  return VIDEO_LABEL_COLUMNS.some((column) => message.includes(column));
}

/** True when the vocabulary snapshot table itself is not migrated yet. */
export function isMissingVocabularyStoreError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  if (error.code === "PGRST205" || error.code === "42P01") return message.includes("video_label_vocabulary");
  return message.includes("video_label_vocabulary") && (error.code === "PGRST204" || error.code === "42703");
}
