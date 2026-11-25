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
/** Monthly allowance, or a balance that lasts until it is spent. */
export type PlanFunding = "subscription" | "prepaid";
/** What is being paid right now. Paused stops the monthly fee. Cancelled ends the service. */
export type PlanAccount = "active" | "paused" | "cancelled";

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
  funding: PlanFunding;
  account: PlanAccount;
  monthlyFeeUsd: number | null;
  included: number | null;
  overagePerUnitUsd: number | null;
  /** Next renewal the admin typed, `YYYY-MM-DD`. */
  renewsOn: string | null;
  /** First invoice. Charges are counted from this day. */
  startedOn: string | null;
  /** Last day of this run. Empty while the subscription continues. */
  endedOn: string | null;
  creditsPerMinute: number | null;
  /** Dollars loaded at `creditedOn`. Replaced on the next top-up. */
  balanceUsd: number | null;
  /** Day the current balance starts. Usage before it does not reduce the balance. */
  creditedOn: string | null;
  /** Dollars per billed unit (one character, one minute). One for a dollar-priced service. */
  usdPerUnit: number | null;
}

export interface UsageEvent {
  serviceId: string;
  at: string;
  amount: number;
}

export interface BillingWindow {
  start: Date;
  end: Date;
  source: "renewal" | "calendar" | "credit";
}

export type PlanStatus =
  | "unset"
  | "inside"
  | "over"
  | "payg"
  | "unmeasured"
  | "allowance-missing"
  | "over-rate-missing"
  | "credit"
  | "topup"
  | "rate-missing"
  | "paused"
  | "cancelled";

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
  /** Prepaid deposit. Null on a subscription. */
  balanceUsd: number | null;
  /** Usage of a prepaid balance, in dollars. */
  spentUsd: number | null;
  /** Dollars still on a prepaid balance. */
  remainingUsd: number | null;
  /** Invoices from the subscription start through the next one, when the start is known. */
  spend: SubscriptionSpend | null;
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
    sourceNote:
      "Pas de portefeuille de crédits. Une fois l'abonnement résilié, le service ne répond plus : indique Résilié. Il n'y a pas de solde à recharger.",
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
    sourceNote:
      "Pas d'abonnement obligatoire : un crédit chargé sert jusqu'à épuisement. Au rechargement, inscris le nouveau solde (ce qui restait + ce que tu ajoutes) et la date. Le prix pour 1 000 caractères convertit la voix mesurée en dollars.",
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
    id: "nuance",
    family: "video",
    label: "Nuance Labs",
    unit: "minutes",
    unitLabel: "minutes",
    charsPerMinute: null,
    creditsPerMinute: null,
    measured: true,
    unmeasuredReason: null,
    sourceUrl: "https://docs.nuancelabs.ai/",
    sourceNote: "Tarif public non relevé le 25 novembre 2026. Saisis le forfait depuis la facture. L'aperçu de l'API parle de crédits quotidiens.",
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
      "Pas d'abonnement mensuel. Le crédit chargé (comme un solde OpenRouter) diminue des coûts déjà renvoyés depuis la date saisie. Au rechargement, inscris le nouveau solde et cette date : l'historique d'avant ne compte plus.",
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
    funding: "subscription",
    account: "active",
    monthlyFeeUsd: null,
    included: null,
    overagePerUnitUsd: null,
    renewsOn: null,
    startedOn: null,
    endedOn: null,
    creditsPerMinute: null,
    balanceUsd: null,
    creditedOn: null,
    usdPerUnit: null,
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

/** Usage that reduces a prepaid balance: from the top-up day through now. */
export function prepaidWindow(creditedOn: string | null, now: Date): BillingWindow {
  const end = new Date(now.getTime() + 86_400_000);
  if (!creditedOn || !DATE_RE.test(creditedOn)) return { start: new Date(0), end, source: "credit" };
  const [year, month, day] = creditedOn.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { start: new Date(0), end, source: "credit" };
  return { start: utcDate(year, month - 1, day), end, source: "credit" };
}

export interface SubscriptionSpend {
  count: number;
  from: string;
  to: string;
  totalUsd: number | null;
  /** The last invoice counted is still in the future. */
  includesUpcoming: boolean;
}

function dayStamp(iso: string): Date | null {
  if (!DATE_RE.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return utcDate(year, month - 1, day);
}

function stampIso(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Monthly (or yearly) invoices from the first one through the horizon.
 * An active plan counts the next renewal. A stopped plan stops at its end, or at today.
 */
export function subscriptionSpend(input: {
  startedOn: string | null;
  renewsOn: string | null;
  endedOn: string | null;
  cadence: BillingCadence;
  monthlyFeeUsd: number | null;
  account: PlanAccount;
  now: Date;
}): SubscriptionSpend | null {
  const start = input.startedOn ? dayStamp(input.startedOn) : null;
  if (!start || !input.startedOn) return null;
  const renews = input.renewsOn ? dayStamp(input.renewsOn) : null;
  const ended = input.endedOn ? dayStamp(input.endedOn) : null;
  const step = input.cadence === "yearly" ? 12 : 1;
  let horizon = input.now;
  let includesUpcoming = false;
  if (input.account === "active" && renews && (!ended || renews.getTime() <= ended.getTime())) {
    horizon = renews;
    includesUpcoming = renews.getTime() > input.now.getTime();
  } else if (ended) {
    horizon = ended;
  }
  const invoice = input.cadence === "yearly"
    ? (input.monthlyFeeUsd == null ? null : input.monthlyFeeUsd * 12)
    : input.monthlyFeeUsd;
  if (start.getTime() > horizon.getTime()) {
    return { count: 0, from: input.startedOn, to: input.startedOn, totalUsd: invoice == null ? null : 0, includesUpcoming: false };
  }
  const dates: Date[] = [];
  let cursor = start;
  for (let i = 0; i < 240 && cursor.getTime() <= horizon.getTime(); i += 1) {
    dates.push(cursor);
    cursor = shiftMonths(cursor, step, start.getUTCDate());
  }
  const last = dates[dates.length - 1] ?? start;
  return {
    count: dates.length,
    from: stampIso(dates[0] ?? start),
    to: stampIso(last),
    totalUsd: invoice == null ? null : invoice * dates.length,
    includesUpcoming,
  };
}

/** A monthly fee is shared across this many days when the admin picks 24 h, 7 days or 30 days. */
export const PLAN_MONTH_DAYS = 30;

export type PeriodCostKind = "subscription" | "prepaid" | "unset" | "stopped" | "month";

export interface PeriodCostReading {
  /** Days the admin asked for. Null means the whole history: the fee shown is one month, not a proration. */
  days: number | null;
  monthDays: number;
  consumedUnits: number | null;
  consumedMinutes: number | null;
  minutesAreEstimate: boolean;
  includedUnits: number | null;
  includedMinutes: number | null;
  /** Left on the current cycle after every measured unit, sandboxes included. */
  remainingUnits: number | null;
  remainingMinutes: number | null;
  /** Share of the monthly fee for `days`, or the whole month when `days` is null. */
  subscriptionUsd: number | null;
  overageUnits: number | null;
  overageMinutes: number | null;
  overageUsd: number | null;
  /** Subscription share plus the overage that falls in the requested window. */
  totalUsd: number | null;
  kind: PeriodCostKind;
  remainingUsd: number | null;
  /** Prepaid dollars spent inside the requested window. */
  spentUsd: number | null;
  allowanceMissing: boolean;
  rateMissing: boolean;
  capped: boolean;
  /** Next renewal the admin typed, `YYYY-MM-DD`. Empty for a prepaid balance. */
  renewsOn: string | null;
}

export function requestedDays(periodId: string): number | null {
  if (periodId === "24h") return 1;
  if (periodId === "7d") return 7;
  if (periodId === "30d") return 30;
  return null;
}

/**
 * Real cost of the window the admin picked.
 *
 * The monthly fee is multiplied by `days / 30`. Minutes consumed are the ones
 * passed in (`periodAmount`, the same unit as a usage event). Minutes left are
 * the subscription allowance minus the whole current cycle, so a 7-day view
 * does not pretend the rest of the month was free. Only units of this window
 * that sit past the allowance are priced as overage. "Tout" shows the current
 * month, not a prorata of all history.
 */
export function periodCostReading(
  service: ServiceDefinition,
  plan: SavedServicePlan,
  cycleEvents: readonly UsageEvent[],
  periodAmount: number,
  now: Date,
  days: number | null,
  capped = false,
): PeriodCostReading {
  const window = plan.funding === "prepaid"
    ? prepaidWindow(plan.creditedOn, now)
    : billingWindow(plan.renewsOn, plan.cadence, now);
  const cycleRaw = service.measured ? sumUsage(cycleEvents, service.id, window.start, window.end) : null;
  const cycleUsed = billedAmount(service, plan, cycleRaw);
  const safePeriod = Number.isFinite(periodAmount) && periodAmount > 0 ? periodAmount : 0;
  const periodUsed = billedAmount(service, plan, service.measured ? safePeriod : null);
  const consumedMinutes = asMinutes(service, plan, periodUsed);
  const included = plan.included;
  const includedMinutes = asMinutes(service, plan, included);
  const base: PeriodCostReading = {
    days,
    monthDays: PLAN_MONTH_DAYS,
    consumedUnits: periodUsed,
    consumedMinutes: consumedMinutes.minutes,
    minutesAreEstimate: consumedMinutes.estimated,
    includedUnits: included,
    includedMinutes: includedMinutes.minutes,
    remainingUnits: null,
    remainingMinutes: null,
    subscriptionUsd: null,
    overageUnits: null,
    overageMinutes: null,
    overageUsd: null,
    totalUsd: null,
    kind: "unset",
    remainingUsd: null,
    spentUsd: null,
    allowanceMissing: false,
    rateMissing: false,
    capped,
    renewsOn: plan.funding === "prepaid" ? null : plan.renewsOn,
  };
  if (!service.measured) return base;

  if (plan.funding === "prepaid") {
    const spent = spentUsd(service, plan, periodUsed);
    const cycleSpent = spentUsd(service, plan, cycleUsed);
    const remainingUsd = plan.balanceUsd == null || cycleSpent == null ? null : Math.max(0, plan.balanceUsd - cycleSpent);
    return {
      ...base,
      kind: "prepaid",
      spentUsd: spent,
      remainingUsd,
      totalUsd: spent,
      rateMissing: plan.balanceUsd != null && spent == null && service.unit !== "usd",
    };
  }

  if (plan.account !== "active") {
    return { ...base, kind: "stopped", subscriptionUsd: 0, totalUsd: 0 };
  }

  const fee = plan.monthlyFeeUsd;
  if (fee == null && included == null) return base;

  const subscriptionUsd = fee == null ? null : days == null ? fee : fee * (days / PLAN_MONTH_DAYS);
  const remainingUnits = included != null && cycleUsed != null ? Math.max(0, included - cycleUsed) : null;
  const remainingMinutes = asMinutes(service, plan, remainingUnits);
  let overageUnits: number | null = null;
  if (included != null && cycleUsed != null && periodUsed != null) {
    if (days == null) {
      overageUnits = Math.max(0, cycleUsed - included);
    } else {
      const attributable = Math.min(periodUsed, cycleUsed);
      const before = cycleUsed - attributable;
      const left = Math.max(0, included - before);
      overageUnits = Math.max(0, attributable - left);
    }
  }
  const overageMinutes = asMinutes(service, plan, overageUnits);
  let overageUsd: number | null = null;
  let rateMissing = false;
  if (overageUnits === 0) overageUsd = 0;
  else if (overageUnits != null && plan.overagePerUnitUsd == null) rateMissing = true;
  else if (overageUnits != null && plan.overagePerUnitUsd != null) overageUsd = overageUnits * plan.overagePerUnitUsd;

  const allowanceMissing = included == null && fee != null;
  let totalUsd: number | null = null;
  if (subscriptionUsd != null && overageUsd != null) totalUsd = subscriptionUsd + overageUsd;
  else if (subscriptionUsd != null && allowanceMissing) totalUsd = subscriptionUsd;

  return {
    ...base,
    kind: days == null ? "month" : "subscription",
    subscriptionUsd,
    remainingUnits,
    remainingMinutes: remainingMinutes.minutes,
    overageUnits,
    overageMinutes: overageMinutes.minutes,
    overageUsd,
    totalUsd,
    allowanceMissing,
    rateMissing,
  };
}

export function sumPeriodTotals(readings: Array<PeriodCostReading | null>): { total: number | null; partial: boolean } {
  const present = readings.filter((reading): reading is PeriodCostReading => reading != null);
  const known = present.filter((reading) => reading.totalUsd != null);
  const partial = present.some((reading) => reading.totalUsd == null && (reading.consumedUnits ?? 0) > 0);
  if (known.length === 0) return { total: null, partial };
  return {
    total: known.reduce((sum, reading) => sum + (reading.totalUsd ?? 0), 0),
    partial,
  };
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

function billedAmount(service: ServiceDefinition, plan: SavedServicePlan, raw: number | null): number | null {
  if (raw == null) return null;
  const perMinute = plan.creditsPerMinute ?? service.creditsPerMinute;
  if (service.creditsPerMinute && perMinute) return raw * perMinute;
  return raw;
}

function asMinutes(service: ServiceDefinition, plan: SavedServicePlan, amount: number | null): { minutes: number | null; estimated: boolean } {
  if (amount == null) return { minutes: null, estimated: false };
  if (service.unit === "minutes") return { minutes: amount, estimated: false };
  const perMinute = plan.creditsPerMinute ?? service.creditsPerMinute;
  if (service.creditsPerMinute && perMinute && perMinute > 0) return { minutes: amount / perMinute, estimated: false };
  if (service.charsPerMinute && service.charsPerMinute > 0) return { minutes: amount / service.charsPerMinute, estimated: true };
  return { minutes: null, estimated: false };
}

function spentUsd(service: ServiceDefinition, plan: SavedServicePlan, used: number | null): number | null {
  if (used == null) return null;
  if (service.unit === "usd") return used;
  if (plan.usdPerUnit == null) return null;
  return used * plan.usdPerUnit;
}

export function planSnapshot(
  service: ServiceDefinition,
  plan: SavedServicePlan,
  events: readonly UsageEvent[],
  now: Date,
  capped: boolean,
): PlanSnapshot {
  const window = plan.funding === "prepaid"
    ? prepaidWindow(plan.creditedOn, now)
    : billingWindow(plan.renewsOn, plan.cadence, now);
  const raw = service.measured ? sumUsage(events, service.id, window.start, window.end) : null;
  const used = billedAmount(service, plan, raw);
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
    balanceUsd: plan.funding === "prepaid" ? plan.balanceUsd : null,
    spentUsd: null,
    remainingUsd: null,
    spend: plan.funding === "prepaid" ? null : subscriptionSpend({
      startedOn: plan.startedOn,
      renewsOn: plan.renewsOn,
      endedOn: plan.endedOn,
      cadence: plan.cadence,
      monthlyFeeUsd: plan.monthlyFeeUsd,
      account: plan.account,
      now,
    }),
    capped,
  };

  const built = plan.funding === "prepaid"
    ? prepaidSnapshot(base, service, plan, used)
    : subscriptionSnapshot(base, service, plan, used, included);
  if (plan.funding === "prepaid" || plan.account === "active") return built;
  return {
    ...built,
    status: plan.account === "cancelled" ? "cancelled" : "paused",
    fixedUsd: 0,
    periodUsd: 0,
    overageUsd: null,
  };
}

function prepaidSnapshot(base: PlanSnapshot, service: ServiceDefinition, plan: SavedServicePlan, used: number | null): PlanSnapshot {
  const balance = plan.balanceUsd;
  const spent = spentUsd(service, plan, used);
  const withMoney: PlanSnapshot = { ...base, balanceUsd: balance, spentUsd: spent, fixedUsd: 0 };
  if (!service.measured) return { ...withMoney, status: "unmeasured", periodUsd: balance };
  if (balance == null) return { ...withMoney, status: "unset" };
  if (spent == null) return { ...withMoney, status: "rate-missing" };
  const remainingUsd = balance - spent;
  if (remainingUsd >= 0) {
    return { ...withMoney, status: "credit", remainingUsd, overageUsd: 0, periodUsd: balance };
  }
  return { ...withMoney, status: "topup", remainingUsd: 0, overageUsd: -remainingUsd, periodUsd: balance };
}

function subscriptionSnapshot(
  base: PlanSnapshot,
  service: ServiceDefinition,
  plan: SavedServicePlan,
  used: number | null,
  included: number | null,
): PlanSnapshot {
  const fixedUsd = plan.monthlyFeeUsd;
  if (!service.measured) return { ...base, status: "unmeasured", periodUsd: fixedUsd };
  if (used == null) return base;

  if (service.unit === "usd" && included == null) {
    const fixed = fixedUsd ?? 0;
    return { ...base, status: "payg", fixedUsd: fixed, overageUsd: used, periodUsd: fixed + used };
  }

  if (included == null && fixedUsd == null) return { ...base, status: "unset" };
  if (included == null) return { ...base, status: "allowance-missing" };

  const overageUnits = Math.max(0, used - included);
  const remaining = Math.max(0, included - used);
  const overageMinutes = asMinutes(service, plan, overageUnits).minutes;
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
  const startedOn = typeof record.startedOn === "string" && DATE_RE.test(record.startedOn) ? record.startedOn : null;
  const endedOn = typeof record.endedOn === "string" && DATE_RE.test(record.endedOn) ? record.endedOn : null;
  const tierId = typeof record.tierId === "string" && record.tierId.length > 0 && record.tierId.length < 40 ? record.tierId : null;
  const funding = record.funding === "prepaid" ? "prepaid" : "subscription";
  const account = record.account === "paused" || record.account === "cancelled" ? record.account : "active";
  const creditedOn = typeof record.creditedOn === "string" && DATE_RE.test(record.creditedOn) ? record.creditedOn : null;
  return {
    tierId,
    cadence,
    funding,
    account,
    monthlyFeeUsd: finiteOrNull(record.monthlyFeeUsd),
    included: finiteOrNull(record.included),
    overagePerUnitUsd: finiteOrNull(record.overagePerUnitUsd),
    renewsOn,
    startedOn,
    endedOn,
    creditsPerMinute: finiteOrNull(record.creditsPerMinute),
    balanceUsd: finiteOrNull(record.balanceUsd),
    creditedOn,
    usdPerUnit: finiteOrNull(record.usdPerUnit),
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
