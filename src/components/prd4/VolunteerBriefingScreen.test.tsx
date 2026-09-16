import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import VolunteerBriefingScreen from "./VolunteerBriefingScreen";
import {
  VOLUNTEER_BRIEFING_CARDS,
  clearVolunteerBriefingProgress,
  getVolunteerBriefingProgress,
  saveVolunteerBriefingProgress,
} from "@/services/volunteerBriefing";

describe("VolunteerBriefingScreen", () => {
  beforeEach(() => {
    clearVolunteerBriefingProgress();
  });

  it("avance carte par carte puis marque la complétion", () => {
    const onComplete = vi.fn();
    render(<VolunteerBriefingScreen onComplete={onComplete} />);

    expect(screen.getByRole("heading", { name: VOLUNTEER_BRIEFING_CARDS[0].title })).toBeInTheDocument();
    for (let i = 0; i < VOLUNTEER_BRIEFING_CARDS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "J'ai compris" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(getVolunteerBriefingProgress().completed).toBe(true);
  });

  it("reprend à la carte interrompue", () => {
    saveVolunteerBriefingProgress({ lastCardIndex: 1 });
    render(<VolunteerBriefingScreen onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { name: VOLUNTEER_BRIEFING_CARDS[1].title })).toBeInTheDocument();
  });

  it("en relecture, repart de la première carte sans toucher la complétion", () => {
    saveVolunteerBriefingProgress({ completed: true, lastCardIndex: 0 });
    const onClose = vi.fn();
    render(<VolunteerBriefingScreen mode="review" onComplete={vi.fn()} onClose={onClose} />);

    expect(screen.getByRole("heading", { name: VOLUNTEER_BRIEFING_CARDS[0].title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalled();
    expect(getVolunteerBriefingProgress().completed).toBe(true);
  });
});
