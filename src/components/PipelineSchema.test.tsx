import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineSchema from "@/components/PipelineSchema";

describe("PipelineSchema", () => {
  it("rend le pipeline et marque les étapes absentes du PRD4 live", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Schéma du pipeline conversationnel/i)).toBeInTheDocument();
    for (const label of [/STT/, /RAG/, /GM pré-tour/, /Max Agent/, /Validateur \(simulateur\)/, /TTS/, /GM post-tour/]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText("non exécuté en live")).toHaveLength(2);
  });

  it("rend le glossaire des rôles GM/Max/RAG", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Glossaire/i)).toBeInTheDocument();
    expect(screen.getByText(/GM \(Game Master\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Brief de tour/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Validateur/i).length).toBeGreaterThan(0);
  });
});
