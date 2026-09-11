import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useEffect: vi.fn() };
});

import CallingMaxScreen from "./CallingMaxScreen";

describe("CallingMaxScreen", () => {
  it("uses the portrait uploaded for the selected character", () => {
    render(
      <CallingMaxScreen
        character="emma"
        portraitUrl="https://portraits.example/emma-uploaded.jpg"
        onAnswered={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Emma" }))
      .toHaveAttribute("src", "https://portraits.example/emma-uploaded.jpg");
  });
});
