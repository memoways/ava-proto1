// Pure building blocks of the admin "Importation vidéo" tab: which Gumlet videos are
// missing from the Notion "Vidéos AVA" base, and the page created for each of them.
// Shared by the import-gumlet-videos edge function and the admin tab; no Deno or
// browser API here so vitest covers every rule.
import { GUMLET_COLLECTION_ID, gumletAssetId } from "./videoDescription.ts";

/** The only Notion base the import may ever write. */
export const VIDEOS_DATABASE_ID = "478685a5b31e45b5bc534bcf905b9124";
/** The player only reads this Gumlet workspace (formerly "collection"). */
export const GUMLET_WORKSPACE_ID = GUMLET_COLLECTION_ID;
/** An imported video never reaches the game before a human puts it "En ligne". */
export const IMPORT_STATUS = "A vérifier";

export const IMPORT_NATURES = ["Extrait du film", "Vidéo transformée"] as const;
export const IMPORT_CHARACTERS = ["Max", "Emma", "Ava", "Léo", "Tous"] as const;
export const IMPORT_DIALOGUES = ["Parlé", "Silencieux"] as const;
export const MAX_IMPORT_BATCH = 50;

export interface ImportDefaults {
  nature?: (typeof IMPORT_NATURES)[number];
  characters?: Array<(typeof IMPORT_CHARACTERS)[number]>;
  dialogue?: (typeof IMPORT_DIALOGUES)[number];
}

export interface GumletVideo {
  asset_id: string;
  title: string;
  description: string;
  status: string;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: string;
  size_bytes: number | null;
  folder: string;
  tags: string[];
  /** ISO date-time of the upload, or null when Gumlet gives none. */
  uploaded_at: string | null;
  thumbnail_url: string | null;
}

export type ImportRequest =
  | { action: "list" }
  | { action: "import"; assetIds: string[]; defaults: ImportDefaults };

const ASSET_ID = /^[a-f0-9]{24}$/i;

export function parseImportRequest(
  body: unknown,
): { ok: true; value: ImportRequest } | { ok: false; error: string } {
  const data = asRecord(body);
  if (data.action === "list") return { ok: true, value: { action: "list" } };
  if (data.action !== "import") return { ok: false, error: "unknown_action" };

  const ids = Array.isArray(data.asset_ids) ? data.asset_ids : [];
  if (ids.length === 0 || !ids.every((id) => typeof id === "string" && ASSET_ID.test(id))) {
    return { ok: false, error: "invalid_asset_ids" };
  }
  const assetIds = [...new Set(ids.map((id) => (id as string).toLowerCase()))];
  if (assetIds.length > MAX_IMPORT_BATCH) return { ok: false, error: "too_many_videos" };

  const raw = asRecord(data.defaults);
  const defaults: ImportDefaults = {};
  if (raw.nature) {
    if (!isOneOf(IMPORT_NATURES, raw.nature)) return { ok: false, error: "invalid_nature" };
    defaults.nature = raw.nature;
  }
  if (raw.dialogue) {
    if (!isOneOf(IMPORT_DIALOGUES, raw.dialogue)) return { ok: false, error: "invalid_dialogue" };
    defaults.dialogue = raw.dialogue;
  }
  if (raw.characters !== undefined) {
    const list = raw.characters;
    if (!Array.isArray(list) || !list.every((name) => isOneOf(IMPORT_CHARACTERS, name))) {
      return { ok: false, error: "invalid_characters" };
    }
    if (list.length) defaults.characters = list as ImportDefaults["characters"];
  }
  return { ok: true, value: { action: "import", assetIds, defaults } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const positive = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);

/** Gumlet asset details → the fields the admin shows and Notion receives. */
export function parseGumletVideo(details: unknown): GumletVideo | null {
  const asset = asRecord(details);
  const assetId = text(asset.asset_id).toLowerCase();
  if (!ASSET_ID.test(assetId)) return null;
  const input = asRecord(asset.input);
  const thumbnails = asRecord(asset.output).thumbnail_url;
  // The two Gumlet endpoints disagree on `tag`: array on details, string on the list.
  const tags = Array.isArray(asset.tag) ? asset.tag : text(asset.tag).split(",");
  const createdAt = positive(asset.created_at);
  const uploaded = createdAt === null ? null : new Date(createdAt);
  return {
    asset_id: assetId,
    title: text(input.title) || `Vidéo ${assetId}`,
    description: text(input.description),
    status: text(asset.status),
    duration_s: positive(input.duration),
    width: positive(input.width),
    height: positive(input.height),
    aspect_ratio: text(input.aspect_ratio),
    size_bytes: positive(input.size),
    folder: text(asset.folder),
    tags: tags.map(text).filter(Boolean),
    uploaded_at: uploaded && !Number.isNaN(uploaded.getTime()) ? uploaded.toISOString() : null,
    thumbnail_url: (Array.isArray(thumbnails) ? thumbnails.map(text).find((url) => url.startsWith("https://")) : "") || null,
  };
}

type NotionProperties = Record<string, unknown>;

const plain = (property: unknown) => {
  const value = asRecord(property);
  const parts = Array.isArray(value.rich_text) ? value.rich_text : [];
  return parts.map((part) => text(asRecord(part).plain_text)).join("");
};

/** Every Gumlet video already in Notion, whatever its status (archived included). */
export function knownAssetIds(pages: Array<{ properties?: NotionProperties }>): Set<string> {
  const known = new Set<string>();
  for (const page of pages) {
    const props = page.properties ?? {};
    for (const name of ["URL Gumlet", "URL"]) {
      const assetId = gumletAssetId(text(asRecord(props[name]).url));
      if (assetId) known.add(assetId.toLowerCase());
    }
    const stored = plain(props["ID Gumlet"]).trim().toLowerCase();
    if (ASSET_ID.test(stored)) known.add(stored);
  }
  return known;
}

const TITLE_PROPERTY = "Titre de la vidéo";
const REQUIRED_PROPERTIES: Record<string, string> = {
  [TITLE_PROPERTY]: "title",
  "URL Gumlet": "url",
  "État": "status",
};

/** Properties without which an import could expose or lose a video: the import is refused. */
export function missingRequiredProperties(schema: Record<string, { type?: string }>): string[] {
  return Object.entries(REQUIRED_PROPERTIES)
    .filter(([name, type]) => schema[name]?.type !== type)
    .map(([name]) => name);
}

const richText = (value: string) => ({ rich_text: [{ type: "text", text: { content: value.slice(0, 1900) } }] });
const round = (value: number) => Math.round(value * 10) / 10;

function dimensions(video: GumletVideo): string {
  if (!video.width || !video.height) return video.aspect_ratio;
  const size = `${video.width} × ${video.height}`;
  return video.aspect_ratio ? `${size} (${video.aspect_ratio})` : size;
}

export function gumletWatchUrl(assetId: string): string {
  return `https://gumlet.tv/watch/${assetId}`;
}

/**
 * Notion page for one video. Metadata and batch choices are written only to properties
 * that exist with the expected type; the skipped names are reported, never created.
 */
export function buildNotionPage(
  video: GumletVideo,
  schema: Record<string, { type?: string }>,
  defaults: ImportDefaults,
): { page: Record<string, unknown>; skipped: string[] } {
  const properties: NotionProperties = {
    [TITLE_PROPERTY]: { title: [{ type: "text", text: { content: video.title.slice(0, 1900) } }] },
    "URL Gumlet": { url: gumletWatchUrl(video.asset_id) },
    "État": { status: { name: IMPORT_STATUS } },
  };
  const skipped: string[] = [];
  const add = (name: string, type: string, value: unknown) => {
    if (value === null) return;
    if (schema[name]?.type === type) properties[name] = value;
    else skipped.push(name);
  };
  const optionalText = (name: string, value: string) => add(name, "rich_text", value ? richText(value) : null);

  optionalText("ID Gumlet", video.asset_id);
  add("Durée (s)", "number", video.duration_s ? { number: round(video.duration_s) } : null);
  add("Uploadée sur Gumlet", "date", video.uploaded_at ? { date: { start: video.uploaded_at } } : null);
  optionalText("Dimensions", dimensions(video));
  add("Poids (Mo)", "number", video.size_bytes ? { number: round(video.size_bytes / 1_000_000) } : null);
  optionalText("Dossier Gumlet", video.folder);
  optionalText("Tags Gumlet", video.tags.join(", "));
  optionalText("Description Gumlet", video.description);
  add("Nature", "select", defaults.nature ? { select: { name: defaults.nature } } : null);
  add("Dialogue", "select", defaults.dialogue ? { select: { name: defaults.dialogue } } : null);
  add("Personnages", "multi_select", defaults.characters?.length
    ? { multi_select: defaults.characters.map((name) => ({ name })) }
    : null);

  return {
    page: {
      parent: { database_id: VIDEOS_DATABASE_ID },
      ...(video.thumbnail_url ? { cover: { type: "external", external: { url: video.thumbnail_url } } } : {}),
      properties,
    },
    skipped,
  };
}
