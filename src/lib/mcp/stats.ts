const DAY_MS = 86_400_000;

export function sinceIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function isoDay(value: unknown): string {
  if (typeof value !== "string" || !value) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function sortedNumbers(values: Array<number | null | undefined>): number[] {
  return values
    .map(toNumber)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (index - low));
}

/** Count, min, mean, p50, p90, p95 and max of a numeric column. */
export function latencyStats(values: Array<number | null | undefined>) {
  const sorted = sortedNumbers(values);
  const total = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    mean: sorted.length ? Math.round(total / sorted.length) : null,
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1] ?? null,
  };
}

export function sumBy<T>(
  rows: T[],
  pick: (row: T) => number | null | undefined,
): number {
  let total = 0;
  for (const row of rows) total += toNumber(pick(row)) ?? 0;
  return total;
}

export function tally<T>(
  rows: T[],
  pick: (row: T) => unknown,
  fallback = "non renseigné",
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const raw = pick(row);
    const label =
      raw === null || raw === undefined || raw === "" ? fallback : String(raw);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

export function groupBy<T>(rows: T[], key: (row: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const row of rows) {
    const label = key(row);
    (groups[label] ??= []).push(row);
  }
  return groups;
}

export function sumGroupBy<T>(
  rows: T[],
  key: (row: T) => string,
  value: (row: T) => number | null | undefined,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const label = key(row);
    totals[label] = (totals[label] ?? 0) + (toNumber(value(row)) ?? 0);
  }
  return totals;
}
