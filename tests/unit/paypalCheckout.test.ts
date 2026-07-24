// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { openOrbitPayPalCheckout } from "@/app/lib/paypalCheckout";

describe("PayPal checkout client", () => {
  const open = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    open.mockReturnValue({});
    vi.stubGlobal("open", open);
  });

  it("requests the selected product and opens the PayPal approval URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          approval_url:
            "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=audit",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await openOrbitPayPalCheckout("plus_subscription");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/paypal/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ product_type: "plus_subscription" }),
      }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=audit",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("surfaces the exact safe backend readiness reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error:
              "PayPal checkout cannot open: missing PAYPAL_PLAN_ORBIT_PRO.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      openOrbitPayPalCheckout("pro_subscription"),
    ).rejects.toThrow(
      "PayPal checkout cannot open: missing PAYPAL_PLAN_ORBIT_PRO.",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects a non-PayPal redirect URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ approval_url: "https://attacker.example/checkout" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      openOrbitPayPalCheckout("starter_topup"),
    ).rejects.toThrow("PayPal returned an untrusted approval URL.");
    expect(open).not.toHaveBeenCalled();
  });
});
