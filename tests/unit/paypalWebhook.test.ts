import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPayPalWebhookSignature } from "@/app/api/billing/paypal/webhook/route";

describe("PayPal webhook signature verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.PAYPAL_MODE = "sandbox";
    process.env.PAYPAL_CLIENT_ID = "sandbox-client";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-secret";
    process.env.PAYPAL_WEBHOOK_ID = "sandbox-webhook";
  });

  it("uses PayPal verification API and accepts SUCCESS", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
        "paypal-transmission-id": "transmission",
        "paypal-transmission-sig": "signature",
        "paypal-transmission-time": "2026-07-25T00:00:00Z",
      },
    });
    const event = {
      id: "WH-AUDIT",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAPTURE-AUDIT" },
    };

    await expect(
      verifyPayPalWebhookSignature(request, event),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
      expect.objectContaining({ method: "POST" }),
    );
    const verifyRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(verifyRequest.body));
    expect(body).toMatchObject({
      webhook_id: "sandbox-webhook",
      transmission_id: "transmission",
      webhook_event: event,
    });
  });

  it("rejects missing transmission headers without calling PayPal", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://example.com/webhook", {
      method: "POST",
    });

    await expect(
      verifyPayPalWebhookSignature(request, {
        id: "WH-AUDIT",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
