/** PRD4 — Écran 3 : Teaser vidéo (Gumlet) */
import GumletVideoPlayer from "@/components/GumletVideoPlayer";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

const TEASER_VIDEO_URL = "https://gumlet.tv/watch/6a188e39fdee17a44c1ea049";

const TeaserScreen = ({ onContinue, onSkip }: Props) => (
  <GumletVideoPlayer
    videoUrl={TEASER_VIDEO_URL}
    onComplete={onContinue}
    onSkip={onSkip}
  />
);

export default TeaserScreen;
