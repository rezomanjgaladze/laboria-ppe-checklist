import { afterEach, describe, expect, it, vi } from "vitest";
import { setupPayPalSandboxCatalog } from "@/app/lib/paypalSandboxSetup";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const plusPlan = {
  id: "P-PLUS123",
  product_id: "PROD-LABORIA123",
  name: "Laboria Orbit Plus",
  description: "Laboria Orbit Plus monthly subscription",
  status: "ACTIVE",
  billing_cycles: [
    {
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: {
        fixed_price: { value: "19.00", currency_code: "USD" },
      },
    },
  ],
  payment_preferences: {
    auto_bill_outstanding: true,
    payment_failure_threshold: 3,
  },
};

const proPlan = {
  ...plusPlan,
  id: "P-PRO123",
  name: "Laboria Orbit Pro",
  description: "Laboria Orbit Pro monthly subscription",
  billing_cycles: [
    {
      ...plusPlan.billing_cycles[0],
      pricing_scheme: {
        fixed_price: { value: "49.00", currency_code: "USD" },
      },
    },
  ],
};

describe("setupPayPalSandboxCatalog", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reuses matching active Sandbox product and plans", async () => {
    vi.stubEnv("PAYPAL_MODE", "sandbox");
    vi.stubEnv("PAYPAL_CLIENT_ID", "sandbox-client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "sandbox-client-secret");

    const apiResponses = [
      jsonResponse({
        products: [{ id: "PROD-LABORIA123", name: "Laboria Orbit" }],
        total_pages: 1,
      }),
      jsonResponse({
        id: "PROD-LABORIA123",
        name: "Laboria Orbit",
        description: "AI-powered Health & Safety operations workspace",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
      jsonResponse({
        plans: [
          { id: plusPlan.id, name: plusPlan.name },
          { id: proPlan.id, name: proPlan.name },
        ],
        total_pages: 1,
      }),
      jsonResponse(plusPlan),
      jsonResponse({
        plans: [
          { id: plusPlan.id, name: plusPlan.name },
          { id: proPlan.id, name: proPlan.name },
        ],
        total_pages: 1,
      }),
      jsonResponse(proPlan),
    ];
    let apiResponseIndex = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;

        if (url.endsWith("/v1/oauth2/token")) {
          return jsonResponse({ access_token: "sandbox-access-token" });
        }

        return apiResponses[apiResponseIndex++];
      }),
    );

    await expect(setupPayPalSandboxCatalog()).resolves.toEqual({
      PAYPAL_PRODUCT_ID: "PROD-LABORIA123",
      PAYPAL_PLAN_ORBIT_PLUS: "P-PLUS123",
      PAYPAL_PLAN_ORBIT_PRO: "P-PRO123",
    });
  });

  it("refuses to run outside Sandbox", async () => {
    vi.stubEnv("PAYPAL_MODE", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(setupPayPalSandboxCatalog()).rejects.toThrow(
      "PayPal catalog setup is disabled unless PAYPAL_MODE=sandbox.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
