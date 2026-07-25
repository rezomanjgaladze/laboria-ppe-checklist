import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  getSafePayPalApiError,
  requestPayPalApi,
} from "@/app/lib/paypalBilling";

export const PAYPAL_PENDING_APPROVAL_MAX_AGE_MS = 30 * 60 * 1000;

const getReturnStateSecret = () =>
  process.env.PAYPAL_CLIENT_SECRET?.trim() || "";

export const createPayPalSubscriptionReturnState = (userId: string) => {
  const secret = getReturnStateSecret();
  if (!secret) {
    throw new Error("PayPal return state cannot be created.");
  }

  return createHmac("sha256", secret)
    .update(`laboria-orbit-paypal-return|${userId}`)
    .digest("hex");
};

export const verifyPayPalSubscriptionReturnState = (
  userId: string,
  suppliedState: string,
) => {
  if (!/^[a-f0-9]{64}$/i.test(suppliedState)) return false;

  const expectedState = createPayPalSubscriptionReturnState(userId);
  return timingSafeEqual(
    Buffer.from(expectedState, "hex"),
    Buffer.from(suppliedState, "hex"),
  );
};

type PayPalLink = {
  href?: unknown;
  rel?: unknown;
};

export type PayPalSubscriptionPayload = {
  id?: unknown;
  status?: unknown;
  links?: unknown;
};

const trustedPayPalHost = (hostname: string) =>
  hostname === "paypal.com" || hostname.endsWith(".paypal.com");

export const getTrustedPayPalApprovalUrl = (
  payload: PayPalSubscriptionPayload | null,
) => {
  const links = Array.isArray(payload?.links)
    ? (payload.links as PayPalLink[])
    : [];
  const approvalLink = links.find(
    (link) =>
      (link.rel === "approve" || link.rel === "payer-action") &&
      typeof link.href === "string",
  );

  if (typeof approvalLink?.href !== "string") return "";

  try {
    const url = new URL(approvalLink.href);
    return url.protocol === "https:" && trustedPayPalHost(url.hostname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};

export const isPayPalPendingApprovalExpired = (
  createdAt: unknown,
  now = Date.now(),
) => {
  if (typeof createdAt !== "string") return true;
  const createdAtTime = Date.parse(createdAt);
  return (
    !Number.isFinite(createdAtTime) ||
    now - createdAtTime >= PAYPAL_PENDING_APPROVAL_MAX_AGE_MS
  );
};

export const inspectPayPalSubscription = async (subscriptionId: string) => {
  const { response, payload } =
    await requestPayPalApi<PayPalSubscriptionPayload>(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: "GET" },
    );
  const status =
    typeof payload?.status === "string"
      ? payload.status.trim().toLowerCase()
      : "";

  return {
    ok: response.ok,
    responseStatus: response.status,
    status,
    approvalUrl: getTrustedPayPalApprovalUrl(payload),
    error: response.ok
      ? ""
      : getSafePayPalApiError(
          payload,
          "PayPal subscription status could not be checked.",
        ),
  };
};

export const cancelPayPalPendingSubscription = async (
  subscriptionId: string,
  reason: string,
) => {
  const { response, payload } =
    await requestPayPalApi<PayPalSubscriptionPayload>(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.slice(0, 128) }),
      },
      randomUUID(),
    );

  if (response.ok) {
    return { cancelled: true, status: "cancelled", error: "" };
  }

  const inspection = await inspectPayPalSubscription(subscriptionId);
  if (["cancelled", "expired"].includes(inspection.status)) {
    return {
      cancelled: true,
      status: inspection.status,
      error: "",
    };
  }

  return {
    cancelled: false,
    status: inspection.status,
    error: getSafePayPalApiError(
      payload,
      "PayPal could not cancel the pending subscription approval.",
    ),
  };
};
