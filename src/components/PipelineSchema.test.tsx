import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineSchema from "@/components/PipelineSchema";

describe("PipelineSchema", () => {
  it("rend les 8 étapes du pipeline conversationnel", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Schéma du pipeline conversationnel/i)).toBeInTheDocument();
    for (const label of [/STT/, /RAG/, /GM pré-tour/, /Max Agent/, /Validateur anti-hallucination/, /TTS/, /GM post-tour/]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("rend le glossaire des rôles GM/Max/RAG", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Glossaire/i)).toBeInTheDocument();
    expect(screen.getByText(/GM \(Game Master\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Brief de tour/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Validateur/i).length).toBeGreaterThan(0);
  });
});
