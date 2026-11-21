import { describe, expect, it } from "vitest";
import type { FlowLink } from "./videoDecisionLog";
import { layoutSankey, videoFlowColumns } from "./videoDecisionSankey";

function link(source: string, target: string, count: number): FlowLink {
  return { source, target, count, examples: [] };
}

describe("layoutSankey", () => {
  it("makes every outgoing band, including a session that stops, fill the source bar", () => {
    const layout = layoutSankey({
      columns: [
        { label: "Vidéo 1", nodes: [{ name: "famille", count: 146 }] },
        { label: "Vidéo 2", nodes: [{ name: "secrets", count: 57 }, { name: "deuil", count: 30 }] },
      ],
      steps: [[link("famille", "secrets", 57), link("famille", "deuil", 30)]],
    });
    const source = layout.columns[0].nodes[0];
    const leaving = layout.bands.filter((band) => band.source === "famille");
    expect(leaving.some((band) => band.target == null && band.count === 59)).toBe(true);
    expect(leaving.reduce((sum, band) => sum + band.sourceH, 0)).toBeCloseTo(source.h, 4);
    const secrets = layout.columns[1].nodes.find((node) => node.name === "secrets");
    const intoSecrets = layout.bands.filter((band) => band.target === "secrets");
    expect(intoSecrets.reduce((sum, band) => sum + band.targetH, 0)).toBeCloseTo(secrets?.h ?? 0, 4);
    expect(layout.bands.every((band) => band.sourceH > 0)).toBe(true);
  });

  it("keeps a thin flow thin beside a thick one", () => {
    const layout = layoutSankey(videoFlowColumns([
      link("famille", "aucune vidéo", 140),
      link("famille", "suspendus", 6),
    ], "Thèmes", "Vidéos"));
    const [thick, thin] = layout.bands;
    expect(thick.sourceH).toBeGreaterThan(thin.sourceH * 10);
    const source = layout.columns[0].nodes[0];
    expect(layout.bands.reduce((sum, band) => sum + band.sourceH, 0)).toBeCloseTo(source.h, 4);
    expect(layout.bands.some((band) => band.target == null)).toBe(false);
  });
});
