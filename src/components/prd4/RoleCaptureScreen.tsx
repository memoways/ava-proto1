/** PRD4 — Écran 4 : Création libre du personnage utilisateur (PTT — stub Phase 1) */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

interface Props {
  onSubmit: (rawInput: string) => void;
}

const EXAMPLES = [
  "Tu pourrais être une amie d'Ava qui cherche à comprendre ce qui s'est passé.",
  "Tu pourrais être un psychologue mandaté par les autorités.",
  "Tu pourrais être un voisin qui connaît la famille de loin.",
];

const RoleCaptureScreen = ({ onSubmit }: Props) => {
  // Phase 1 : stub — pas de STT réel. Saisie texte pour valider le flow.
  // Phase 2 : remplace par PTT + Deepgram.
  const [text, setText] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-7">
        <header className="space-y-3 text-center">
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
            À toi de jouer.
          </h2>
          <p className="text-muted-foreground">
            Présente le personnage que tu souhaites incarner.
          </p>
        </header>

        <div className="space-y-3 rounded-md border border-border bg-card/50 p-5 text-sm text-foreground/85">
          <p>
            Tu vas pouvoir t'entretenir par visioconférence avec l'un ou l'autre
            des membres de la famille. Mais pour entrer dans leur monde, tu dois
            d'abord exister dans le leur.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Qui es-tu&nbsp;?</li>
            <li>Quelle est ta relation avec Max, Emma, Léo et Ava&nbsp;?</li>
            <li>Quel est ton genre&nbsp;?</li>
            <li>Quel est ton âge&nbsp;?</li>
            <li>Pourquoi appelles-tu maintenant&nbsp;?</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Quelques exemples
          </p>
          <ul className="space-y-1 text-sm italic text-muted-foreground/90">
            {EXAMPLES.map((e, i) => (
              <li key={i}>— {e}</li>
            ))}
          </ul>
        </div>

        {/* Phase 1 : stub textarea. Remplacé par PTT en Phase 2. */}
        <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mic className="h-3.5 w-3.5" /> Phase 2 — push-to-talk. Pour
            l'instant, écris ta présentation.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Je suis…"
            rows={5}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={text.trim().length < 10}
            onClick={() => onSubmit(text.trim())}
            className="min-w-[220px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Valider mon personnage
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RoleCaptureScreen;
