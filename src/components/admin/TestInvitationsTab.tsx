import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, RefreshCw, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { useAdminEnvironment } from "@/contexts/AdminEnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENVIRONMENTS } from "@/services/environmentContext";
import {
  createExternalTestInvitation,
  listExternalTestInvitations,
  revokeExternalTestInvitation,
  type ExternalTestInvitationStatus,
  type ExternalTestInvitationSummary,
} from "@/services/externalTestInvitations";

const STATUS_LABELS: Record<ExternalTestInvitationStatus, string> = {
  available: "Disponible",
  activated: "Activée",
  expired: "Expirée",
  revoked: "Révoquée",
};

const STATUS_CLASSES: Record<ExternalTestInvitationStatus, string> = {
  available: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  activated: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  expired: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  revoked: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

interface CreatedSecret {
  link: string;
  code: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-CH");
}

async function copy(value: string, label: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copié.`);
}

export default function TestInvitationsTab() {
  const { environmentId } = useAdminEnvironment();
  const [testerLabel, setTesterLabel] = useState("");
  const [invitations, setInvitations] = useState<ExternalTestInvitationSummary[]>([]);
  const [createdSecret, setCreatedSecret] = useState<CreatedSecret | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const environment = ENVIRONMENTS.find((candidate) => candidate.id === environmentId);
  const isSandbox = environment?.type === "sandbox";

  const activeCount = useMemo(
    () => invitations.filter((invitation) => invitation.status === "available").length,
    [invitations],
  );

  async function load(): Promise<void> {
    setLoading(true);
    try {
      setInvitations(await listExternalTestInvitations());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les invitations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function create(): Promise<void> {
    const label = testerLabel.trim();
    if (!isSandbox) {
      toast.error("Sélectionnez une sandbox avant de créer une invitation.");
      return;
    }
    if (!label) {
      toast.error("Ajoutez un nom, un pseudonyme ou une référence de test.");
      return;
    }
    setCreating(true);
    try {
      const result = await createExternalTestInvitation({ environmentId, testerLabel: label });
      setCreatedSecret({ link: result.link, code: result.code });
      setInvitations((current) => [result.invitation, ...current]);
      setTesterLabel("");
      toast.success("Invitation créée. Copiez maintenant son mot de passe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer l’invitation.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(invitation: ExternalTestInvitationSummary): Promise<void> {
    if (!window.confirm(`Révoquer l’invitation de ${invitation.tester_label} ?`)) return;
    setRevoking(invitation.id);
    try {
      await revokeExternalTestInvitation(invitation.id);
      setInvitations((current) => current.map((item) => (
        item.id === invitation.id
          ? { ...item, status: "revoked", revoked_at: new Date().toISOString() }
          : item
      )));
      toast.success("Invitation révoquée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de révoquer l’invitation.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Invitations de test</h2>
        <p className="text-sm text-muted-foreground">
          Créez un accès externe unique vers votre sandbox. Vous ne voyez ici que les invitations
          créées avec votre compte.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Nouvelle invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            Environnement ciblé : <strong>{isSandbox ? `Sandbox — ${environment?.label}` : "Production"}</strong>
          </div>
          {!isSandbox ? (
            <p className="text-sm text-amber-500">
              Les invitations externes sont réservées aux sandboxes. Sélectionnez-en une dans le menu en haut de page.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="tester-label">Nom, pseudonyme ou référence du testeur</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="tester-label"
                value={testerLabel}
                onChange={(event) => setTesterLabel(event.target.value)}
                maxLength={80}
                placeholder="Ex. Camille — test septembre"
              />
              <Button onClick={() => void create()} disabled={!isSandbox || !testerLabel.trim() || creating}>
                {creating ? "Génération…" : "Générer l’invitation"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Le lien expire après 7 jours s’il n’est pas activé. Après activation, un seul navigateur
            peut lancer plusieurs sessions pendant 4 heures.
          </p>
        </CardContent>
      </Card>

      {createdSecret ? (
        <Card className="border-fuchsia-500/50 bg-fuchsia-500/5">
          <CardHeader><CardTitle className="text-base">À transmettre au testeur</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-fuchsia-700 dark:text-fuchsia-200">
              Copiez le mot de passe maintenant : il ne sera plus affiché après avoir quitté cette page.
            </p>
            <div className="space-y-2">
              <Label>Lien d’invitation</Label>
              <div className="flex gap-2">
                <Input readOnly value={createdSecret.link} />
                <Button variant="outline" size="icon" aria-label="Copier le lien" onClick={() => void copy(createdSecret.link, "Lien")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mot de passe unique</Label>
              <div className="flex gap-2">
                <Input readOnly value={createdSecret.code} className="font-mono tracking-wide" />
                <Button variant="outline" size="icon" aria-label="Copier le mot de passe" onClick={() => void copy(createdSecret.code, "Mot de passe")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreatedSecret(null)}>J’ai terminé la copie</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Mes invitations · {activeCount} disponible{activeCount > 1 ? "s" : ""}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
          {!loading && invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune invitation créée avec ce compte.</p>
          ) : null}
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const label = ENVIRONMENTS.find((candidate) => candidate.id === invitation.environment_id)?.label ?? invitation.environment_id;
              return (
                <div key={invitation.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{invitation.tester_label}</strong>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASSES[invitation.status]}`}>
                        {STATUS_LABELS[invitation.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sandbox — {label} · créée le {formatDate(invitation.created_at)} · expiration {formatDate(invitation.expires_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.sessionCount} session{invitation.sessionCount > 1 ? "s" : ""}
                      {invitation.redeemed_at ? ` · activée le ${formatDate(invitation.redeemed_at)}` : ""}
                    </p>
                  </div>
                  {invitation.status === "available" || invitation.status === "activated" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copy(`${window.location.origin}/test/${invitation.id}`, "Lien")}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copier le lien
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void revoke(invitation)} disabled={revoking === invitation.id}>
                        <ShieldX className="mr-2 h-4 w-4" /> {revoking === invitation.id ? "Révocation…" : "Révoquer"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
