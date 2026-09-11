import { describe, expect, it, vi } from "vitest";
import {
  collectNotionPageContent,
  loadPaginatedNotionChildren,
} from "../../supabase/functions/_shared/notionPageContent";

describe("Notion page content traversal", () => {
  it("suit toutes les pages de résultats Notion", async () => {
    const loadPage = vi.fn(async (_blockId: string, cursor?: string) => cursor
      ? { results: [{ id: "second", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Deuxième" }] } }], has_more: false }
      : { results: [{ id: "first", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Première" }] } }], has_more: true, next_cursor: "page-2" });

    const blocks = await loadPaginatedNotionChildren("root", loadPage);

    expect(blocks.map((block) => block.id)).toEqual(["first", "second"]);
    expect(loadPage).toHaveBeenNthCalledWith(1, "root", undefined);
    expect(loadPage).toHaveBeenNthCalledWith(2, "root", "page-2");
  });

  it("lit les tableaux et une imbrication profonde sans limite arbitraire", async () => {
    const load = vi.fn(async (id: string) => {
      if (id === "root") return [
        { id: "table", type: "table", has_children: true, table: {} },
        { id: "d1", type: "toggle", has_children: true, toggle: { rich_text: [{ plain_text: "Niveau 1" }] } },
      ];
      if (id === "table") return [{ id: "row", type: "table_row", table_row: { cells: [[{ plain_text: "Date" }], [{ plain_text: "Fait" }]] } }];
      if (/^d\d+$/.test(id)) {
        const level = Number(id.slice(1));
        return level < 9
          ? [{ id: `d${level + 1}`, type: "toggle", has_children: true, toggle: { rich_text: [{ plain_text: `Niveau ${level + 1}` }] } }]
          : [{ id: "deep", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Texte profond" }] } }];
      }
      return [];
    });

    const result = await collectNotionPageContent("root", load);
    expect(result.content).toContain("Date | Fait");
    expect(result.content).toContain("Texte profond");
    expect(result.unreadBlocks).toEqual([]);
  });

  it("propage une erreur intermédiaire afin d'empêcher un remplacement partiel", async () => {
    await expect(collectNotionPageContent("root", async (id) => {
      if (id === "root") return [{ id: "child", type: "toggle", has_children: true, toggle: { rich_text: [{ plain_text: "Ouvert" }] } }];
      throw new Error("Notion page 2 unavailable");
    })).rejects.toThrow("Notion page 2 unavailable");
  });

  it("signale un bloc dont le contenu ne peut pas être lu", async () => {
    const result = await collectNotionPageContent("root", async () => [
      { id: "unknown", type: "unsupported", unsupported: {} },
    ]);
    expect(result.unreadBlocks).toEqual([{ id: "unknown", type: "unsupported" }]);
  });
});
