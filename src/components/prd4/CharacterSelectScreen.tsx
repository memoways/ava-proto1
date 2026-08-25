/** PRD4 — Choix du protagoniste (Max toujours, Emma si ready). */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import maxImg from "@/assets/characters/max.jpg";
import emmaImg from "@/assets/characters/emma.jpg";
import avaImg from "@/assets/characters/ava.jpg";
import leoImg from "@/assets/characters/leo.jpg";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";

type CharId = "max" | "emma" | "ava" | "leo";

interface Props {
  onSelect: (id: "max" | "emma") => void;
  onLockedClick?: (id: Exclude<CharId, "max">) => void;
}

const CHARACTERS: { id: CharId; name: string; img: string }[] = [
  { id: "max", name: "Max", img: maxImg },
  { id: "emma", name: "Emma", img: emmaImg },
  { id: "ava", name: "Ava", img: avaImg },
  { id: "leo", name: "Léo", img: leoImg },
];

const CharacterSelectScreen = ({ onSelect, onLockedClick }: Props) => {
  const [lockedDialog, setLockedDialog] = useState(false);
  const [maxReady, setMaxReady] = useState(true);
  const [emmaReady, setEmmaReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getCharacterRuntimeReadiness("max"),
      getCharacterRuntimeReadiness("emma"),
    ])
      .then(([maxProfile, emmaProfile]) => {
        if (cancelled) return;
        setMaxReady(maxProfile?.ready !== false);
        setEmmaReady(emmaProfile?.ready === true);
      })
      .catch(() => {
        if (cancelled) return;
        setMaxReady(true);
        setEmmaReady(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isActive = (id: CharId) => (id === "max" && maxReady) || (id === "emma" && emmaReady);

  const handleLocked = (id: CharId) => {
    setLockedDialog(true);
    if (id !== "max") onLockedClick?.(id);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8 text-center">
        <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
          À qui veux-tu parler&nbsp;?
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 tablet-lg:grid-cols-4">
          {CHARACTERS.map((c) => {
            const cardBase =
              "group relative flex flex-col items-center gap-3 rounded-lg border bg-card/60 p-4 transition-all duration-200";
            if (isActive(c.id)) {
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id as "max" | "emma")}
                  className={`${cardBase} border-primary/50 hover:-translate-y-1 hover:border-primary hover:bg-card hover:shadow-lg hover:shadow-primary/10`}
                  aria-label={`Appeler ${c.name}`}
                >
                  <div className="relative">
                    <img src={c.img} alt="" className="h-28 w-28 rounded-md object-cover" />
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-primary">Disponible</p>
                  </div>
                </button>
              );
            }
            return (
              <button
                key={c.id}
                onClick={() => handleLocked(c.id)}
                className={`${cardBase} cursor-not-allowed border-border opacity-50 grayscale hover:opacity-70`}
                aria-label={`${c.name} indisponible`}
              >
                <div className="relative">
                  <img src={c.img} alt="" className="h-28 w-28 rounded-md object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50 backdrop-blur-[1px]">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">{c.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Bientôt
                  </p>
                </div>
              </button>
            );
          })}

        </div>
      </div>

      <Dialog open={lockedDialog} onOpenChange={setLockedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personnage indisponible</DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Ce personnage n'est pas encore disponible dans cette version du
              prototype.
              <br />
              <br />
              Pour l'instant, tu peux appeler {[maxReady && "Max", emmaReady && "Emma"].filter(Boolean).join(" ou ") || "personne — la checklist runtime n'est pas complète"}.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CharacterSelectScreen;
