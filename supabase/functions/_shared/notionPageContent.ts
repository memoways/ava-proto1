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
  if (block.type.startsWith("heading_") && text) text = `\n## ${text}`;
  else if ((block.type === "bulleted_list_item" || block.type === "numbered_list_item") && text) text = `- ${text}`;
  else if (block.type === "to_do" && text) text = `- [${data.checked ? "x" : " "}] ${text}`;
  else if (block.type === "quote" && text) text = `> ${text}`;
  else if (block.type === "callout" && text) text = `📌 ${text}`;
  else if (block.type === "divider") text = "---";
  const unread = block.type === "unsupported"
    || (!text && !block.has_children && !CONTAINER_OR_NON_TEXT_TYPES.has(block.type));
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
