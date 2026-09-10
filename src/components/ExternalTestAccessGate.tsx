import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { configureExternalTestRuntime } from "@/services/environmentContext";
import {
  getExternalTestAccessStatus,
  redeemExternalTestInvitation,
} from "@/services/externalTestInvitations";

interface Props {
  invitationId: string;
  children: ReactNode;
}

export default function ExternalTestAccessGate({ invitationId, children }: Props) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [permanentAccount, setPermanentAccount] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user && data.session.user.is_anonymous !== true) {
        if (active) {
          setPermanentAccount(true);
          setReady(true);
        }
        return;
      }
      try {
        const access = await getExternalTestAccessStatus(invitationId);
        if (!active) return;
        if (access) {
          configureExternalTestRuntime(access);
          setUnlocked(true);
        }
      } catch {
        if (active) setError("L’accès de test est momentanément indisponible.");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [invitationId]);

  async function verify(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!code || checking) return;
    setChecking(true);
    setError("");
    try {
      const access = await redeemExternalTestInvitation(invitationId, code);
      if (!access) {
        setError("Mot de passe incorrect ou invitation indisponible.");
        return;
      }
      configureExternalTestRuntime(access);
      setCode("");
      setUnlocked(true);
    } catch {
      setError("Impossible de vérifier l’invitation. Réessayez dans quelques instants.");
    } finally {
      setChecking(false);
    }
  }

  if (!ready) return <div className="min-h-screen bg-[#06070a]" aria-label="Chargement" />;
  if (unlocked) return <>{children}</>;

  if (permanentAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06070a] px-5 text-white">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-black/55 p-7 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-fuchsia-200" />
          <h1 className="font-serif text-3xl">Invitation pour un testeur externe</h1>
          <p className="text-sm leading-relaxed text-white/65">
            Vous êtes connecté avec un compte administrateur. Utilisez « Tester moi-même » dans le
            back-office, ou ouvrez cette invitation dans une fenêtre privée pour ne pas consommer
            le mot de passe à la place du testeur.
          </p>
          <Button asChild variant="secondary"><Link to="/admin">Ouvrir le back-office</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06070a] px-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(163,74,183,0.20),transparent_42%)]" />
      <form onSubmit={(event) => void verify(event)} className="relative z-10 w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-black/55 p-7 shadow-2xl backdrop-blur-md">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-fuchsia-100/20 bg-fuchsia-100/10">
            <KeyRound className="h-5 w-5 text-fuchsia-100" />
          </div>
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-100/70">Session de test privée</p>
          <h1 className="font-serif text-3xl">Où est Ava ?</h1>
          <p className="text-sm leading-relaxed text-white/60">
            Entrez le mot de passe unique transmis avec cette invitation.
          </p>
        </div>
        <div className="space-y-2">
          <label className="sr-only" htmlFor="invitation-code">Mot de passe unique</label>
          <Input
            id="invitation-code"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="AVA-XXXX-XXXX-XXXX-XXXX"
            className="h-12 border-white/15 bg-white/5 font-mono uppercase tracking-wide text-white placeholder:text-white/35"
            autoFocus
            required
          />
          {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        </div>
        <Button type="submit" className="h-12 w-full" disabled={checking || !code}>
          {checking ? "Vérification…" : "Entrer dans l’expérience"}
        </Button>
      </form>
    </main>
  );
}
