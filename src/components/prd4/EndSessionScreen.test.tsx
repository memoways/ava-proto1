import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EndSessionScreen from "./EndSessionScreen";

describe("EndSessionScreen", () => {
  it("ends the prototype without naming a character", () => {
    render(<EndSessionScreen onContinue={vi.fn()} />);

    expect(screen.getByText("La communication se coupe.")).toBeInTheDocument();
    expect(screen.getByText("L'expérience s'arrête ici pour cette version du prototype.")).toBeInTheDocument();
    expect(screen.queryByText(/Max reste silencieux/i)).not.toBeInTheDocument();
  });
});
