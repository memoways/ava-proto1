import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/services/settingsService", () => {
  const defaults = {
    mode: "off",
    authorizedFacts: "Fait global A\nFait global B",
    blockedAssertionRules: "Règle globale 1",
  };
  return {
    getAntiHallucinationValidatorSettings: () => ({ ...defaults }),
    loadAntiHallucinationValidatorSettingsFromDB: async () => ({ ...defaults }),
    saveAntiHallucinationValidatorSettings: (patch: any) => ({ ...defaults, ...patch }),
    saveAntiHallucinationValidatorSettingsToDB: async () => {},
    resetAntiHallucinationValidatorSettings: () => ({ ...defaults }),
  };
});

vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import AntiHallucinationValidatorTab from "./AntiHallucinationValidatorTab";

beforeEach(() => {
  localStorage.setItem(
    "ava_pipeline_last_trace",
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      preTurnBrief: {
        allowed_knowledge: ["Fait du tour X"],
        forbidden_topics: ["Sujet interdit Y"],
        blocked_assertions: ["Assertion bloquée Z"],
      },
    }),
  );
});

describe("AntiHallucinationValidatorTab", () => {
  it("renders PreviewColumn and MiniList helpers with merged data", () => {
    render(<AntiHallucinationValidatorTab />);

    // PreviewColumn titles
    expect(screen.getByText("Faits autorisés (fusion)")).toBeInTheDocument();
    expect(screen.getByText("Assertions bloquées (fusion)")).toBeInTheDocument();
    expect(screen.getByText("Sujets interdits (tour)")).toBeInTheDocument();

    // PreviewColumn merged footer label (proves PreviewColumn rendered)
    expect(screen.getAllByText(/Fusion envoyée au validateur/i).length).toBeGreaterThanOrEqual(3);

    // MiniList items from global + turn (proves MiniList rendered, items also appear in merged list)
    expect(screen.getAllByText("Fait global A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Fait du tour X").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Règle globale 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Assertion bloquée Z").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sujet interdit Y").length).toBeGreaterThanOrEqual(1);

    // MiniList label format "(N)" (proves MiniList helper rendered)
    expect(screen.getAllByText(/\(\d+\)/).length).toBeGreaterThan(0);
  });
});
