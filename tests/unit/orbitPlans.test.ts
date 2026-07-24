import { describe, expect, it } from "vitest";
import {
  ORBIT_PLUS_PLAN,
  ORBIT_PRO_PLAN,
  ORBIT_STARTER_PLAN,
  getOrbitPlan,
  isOrbitAiToolAvailableForPlan,
  isOrbitCreditPackAvailableForPlan,
  orbitCreditPacks,
} from "@/app/lib/orbitPlans";

describe("Orbit plan configuration", () => {
  it("keeps approved prices and monthly credits centralized", () => {
    expect(getOrbitPlan(ORBIT_STARTER_PLAN)).toMatchObject({
      monthlyPriceUsd: 0,
      includedAiCreditsMonthly: 0,
    });
    expect(getOrbitPlan(ORBIT_PLUS_PLAN)).toMatchObject({
      monthlyPriceUsd: 19,
      includedAiCreditsMonthly: 100,
    });
    expect(getOrbitPlan(ORBIT_PRO_PLAN)).toMatchObject({
      monthlyPriceUsd: 49,
      includedAiCreditsMonthly: 300,
    });
  });

  it("restricts command-center intelligence tools to Orbit Pro", () => {
    for (const toolId of [
      "executive-summary",
      "workspace-analysis",
      "risk-trends",
      "predictive-warning",
    ]) {
      expect(isOrbitAiToolAvailableForPlan(ORBIT_STARTER_PLAN, toolId)).toBe(false);
      expect(isOrbitAiToolAvailableForPlan(ORBIT_PLUS_PLAN, toolId)).toBe(false);
      expect(isOrbitAiToolAvailableForPlan(ORBIT_PRO_PLAN, toolId)).toBe(true);
    }
  });

  it("limits each credit pack to its approved plan", () => {
    expect(
      isOrbitCreditPackAvailableForPlan(
        ORBIT_STARTER_PLAN,
        orbitCreditPacks.starter_topup,
      ),
    ).toBe(true);
    expect(
      isOrbitCreditPackAvailableForPlan(
        ORBIT_PLUS_PLAN,
        orbitCreditPacks.starter_topup,
      ),
    ).toBe(false);
    expect(
      isOrbitCreditPackAvailableForPlan(
        ORBIT_PRO_PLAN,
        orbitCreditPacks.pro_pack,
      ),
    ).toBe(true);
    expect(
      isOrbitCreditPackAvailableForPlan(
        ORBIT_PRO_PLAN,
        orbitCreditPacks.plus_pack,
      ),
    ).toBe(true);
  });
});
