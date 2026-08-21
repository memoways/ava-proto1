import { describe, expect, it } from "vitest";
import {
  LEGACY_GROUP,
  TAB_GROUPS,
  adminSessionPath,
  adminTabPath,
  resolveAdminPath,
} from "@/services/adminNavigation";

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
      "alerts",
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

  it("assigns a unique human-readable path to every admin page", () => {
    const pages = [...TAB_GROUPS, LEGACY_GROUP].flatMap((group) =>
      group.tabs.map((tab) => adminTabPath(tab.id)),
    );
    expect(new Set(pages).size).toBe(pages.length);
    expect(pages.every((path) => path.startsWith("/admin/") && !path.includes("?tab="))).toBe(true);
    expect(adminTabPath("sessions")).toBe("/admin/donnees/sessions");
    expect(adminTabPath("llm")).toBe("/admin/technique/configuration-llm");
    expect(adminTabPath("latency")).toBe("/admin/qualite/latence-et-blocages");
  });

  it("resolves canonical pages and session detail URLs", () => {
    expect(resolveAdminPath("/admin/experience/reglages-game-master")).toEqual({
      group: "experience",
      tab: "gm-settings",
      sessionId: null,
    });
    expect(adminSessionPath("session 42")).toBe("/admin/donnees/sessions/session%2042");
    expect(resolveAdminPath("/admin/donnees/sessions/session%2042")).toEqual({
      group: "data",
      tab: "sessions",
      sessionId: "session 42",
    });
    expect(resolveAdminPath("/admin/chemin/inconnu")).toBeNull();
    expect(resolveAdminPath("/admin/donnees/sessions/%E0%A4%A")).toBeNull();
  });
});
