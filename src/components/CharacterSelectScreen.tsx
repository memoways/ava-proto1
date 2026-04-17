import { useState } from "react";

interface CharacterSelectScreenProps {
  onSelect: (character: "max" | "emma" | "leo" | "ava") => void;
}

type CharId = "max" | "emma" | "leo" | "ava";

interface CharDef {
  id: CharId;
  name: string;
  role: string;
  available: boolean;
  accent: string; // hsl token
}

const CHARACTERS: CharDef[] = [
  { id: "max", name: "Max", role: "Le père d'Ava", available: true, accent: "var(--primary)" },
  { id: "emma", name: "Emma", role: "La meilleure amie", available: false, accent: "var(--trust)" },
  { id: "leo", name: "Léo", role: "L'ex-petit ami", available: false, accent: "var(--timer-warning)" },
  { id: "ava", name: "Ava", role: "La disparue", available: false, accent: "var(--primary)" },
];

const Portrait = ({ name, accent, available }: { name: string; accent: string; available: boolean }) => {
  const initial = name.charAt(0).toUpperCase();
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      <defs>
        <radialGradient id={`grad-${name}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={`hsl(${accent} / 0.4)`} />
          <stop offset="100%" stopColor="hsl(var(--background))" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#grad-${name})`} />
      {/* Silhouette */}
      <circle cx="60" cy="48" r="20" fill="hsl(var(--foreground) / 0.12)" />
      <path
        d="M 20 120 Q 20 80 60 80 Q 100 80 100 120 Z"
        fill="hsl(var(--foreground) / 0.12)"
      />
      {/* Initial */}
      <text
        x="60"
        y="58"
        textAnchor="middle"
        fontSize="22"
        fontFamily="monospace"
        fill={available ? `hsl(${accent})` : "hsl(var(--muted-foreground) / 0.4)"}
        fontWeight="bold"
      >
        {initial}
      </text>
    </svg>
  );
};

const CharacterSelectScreen = ({ onSelect }: CharacterSelectScreenProps) => {
  const [hovered, setHovered] = useState<CharId | null>(null);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden p-6">
      <div className="absolute inset-0 cinema-vignette pointer-events-none" />

      <div className="relative z-10 text-center mb-12 animate-fade-in">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground/60 mb-3">
          Choisissez votre contact
        </p>
        <h1 className="text-2xl md:text-3xl font-light text-foreground">
          À qui voulez-vous parler&nbsp;?
        </h1>
        <p className="text-sm text-muted-foreground/70 mt-3 max-w-md">
          Pour ce prototype, seul Max est disponible. Les autres personnages arriveront bientôt.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl w-full animate-fade-in">
        {CHARACTERS.map((c) => {
          const isHover = hovered === c.id;
          return (
            <button
              key={c.id}
              disabled={!c.available}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => c.available && onSelect(c.id)}
              className={`group relative flex flex-col items-center gap-3 p-5 rounded-xl border transition-all duration-300 ${
                c.available
                  ? "border-border/40 bg-black/30 backdrop-blur-sm hover:border-primary/60 hover:bg-black/50 cursor-pointer hover-scale"
                  : "border-border/10 bg-black/10 opacity-40 cursor-not-allowed"
              }`}
            >
              <div
                className={`relative w-24 h-24 rounded-full overflow-hidden border-2 transition-all ${
                  c.available && isHover
                    ? "border-primary"
                    : "border-border/30"
                }`}
              >
                <Portrait name={c.name} accent={c.accent} available={c.available} />
              </div>
              <div className="text-center">
                <p className={`text-base font-medium ${c.available ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {c.name}
                </p>
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/60 mt-1">
                  {c.role}
                </p>
                {!c.available && (
                  <p className="text-[10px] text-muted-foreground/40 mt-2">Bientôt</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CharacterSelectScreen;
