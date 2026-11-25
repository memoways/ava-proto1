import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { streamingAvatarDefaults } from "@/services/streamingAvatar/settings";
import type { CharacterVideoChoice } from "@/services/streamingAvatar/settings";
import { CharacterVideoLinkEditor } from "./CharacterVideoLinkEditor";

function show(characterKey: string, choice: CharacterVideoChoice) {
  render(
    <CharacterVideoLinkEditor
      characterKey={characterKey}
      characterName={characterKey === "max" ? "Max" : "Emma"}
      settings={streamingAvatarDefaults}
      choice={choice}
      onChange={vi.fn()}
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
});
