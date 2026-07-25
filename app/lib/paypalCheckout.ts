"use client";

import type { OrbitBillingProductType } from "@/app/lib/orbitPlans";

type PayPalCheckoutResponse = {
  approval_url?: string;
  error?: string;
  missingVariables?: string[];
  invalidVariables?: string[];
  payment_confirmation_pending?: boolean;
  reused_pending_approval?: boolean;
  message?: string;
};

export type OrbitPayPalCheckoutResult = {
  approvalUrl: string | null;
  popupOpened: boolean;
  reusedPendingApproval: boolean;
  paymentConfirmationPending: boolean;
};

export const openOrbitPayPalCheckout = async (
  productType: OrbitBillingProductType,
): Promise<OrbitPayPalCheckoutResult> => {
  const response = await fetch("/api/billing/paypal/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_type: productType }),
  });
  const payload = (await response.json().catch(() => null)) as
    | PayPalCheckoutResponse
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error || "PayPal checkout could not be opened. Please try again.",
    );
  }

  if (payload?.payment_confirmation_pending) {
    return {
      approvalUrl: null,
      popupOpened: false,
      reusedPendingApproval: false,
      paymentConfirmationPending: true,
    };
  }

  if (!payload?.approval_url) {
    throw new Error(
      payload?.error || "PayPal checkout did not return an approval link.",
    );
  }

  let approvalUrl: URL;

  try {
    approvalUrl = new URL(payload.approval_url);
  } catch {
    throw new Error("PayPal returned an invalid approval URL.");
  }

  if (
    approvalUrl.protocol !== "https:" ||
    !(
      approvalUrl.hostname === "paypal.com" ||
      approvalUrl.hostname.endsWith(".paypal.com")
    )
  ) {
    throw new Error("PayPal returned an untrusted approval URL.");
  }

  const checkoutWindow = window.open(
    approvalUrl.toString(),
    "_blank",
    "noopener,noreferrer",
  );

  return {
    approvalUrl: approvalUrl.toString(),
    popupOpened: Boolean(checkoutWindow),
    reusedPendingApproval: Boolean(payload.reused_pending_approval),
    paymentConfirmationPending: false,
  };
};

export const cancelOrbitPayPalPendingApproval = async () => {
  const response = await fetch("/api/billing/paypal/pending", {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        cleared?: boolean;
        product_type?: unknown;
        payment_confirmation_pending?: boolean;
        error?: string;
      }
    | null;

  if (
    !response.ok ||
    !payload?.cleared ||
    (payload.product_type !== "plus_subscription" &&
      payload.product_type !== "pro_subscription")
  ) {
    throw new Error(
      payload?.error || "The pending PayPal approval could not be restarted.",
    );
  }

  return payload.product_type;
};
