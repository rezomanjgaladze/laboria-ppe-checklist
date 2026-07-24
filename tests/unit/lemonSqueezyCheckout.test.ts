// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { openOrbitLemonSqueezyCheckout } from "@/app/lib/lemonSqueezyCheckout";

describe("Lemon Squeezy checkout client", () => {
  const open = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    open.mockReturnValue({});
    vi.stubGlobal("open", open);
  });

  it("requests the selected product and opens the hosted checkout URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout_url: "https://store.lemonsqueezy.com/checkout/audit",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await openOrbitLemonSqueezyCheckout("plus_subscription");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/lemon/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ product_type: "plus_subscription" }),
      }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://store.lemonsqueezy.com/checkout/audit",
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
              "Lemon Squeezy checkout is not configured: missing LEMONSQUEEZY_VARIANT_ORBIT_PRO.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      openOrbitLemonSqueezyCheckout("pro_subscription"),
    ).rejects.toThrow(
      "Lemon Squeezy checkout is not configured: missing LEMONSQUEEZY_VARIANT_ORBIT_PRO.",
    );
    expect(open).not.toHaveBeenCalled();
  });
});
