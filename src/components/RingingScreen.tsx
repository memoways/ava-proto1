import { useEffect, useRef, useState } from "react";
import { PhoneOff, Phone } from "lucide-react";

interface RingingScreenProps {
  characterName: string;
  onAnswer: () => void;
  onHangUp: () => void;
  autoAnswerMs?: number;
}

/**
 * Plays a synthesized "video call" ringtone using Web Audio API.
 * Pattern: two short tones, pause, repeat.
 */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const playBeep = (freq: number, startAt: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + startAt);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.02);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + duration - 0.05);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    const playPattern = () => {
      // Two-tone ring
      playBeep(880, 0, 0.35, 0.15);
      playBeep(660, 0.45, 0.35, 0.15);
    };

    playPattern();
    const interval = window.setInterval(playPattern, 2000);
    timersRef.current.push(interval);

    return () => {
      timersRef.current.forEach((t) => clearInterval(t));
      timersRef.current = [];
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active]);
}

const RingingScreen = ({ characterName, onAnswer, onHangUp, autoAnswerMs = 5000 }: RingingScreenProps) => {
  const [ringing, setRinging] = useState(true);
  useRingtone(ringing);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setRinging(false);
      onAnswer();
    }, autoAnswerMs);
    return () => clearTimeout(t);
  }, [autoAnswerMs, onAnswer]);

  const handleAnswer = () => {
    setRinging(false);
    onAnswer();
  };

  const handleHangUp = () => {
    setRinging(false);
    onHangUp();
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 cinema-vignette pointer-events-none" />
      <div className="absolute inset-0 cinema-gradient pointer-events-none" />

      {/* Pulsing rings */}
      <div className="relative z-10 flex flex-col items-center gap-10 animate-fade-in">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-48 h-48 rounded-full border border-primary/30 animate-ping" />
          <div className="absolute w-36 h-36 rounded-full border border-primary/40 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full border-2 border-primary/60 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <span className="text-3xl font-light text-foreground">{characterName.charAt(0)}</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground/60 mb-2">
            Appel entrant
          </p>
          <p className="text-2xl font-light text-foreground">{characterName}</p>
          <p className="text-sm text-muted-foreground/70 mt-2">Visioconférence cryptée…</p>
        </div>

        <div className="flex items-center gap-10 mt-4">
          <button
            onClick={handleHangUp}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground transition-all hover-scale shadow-lg"
            title="Refuser"
          >
            <PhoneOff size={22} />
          </button>
          <button
            onClick={handleAnswer}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover-scale shadow-lg animate-pulse"
            title="Répondre"
          >
            <Phone size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RingingScreen;
