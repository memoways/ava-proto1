/** PRD4 — Écran 5 : Résumé du personnage utilisateur */
import { Button } from "@/components/ui/button";
import type { UserRoleProfile } from "@/types";

interface Props {
  profile: UserRoleProfile;
  onConfirm: () => void;
  onRestart: () => void;
}

const RoleSummaryScreen = ({ profile, onConfirm, onRestart }: Props) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
    <div className="mx-auto w-full max-w-xl space-y-7 text-center">
      <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
        Je résume.
      </h2>

      <blockquote className="rounded-md border border-border bg-card/60 p-6 text-left font-serif text-lg leading-relaxed text-foreground/90">
        {profile.summary_for_user}
      </blockquote>

      {profile.created_by_system && (
        <p className="text-xs text-muted-foreground">
          Certaines informations ont été complétées automatiquement pour rendre
          ton personnage plus cohérent.
        </p>
      )}

      <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
        <Button variant="ghost" onClick={onRestart} className="min-w-[160px]">
          Recommencer
        </Button>
        <Button
          onClick={onConfirm}
          className="min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Continuer
        </Button>
      </div>
    </div>
  </div>
);

export default RoleSummaryScreen;
