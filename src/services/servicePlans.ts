/**
 * Subscription plans for the admin consumption screens.
 *
 * Public prices were read on 2026-11-22. They prefill a tier. The amount
 * actually stored is the one typed in the admin (the invoice), kept in the
 * existing `admin_settings` row `billing.service_plans` — no extra table.
 *
 * A minute inside the allowance costs nothing more. Only units past the
 * allowance are multiplied by the overage rate, then added to the fixed fee.
 */

export const PLAN_CATALOG_CHECKED_ON = "2026-11-22";

export type PlanFamily = "voice" | "video" | "llm" | "rag";
export type PlanUnit = "credits" | "minutes" | "usd";
export type BillingCadence = "monthly" | "yearly";

export interface PublicTier {
  id: string;
  label: string;
  monthlyFeeUsd: number;
  /** Published monthly equivalent when billed yearly. */
  yearlyMonthlyFeeUsd: number | null;
  included: number;
  overagePerUnitUsd: number | null;
  detail: string;
}

export interface ServiceDefinition {
  id: string;
  family: PlanFamily;
  label: string;
  unit: PlanUnit;
  unitLabel: string;
  /** Spoken-minute estimate for character credits. Not what the provider bills. */
  charsPerMinute: number | null;
  /** HeyGen bills credits per streamed minute (FULL = 2, LITE = 1). */
  creditsPerMinute: number | null;
  measured: boolean;
  unmeasuredReason: string | null;
  sourceNote: string;
  sourceUrl: string;
  tiers: PublicTier[];
}

export interface SavedServicePlan {
  tierId: string | null;
  cadence: BillingCadence;
  monthlyFeeUsd: number | null;
  included: number | null;
  overagePerUnitUsd: number | null;
  /** Next renewal the admin typed, `YYYY-MM-DD`. */
  renewsOn: string | null;
  creditsPerMinute: number | null;
}

export interface UsageEvent {
  serviceId: string;
  at: string;
  amount: number;
}

export interface BillingWindow {
  start: Date;
  end: Date;
  source: "renewal" | "calendar";
}

export type PlanStatus =
  | "unset"
  | "inside"
  | "over"
  | "payg"
  | "unmeasured"
  | "allowance-missing"
  | "over-rate-missing";

export interface PlanSnapshot {
  service: ServiceDefinition;
  plan: SavedServicePlan;
  window: BillingWindow;
  status: PlanStatus;
  /** Usage converted into the provider's billed unit. */
  used: number | null;
  /** Minutes we can show. Estimated when the provider bills characters. */
  usedMinutes: number | null;
  minutesAreEstimate: boolean;
  included: number | null;
  includedMinutes: number | null;
  remaining: number | null;
  overageUnits: number | null;
  overageMinutes: number | null;
  fixedUsd: number | null;
  overageUsd: number | null;
  /** Fixed plus overage, only when both pieces needed for that status are known. */
  periodUsd: number | null;
  capped: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Gradium bills extra credits at the plan rate plus this surcharge. */
function creditOverage(monthlyUsd: number, credits: number, surcharge: number): number {
  return (monthlyUsd / credits) * (1 + surcharge);
}

export const SERVICE_CATALOG: readonly ServiceDefinition[] = [
  {
    id: "elevenlabs",
    family: "voice",
    label: "ElevenLabs",
    unit: "credits",
    unitLabel: "crédits",
    charsPerMinute: 750,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://elevenlabs.io/pricing",
    sourceNote:
      "Forfaits mensuels lus le 22 novembre 2026. 1 caractère Multilingual v2 = 1 crédit. Les modèles Flash/Turbo peuvent coûter 0,5 crédit : Ava compte 1. Le report de crédits (jusqu'à 2 mois) n'est pas dans ce calcul. Le prix du crédit supplémentaire n'était pas sur la page : à saisir.",
    tiers: [
      { id: "free", label: "Free", monthlyFeeUsd: 0, yearlyMonthlyFeeUsd: null, included: 10_000, overagePerUnitUsd: null, detail: "10 000 crédits" },
      { id: "starter", label: "Starter", monthlyFeeUsd: 6, yearlyMonthlyFeeUsd: 5, included: 30_000, overagePerUnitUsd: null, detail: "30 000 crédits" },
      { id: "creator", label: "Creator", monthlyFeeUsd: 22, yearlyMonthlyFeeUsd: 18.33, included: 121_000, overagePerUnitUsd: null, detail: "121 000 crédits" },
      { id: "pro", label: "Pro", monthlyFeeUsd: 99, yearlyMonthlyFeeUsd: 82.5, included: 600_000, overagePerUnitUsd: null, detail: "600 000 crédits" },
      { id: "scale", label: "Scale", monthlyFeeUsd: 299, yearlyMonthlyFeeUsd: 249.17, included: 1_800_000, overagePerUnitUsd: null, detail: "1,8 M crédits" },
      { id: "business", label: "Business", monthlyFeeUsd: 990, yearlyMonthlyFeeUsd: 825, included: 6_000_000, overagePerUnitUsd: null, detail: "6 M crédits" },
    ],
  },
  {
    id: "gradium",
    family: "voice",
    label: "Gradium",
    unit: "credits",
    unitLabel: "crédits",
    charsPerMinute: 750,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://gradium.ai/pricing",
    sourceNote:
      "Page tarifaire du 22 novembre 2026 : XS 12 $, S 39 $, M 312 $, L 1 480 $. Une autre page Gradium affiche 13 / 43 / 340 / 1 615 $. Corrige le montant s'il ne colle pas à la facture. 1 caractère = 1 crédit. Le dépassement est le tarif du forfait + 20 % (XS) ou + 5 % (S, M, L).",
    tiers: [
      { id: "free", label: "Free", monthlyFeeUsd: 0, yearlyMonthlyFeeUsd: null, included: 45_000, overagePerUnitUsd: null, detail: "45 000 crédits · ~1 h de voix" },
      { id: "xs", label: "XS", monthlyFeeUsd: 12, yearlyMonthlyFeeUsd: 143 / 12, included: 225_000, overagePerUnitUsd: creditOverage(12, 225_000, 0.2), detail: "225 000 crédits · ~5 h" },
      { id: "s", label: "S", monthlyFeeUsd: 39, yearlyMonthlyFeeUsd: 473 / 12, included: 900_000, overagePerUnitUsd: creditOverage(39, 900_000, 0.05), detail: "900 000 crédits · ~20 h" },
      { id: "m", label: "M", monthlyFeeUsd: 312, yearlyMonthlyFeeUsd: 3740 / 12, included: 9_000_000, overagePerUnitUsd: creditOverage(312, 9_000_000, 0.05), detail: "9 M crédits · ~200 h" },
      { id: "l", label: "L", monthlyFeeUsd: 1480, yearlyMonthlyFeeUsd: 17765 / 12, included: 45_000_000, overagePerUnitUsd: creditOverage(1480, 45_000_000, 0.05), detail: "45 M crédits · ~1 000 h" },
    ],
  },
  {
    id: "cartesia",
    family: "voice",
    label: "Cartesia",
    unit: "credits",
    unitLabel: "caractères",
    charsPerMinute: 750,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "",
    sourceNote: "Tarif public non relevé. Saisis le montant, le quota et le prix du dépassement depuis la facture.",
    tiers: [],
  },
  {
    id: "fish",
    family: "voice",
    label: "Fish Audio",
    unit: "credits",
    unitLabel: "caractères",
    charsPerMinute: 750,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "",
    sourceNote: "Tarif public non relevé. Saisis le forfait depuis la facture.",
    tiers: [],
  },
  {
    id: "inworld",
    family: "voice",
    label: "Inworld",
    unit: "credits",
    unitLabel: "caractères",
    charsPerMinute: 750,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "",
    sourceNote: "Tarif public non relevé. Saisis le forfait depuis la facture.",
    tiers: [],
  },
  {
    id: "tavus",
    family: "video",
    label: "Tavus",
    unit: "minutes",
    unitLabel: "minutes",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://www.tavus.io/pricing",
    sourceNote:
      "Conversational Video, page lue le 22 novembre 2026. Tavus compte 30 secondes minimum par conversation et arrondit : la durée Ava peut être plus courte que la facture.",
    tiers: [
      { id: "free", label: "Free", monthlyFeeUsd: 0, yearlyMonthlyFeeUsd: null, included: 20, overagePerUnitUsd: null, detail: "20 min, sans dépassement" },
      { id: "starter", label: "Starter", monthlyFeeUsd: 22, yearlyMonthlyFeeUsd: null, included: 60, overagePerUnitUsd: null, detail: "60 min, sans dépassement" },
      { id: "builder", label: "Builder", monthlyFeeUsd: 59, yearlyMonthlyFeeUsd: null, included: 175, overagePerUnitUsd: 0.35, detail: "175 min, puis 0,35 $/min" },
      { id: "growth", label: "Growth", monthlyFeeUsd: 397, yearlyMonthlyFeeUsd: null, included: 1300, overagePerUnitUsd: 0.31, detail: "1 300 min, puis 0,31 $/min" },
      { id: "business", label: "Business", monthlyFeeUsd: 975, yearlyMonthlyFeeUsd: null, included: 4000, overagePerUnitUsd: 0.26, detail: "4 000 min, puis 0,26 $/min" },
    ],
  },
  {
    id: "anam",
    family: "video",
    label: "Anam",
    unit: "minutes",
    unitLabel: "minutes",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://anam.ai/pricing",
    sourceNote:
      "Page lue le 22 novembre 2026, prix mensuels. L'annuel affiché est le prix mensuel équivalent (10, 40, 249, 832 $). Anam facture à la seconde.",
    tiers: [
      { id: "free", label: "Free", monthlyFeeUsd: 0, yearlyMonthlyFeeUsd: null, included: 30, overagePerUnitUsd: null, detail: "30 min, sans extra" },
      { id: "starter", label: "Starter", monthlyFeeUsd: 12, yearlyMonthlyFeeUsd: 10, included: 50, overagePerUnitUsd: 0.16, detail: "50 min, puis 0,16 $/min" },
      { id: "explorer", label: "Explorer", monthlyFeeUsd: 49, yearlyMonthlyFeeUsd: 40, included: 250, overagePerUnitUsd: 0.14, detail: "250 min, puis 0,14 $/min" },
      { id: "growth", label: "Growth", monthlyFeeUsd: 299, yearlyMonthlyFeeUsd: 249, included: 2000, overagePerUnitUsd: 0.12, detail: "2 000 min, puis 0,12 $/min" },
      { id: "professional", label: "Professional", monthlyFeeUsd: 999, yearlyMonthlyFeeUsd: 832, included: 8000, overagePerUnitUsd: 0.11, detail: "8 000 min, puis 0,11 $/min" },
    ],
  },
  {
    id: "heygen",
    family: "video",
    label: "HeyGen LiveAvatar",
    unit: "credits",
    unitLabel: "crédits",
    charsPerMinute: null,
    creditsPerMinute: 2,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://docs.liveavatar.com/docs/faq/credits",
    sourceNote:
      "Essential 99 $ / 1 100 crédits, Business 475 $ / 6 000 crédits, lus le 22 novembre 2026. FULL = 2 crédits par minute, LITE = 1. Le mode se choisit dans la fiche : Ava ne le déduit pas de la session.",
    tiers: [
      { id: "free", label: "Free", monthlyFeeUsd: 0, yearlyMonthlyFeeUsd: null, included: 10, overagePerUnitUsd: null, detail: "10 crédits" },
      { id: "essential", label: "Essential", monthlyFeeUsd: 99, yearlyMonthlyFeeUsd: null, included: 1100, overagePerUnitUsd: 0.095, detail: "1 100 crédits, puis 0,095 $/crédit" },
      { id: "business", label: "Business", monthlyFeeUsd: 475, yearlyMonthlyFeeUsd: null, included: 6000, overagePerUnitUsd: 0.09, detail: "6 000 crédits, puis 0,09 $/crédit" },
    ],
  },
  {
    id: "lemonslice",
    family: "video",
    label: "LemonSlice",
    unit: "minutes",
    unitLabel: "minutes",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "",
    sourceNote: "Tarif public non relevé. Saisis le forfait depuis la facture.",
    tiers: [],
  },
  {
    id: "openrouter",
    family: "llm",
    label: "OpenRouter",
    unit: "usd",
    unitLabel: "dollars",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://openrouter.ai/docs",
    sourceNote:
      "Pas d'abonnement mensuel public. Le montant est la somme des coûts déjà renvoyés par OpenRouter (llm_usage), sandboxes comprises. N'ajoute un fixe que si une facture existe en plus de ces appels.",
    tiers: [],
  },
  {
    id: "voyage",
    family: "rag",
    label: "Voyage (RAG)",
    unit: "usd",
    unitLabel: "dollars",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: false,
    unmeasuredReason:
      "Chaque question RAG et chaque indexation appellent Voyage. Ava n'enregistre pas ce prix. Le rerank et les autres appels LLM sont déjà dans OpenRouter : ils ne se rajoutent pas ici.",
    sourceUrl: "",
    sourceNote: "Saisis l'abonnement Voyage s'il y en a un. La consommation du mois n'est pas mesurée.",
    tiers: [],
  },
];

export function servicesForFamily(family: "voice" | "video" | "llm"): ServiceDefinition[] {
  if (family === "llm") return SERVICE_CATALOG.filter((service) => service.family === "llm" || service.family === "rag");
  return SERVICE_CATALOG.filter((service) => service.family === family);
}

export function serviceById(id: string): ServiceDefinition | undefined {
  return SERVICE_CATALOG.find((service) => service.id === id);
}

export function emptyPlan(): SavedServicePlan {
  return {
    tierId: null,
    cadence: "monthly",
    monthlyFeeUsd: null,
    included: null,
    overagePerUnitUsd: null,
    renewsOn: null,
    creditsPerMinute: null,
  };
}

export function tierById(service: ServiceDefinition, tierId: string | null): PublicTier | undefined {
  if (!tierId || tierId === "custom") return undefined;
  return service.tiers.find((tier) => tier.id === tierId);
}

/** Copies a public tier into the editable fields. Yearly uses the published monthly equivalent. */
export function applyTier(service: ServiceDefinition, tierId: string, cadence: BillingCadence, previous: SavedServicePlan): SavedServicePlan {
  const tier = tierById(service, tierId);
  if (!tier) return { ...previous, tierId: tierId === "custom" ? "custom" : null, cadence };
  const yearly = cadence === "yearly" ? tier.yearlyMonthlyFeeUsd : null;
  return {
    ...previous,
    tierId: tier.id,
    cadence,
    monthlyFeeUsd: yearly ?? tier.monthlyFeeUsd,
    included: tier.included,
    overagePerUnitUsd: tier.overagePerUnitUsd,
    creditsPerMinute: previous.creditsPerMinute ?? service.creditsPerMinute,
  };
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, last)));
}

function shiftMonths(date: Date, months: number, anchorDay: number): Date {
  const absolute = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(absolute / 12);
  const month = ((absolute % 12) + 12) % 12;
  return utcDate(year, month, anchorDay);
}

export function billingWindow(renewsOn: string | null, cadence: BillingCadence, now: Date): BillingWindow {
  const calendar = (): BillingWindow => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end, source: "calendar" };
  };
  if (!renewsOn || !DATE_RE.test(renewsOn)) return calendar();
  const [year, month, day] = renewsOn.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return calendar();
  const step = cadence === "yearly" ? 12 : 1;
  let end = utcDate(year, month - 1, day);
  for (let i = 0; i < 240 && end.getTime() <= now.getTime(); i += 1) {
    end = shiftMonths(end, step, day);
  }
  for (let i = 0; i < 240; i += 1) {
    const previous = shiftMonths(end, -step, day);
    if (previous.getTime() > now.getTime()) {
      end = previous;
      continue;
    }
    return { start: previous, end, source: "renewal" };
  }
  return calendar();
}

export function sumUsage(events: readonly UsageEvent[], serviceId: string, start: Date, end: Date): number {
  let total = 0;
  for (const event of events) {
    if (event.serviceId !== serviceId || !Number.isFinite(event.amount) || event.amount < 0) continue;
    const at = new Date(event.at).getTime();
    if (Number.isNaN(at) || at < start.getTime() || at >= end.getTime()) continue;
    total += event.amount;
  }
  return total;
}

export function earliestWindowStart(services: readonly ServiceDefinition[], plans: Readonly<Record<string, SavedServicePlan>>, now: Date): Date {
  let earliest = billingWindow(null, "monthly", now).start;
  for (const service of services) {
    if (!service.measured) continue;
    const plan = plans[service.id] ?? emptyPlan();
    const start = billingWindow(plan.renewsOn, plan.cadence, now).start;
    if (start.getTime() < earliest.getTime()) earliest = start;
  }
  return earliest;
}

function asMinutes(service: ServiceDefinition, plan: SavedServicePlan, amount: number | null): { minutes: number | null; estimated: boolean } {
  if (amount == null) return { minutes: null, estimated: false };
  if (service.unit === "minutes") return { minutes: amount, estimated: false };
  const perMinute = plan.creditsPerMinute ?? service.creditsPerMinute;
  if (service.creditsPerMinute && perMinute && perMinute > 0) return { minutes: amount / perMinute, estimated: false };
  if (service.charsPerMinute && service.charsPerMinute > 0) return { minutes: amount / service.charsPerMinute, estimated: true };
  return { minutes: null, estimated: false };
}

export function planSnapshot(
  service: ServiceDefinition,
  plan: SavedServicePlan,
  events: readonly UsageEvent[],
  now: Date,
  capped: boolean,
): PlanSnapshot {
  const window = billingWindow(plan.renewsOn, plan.cadence, now);
  const perMinute = plan.creditsPerMinute ?? service.creditsPerMinute;
  const raw = service.measured ? sumUsage(events, service.id, window.start, window.end) : null;
  const used = raw == null ? null : service.creditsPerMinute && perMinute ? raw * perMinute : raw;
  const usedMinutes = asMinutes(service, plan, used);
  const included = plan.included;
  const includedMinutes = asMinutes(service, plan, included);
  const fixedUsd = plan.monthlyFeeUsd;

  const base: PlanSnapshot = {
    service,
    plan,
    window,
    status: "unset",
    used,
    usedMinutes: usedMinutes.minutes,
    minutesAreEstimate: usedMinutes.estimated,
    included,
    includedMinutes: includedMinutes.minutes,
    remaining: null,
    overageUnits: null,
    overageMinutes: null,
    fixedUsd,
    overageUsd: null,
    periodUsd: null,
    capped,
  };

  if (!service.measured) {
    return { ...base, status: "unmeasured", periodUsd: fixedUsd };
  }
  if (used == null) return base;

  if (service.unit === "usd" && included == null) {
    const fixed = fixedUsd ?? 0;
    return {
      ...base,
      status: "payg",
      fixedUsd: fixed,
      overageUsd: used,
      periodUsd: fixed + used,
    };
  }

  if (included == null && fixedUsd == null) return { ...base, status: "unset" };
  if (included == null) return { ...base, status: "allowance-missing" };

  const overageUnits = Math.max(0, used - included);
  const remaining = Math.max(0, included - used);
  const overageMinutes = asMinutes(service, plan, overageUnits).minutes;
  // A dollar past a dollar credit costs one dollar. Other units need a typed rate.
  const rate = service.unit === "usd" ? (plan.overagePerUnitUsd ?? 1) : plan.overagePerUnitUsd;
  if (overageUnits === 0) {
    return {
      ...base,
      status: "inside",
      remaining,
      overageUnits: 0,
      overageMinutes: 0,
      overageUsd: 0,
      periodUsd: fixedUsd,
    };
  }
  if (rate == null) {
    return { ...base, status: "over-rate-missing", remaining: 0, overageUnits, overageMinutes };
  }
  const overageUsd = overageUnits * rate;
  return {
    ...base,
    status: "over",
    remaining: 0,
    overageUnits,
    overageMinutes,
    overageUsd,
    periodUsd: fixedUsd == null ? null : fixedUsd + overageUsd,
  };
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) return null;
  return number;
}

export function parseSavedPlan(value: unknown): SavedServicePlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const cadence = record.cadence === "yearly" ? "yearly" : "monthly";
  const renewsOn = typeof record.renewsOn === "string" && DATE_RE.test(record.renewsOn) ? record.renewsOn : null;
  const tierId = typeof record.tierId === "string" && record.tierId.length > 0 && record.tierId.length < 40 ? record.tierId : null;
  return {
    tierId,
    cadence,
    monthlyFeeUsd: finiteOrNull(record.monthlyFeeUsd),
    included: finiteOrNull(record.included),
    overagePerUnitUsd: finiteOrNull(record.overagePerUnitUsd),
    renewsOn,
    creditsPerMinute: finiteOrNull(record.creditsPerMinute),
  };
}

export function parseServicePlans(value: unknown): Record<string, SavedServicePlan> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const plans = (value as { plans?: unknown }).plans;
  if (!plans || typeof plans !== "object" || Array.isArray(plans)) return {};
  const parsed: Record<string, SavedServicePlan> = {};
  for (const [id, plan] of Object.entries(plans)) {
    if (!serviceById(id)) continue;
    const saved = parseSavedPlan(plan);
    if (saved) parsed[id] = saved;
  }
  return parsed;
}

export function formatUsd(value: number | null): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1 || abs === 0 ? 2 : abs >= 0.01 ? 3 : 4;
  return `${value.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: digits })} $`;
}

export function formatAmount(value: number | null, unit: PlanUnit): string {
  if (value == null) return "—";
  if (unit === "usd") return formatUsd(value);
  const digits = value >= 100 || Number.isInteger(value) ? 0 : 1;
  return value.toLocaleString("fr-CH", { maximumFractionDigits: digits });
}

export function formatMinutes(value: number | null, estimated: boolean): string {
  if (value == null) return "—";
  const text = `${value.toLocaleString("fr-CH", { maximumFractionDigits: value >= 100 ? 0 : 1 })} min`;
  return estimated ? `~${text}` : text;
}

export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
