import { describe, expect, it } from "vitest";
import {
  LEGACY_GROUP,
  TAB_GROUPS,
  adminSessionPath,
  adminTabPath,
  movedAdminPath,
  resolveAdminPath,
} from "@/services/adminNavigation";

describe("Admin navigation invariants", () => {
  it("exposes the account / sandbox guide group first", () => {
    const account = TAB_GROUPS[0];
    expect(account?.id).toBe("account");
    expect(account?.path).toBe("mon-compte");
    expect(account?.tabs.map((tab) => tab.id)).toEqual(["sandbox-guide", "test-invitations", "architecture"]);
  });

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
      "speech-workshop",
      "gamemaster",
      "gm-settings",
      "character-runtime",
      "devices",
      "video-triggers",
      "extracts",
      "video-decisions",
      "video-import",
    ]);
    expect(TAB_GROUPS.find((group) => group.id === "quality")?.tabs.map((tab) => tab.id)).toEqual([
      "alerts",
      "latency",
      "latency-telemetry",
      "max-test",
      "eval-judge",
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
    expect(adminTabPath("speech-workshop")).toBe("/admin/experience/atelier-de-parole");
    expect(adminTabPath("llm")).toBe("/admin/technique/configuration-llm");
    expect(adminTabPath("latency")).toBe("/admin/qualite/latence-et-blocages");
    expect(adminTabPath("eval-judge")).toBe("/admin/qualite/llm-as-judge");
    expect(adminTabPath("sandbox-guide")).toBe("/admin/mon-compte/mode-emploi");
    expect(adminTabPath("test-invitations")).toBe("/admin/mon-compte/invitations-de-test");
  });

  it("keeps the old address of a moved page working", () => {
    expect(movedAdminPath("/admin/experience/fonctionnement")).toBe(adminTabPath("architecture"));
    expect(movedAdminPath("/admin/experience/fonctionnement/")).toBe("/admin/mon-compte/fonctionnement");
    expect(movedAdminPath("/admin/experience/extraits")).toBeNull();
    expect(adminTabPath("video-import")).toBe("/admin/experience/importation-video");
  });

  it("resolves canonical pages and session detail URLs", () => {
    expect(resolveAdminPath("/admin/mon-compte/mode-emploi")).toEqual({
      group: "account",
      tab: "sandbox-guide",
      sessionId: null,
    });
    expect(resolveAdminPath("/admin/mon-compte/invitations-de-test")).toEqual({
      group: "account",
      tab: "test-invitations",
      sessionId: null,
    });
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
