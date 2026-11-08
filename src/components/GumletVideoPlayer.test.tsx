import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveNativeVideoSource } from "@/services/videoPlayback";
import GumletVideoPlayer from "./GumletVideoPlayer";

describe("GumletVideoPlayer", () => {
  it("plays the replacement introduction automatically with full-volume audio", () => {
    const watchUrl = "https://gumlet.tv/watch/6acc8341689a80cf2e4a427d";
    const hlsUrl = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6acc8341689a80cf2e4a427d/main.m3u8";
    expect(resolveNativeVideoSource(watchUrl)).toEqual({ url: hlsUrl, kind: "hls" });
    expect(resolveNativeVideoSource(hlsUrl)).toEqual({ url: hlsUrl, kind: "hls" });
    render(<GumletVideoPlayer videoUrl={hlsUrl} onComplete={() => {}} onSkip={() => {}} />);
    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
    expect(player.autoplay).toBe(true);
    expect(player.muted).toBe(false);
    expect(player.defaultMuted).toBe(false);
    expect(player.volume).toBe(1);
    expect(player.controls).toBe(false);
  });

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

    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
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

    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
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

    const firstPlayer = screen.getByLabelText("Video player");
    rerender(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/67a281cac82041cdc3714c0c"
        onComplete={() => {}}
        onSkip={() => {}}
      />,
    );

    expect(screen.getByLabelText("Video player")).toBe(firstPlayer);
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
          const player = screen.getByLabelText("Video player") as HTMLVideoElement;
          stateObservedByParent = {
            muted: player.muted,
            currentTime: player.currentTime,
            hasSource: player.hasAttribute("src"),
          };
        }}
      />,
    );

    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
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

    const player = screen.getByLabelText("Video player");
    fireEvent.ended(player);
    fireEvent.ended(player);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reports one playback failure while shown, and none while hidden", () => {
    const onError = vi.fn();
    const url = "https://example.test/cinematic.mp4";
    const { rerender } = render(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} onError={onError} active={false} />);
    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
    fireEvent.error(player);
    expect(onError).not.toHaveBeenCalled();
    rerender(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} onError={onError} active />);
    fireEvent.error(player);
    fireEvent.error(player);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("hides the pointer and the native tooltip while a video plays; a mouse move shows it briefly", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<GumletVideoPlayer videoUrl="https://example.test/cinematic.mp4" onComplete={() => {}} onSkip={() => {}} active />);
      const shell = container.firstElementChild as HTMLElement;
      expect(screen.getByLabelText("Video player")).not.toHaveAttribute("title");
      expect(shell).toHaveClass("cursor-none");
      fireEvent.mouseMove(shell);
      expect(shell).not.toHaveClass("cursor-none");
      act(() => { vi.advanceTimersByTime(1_600); });
      expect(shell).toHaveClass("cursor-none");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the whole film on touch screens and offers fullscreen; desktop keeps filling in landscape", () => {
    const url = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6acc8341689a80cf2e4a427d/main.m3u8";
    const { unmount } = render(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} />);
    const desktop = screen.getByLabelText("Video player");
    expect(desktop.className).toContain("object-cover");
    expect(desktop.className).toContain("portrait:object-contain");
    expect(screen.queryByRole("button", { name: /Plein écran/ })).toBeNull();
    unmount();

    render(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst />);
    const touch = screen.getByLabelText("Video player") as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    expect(touch.className).toContain("object-contain");
    expect(touch.className).not.toContain("object-cover");
    // iPhone: no element fullscreen, the native player opens.
    const enter = vi.fn();
    touch.webkitEnterFullscreen = enter;
    fireEvent.click(screen.getByRole("button", { name: /Plein écran/ }));
    expect(enter).toHaveBeenCalledTimes(1);
  });
});
