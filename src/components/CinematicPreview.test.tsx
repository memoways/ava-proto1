import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { resolveGumletThumbnailUrl } from "@/services/videoPlayback";
import CinematicPreview from "./CinematicPreview";

const EMBED_URL = "https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049";
const THUMBNAIL_URL = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6a188e39fdee17a44c1ea049/thumbnail-1-0.png";

function Harness({ videoUrl }: { videoUrl: string | null }) {
  const [playing, setPlaying] = useState(false);
  return (
    <CinematicPreview
      videoUrl={videoUrl}
      title="intro_max"
      playing={playing}
      onPlay={() => setPlaying(true)}
      onClose={() => setPlaying(false)}
    />
  );
}

describe("resolveGumletThumbnailUrl", () => {
  it("derives Gumlet's poster frame from watch and embed URLs only", () => {
    expect(resolveGumletThumbnailUrl(EMBED_URL)).toBe(THUMBNAIL_URL);
    expect(resolveGumletThumbnailUrl("https://gumlet.tv/watch/6a188e39fdee17a44c1ea049")).toBe(THUMBNAIL_URL);
    expect(resolveGumletThumbnailUrl("https://example.com/clip.mp4")).toBeNull();
    expect(resolveGumletThumbnailUrl(null)).toBeNull();
  });
});

describe("CinematicPreview", () => {
  it("shows the thumbnail, then an inline player with controls, then the thumbnail again", () => {
    const { container } = render(<Harness videoUrl={EMBED_URL} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(THUMBNAIL_URL);

    fireEvent.click(screen.getByLabelText("Lire intro_max"));
    const player = screen.getByLabelText("intro_max") as HTMLVideoElement;
    expect(player.tagName).toBe("VIDEO");
    expect(player.controls).toBe(true);

    fireEvent.click(screen.getByLabelText("Fermer la lecture de intro_max"));
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(THUMBNAIL_URL);
  });

  it("shows a placeholder without a play button when the media is missing", () => {
    render(<Harness videoUrl={null} />);
    expect(screen.getByLabelText("Aucun média")).toBeTruthy();
    expect(screen.queryByLabelText("Lire intro_max")).toBeNull();
  });
});
