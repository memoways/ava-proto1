import { describe, expect, it } from "vitest";
import {
  ACTIVE_SITUATION_SUMMARY_PROMPT_VERSION,
  buildSituationSummaryPrompt,
  isSituationSummaryPromptVersion,
  recentTimelineDays,
  situationSummaryRequest,
} from "../../supabase/functions/_shared/situationSummaryPrompt";
import sandbox from "@/agents/__fixtures__/speechSandbox20261109.json";

type FixtureRow = { name: string; timeline: string; identite_fondamentale: string };
const rows = sandbox as unknown as FixtureRow[];
const max = rows.find((row) => row.name.startsWith("Max"))!;
const emma = rows.find((row) => row.name.startsWith("Emma"))!;
const sources = (row: FixtureRow) => ({
  name: row.name,
  pageContent: "Fin du récit : la famille attend dans l'appartement.",
  timeline: row.timeline,
  identity: row.identite_fondamentale,
});

describe("recentTimelineDays", () => {
  it("keeps today, yesterday, two and three days ago, most recent first", () => {
    const days = recentTimelineDays(max.timeline);
    expect(days.map((day) => day.heading)).toEqual([
      "Aujourd'hui, à l'appartement de Lausanne",
      "Hier, jour 4 à la montagne et retour à Lausanne",
      "Il y a deux jours, jour 3 à la montagne",
      "Il y a trois jours, jour 2 à la montagne",
    ]);
  });

  it("files Peter's death under yesterday, never two days ago (Max and Emma)", () => {
    for (const row of [max, emma]) {
      const [, yesterday, twoDaysAgo] = recentTimelineDays(row.timeline);
      expect(yesterday.entries.some((entry) => /Peter est tué par Agotha/.test(entry))).toBe(true);
      expect(yesterday.entries.some((entry) => /Agotha et Philippe meurent/.test(entry))).toBe(true);
      expect(twoDaysAgo.entries.some((entry) => /tué|meurent/.test(entry))).toBe(false);
      expect(twoDaysAgo.entries.some((entry) => /Peter, vivant/.test(entry))).toBe(true);
    }
  });

  it("strips the souvenir code but keeps place and title", () => {
    const [today] = recentTimelineDays(max.timeline);
    expect(today.entries).toEqual(["appartement ville / jour — Chacun de son côté, et l'appel que tu attends"]);
  });

  it("ignores preamble paragraphs and returns nothing for an unstructured timeline", () => {
    expect(recentTimelineDays("Utilise cette timeline.\nHier il pleuvait.")).toEqual([]);
    expect(recentTimelineDays("")).toEqual([]);
  });
});

describe("buildSituationSummaryPrompt", () => {
  it("returns null when there is nothing to summarize", () => {
    expect(buildSituationSummaryPrompt({ name: "Max", pageContent: " ", timeline: "", identity: "x" }, "v2_second_person")).toBeNull();
  });

  it("keeps the current generator as the active sync version (v1, coverage obligation)", () => {
    expect(ACTIVE_SITUATION_SUMMARY_PROMPT_VERSION).toBe("v1_coverage");
    const prompt = buildSituationSummaryPrompt(sources(max), "v1_coverage")!;
    expect(prompt.startsWith(`Tu rédiges la SITUATION ACTUELLE du personnage "${max.name}"`)).toBe(true);
    expect(prompt).toContain("OBLIGATION DE COUVERTURE");
    expect(prompt).toContain("FORME : 90-130 mots, français, 3e personne");
    expect(prompt).toContain(max.timeline.trim());
    expect(situationSummaryRequest(prompt, "v1_coverage")).toMatchObject({
      model: "google/gemini-2.5-flash", temperature: 0.3, max_tokens: 260,
    });
  });

  it("v2 speaks in the second person, without the coverage obligation", () => {
    const prompt = buildSituationSummaryPrompt(sources(max), "v2_second_person")!;
    expect(prompt).not.toContain("OBLIGATION DE COUVERTURE");
    expect(prompt).not.toContain("3e personne");
    expect(prompt).toContain("écris à la 2e personne");
    expect(prompt).toContain("ne la recopie jamais scène par scène");
    expect(prompt).toContain("120 mots au total au maximum");
    expect(prompt).toContain("jamais « je »");
    expect(situationSummaryRequest(prompt, "v2_second_person").max_tokens).toBeGreaterThan(260);
  });

  it("v2 hands the model a chronology filed by day, with explicit dating rules", () => {
    const prompt = buildSituationSummaryPrompt(sources(emma), "v2_second_person")!;
    const yesterday = prompt.indexOf("HIER, JOUR 4");
    const twoDays = prompt.indexOf("IL Y A DEUX JOURS, JOUR 3");
    const peter = prompt.indexOf("Peter est tué par Agotha");
    expect(prompt.indexOf("AUJOURD'HUI, À L'APPARTEMENT")).toBeLessThan(yesterday);
    expect(yesterday).toBeLessThan(peter);
    expect(peter).toBeLessThan(twoDays);
    expect(prompt).toContain("Une mort se date par son jour exact");
    expect(prompt).toContain("Chaque mort des derniers jours est nommée à son jour");
    expect(prompt).toContain("écris-la comme une croyance à son jour");
    expect(prompt).toContain("n'invente pas son objet");
    expect(prompt).toContain("Ce qui s'est passé à l'hôtel n'est pas l'appartement");
    // Older periods and the timeline preamble are not repeated.
    expect(prompt).not.toContain("Il y a cinq jours");
    expect(prompt).not.toContain("SOUVENIR EMMA");
  });

  it("v2 falls back to the raw timeline when it has no day sections", () => {
    const prompt = buildSituationSummaryPrompt({ ...sources(max), timeline: "Hier : retour en ville." }, "v2_second_person")!;
    expect(prompt).toContain("Hier : retour en ville.");
  });

  it("recognizes only known versions", () => {
    expect(isSituationSummaryPromptVersion("v2_second_person")).toBe(true);
    expect(isSituationSummaryPromptVersion("v3")).toBe(false);
  });
});
