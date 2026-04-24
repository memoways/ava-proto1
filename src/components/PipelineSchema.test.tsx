import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineSchema from "@/components/PipelineSchema";

describe("PipelineSchema", () => {
  it("rend les 8 étapes du pipeline conversationnel", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Schéma du pipeline conversationnel/i)).toBeInTheDocument();
    expect(screen.getByText(/STT/)).toBeInTheDocument();
    expect(screen.getByText(/RAG/)).toBeInTheDocument();
    expect(screen.getByText(/GM pré-tour/)).toBeInTheDocument();
    expect(screen.getByText(/Max Agent/)).toBeInTheDocument();
    expect(screen.getByText(/Validateur anti-hallucination/)).toBeInTheDocument();
    expect(screen.getByText(/TTS/)).toBeInTheDocument();
    expect(screen.getByText(/GM post-tour/)).toBeInTheDocument();
  });

  it("rend le glossaire des rôles GM/Max/RAG", () => {
    render(<PipelineSchema />);
    expect(screen.getByText(/Glossaire/i)).toBeInTheDocument();
    expect(screen.getByText(/GM \(Game Master\)/i)).toBeInTheDocument();
    expect(screen.getByText(/RAG/)).toBeInTheDocument();
    expect(screen.getByText(/Validateur/)).toBeInTheDocument();
  });
});
