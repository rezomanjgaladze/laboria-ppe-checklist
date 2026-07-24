"use client";

import type { OrbitBillingProductType } from "@/app/lib/orbitPlans";

type PayPalCheckoutResponse = {
  approval_url?: string;
  error?: string;
  missingVariables?: string[];
  invalidVariables?: string[];
};

export const openOrbitPayPalCheckout = async (
  productType: OrbitBillingProductType,
) => {
  const response = await fetch("/api/billing/paypal/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_type: productType }),
  });
  const payload = (await response.json().catch(() => null)) as
    | PayPalCheckoutResponse
    | null;

  if (!response.ok || !payload?.approval_url) {
    throw new Error(
      payload?.error || "PayPal checkout could not be opened. Please try again.",
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

  if (!checkoutWindow) {
    window.location.assign(approvalUrl.toString());
  }
};
