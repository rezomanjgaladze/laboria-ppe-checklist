import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAYPAL_PENDING_APPROVAL_MAX_AGE_MS,
  createPayPalSubscriptionReturnState,
  getTrustedPayPalApprovalUrl,
  isPayPalPendingApprovalExpired,
  verifyPayPalSubscriptionReturnState,
} from "@/app/lib/paypalPendingApproval";

describe("PayPal pending approval helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only trusted HTTPS PayPal approval links", () => {
    expect(
      getTrustedPayPalApprovalUrl({
        links: [
          {
            rel: "approve",
            href: "https://www.sandbox.paypal.com/checkoutnow?token=I-SAFE",
          },
        ],
      }),
    ).toBe("https://www.sandbox.paypal.com/checkoutnow?token=I-SAFE");

    expect(
      getTrustedPayPalApprovalUrl({
        links: [
          {
            rel: "approve",
            href: "https://paypal.example/checkout",
          },
        ],
      }),
    ).toBe("");
  });

  it("expires pending approvals after 30 minutes", () => {
    const now = Date.parse("2026-07-25T12:00:00.000Z");

    expect(
      isPayPalPendingApprovalExpired(
        new Date(now - PAYPAL_PENDING_APPROVAL_MAX_AGE_MS + 1).toISOString(),
        now,
      ),
    ).toBe(false);
    expect(
      isPayPalPendingApprovalExpired(
        new Date(now - PAYPAL_PENDING_APPROVAL_MAX_AGE_MS).toISOString(),
        now,
      ),
    ).toBe(true);
  });

  it("binds PayPal return state to the authenticated user", () => {
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "sandbox-secret");
    const state = createPayPalSubscriptionReturnState("user-a");

    expect(verifyPayPalSubscriptionReturnState("user-a", state)).toBe(true);
    expect(verifyPayPalSubscriptionReturnState("user-b", state)).toBe(false);
    expect(verifyPayPalSubscriptionReturnState("user-a", "invalid")).toBe(
      false,
    );
  });
});
