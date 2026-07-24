import { afterEach, describe, expect, it } from "vitest";
import {
  formatPayPalSetupMessage,
  getPayPalApiBaseUrl,
  getPayPalSetupStatus,
} from "@/app/lib/paypalBilling";

const variableNames = [
  "PAYPAL_MODE",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PLAN_ORBIT_PLUS",
  "PAYPAL_PLAN_ORBIT_PRO",
  "NEXT_PUBLIC_BILLING_PROVIDER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const originalValues = Object.fromEntries(
  variableNames.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of variableNames) {
    const value = originalValues[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const configureCommonSandbox = () => {
  process.env.PAYPAL_MODE = "sandbox";
  process.env.PAYPAL_CLIENT_ID = "sandbox-client";
  process.env.PAYPAL_CLIENT_SECRET = "sandbox-secret";
  process.env.PAYPAL_WEBHOOK_ID = "sandbox-webhook";
  process.env.NEXT_PUBLIC_BILLING_PROVIDER = "paypal";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_audit";
};

describe("PayPal billing configuration", () => {
  it("uses the PayPal Sandbox API and enables a configured Plus checkout", () => {
    configureCommonSandbox();
    process.env.PAYPAL_PLAN_ORBIT_PLUS = "P-PLUSPLAN123";

    expect(getPayPalApiBaseUrl()).toBe(
      "https://api-m.sandbox.paypal.com",
    );
    expect(getPayPalSetupStatus("plus_subscription")).toMatchObject({
      checkoutEnabled: true,
      provider: "paypal",
      mode: "sandbox",
      missingVariables: [],
      invalidVariables: [],
    });
  });

  it("returns only safe missing variable names for a selected product", () => {
    configureCommonSandbox();
    delete process.env.PAYPAL_PLAN_ORBIT_PRO;

    const status = getPayPalSetupStatus("pro_subscription");
    expect(status.checkoutEnabled).toBe(false);
    expect(status.missingVariables).toEqual(["PAYPAL_PLAN_ORBIT_PRO"]);
    expect(formatPayPalSetupMessage(status)).toBe(
      "PayPal checkout cannot open: missing PAYPAL_PLAN_ORBIT_PRO.",
    );
  });

  it("does not require a plan ID for a one-time credit pack", () => {
    configureCommonSandbox();
    delete process.env.PAYPAL_PLAN_ORBIT_PLUS;
    delete process.env.PAYPAL_PLAN_ORBIT_PRO;

    expect(getPayPalSetupStatus("starter_topup").checkoutEnabled).toBe(true);
  });
});
