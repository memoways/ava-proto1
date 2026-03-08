import type { AudioState } from "@/types";

interface SubtitleOverlayProps {
  userText: string;
  maxText: string;
  audioState: AudioState;
}

const SubtitleOverlay = ({ userText, maxText, audioState }: SubtitleOverlayProps) => {
  const showUser = audioState === "user_speaking" && userText;
  const showMax = (audioState === "max_speaking" || audioState === "max_thinking") && maxText;

  return (
    <div className="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center gap-2 px-8">
      {showUser && (
        <p className="max-w-lg rounded-md bg-secondary/60 px-4 py-2 text-center text-sm text-subtitle-user backdrop-blur-sm animate-fade-in">
          {userText}
        </p>
      )}
      {showMax && (
        <p className="max-w-lg rounded-md bg-secondary/80 px-4 py-2 text-center text-base text-subtitle-max backdrop-blur-sm animate-fade-in font-medium">
          {maxText}
        </p>
      )}
    </div>
  );
};

export default SubtitleOverlay;
