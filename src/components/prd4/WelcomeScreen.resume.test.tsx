import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@hcaptcha/react-hcaptcha", () => ({ default: () => null }));
vi.mock("@/services/openingTTSCache", () => ({ prefetchOpeningTTS: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/services/privacyConsent", () => ({ isPrivacyNoticeEnabled: () => false }));

import WelcomeScreen from "./WelcomeScreen";
import { prefetchOpeningTTS } from "@/services/openingTTSCache";

const baseProps = {
  onStart: vi.fn().mockResolvedValue(true),
  privacyPreferences: null,
  onPrivacyChange: vi.fn(),
};

describe("WelcomeScreen — reprise", () => {
  it("ne prépare aucune voix pendant la recherche ou lorsqu'une reprise existe", async () => {
    const onResume = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <MemoryRouter>
        <WelcomeScreen {...baseProps} resumeLoading resumeAvailable={false} onResume={onResume} />
      </MemoryRouter>,
    );
    expect(prefetchOpeningTTS).not.toHaveBeenCalled();

    view.rerender(
      <MemoryRouter>
        <WelcomeScreen {...baseProps} resumeLoading={false} resumeAvailable onResume={onResume} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reprendre l’appel" }));
    await waitFor(() => expect(onResume).toHaveBeenCalledOnce());
    expect(baseProps.onStart).not.toHaveBeenCalled();
    expect(prefetchOpeningTTS).not.toHaveBeenCalled();
  });
});
