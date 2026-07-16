import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveNativeVideoSource } from "@/services/videoPlayback";
import GumletVideoPlayer from "./GumletVideoPlayer";

describe("GumletVideoPlayer", () => {
  it("converts every valid Gumlet watch/embed URL to direct HLS", () => {
    expect(resolveNativeVideoSource("https://gumlet.tv/watch/6a188e39fdee17a44c1ea049")).toEqual({
      url: "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6a188e39fdee17a44c1ea049/main.m3u8",
      kind: "hls",
    });
    expect(resolveNativeVideoSource("https://play.gumlet.io/embed/67a281cac82041cdc3714c0c?autoplay=true")).toEqual({
      url: "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/67a281cac82041cdc3714c0c/main.m3u8",
      kind: "hls",
    });
  });

  it("never partially converts an invalid Gumlet identifier", () => {
    expect(resolveNativeVideoSource("https://play.gumlet.io/embed/e2e-family")).toEqual({
      url: "https://play.gumlet.io/embed/e2e-family",
      kind: "file",
    });
  });

  it("renders Gumlet embeds as native video and never as an iframe", () => {
    render(
      <GumletVideoPlayer
        videoUrl="https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049?muted=true&volume=0"
        onComplete={() => {}}
        onSkip={() => {}}
      />,
    );

    const player = screen.getByTitle("Video player") as HTMLVideoElement;
    expect(player.tagName).toBe("VIDEO");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(player).toHaveAttribute(
      "data-source",
      "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6a188e39fdee17a44c1ea049/main.m3u8",
    );
  });

  it("keeps autoplay enabled without exposing native media controls", () => {
    render(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/67a281cac82041cdc3714c0c"
        onComplete={() => {}}
        onSkip={() => {}}
      />,
    );

    const player = screen.getByTitle("Video player") as HTMLVideoElement;
    expect(player.autoplay).toBe(true);
    expect(player.controls).toBe(false);
    expect(player.volume).toBe(1);
    expect(screen.queryByRole("button", { name: /activer le son|play/i })).not.toBeInTheDocument();
  });

  it("keeps the same native media element when the cinematic changes", () => {
    const { rerender } = render(
      <GumletVideoPlayer
        videoUrl="https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049"
        onComplete={() => {}}
        onSkip={() => {}}
        active={false}
      />,
    );

    const firstPlayer = screen.getByTitle("Video player");
    rerender(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/67a281cac82041cdc3714c0c"
        onComplete={() => {}}
        onSkip={() => {}}
      />,
    );

    expect(screen.getByTitle("Video player")).toBe(firstPlayer);
    expect(firstPlayer).toHaveAttribute(
      "data-source",
      "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/67a281cac82041cdc3714c0c/main.m3u8",
    );
  });

  it("hard-stops and rewinds before notifying the parent about Passer", () => {
    let stateObservedByParent: { muted: boolean; currentTime: number; hasSource: boolean } | null = null;

    render(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/6a188e39fdee17a44c1ea049"
        onComplete={() => {}}
        onSkip={() => {
          const player = screen.getByTitle("Video player") as HTMLVideoElement;
          stateObservedByParent = {
            muted: player.muted,
            currentTime: player.currentTime,
            hasSource: player.hasAttribute("src"),
          };
        }}
      />,
    );

    const player = screen.getByTitle("Video player") as HTMLVideoElement;
    player.currentTime = 12;
    fireEvent.click(screen.getByRole("button", { name: /passer/i }));

    expect(stateObservedByParent).toEqual({ muted: true, currentTime: 0, hasSource: false });
  });

  it("calls completion only once even if ended is emitted twice", () => {
    const onComplete = vi.fn();
    render(
      <GumletVideoPlayer
        videoUrl="https://example.test/cinematic.mp4"
        onComplete={onComplete}
        onSkip={() => {}}
      />,
    );

    const player = screen.getByTitle("Video player");
    fireEvent.ended(player);
    fireEvent.ended(player);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
