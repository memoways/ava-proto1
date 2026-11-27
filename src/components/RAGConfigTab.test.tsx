import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import RAGConfigPreview from "@/dev/RAGConfigPreview";

describe("RAGConfigTab — test settings apart from durable ones", () => {
  it("folds the prompt variant and the experimental index by default, with plain labels", () => {
    render(<RAGConfigPreview />);
    const prompt = screen.getByTestId("test-settings-rag-prompt");
    const profiles = screen.getByTestId("test-settings-rag-profiles");
    for (const fold of [prompt, profiles]) {
      expect(fold.tagName).toBe("DETAILS");
      expect(fold).not.toHaveAttribute("open");
    }
    expect(within(prompt).getByRole("radiogroup", { hidden: true, name: "Variante du prompt Max" })).toBeInTheDocument();
    expect(prompt).toHaveTextContent("Optimized v3 est la version retenue");
    expect(prompt).toHaveTextContent("adopté");
    expect(profiles).toHaveTextContent("Voyage Context 4");
    expect(profiles).toHaveTextContent("prototype");
    expect(profiles).not.toHaveTextContent("Voyage 4 · temps réel");
    expect(document.body.textContent).not.toMatch(/Lot \d|canary|Live actuel/i);
  });
});
