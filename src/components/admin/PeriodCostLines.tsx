/**
 * Subscription share for the period the admin picked, the minutes used in it,
 * and the minutes still left on the plan.
 */

import {
  formatAmount,
  formatMinutes,
  formatUsd,
  type PeriodCostReading,
  type ServiceDefinition,
} from "@/services/servicePlans";

export default function PeriodCostLines({ reading, service }: { reading: PeriodCostReading; service: ServiceDefinition }) {
  return (
    <div className="border-t pt-2 text-xs space-y-1">
      <Line label="Minutes consommées" value={formatMinutes(reading.consumedMinutes, reading.minutesAreEstimate)} />
      {service.unit !== "minutes" && (
        <Line
          label={`${unitTitle(service.unitLabel)} consommés`}
          value={reading.consumedUnits == null ? "—" : formatAmount(reading.consumedUnits, service.unit)}
        />
      )}
      {reading.kind === "prepaid" ? (
        <>
          <Line label="Consommé sur la période" value={reading.spentUsd == null ? "prix non saisi" : formatUsd(reading.spentUsd)} />
          <Line label="Crédit restant" value={reading.remainingUsd == null ? "—" : formatUsd(reading.remainingUsd)} />
        </>
      ) : (
        <>
          <Line label={feeLabel(reading)} value={feeValue(reading)} />
          <Line label="Reste du forfait" value={remainingValue(reading, service)} />
          {reading.overageUnits != null && reading.overageUnits > 0 && (
            <Line
              label={reading.days == null ? "Dépassement du mois" : "Dépassement sur la période"}
              value={overageValue(reading, service)}
              warn
            />
          )}
          <Line
            label={reading.days == null ? "Coût du mois" : "Coût de la période"}
            value={reading.totalUsd == null ? (reading.rateMissing ? "prix du dépassement manquant" : "—") : formatUsd(reading.totalUsd)}
          />
        </>
      )}
      {reading.capped && (
        <p className="text-[11px] text-amber-500">Consommation du cycle tronquée : le reste est un maximum.</p>
      )}
    </div>
  );
}

function unitTitle(label: string): string {
  return label.charAt(0).toLocaleUpperCase("fr-CH") + label.slice(1);
}

function feeLabel(reading: PeriodCostReading): string {
  if (reading.kind === "stopped") return "Abonnement";
  if (reading.days == null) return "Abonnement du mois";
  return `Abonnement (${reading.days} j / ${reading.monthDays})`;
}

function feeValue(reading: PeriodCostReading): string {
  if (reading.kind === "stopped") return "arrêté";
  if (reading.subscriptionUsd == null) return "non saisi";
  return formatUsd(reading.subscriptionUsd);
}

function remainingValue(reading: PeriodCostReading, service: ServiceDefinition): string {
  if (reading.kind === "stopped" || reading.kind === "unset") return "—";
  if (reading.allowanceMissing || reading.remainingUnits == null) return "quota non saisi";
  if (service.unit === "minutes") return formatMinutes(reading.remainingMinutes, false);
  const units = `${formatAmount(reading.remainingUnits, service.unit)} ${service.unitLabel}`;
  if (reading.remainingMinutes == null) return units;
  return `${units} · ${formatMinutes(reading.remainingMinutes, reading.minutesAreEstimate)}`;
}

function overageValue(reading: PeriodCostReading, service: ServiceDefinition): string {
  const units = service.unit === "minutes"
    ? formatMinutes(reading.overageMinutes, false)
    : `${formatAmount(reading.overageUnits, service.unit)} ${service.unitLabel}`;
  if (reading.overageUsd == null) return `${units} · prix manquant`;
  return `${units} · ${formatUsd(reading.overageUsd)}`;
}

function Line({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono text-right ${warn ? "text-amber-400" : ""}`}>{value}</span>
    </div>
  );
}
