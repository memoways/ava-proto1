import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { streamingAvatarDefaults } from "@/services/streamingAvatar/settings";
import type { CharacterVideoChoice } from "@/services/streamingAvatar/settings";
import type { OutputMode } from "@/services/streamingAvatar/types";
import { CharacterVideoLinkEditor, characterVideoSummary } from "./CharacterVideoLinkEditor";

function show(characterKey: string, choice: CharacterVideoChoice, configuredMode: OutputMode = "streaming_avatar") {
  render(
    <CharacterVideoLinkEditor
      characterKey={characterKey}
      characterName={characterKey === "max" ? "Max" : "Emma"}
      settings={streamingAvatarDefaults}
      choice={choice}
      onChange={vi.fn()}
      configuredMode={configuredMode}
    />,
  );
}

describe("CharacterVideoLinkEditor", () => {
  it("warns that Emma's empty Anam fields would take Max's face and voice", () => {
    show("emma", { link: { provider: "anam" }, tavus: {} });
    expect(screen.getByRole("alert").textContent).toContain("Avatar ID, Voice ID vidéo");
  });

  it("warns about Emma's missing Tavus face", () => {
    show("emma", { link: { provider: "tavus" }, tavus: {} });
    expect(screen.getByRole("alert").textContent).toContain("Face ID");
  });

  it("stays quiet once the fields are filled, and for Max", () => {
    show("emma", { link: { provider: "anam", avatarId: "a", voiceId: "v" }, tavus: {} });
    show("max", { link: { provider: "anam" }, tavus: {} });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what Max's next call gives under the global switch", () => {
    show("max", { link: { provider: "tavus" }, tavus: {} }, "tts");
    expect(screen.getByTestId("next-call-max")).toHaveTextContent("Voix seule, car le réglage global est sur Voix");
  });

  it("opens the linked provider while video is on, and hides the fields for « Pas de vidéo »", () => {
    show("max", { link: { provider: "tavus" }, tavus: {} });
    expect(screen.getByTestId("next-call-max")).toHaveTextContent("Vidéo Tavus");
  });

  it("shows no provider field for « Pas de vidéo »", () => {
    show("emma", { link: { provider: "none" }, tavus: {} });
    expect(screen.getByTestId("next-call-emma")).toHaveTextContent("Voix seule, choisie pour ce personnage");
    expect(screen.queryByLabelText(/Avatar ID|Persona|Face/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("summarises the folded block on one line", () => {
    expect(characterVideoSummary({ link: null, tavus: {} })).toBe("Suit le réglage global");
    expect(characterVideoSummary({ link: { provider: "none" }, tavus: {} })).toBe("Pas de vidéo");
    expect(characterVideoSummary({ link: { provider: "tavus" }, tavus: { faceId: "f1" } })).toBe("Tavus · Face f1");
  });
});
