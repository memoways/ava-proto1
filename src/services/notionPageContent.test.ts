import { describe, expect, it, vi } from "vitest";
import {
  chunkNotionPage,
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

  it("garde le niveau 3 seulement pour un titre SOUVENIR", async () => {
    const result = await collectNotionPageContent("root", async () => [
      { id: "period", type: "heading_2", heading_2: { rich_text: [{ plain_text: "Il y a sept jours" }] } },
      { id: "memory", type: "heading_3", heading_3: { rich_text: [{ plain_text: "SOUVENIR MAX aujourd'hui.01 — L'appel" }] } },
      { id: "other", type: "heading_3", heading_3: { rich_text: [{ plain_text: "Introduction" }] } },
    ]);
    expect(result.content).toContain("## Il y a sept jours");
    expect(result.content).toContain("### SOUVENIR MAX aujourd'hui.01 — L'appel");
    expect(result.content).toContain("## Introduction");
    expect(result.content).not.toContain("### Introduction");
  });
});

describe("chunkNotionPage — souvenirs éditoriaux", () => {
  const page = [
    "## TA MÉMOIRE COMPLÈTE — CE QUI S'EST PASSÉ",
    "Chaque bloc est autonome. Ce préambule n'est pas un souvenir.",
    "## Il y a sept jours",
    "### SOUVENIR MAX J-7.01 — Découverte du thermos",
    "Point de vue : Max",
    "Quand : il y a sept jours",
    "Lieu : vieille voiture",
    "Tu trouves le thermos.",
    "### SOUVENIR MAX J-7.02 — Silence envers Emma",
    "Point de vue : Max",
    "Quand : il y a sept jours",
    "Lieu : vieille voiture",
    "Tu décides de ne rien dire.",
    "## Permanent — vaut toujours aujourd'hui",
    "### SOUVENIR EMMA permanent.04 — Les pommes",
    "Point de vue : Emma",
    "Quand : permanent",
    "Lieu : Lausanne",
    "Tu ranges les pommes.",
  ].join("\n");

  it("garde deux souvenirs adjacents séparés même sous 1 000 caractères", () => {
    const chunks = chunkNotionPage(page, 1000, 150).chunks;
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain("MAX J-7.01");
    expect(chunks[0]).not.toContain("J-7.02");
    expect(chunks[1]).toContain("MAX J-7.02");
    expect(chunks[1]).not.toContain("Tu trouves le thermos");
    expect(chunks[0].length + chunks[1].length).toBeLessThan(1000);
  });

  it("laisse un souvenir de plus de 1 000 caractères entier, avec sa dernière phrase", () => {
    const ending = "La dernière phrase du thermos reste entière.";
    const narrative = `${"Mot ".repeat(280)}${ending}`;
    expect(narrative.length).toBeGreaterThan(1000);
    const longPage = [
      "## Il y a cinq jours, jour du voyage et arrivée à la montagne",
      "### SOUVENIR MAX J-5.04 — Dans la voiture",
      "Point de vue : Max",
      "Quand : il y a cinq jours",
      "Lieu : voiture",
      narrative,
    ].join("\n");
    const chunks = chunkNotionPage(longPage, 1000, 150).chunks;
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBeGreaterThan(1000);
    expect(chunks[0].endsWith(ending)).toBe(true);
    expect(chunks[0]).not.toContain("…");
  });

  it("recopie la période du titre de niveau 2 dans chaque souvenir", () => {
    const chunks = chunkNotionPage(page, 1000, 150).chunks;
    expect(chunks[0].startsWith("## Il y a sept jours")).toBe(true);
    expect(chunks[1].startsWith("## Il y a sept jours")).toBe(true);
    expect(chunks[2].startsWith("## Permanent — vaut toujours aujourd'hui")).toBe(true);
    expect(chunks[0]).not.toContain("préambule");
  });

  it("ne fait pas se recouvrir deux souvenirs", () => {
    const chunks = chunkNotionPage(page, 1000, 150).chunks;
    expect(chunks[1].startsWith("…")).toBe(false);
    expect(chunks[1]).not.toContain("Tu trouves le thermos");
  });

  it("nomme un souvenir au-dessus de 32 000 tokens sans le couper", () => {
    const huge = "mot ".repeat(30_000);
    const longPage = [
      "## Période",
      "### SOUVENIR MAX J-1.01 — Trop long",
      huge,
    ].join("\n");
    const result = chunkNotionPage(longPage, 1000, 150);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toContain(huge.slice(-20));
    expect(result.oversizedSouvenirs.map((item) => item.title)).toEqual([
      "### SOUVENIR MAX J-1.01 — Trop long",
    ]);
  });
});

describe("chunkNotionPage — page sans marqueur SOUVENIR", () => {
  it("reprend le découpage historique sans marqueur SOUVENIR", () => {
    const merged = chunkNotionPage("## Alpha\n\nUn fait court.\n\n## Beta\n\nUn autre fait court.", 1000, 150);
    expect(merged.chunks).toEqual([
      "## Alpha\n\nUn fait court.\n\nBeta\n\nUn autre fait court.",
    ]);

    const sentence = "Phrase assez longue pour remplir le chunk. ";
    const split = chunkNotionPage(`## Memoire\n\n${sentence.repeat(40)}`, 1000, 150);
    expect(split.chunks.length).toBeGreaterThan(1);
    expect(split.chunks[1].startsWith("…")).toBe(true);
    expect(split.oversizedSouvenirs).toEqual([]);
  });
});
