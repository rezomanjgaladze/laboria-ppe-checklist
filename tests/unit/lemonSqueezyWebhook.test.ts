import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLemonSqueezyWebhookSignature } from "@/app/api/billing/lemon/webhook/route";

describe("Lemon Squeezy webhook signature verification", () => {
  const secret = "audit-webhook-secret";
  const body = JSON.stringify({
    meta: { event_name: "order_created" },
    data: { id: "audit-order" },
  });

  it("accepts the raw body signed with HMAC SHA-256", () => {
    const signature = createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("hex");

    expect(
      verifyLemonSqueezyWebhookSignature(body, signature, secret),
    ).toBe(true);
  });

  it("rejects changed bodies, invalid signatures, and missing values", () => {
    const signature = createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("hex");

    expect(
      verifyLemonSqueezyWebhookSignature(`${body} `, signature, secret),
    ).toBe(false);
    expect(
      verifyLemonSqueezyWebhookSignature(body, "0".repeat(64), secret),
    ).toBe(false);
    expect(verifyLemonSqueezyWebhookSignature(body, "", secret)).toBe(false);
  });
});
