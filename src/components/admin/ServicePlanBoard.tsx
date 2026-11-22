/**
 * Fixed fee, included allowance, usage this cycle, and what goes over it.
 * One card per provider. The invoice amount is typed here; public tiers only prefill.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { loadServicePlans, saveServicePlan } from "@/services/servicePlanStore";
import {
  PLAN_CATALOG_CHECKED_ON,
  applyTier,
  emptyPlan,
  formatAmount,
  formatDay,
  formatMinutes,
  formatUsd,
  planSnapshot,
  servicesForFamily,
  type PlanSnapshot,
  type SavedServicePlan,
  type UsageEvent,
} from "@/services/servicePlans";

export interface PlanUsageBatch {
  events: UsageEvent[];
  capped: boolean;
}

interface Props {
  family: "voice" | "video" | "llm";
  serviceId: string;
  onServiceId: (id: string) => void;
  loadUsage: (fromIso: string) => Promise<PlanUsageBatch>;
}

export default function ServicePlanBoard({ family, serviceId, onServiceId, loadUsage }: Props) {
  const services = useMemo(() => servicesForFamily(family), [family]);
  const [plans, setPlans] = useState<Record<string, SavedServicePlan>>({});
  const [usage, setUsage] = useState<PlanUsageBatch>({ events: [], capped: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const [open, setOpen] = useState(() => readPlansOpen(family));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadServicePlans();
      setPlans(loaded);
      const starts = services
        .filter((service) => service.measured)
        .map((service) => planSnapshot(service, loaded[service.id] ?? emptyPlan(), [], now, false).window.start);
      const from = starts.reduce((earliest, start) => (start < earliest ? start : earliest), starts[0] ?? now);
      const batch = await loadUsage(from.toISOString());
      setUsage(batch);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [loadUsage, now, services]);

  useEffect(() => { void reload(); }, [reload]);

  const snapshots = useMemo(
    () => services.map((service) => planSnapshot(service, plans[service.id] ?? emptyPlan(), usage.events, now, usage.capped)),
    [services, plans, usage, now],
  );
  const visible = serviceId === "all" ? snapshots : snapshots.filter((snapshot) => snapshot.service.id === serviceId);
  const filled = snapshots.filter((snapshot) => snapshot.plan.tierId != null || snapshot.plan.monthlyFeeUsd != null).length;

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        writePlansOpen(family, next);
      }}
      className="rounded-lg border"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left [&[data-state=open]>svg]:rotate-90">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
          <span className="font-semibold">Forfaits du mois</span>
          <span className="truncate text-sm text-muted-foreground">
            {filled === 0 ? "aucun forfait saisi" : `${filled} forfait${filled > 1 ? "s" : ""} saisi${filled > 1 ? "s" : ""}`}
          </span>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <Select value={serviceId} onValueChange={onServiceId}>
            <SelectTrigger className="h-10 w-[220px] text-sm" aria-label="Service"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les services</SelectItem>
              {services.map((service) => <SelectItem key={service.id} value={service.id}>{service.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="h-10" onClick={() => void reload()} disabled={loading}>
            {loading ? "…" : "Rafraîchir"}
          </Button>
        </div>
      </div>
      {error && <p className="px-3 pb-2 text-sm text-destructive">Forfaits non chargés : {error}</p>}
      <CollapsibleContent className="space-y-3 border-t px-3 py-3">
        <p className="text-xs text-muted-foreground">
          Abonnement fixe, quota inclus, consommation de ce cycle, et ce qui est facturé en plus.
          Les minutes déjà dans le forfait ne sont pas recomptées. Tarifs publics du {PLAN_CATALOG_CHECKED_ON} : à corriger selon la facture.
        </p>
        {usage.capped && (
          <p className="text-xs text-amber-500">
            Plus de 5 000 lignes sur la période : la consommation affichée est un minimum.
          </p>
        )}
        <div className="grid gap-3">
          {visible.map((snapshot) => (
            <PlanCard
              key={snapshot.service.id}
              snapshot={snapshot}
              onSaved={(plan) => {
                setPlans((current) => ({ ...current, [snapshot.service.id]: plan }));
                void reload();
              }}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function readPlansOpen(family: string): boolean {
  try {
    return localStorage.getItem(`ava:admin:service-plans-open:${family}`) === "1";
  } catch {
    return false;
  }
}

function writePlansOpen(family: string, open: boolean): void {
  try {
    localStorage.setItem(`ava:admin:service-plans-open:${family}`, open ? "1" : "0");
  } catch {
    // Private browsing: the panel simply starts closed on the next visit.
  }
}

function PlanCard({ snapshot, onSaved }: { snapshot: PlanSnapshot; onSaved: (plan: SavedServicePlan) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(snapshot.plan);
  const [seed, setSeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const { service } = snapshot;
  const cycle = snapshot.window.source === "renewal"
    ? `${formatDay(snapshot.window.start)} → ${formatDay(snapshot.window.end)}`
    : `mois calendaire (${formatDay(snapshot.window.start)} → ${formatDay(snapshot.window.end)}), date de renouvellement non saisie`;

  useEffect(() => { setDraft(snapshot.plan); }, [snapshot.plan]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveServicePlan(service.id, draft);
      onSaved(saved[service.id] ?? draft);
      toast.success(`${service.label} enregistré`);
      setOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="space-y-3 rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium">{service.label}</h4>
        <p className="text-xs text-muted-foreground">{cycle}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <Metric label="Abonnement / mois" value={formatUsd(snapshot.fixedUsd)} />
        <Metric label="Inclus" value={allowance(snapshot)} />
        <Metric label="Consommé" value={consumed(snapshot)} />
        <Metric label="Au-dessus du forfait" value={overage(snapshot)} warn={snapshot.status === "over" || snapshot.status === "over-rate-missing"} />
      </dl>
      <p className="text-sm">
        <span className="text-muted-foreground">Ce cycle : </span>
        <span className="font-semibold">{periodSentence(snapshot)}</span>
      </p>
      {service.unmeasuredReason && <p className="text-xs text-muted-foreground">{service.unmeasuredReason}</p>}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? "Fermer" : "Saisir le forfait"}
        </Button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-border/60 pt-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Forfait publié
            <Select
              value={draft.tierId ?? "unset"}
              onValueChange={(tierId) => {
                setSeed((value) => value + 1);
                if (tierId === "unset") setDraft(emptyPlan());
                else setDraft(applyTier(service, tierId, draft.cadence, draft));
              }}
            >
              <SelectTrigger className="h-9 text-xs text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Non renseigné</SelectItem>
                {service.tiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>{tier.label} — {tier.detail}</SelectItem>
                ))}
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Facturation
            <Select
              value={draft.cadence}
              onValueChange={(cadence) => {
                const next = cadence === "yearly" ? "yearly" : "monthly";
                setSeed((value) => value + 1);
                setDraft(draft.tierId && draft.tierId !== "custom"
                  ? applyTier(service, draft.tierId, next, draft)
                  : { ...draft, cadence: next });
              }}
            >
              <SelectTrigger className="h-9 text-xs text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensuel</SelectItem>
                <SelectItem value="yearly">Annuel (montant par mois)</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <NumberField key={`${seed}-fee`} label="Ce que tu paies / mois ($)" value={draft.monthlyFeeUsd} onChange={(monthlyFeeUsd) => setDraft({ ...draft, tierId: "custom", monthlyFeeUsd })} />
          <NumberField key={`${seed}-included`} label={`Inclus (${service.unitLabel})`} value={draft.included} onChange={(included) => setDraft({ ...draft, tierId: "custom", included })} />
          <NumberField key={`${seed}-overage`} label="Prix d'une unité au-dessus ($)" value={draft.overagePerUnitUsd} onChange={(overagePerUnitUsd) => setDraft({ ...draft, tierId: "custom", overagePerUnitUsd })} />
          <label className="space-y-1 text-xs text-muted-foreground">
            Prochain renouvellement
            <Input type="date" className="h-9 text-foreground" value={draft.renewsOn ?? ""} onChange={(event) => setDraft({ ...draft, renewsOn: event.target.value || null })} />
          </label>
          {service.creditsPerMinute != null && (
            <label className="space-y-1 text-xs text-muted-foreground">
              Crédits par minute
              <Select
                value={String(draft.creditsPerMinute ?? service.creditsPerMinute)}
                onValueChange={(value) => setDraft({ ...draft, creditsPerMinute: Number(value) })}
              >
                <SelectTrigger className="h-9 text-xs text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 — mode FULL</SelectItem>
                  <SelectItem value="1">1 — mode LITE</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
          <p className="text-xs text-muted-foreground md:col-span-2">{service.sourceNote}</p>
          <div className="md:col-span-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
          </div>
        </div>
      )}
    </article>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      {label}
      <Input
        className="h-9 text-foreground"
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(",", ".");
          setText(next);
          if (!next.trim()) onChange(null);
          else {
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
          }
        }}
      />
    </label>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-sm ${warn ? "text-amber-400" : ""}`}>{value}</dd>
    </div>
  );
}

function allowance(snapshot: PlanSnapshot): string {
  if (snapshot.included == null) return "—";
  const units = `${formatAmount(snapshot.included, snapshot.service.unit)} ${snapshot.service.unit === "usd" ? "" : snapshot.service.unitLabel}`.trim();
  if (snapshot.includedMinutes == null || snapshot.service.unit === "minutes") return units;
  return `${units} · ${formatMinutes(snapshot.includedMinutes, snapshot.minutesAreEstimate)}`;
}

function consumed(snapshot: PlanSnapshot): string {
  if (!snapshot.service.measured) return "non mesuré";
  if (snapshot.used == null) return "—";
  const units = snapshot.service.unit === "usd"
    ? formatUsd(snapshot.used)
    : `${formatAmount(snapshot.used, snapshot.service.unit)} ${snapshot.service.unitLabel}`;
  if (snapshot.usedMinutes == null || snapshot.service.unit === "minutes") return units;
  return `${units} · ${formatMinutes(snapshot.usedMinutes, snapshot.minutesAreEstimate)}`;
}

function overage(snapshot: PlanSnapshot): string {
  if (snapshot.status === "unmeasured" || snapshot.status === "unset" || snapshot.status === "allowance-missing") return "—";
  if (snapshot.status === "payg") return snapshot.fixedUsd ? formatUsd(snapshot.overageUsd) : "pas de quota";
  if (snapshot.overageUnits === 0) return snapshot.service.unit === "minutes" ? "0 min" : "0";
  const units = snapshot.service.unit === "usd"
    ? formatUsd(snapshot.overageUnits)
    : `${formatAmount(snapshot.overageUnits, snapshot.service.unit)} ${snapshot.service.unitLabel}`;
  const minutes = snapshot.overageMinutes != null && snapshot.service.unit !== "minutes"
    ? ` · ${formatMinutes(snapshot.overageMinutes, snapshot.minutesAreEstimate)}`
    : "";
  const price = snapshot.overageUsd == null ? "" : ` · ${formatUsd(snapshot.overageUsd)}`;
  return `${units}${minutes}${price}`;
}

function periodSentence(snapshot: PlanSnapshot): string {
  if (snapshot.status === "unset") return "forfait non saisi — la consommation est là, pas le prix";
  if (snapshot.status === "allowance-missing") return `${formatUsd(snapshot.fixedUsd)} d'abonnement, quota inclus manquant`;
  if (snapshot.status === "unmeasured") {
    return snapshot.fixedUsd == null ? "abonnement non saisi, consommation non mesurée" : `${formatUsd(snapshot.fixedUsd)} d'abonnement, consommation non mesurée`;
  }
  if (snapshot.status === "payg") return formatUsd(snapshot.periodUsd);
  if (snapshot.status === "inside") {
    return snapshot.periodUsd == null ? "dans le forfait, montant mensuel à saisir" : `${formatUsd(snapshot.periodUsd)} fixe, rien en plus`;
  }
  if (snapshot.status === "over-rate-missing") return "au-dessus du forfait — saisis le prix du dépassement";
  if (snapshot.periodUsd == null) return `${formatUsd(snapshot.overageUsd)} en plus, abonnement à saisir`;
  return `${formatUsd(snapshot.periodUsd)} dont ${formatUsd(snapshot.fixedUsd)} fixe et ${formatUsd(snapshot.overageUsd)} en plus`;
}
