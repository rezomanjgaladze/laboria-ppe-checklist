"use client";

import type { OrbitBillingProductType } from "@/app/lib/orbitPlans";

type LemonCheckoutResponse = {
  checkout_url?: string;
  error?: string;
  missingVariables?: string[];
  invalidVariables?: string[];
  selectedVariantKey?: string;
};

export const openOrbitLemonSqueezyCheckout = async (
  productType: OrbitBillingProductType,
) => {
  const response = await fetch("/api/billing/lemon/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_type: productType }),
  });
  const payload = (await response.json().catch(() => null)) as
    | LemonCheckoutResponse
    | null;

  if (!response.ok || !payload?.checkout_url) {
    throw new Error(
      payload?.error ||
        "Lemon Squeezy checkout could not be opened. Please try again.",
    );
  }

  let checkoutUrl: URL;

  try {
    checkoutUrl = new URL(payload.checkout_url);
  } catch {
    throw new Error("Lemon Squeezy returned an invalid checkout URL.");
  }

  if (checkoutUrl.protocol !== "https:") {
    throw new Error("Lemon Squeezy returned an insecure checkout URL.");
  }

  const checkoutWindow = window.open(
    checkoutUrl.toString(),
    "_blank",
    "noopener,noreferrer",
  );

  if (!checkoutWindow) {
    window.location.assign(checkoutUrl.toString());
  }
};
