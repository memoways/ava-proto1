/**
 * The period cost is the large figure at the top of a provider card, with the
 * minutes still left and the renewal date. The smaller lines underneath are the breakdown.
 */

import {
  formatAmount,
  formatDay,
  formatMinutes,
  formatUsd,
  type PeriodCostReading,
  type ServiceDefinition,
} from "@/services/servicePlans";

export default function PeriodCostLines({ reading, service }: { reading: PeriodCostReading; service: ServiceDefinition }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-2xl font-semibold tracking-tight">{costText(reading)}</p>
        <p className="text-xs text-muted-foreground">{costCaption(reading)}</p>
        <p className="mt-1 text-base font-semibold">{remainingHeadline(reading, service)}</p>
        {reading.capacity.map((family) => (
          <p key={family.label} className="text-sm">
            {formatMinutes(family.remainingMinutes, true)} restantes en {family.label}
          </p>
        ))}
        <p className="text-sm text-muted-foreground">{renewalHeadline(reading)}</p>
      </div>
      <div className="border-t pt-2 text-xs space-y-1">
        <Line label="Minutes consommées" value={formatMinutes(reading.consumedMinutes, reading.minutesAreEstimate)} />
        {service.unit !== "minutes" && (
          <Line
            label={`${unitTitle(service.unitLabel)} consommés`}
            value={reading.consumedUnits == null ? "—" : formatAmount(reading.consumedUnits, service.unit)}
          />
        )}
        {reading.kind === "prepaid" ? (
          <Line label="Consommé sur la période" value={reading.spentUsd == null ? "prix non saisi" : formatUsd(reading.spentUsd)} />
        ) : (
          <>
            <Line label={feeLabel(reading)} value={feeValue(reading)} />
            {reading.overageUnits != null && reading.overageUnits > 0 && (
              <Line
                label={reading.days == null ? "Dépassement du mois" : "Dépassement sur la période"}
                value={overageValue(reading, service)}
                warn
              />
            )}
          </>
        )}
        {reading.unknownModelChars > 0 && (
          <p className="text-[11px] text-amber-500">
            {formatAmount(reading.unknownModelChars, "credits")} caractères sans modèle connu, comptés au taux le plus élevé.
          </p>
        )}
        {reading.countingNote && <p className="text-[11px] text-muted-foreground">{reading.countingNote}</p>}
        {reading.capped && (
          <p className="text-[11px] text-amber-500">Consommation du cycle tronquée : le reste est un maximum.</p>
        )}
      </div>
    </div>
  );
}

function costText(reading: PeriodCostReading): string {
  if (reading.kind === "prepaid") return reading.spentUsd == null ? "prix non saisi" : formatUsd(reading.spentUsd);
  if (reading.kind === "stopped") return "arrêté";
  if (reading.totalUsd == null) return reading.rateMissing ? "prix manquant" : "non saisi";
  return formatUsd(reading.totalUsd);
}

function costCaption(reading: PeriodCostReading): string {
  if (reading.kind === "prepaid") return "consommé sur la période";
  if (reading.kind === "stopped") return "abonnement arrêté";
  if (reading.days == null) return "coût du mois";
  return "coût de la période";
}

function remainingHeadline(reading: PeriodCostReading, service: ServiceDefinition): string {
  if (reading.kind === "prepaid") {
    return reading.remainingUsd == null ? "crédit non chiffré" : `${formatUsd(reading.remainingUsd)} restants`;
  }
  if (reading.kind === "stopped" || reading.kind === "unset") return "minutes non disponibles";
  if (!reading.allowanceMissing && reading.capacity.length > 0 && reading.remainingUnits != null) {
    return `${formatAmount(reading.remainingUnits, service.unit)} ${service.unitLabel} restants ce mois`;
  }
  if (reading.allowanceMissing || reading.remainingMinutes == null) return "quota non saisi";
  const minutes = formatMinutes(reading.remainingMinutes, reading.minutesAreEstimate);
  if (service.unit === "minutes" || reading.remainingUnits == null) return `${minutes} restantes`;
  return `${minutes} restantes · ${formatAmount(reading.remainingUnits, service.unit)} ${service.unitLabel}`;
}

function renewalHeadline(reading: PeriodCostReading): string {
  if (reading.kind === "prepaid") return "crédit, sans date de renouvellement";
  if (reading.kind === "stopped") return "plus de renouvellement";
  if (!reading.renewsOn) return "date de renouvellement non saisie";
  return `renouvellement ${formatDay(new Date(`${reading.renewsOn}T00:00:00.000Z`))}`;
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
