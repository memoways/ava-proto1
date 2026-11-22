import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { resolveNativeVideoSource } from "@/services/videoPlayback";
import { attachVideoGain, getVideoGain, isIosWebKit, type VideoGain } from "@/services/videoGain";
import GumletVideoPlayer from "./GumletVideoPlayer";

vi.mock("@/services/videoGain", () => ({
  canRouteThroughGain: vi.fn(() => true),
  getVideoGain: vi.fn(() => null),
  attachVideoGain: vi.fn(async () => null),
  keepVideoGainAudible: vi.fn(),
  isIosWebKit: vi.fn(() => false),
}));

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

  it("overlay: muted while hidden, attenuated once shown, silent where volume cannot be set", () => {
    const url = "https://gumlet.tv/watch/6acc8341689a80cf2e4a427d";
    const onPlaying = vi.fn();
    const { rerender } = render(
      <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} active muted volume={0.178}
        onPlaying={onPlaying} allowFullscreen={false} touchFirst showSkip={false} />,
    );
    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
    expect(player.muted).toBe(true);
    expect(screen.queryByRole("button", { name: /Plein écran/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Passer/ })).not.toBeInTheDocument();
    fireEvent.playing(player);
    expect(onPlaying).toHaveBeenCalledTimes(1);

    rerender(
      <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} active muted={false} volume={0.178}
        onPlaying={onPlaying} allowFullscreen={false} touchFirst showSkip={false} />,
    );
    expect(player.muted).toBe(false);
    expect(player.volume).toBeCloseTo(0.178, 3);
    // A user agent resetting the sound is corrected back to the requested attenuation.
    player.volume = 1;
    fireEvent.volumeChange(player);
    expect(player.volume).toBeCloseTo(0.178, 3);

    // iOS: volume is read-only (always 1) → the attenuated video stays silent instead.
    Object.defineProperty(player, "volume", { configurable: true, get: () => 1, set: () => {} });
    rerender(
      <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} active muted={false} volume={0.17}
        onPlaying={onPlaying} allowFullscreen={false} touchFirst showSkip={false} />,
    );
    expect(player.muted).toBe(true);
  });

  it("overlay on iOS: stays muted until a Web Audio gain is attached, then attenuates through it", async () => {
    const url = "https://gumlet.tv/watch/6acc8341689a80cf2e4a427d";
    vi.mocked(attachVideoGain).mockClear();
    const setLinear = vi.fn();
    const gain: VideoGain = { setLinear };
    let release: (value: VideoGain | null) => void = () => {};
    vi.mocked(attachVideoGain).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(
      <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} active muted={false} volume={0.178}
        allowFullscreen={false} touchFirst showSkip={false} />,
    );
    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
    // jsdom honours volume; emulate iOS, where it is read-only.
    Object.defineProperty(player, "volume", { configurable: true, get: () => 1, set: () => {} });
    fireEvent.play(player);
    fireEvent.volumeChange(player);
    expect(attachVideoGain).toHaveBeenCalledTimes(1);
    expect(player.muted).toBe(true);
    expect(player.dataset.audioMode).toBe("muted-fallback");

    vi.mocked(getVideoGain).mockReturnValue(gain);
    await act(async () => { release(gain); });
    expect(setLinear).toHaveBeenCalledWith(expect.closeTo(0.178, 3));
    expect(player.muted).toBe(false);
    expect(player.dataset.audioMode).toBe("web-audio-gain");
    vi.mocked(getVideoGain).mockReturnValue(null);
  });

  it("overlay on iOS: the volume read-back is never trusted (it can claim the volume was applied)", async () => {
    vi.mocked(attachVideoGain).mockClear();
    vi.mocked(isIosWebKit).mockReturnValue(true);
    try {
      render(
        <GumletVideoPlayer videoUrl="https://gumlet.tv/watch/6acc8341689a80cf2e4a427d" onComplete={() => {}} onSkip={() => {}}
          active muted={false} volume={0.178} allowFullscreen={false} touchFirst showSkip={false} />,
      );
      const player = screen.getByLabelText("Video player") as HTMLVideoElement;
      fireEvent.play(player); // jsdom reads the volume back as set: a read-back check would see "supported"
      await act(async () => { await Promise.resolve(); });
      expect(attachVideoGain).toHaveBeenCalled();
      expect(player.muted).toBe(true);
      expect(player.dataset.audioMode).toBe("muted-fallback");
    } finally {
      vi.mocked(isIosWebKit).mockReturnValue(false);
    }
  });

  it("overlay on iOS: stays muted when no gain can be attached", async () => {
    const url = "https://gumlet.tv/watch/6acc8341689a80cf2e4a427d";
    render(
      <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} active muted={false} volume={0.178}
        allowFullscreen={false} touchFirst showSkip={false} />,
    );
    const player = screen.getByLabelText("Video player") as HTMLVideoElement;
    Object.defineProperty(player, "volume", { configurable: true, get: () => 1, set: () => {} });
    fireEvent.play(player);
    await act(async () => { await Promise.resolve(); });
    expect(player.muted).toBe(true);
    expect(player.dataset.audioMode).toBe("muted-fallback");
  });

  it("does not report playing while hidden (preload)", () => {
    const onPlaying = vi.fn();
    render(<GumletVideoPlayer videoUrl="https://gumlet.tv/watch/6acc8341689a80cf2e4a427d" onComplete={() => {}} onSkip={() => {}}
      active={false} onPlaying={onPlaying} />);
    fireEvent.playing(screen.getByLabelText("Video player"));
    expect(onPlaying).not.toHaveBeenCalled();
  });

  describe("smartphone presentation modes", () => {
    const url = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6acc8341689a80cf2e4a427d/main.m3u8";
    // jsdom has no PointerEvent: a MouseEvent carries the coordinates and the pointerId.
    beforeAll(() => {
      if (typeof window.PointerEvent === "undefined") {
        class TestPointerEvent extends MouseEvent {
          pointerId: number;
          constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
            super(type, init);
            this.pointerId = init.pointerId ?? 0;
          }
        }
        Object.defineProperty(window, "PointerEvent", { configurable: true, value: TestPointerEvent });
      }
    });
    const setScreen = (width: number, height: number) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    };

    it("current: whole frame, no pan, no rotation invite", () => {
      setScreen(390, 844);
      render(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst />);
      const player = screen.getByLabelText("Video player");
      expect(player).toHaveAttribute("data-fit", "contain");
      expect(screen.queryByTestId("rotate-invite")).not.toBeInTheDocument();
    });

    it("portrait: full height film, starts on the framed point, a finger drag pans it", () => {
      setScreen(390, 844);
      const { container } = render(
        <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst videoMode="portrait" panStart={0.5} />,
      );
      const player = screen.getByLabelText("Video player");
      const root = container.firstElementChild as HTMLElement;
      expect(player).toHaveAttribute("data-fit", "pan");
      const filmWidth = 844 * (16 / 9);
      const start = Number(player.getAttribute("data-pan-offset"));
      expect(start).toBe(Math.round(filmWidth / 2 - 195));
      expect(player.style.width).toBe(`${filmWidth}px`);
      expect(screen.queryByText("Plein écran ⤢")).not.toBeInTheDocument();

      fireEvent.pointerDown(root, { pointerId: 1, clientX: 200, clientY: 400 });
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 100, clientY: 405 });
      expect(Number(player.getAttribute("data-pan-offset"))).toBe(start + 100);
      fireEvent.pointerUp(root, { pointerId: 1 });
      fireEvent.pointerMove(root, { pointerId: 1, clientX: 0, clientY: 405 });
      expect(Number(player.getAttribute("data-pan-offset"))).toBe(start + 100);
    });

    it("portrait: a short tap does not pan", () => {
      setScreen(390, 844);
      const { container } = render(
        <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst videoMode="portrait" />,
      );
      const player = screen.getByLabelText("Video player");
      const root = container.firstElementChild as HTMLElement;
      const start = player.getAttribute("data-pan-offset");
      fireEvent.pointerDown(root, { pointerId: 2, clientX: 200, clientY: 400 });
      fireEvent.pointerMove(root, { pointerId: 2, clientX: 203, clientY: 400 });
      expect(player.getAttribute("data-pan-offset")).toBe(start);
    });

    it("landscape: shows an icon-only rotation invite while upright, none once turned", () => {
      setScreen(390, 844);
      const { unmount } = render(
        <GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst videoMode="landscape" />,
      );
      const invite = screen.getByTestId("rotate-invite");
      expect(invite.textContent).toBe("");
      unmount();
      setScreen(844, 390);
      render(<GumletVideoPlayer videoUrl={url} onComplete={() => {}} onSkip={() => {}} touchFirst videoMode="landscape" />);
      expect(screen.queryByTestId("rotate-invite")).not.toBeInTheDocument();
    });
  });
});
