import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { oauth, type OAuthDetails } from "@/lib/oauth-sdk";
import { safeRedirectUrl } from "@/lib/oauth-return-path";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Demande de connexion incomplète : identifiant d'autorisation absent.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || sess.session.user.is_anonymous === true) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setAccount(sess.session.user.email ?? sess.session.user.id);
      const { data, error: loadError } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }
      const immediate = safeRedirectUrl(data?.redirect_url ?? data?.redirect_to);
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? {});
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: decideError } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = safeRedirectUrl(data?.redirect_url ?? data?.redirect_to);
    if (!target) {
      setBusy(false);
      setError("Aucune adresse de retour n'a été renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? " cette application";

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold">Connexion impossible</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Vérification de la demande…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Autoriser {clientName}</h1>
          <p className="text-sm text-muted-foreground">
            Cette application demande à lire les statistiques d’AVA Prototype 1 avec le compte{" "}
            <span className="font-medium text-foreground">{account}</span>.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          L’accès est en lecture seule et suit exactement les droits de ce compte. Vous pouvez le
          retirer plus tard.
        </p>
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => void decide(true)}>
            {busy ? "…" : "Autoriser"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
            Refuser
          </Button>
        </div>
      </div>
    </main>
  );
}
