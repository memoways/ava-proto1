import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  configureRuntimeContext,
  getAdminUserProfile,
  getPersistedAdminEnvironment,
  normalizeEnvironment,
  preserveCampaignFromUrl,
} from "@/services/environmentContext";

const UNLOCK_KEY = "ava:public-access:unlocked";

interface Props {
  children: ReactNode;
}

export default function PublicAccessGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const profile = await getAdminUserProfile(data.session?.user ?? null);
      const params = new URLSearchParams(window.location.search);
      const persisted = profile
        ? getPersistedAdminEnvironment(profile.default_environment_id, profile.user_id)
        : "prod";
      const requested = params.has("env")
        ? normalizeEnvironment(params.get("env"))
        : persisted;
      const { campaignId, testerLabel } = preserveCampaignFromUrl(window.location.search);
      configureRuntimeContext({ profile, requestedEnvironment: requested, campaignId, testerLabel });

      let sessionUnlocked = false;
      try {
        sessionUnlocked = sessionStorage.getItem(UNLOCK_KEY) === "1";
      } catch {
        // A restricted browser simply asks again.
      }
      if (!active) return;
      setUnlocked(Boolean(profile) || sessionUnlocked);
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  async function verify(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke<{ ok: boolean }>(
      "verify-public-access",
      { body: { password } },
    );
    if (!invokeError && data?.ok === true) {
      try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* tab remains unlocked in memory */ }
      setUnlocked(true);
      setPassword("");
    } else {
      setError("Mot de passe incorrect. Vérifiez le lien reçu et réessayez.");
    }
    setChecking(false);
  }

  if (!ready) {
    return <div className="min-h-screen bg-[#06070a]" aria-label="Chargement" />;
  }
  if (unlocked) return <>{children}</>;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06070a] px-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(117,79,48,0.22),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
      <form
        onSubmit={(event) => void verify(event)}
        className="relative z-10 w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-black/55 p-7 shadow-2xl backdrop-blur-md"
      >
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-100/20 bg-amber-100/10">
            <LockKeyhole className="h-5 w-5 text-amber-100" />
          </div>
          <p className="text-xs uppercase tracking-[0.32em] text-amber-100/70">Expérience privée</p>
          <h1 className="font-serif text-3xl">Où est Ava ?</h1>
          <p className="text-sm leading-relaxed text-white/60">
            Entrez le mot de passe communiqué par l’équipe pour commencer.
          </p>
        </div>
        <div className="space-y-2">
          <label className="sr-only" htmlFor="public-password">Mot de passe</label>
          <Input
            id="public-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            className="h-12 border-white/15 bg-white/5 text-white placeholder:text-white/35"
            autoFocus
            required
          />
          {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        </div>
        <Button type="submit" className="h-12 w-full" disabled={checking || !password}>
          {checking ? "Vérification…" : "Entrer dans l’expérience"}
        </Button>
      </form>
    </main>
  );
}
