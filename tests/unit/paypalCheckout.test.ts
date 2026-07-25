// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelOrbitPayPalPendingApproval,
  openOrbitPayPalCheckout,
} from "@/app/lib/paypalCheckout";

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

    const result = await openOrbitPayPalCheckout("plus_subscription");

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
    expect(result).toEqual({
      approvalUrl:
        "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=audit",
      popupOpened: true,
      reusedPendingApproval: false,
      paymentConfirmationPending: false,
    });
  });

  it("returns a normal approval link when the popup is blocked", async () => {
    open.mockReturnValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            approval_url:
              "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=blocked",
            reused_pending_approval: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      openOrbitPayPalCheckout("plus_subscription"),
    ).resolves.toEqual({
      approvalUrl:
        "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=blocked",
      popupOpened: false,
      reusedPendingApproval: true,
      paymentConfirmationPending: false,
    });
  });

  it("reports webhook confirmation pending without opening another checkout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            payment_confirmation_pending: true,
            message: "Payment confirmation pending.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      openOrbitPayPalCheckout("plus_subscription"),
    ).resolves.toEqual({
      approvalUrl: null,
      popupOpened: false,
      reusedPendingApproval: false,
      paymentConfirmationPending: true,
    });
    expect(open).not.toHaveBeenCalled();
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

  it("clears a pending approval before starting over", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          cleared: true,
          product_type: "plus_subscription",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(cancelOrbitPayPalPendingApproval()).resolves.toBe(
      "plus_subscription",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/paypal/pending",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
