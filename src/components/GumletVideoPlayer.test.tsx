import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GumletVideoPlayer from "./GumletVideoPlayer";

describe("GumletVideoPlayer", () => {
  it("ignores unrelated string messages that only happen to contain an ended event", () => {
    const onComplete = vi.fn();

    render(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/6a188e39fdee17a44c1ea049"
        onComplete={onComplete}
        onSkip={() => {}}
      />,
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ event: "ended" }),
      }),
    );

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("builds the Gumlet embed URL from a watch URL", () => {
    render(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/6a188e39fdee17a44c1ea049"
        onComplete={() => {}}
        onSkip={() => {}}
      />,
    );

    expect(screen.getByTitle("Video player")).toHaveAttribute(
      "src",
      "https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049?preload=true&autoplay=true",
    );
  });

  it("calls onSkip from the overlay button", () => {
    const onSkip = vi.fn();

    render(
      <GumletVideoPlayer
        videoUrl="https://gumlet.tv/watch/6a188e39fdee17a44c1ea049"
        onComplete={() => {}}
        onSkip={onSkip}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /passer/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
