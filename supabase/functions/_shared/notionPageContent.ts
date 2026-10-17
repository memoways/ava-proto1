import { VOYAGE_MAX_TEXT_TOKENS } from "./ragProfiles.ts";

export interface NotionTextItem {
  plain_text?: string;
}

export interface NotionContentBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

export interface NotionContentResult {
  content: string;
  unreadBlocks: Array<{ id: string; type: string }>;
}

export interface NotionChildrenPage {
  results: NotionContentBlock[];
  has_more: boolean;
  next_cursor?: string | null;
}

type BlockData = {
  rich_text?: NotionTextItem[];
  caption?: NotionTextItem[];
  cells?: NotionTextItem[][];
  checked?: boolean;
  expression?: string;
  title?: string;
  url?: string;
};

const CONTAINER_OR_NON_TEXT_TYPES = new Set([
  "divider", "breadcrumb", "column", "column_list", "table", "synced_block",
  "table_of_contents", "template", "image", "video", "audio", "file", "pdf",
]);

function plain(items?: NotionTextItem[]): string {
  return items?.map((item) => item.plain_text || "").join("") || "";
}

export async function loadPaginatedNotionChildren(
  blockId: string,
  loadPage: (blockId: string, cursor?: string) => Promise<NotionChildrenPage>,
): Promise<NotionContentBlock[]> {
  const blocks: NotionContentBlock[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await loadPage(blockId, cursor);
    blocks.push(...page.results);
    if (page.has_more && !page.next_cursor) {
      throw new Error(`Notion pagination returned no cursor for ${blockId}`);
    }
    const nextCursor = page.has_more ? page.next_cursor || undefined : undefined;
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new Error(`Notion pagination repeated cursor ${nextCursor} for ${blockId}`);
    }
    if (nextCursor) seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);
  return blocks;
}

export function extractNotionBlockText(block: NotionContentBlock): { text: string; unread: boolean } {
  const data = block[block.type] as BlockData | undefined;
  if (!data) {
    return { text: block.type === "divider" ? "---" : "", unread: !CONTAINER_OR_NON_TEXT_TYPES.has(block.type) };
  }
  let text = plain(data.rich_text);
  if (block.type === "table_row" && Array.isArray(data.cells)) {
    text = data.cells.map((cell) => plain(cell).trim()).join(" | ");
  } else if (!text && data.expression) {
    text = data.expression;
  } else if (!text && data.title) {
    text = data.title;
  }
  const caption = plain(data.caption).trim();
  if (caption) text = text ? `${text}\n${caption}` : caption;
  if (!text && (block.type === "bookmark" || block.type === "link_preview" || block.type === "embed")) {
    text = data.url || "";
  }
  if (block.type === "heading_3" && /^SOUVENIR\b/i.test(text.trim())) text = `\n### ${text.trim()}`;
  else if (block.type.startsWith("heading_") && text) text = `\n## ${text}`;
  else if ((block.type === "bulleted_list_item" || block.type === "numbered_list_item") && text) text = `- ${text}`;
  else if (block.type === "to_do" && text) text = `- [${data.checked ? "x" : " "}] ${text}`;
  else if (block.type === "quote" && text) text = `> ${text}`;
  else if (block.type === "callout" && text) text = `📌 ${text}`;
  else if (block.type === "divider") text = "---";
  // A known text block whose rich_text array is present but empty is an
  // intentionally blank line in Notion, not an unreadable block.
  const isKnownTextBlock = Array.isArray(data.rich_text);
  const unread = block.type === "unsupported"
    || (!text && !isKnownTextBlock && !block.has_children && !CONTAINER_OR_NON_TEXT_TYPES.has(block.type));
  return { text, unread };
}

export async function collectNotionPageContent(
  rootId: string,
  loadChildren: (blockId: string) => Promise<NotionContentBlock[]>,
): Promise<NotionContentResult> {
  const blocks: string[] = [];
  const unreadBlocks: Array<{ id: string; type: string }> = [];
  const visited = new Set<string>();

  const visit = async (parentId: string): Promise<void> => {
    if (visited.has(parentId)) return;
    visited.add(parentId);
    const children = await loadChildren(parentId);
    for (const block of children) {
      const extracted = extractNotionBlockText(block);
      if (extracted.text.trim()) blocks.push(extracted.text);
      if (extracted.unread) unreadBlocks.push({ id: block.id, type: block.type });
      if (block.has_children) await visit(block.id);
    }
  };

  await visit(rootId);
  return { content: blocks.join("\n\n"), unreadBlocks };
}

const SOUVENIR_HEADING = /^###[ \t]+SOUVENIR\b/i;
const PERIOD_HEADING = /^##[ \t]+(?!#)/;

export interface OversizedEditorialSouvenir {
  title: string;
  characters: number;
  estimatedTokens: number;
}

export interface NotionChunkingResult {
  chunks: string[];
  oversizedSouvenirs: OversizedEditorialSouvenir[];
}

/** Upper bound for French text: one token per three characters. Warns before Voyage's real limit. */
export function estimateEmbeddingTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function pageHasEditorialSouvenirs(text: string): boolean {
  return text.split("\n").some((line) => SOUVENIR_HEADING.test(line.trim()));
}

function chunkTextLegacy(text: string, maxChunkSize = 1000, overlap = 150): string[] {
  const sections = text.split(/\n## /);
  const chunks: string[] = [];
  let currentChunk = "";
  for (const section of sections) {
    const sectionText = chunks.length === 0 && !text.startsWith("\n## ") ? section : `## ${section}`;
    if (sectionText.length > maxChunkSize) {
      if (currentChunk.trim()) { chunks.push(currentChunk.trim()); currentChunk = ""; }
      const paragraphs = sectionText.split(/\n\n|\n(?=-\s)/);
      let subChunk = "";
      for (const para of paragraphs) {
        if (para.length > maxChunkSize) {
          if (subChunk.trim()) { chunks.push(subChunk.trim()); subChunk = ""; }
          const sentences = para.split(/(?<=[.!?])\s+/);
          let sentenceChunk = "";
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length > maxChunkSize && sentenceChunk.length > 0) {
              chunks.push(sentenceChunk.trim());
              sentenceChunk = sentence;
            } else {
              sentenceChunk += (sentenceChunk ? " " : "") + sentence;
            }
          }
          if (sentenceChunk.trim()) subChunk = sentenceChunk;
        } else if (subChunk.length + para.length > maxChunkSize && subChunk.length > 0) {
          chunks.push(subChunk.trim());
          subChunk = para;
        } else {
          subChunk += (subChunk ? "\n" : "") + para;
        }
      }
      if (subChunk.trim()) currentChunk = subChunk;
    } else if (currentChunk.length + sectionText.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sectionText;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + sectionText;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  if (overlap > 0 && chunks.length > 1) {
    const overlapped: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].slice(-overlap);
      overlapped.push(`…${prevTail}\n\n${chunks[i]}`);
    }
    return overlapped;
  }
  return chunks;
}

function chunkEditorialSouvenirs(text: string): NotionChunkingResult {
  const chunks: string[] = [];
  const oversizedSouvenirs: OversizedEditorialSouvenir[] = [];
  let period = "";
  let current: string[] | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.join("\n").trim();
    current = null;
    if (!body) return;
    const chunk = (period ? `${period}\n\n${body}` : body).trim();
    chunks.push(chunk);
    const estimatedTokens = estimateEmbeddingTokens(chunk);
    if (estimatedTokens > VOYAGE_MAX_TEXT_TOKENS) {
      const title = chunk.split("\n").find((line) => SOUVENIR_HEADING.test(line.trim()))?.trim()
        ?? "souvenir sans titre";
      oversizedSouvenirs.push({ title, characters: chunk.length, estimatedTokens });
    }
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (SOUVENIR_HEADING.test(trimmed)) {
      flush();
      current = [trimmed];
      continue;
    }
    if (PERIOD_HEADING.test(trimmed)) {
      flush();
      period = trimmed;
      continue;
    }
    if (current) current.push(line);
  }
  flush();
  return { chunks, oversizedSouvenirs };
}

/**
 * Pages with `### SOUVENIR` become one chunk per souvenir, including the parent
 * period, with no size merge and no overlap. Other pages keep the historical
 * heading / size / overlap split.
 */
export function chunkNotionPage(text: string, maxChunkSize = 1000, overlap = 150): NotionChunkingResult {
  if (!pageHasEditorialSouvenirs(text)) {
    return { chunks: chunkTextLegacy(text, maxChunkSize, overlap), oversizedSouvenirs: [] };
  }
  return chunkEditorialSouvenirs(text);
}
