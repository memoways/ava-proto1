import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CharacterStateEditor } from "@/components/admin/CharacterStateEditor";
import { CharacterStateHistory } from "@/components/admin/CharacterStateHistory";
import { STATE_LEVEL_TEXT } from "@/services/characterState";

describe("CharacterStateEditor", () => {
  it("is off by default and creates a neutral profile when switched on", () => {
    const onChange = vi.fn();
    render(<CharacterStateEditor characterName="Max" value={null} onChange={onChange} />);
    expect(screen.getByTestId("state-editor-off")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    const next = onChange.mock.calls[0][0];
    expect(next.initial.agitation).toBe(3);
    expect(next.maxStepPerTurn).toBe(1);
    expect(next.gmCanEvolve).toBe(true);
  });

  it("shows five axes, the exact fragment sent to the character and the radar", () => {
    render(<CharacterStateEditor characterName="Max" value={{ initial: { agitation: 5 } }} onChange={vi.fn()} />);
    expect(screen.getByTestId("state-axis-combativite")).toBeTruthy();
    expect(screen.getByTestId("state-axis-agitation")).toBeTruthy();
    expect(screen.getByTestId("state-preview").textContent).toContain(STATE_LEVEL_TEXT.agitation[5]);
    expect(screen.getByTestId("state-radar").getAttribute("aria-label")).toContain("Agitation 5");
  });

  it("switches back to no state (null) from the editor", () => {
    const onChange = vi.fn();
    render(<CharacterStateEditor characterName="Max" value={{}} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renames an axis label", () => {
    const onChange = vi.fn();
    render(<CharacterStateEditor characterName="Max" value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Libellé Agitation"), { target: { value: "Nervosité" } });
    expect(onChange.mock.calls[0][0].labels.agitation).toBe("Nervosité");
  });
});

describe("CharacterStateHistory", () => {
  const lv = (agitation: number) => ({ combativite: 3, initiative: 3, lucidite: 3, ouverture: 3, agitation });
  it("renders nothing without recorded state", () => {
    const { container } = render(<CharacterStateHistory log={[{ character_key: "max", turn_index: 1 }]} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders a mini-radar per character with the last state", () => {
    render(<CharacterStateHistory log={[
      { character_key: "max", turn_index: 1, character_state_used: lv(2) },
      { character_key: "max", turn_index: 2, character_state_used: lv(4) },
    ]} />);
    expect(screen.getByTestId("state-history")).toBeTruthy();
    expect(screen.getByTestId("state-radar").getAttribute("aria-label")).toContain("Agitation 4");
  });
});
