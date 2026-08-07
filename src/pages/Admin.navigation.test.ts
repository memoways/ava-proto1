import { describe, expect, it } from "vitest";
import { LEGACY_GROUP, TAB_GROUPS } from "@/services/adminNavigation";

describe("Admin navigation invariants", () => {
  it("keeps every protected Technique avancée page visible", () => {
    const technique = TAB_GROUPS.find((group) => group.id === "tech");
    expect(technique?.label).toContain("Technique avancée");
    expect(technique?.tabs.map((tab) => tab.id)).toEqual([
      "stt",
      "rag",
      "llm",
      "voice",
      "streaming-avatar",
      "usage",
      "voice-usage",
      "avatar-usage",
    ]);
  });

  it("separates Expérience and Qualité without merging latency sources", () => {
    expect(TAB_GROUPS.find((group) => group.id === "experience")?.tabs.map((tab) => tab.id)).toEqual([
      "gamemaster",
      "gm-settings",
      "character-runtime",
      "video-triggers",
      "architecture",
    ]);
    expect(TAB_GROUPS.find((group) => group.id === "quality")?.tabs.map((tab) => tab.id)).toEqual([
      "latency",
      "latency-telemetry",
      "max-test",
      "pipeline",
    ]);
  });

  it("keeps validator views only in the explicit legacy group", () => {
    expect(LEGACY_GROUP.tabs.map((tab) => tab.id)).toEqual(["validator", "metrics"]);
    expect(TAB_GROUPS.flatMap((group) => group.tabs).map((tab) => tab.id)).not.toContain("validator");
  });
});
