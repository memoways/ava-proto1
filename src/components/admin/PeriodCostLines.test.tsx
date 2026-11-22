import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PeriodCostLines from "@/components/admin/PeriodCostLines";
import { applyTier, emptyPlan, periodCostReading, serviceById } from "@/services/servicePlans";

const NOW = new Date("2026-11-22T08:00:00.000Z");

describe("PeriodCostLines", () => {
  it("shows the prorated subscription, the minutes used and the minutes left", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const reading = periodCostReading(
      service,
      plan,
      [{ serviceId: "tavus", at: "2026-11-20T12:00:00.000Z", amount: 10 }],
      10,
      NOW,
      7,
    );
    render(<PeriodCostLines reading={reading} service={service} />);
    expect(screen.getByText("Minutes consommées")).toBeTruthy();
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText("Abonnement (7 j / 30)")).toBeTruthy();
    expect(screen.getByText("coût de la période")).toBeTruthy();
    expect(screen.getByText("165 min restantes")).toBeTruthy();
    expect(screen.getByText(/renouvellement/)).toBeTruthy();
    expect(screen.getAllByText("13,77 $")).toHaveLength(2);
  });

  it("shows estimated voice minutes and the characters that were billed", () => {
    const service = serviceById("elevenlabs")!;
    const plan = applyTier(service, "creator", "monthly", { ...emptyPlan(), renewsOn: "2026-12-05" });
    const reading = periodCostReading(
      service,
      plan,
      [{ serviceId: "elevenlabs", at: "2026-11-10T12:00:00.000Z", amount: 1500 }],
      1500,
      NOW,
      7,
    );
    render(<PeriodCostLines reading={reading} service={service} />);
    expect(screen.getByText("~2 min")).toBeTruthy();
    expect(screen.getByText("Crédits consommés")).toBeTruthy();
    expect(screen.getByText("1'500")).toBeTruthy();
    expect(screen.getByText("~159 min restantes · 119'500 crédits")).toBeTruthy();
    expect(screen.getAllByText("5,13 $")).toHaveLength(2);
  });
});
