export const INTERNAL_CANARY_THRESHOLDS = {
  minimumSessions: 5,
  minimumTurns: 30,
  maximumP95FirstSoundMs: 5_000,
  maximumTurnErrorRate: 0.02,
  minimumPersistenceRate: 0.995,
} as const;

export interface CanaryMetrics {
  sessionCount: number;
  turnCount: number;
  p95FirstSoundMs: number | null;
  turnErrorRate: number | null;
  persistenceRate: number | null;
  costPerSessionUsd: number | null;
}

export interface CanaryThresholds {
  minimumSessions: number;
  minimumTurns: number;
  maximumP95FirstSoundMs: number;
  maximumTurnErrorRate: number;
  minimumPersistenceRate: number;
  maximumCostPerSessionUsd: number | null;
}

export type CanaryCheckStatus = "pass" | "hold" | "fail";
export type CanaryDecision = "promote" | "hold" | "rollback";

export interface CanaryCheck {
  key: keyof CanaryMetrics;
  status: CanaryCheckStatus;
  detail: string;
}

export interface CanaryReadiness {
  decision: CanaryDecision;
  checks: CanaryCheck[];
}

const DEFAULT_THRESHOLDS: CanaryThresholds = {
  ...INTERNAL_CANARY_THRESHOLDS,
  maximumCostPerSessionUsd: null,
};

export function evaluateCanaryReadiness(
  metrics: CanaryMetrics,
  thresholds: CanaryThresholds = DEFAULT_THRESHOLDS,
): CanaryReadiness {
  const checks: CanaryCheck[] = [
    metrics.sessionCount >= thresholds.minimumSessions
      ? { key: "sessionCount", status: "pass", detail: `${metrics.sessionCount} sessions observées` }
      : {
          key: "sessionCount",
          status: "hold",
          detail: `${metrics.sessionCount}/${thresholds.minimumSessions} sessions internes minimum`,
        },
    metrics.turnCount >= thresholds.minimumTurns
      ? { key: "turnCount", status: "pass", detail: `${metrics.turnCount} tours observés` }
      : {
          key: "turnCount",
          status: "hold",
          detail: `${metrics.turnCount}/${thresholds.minimumTurns} tours internes minimum`,
        },
    metricMaximumCheck(
      "p95FirstSoundMs",
      metrics.p95FirstSoundMs,
      thresholds.maximumP95FirstSoundMs,
      "p95 premier son",
      (value) => `${Math.round(value)} ms`,
    ),
    metricMaximumCheck(
      "turnErrorRate",
      metrics.turnErrorRate,
      thresholds.maximumTurnErrorRate,
      "taux d'erreur des tours",
      percentage,
    ),
    metricMinimumCheck(
      "persistenceRate",
      metrics.persistenceRate,
      thresholds.minimumPersistenceRate,
      "persistance réussie",
      percentage,
    ),
    costCheck(metrics.costPerSessionUsd, thresholds.maximumCostPerSessionUsd),
  ];

  const decision: CanaryDecision = checks.some((check) => check.status === "fail")
    ? "rollback"
    : checks.some((check) => check.status === "hold")
      ? "hold"
      : "promote";

  return { decision, checks };
}

function metricMaximumCheck(
  key: keyof CanaryMetrics,
  value: number | null,
  maximum: number,
  label: string,
  format: (value: number) => string,
): CanaryCheck {
  if (value == null) return { key, status: "hold", detail: `${label} non mesuré` };
  return value <= maximum
    ? { key, status: "pass", detail: `${label} ${format(value)} ≤ ${format(maximum)}` }
    : { key, status: "fail", detail: `${label} ${format(value)} > ${format(maximum)}` };
}

function metricMinimumCheck(
  key: keyof CanaryMetrics,
  value: number | null,
  minimum: number,
  label: string,
  format: (value: number) => string,
): CanaryCheck {
  if (value == null) return { key, status: "hold", detail: `${label} non mesurée` };
  return value >= minimum
    ? { key, status: "pass", detail: `${label} ${format(value)} ≥ ${format(minimum)}` }
    : { key, status: "fail", detail: `${label} ${format(value)} < ${format(minimum)}` };
}

function costCheck(value: number | null, maximum: number | null): CanaryCheck {
  if (maximum == null) {
    return { key: "costPerSessionUsd", status: "hold", detail: "budget par session à valider" };
  }
  if (value == null) {
    return { key: "costPerSessionUsd", status: "hold", detail: "coût par session non mesuré" };
  }
  return value <= maximum
    ? {
        key: "costPerSessionUsd",
        status: "pass",
        detail: `coût/session $${value.toFixed(4)} ≤ $${maximum.toFixed(4)}`,
      }
    : {
        key: "costPerSessionUsd",
        status: "fail",
        detail: `coût/session $${value.toFixed(4)} > $${maximum.toFixed(4)}`,
      };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(value >= 0.99 ? 1 : 2)}%`;
}
