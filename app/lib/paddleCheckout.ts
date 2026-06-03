"use client";

import {
  initializePaddle,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js";
import type { PaddlePurchaseKey } from "@/app/lib/paddleCatalog";

type PaddleCheckoutResponse = {
  error?: string;
  checkoutEnabled?: boolean;
  checkoutAttemptId?: string;
  clientToken?: string;
  environment?: Environments;
  priceId?: string;
  customerEmail?: string;
  missingVariables?: string[];
  invalidVariables?: string[];
};

type OpenOrbitPaddleCheckoutOptions = {
  purchaseKey: PaddlePurchaseKey;
  darkMode: boolean;
};

let paddlePromise: Promise<Paddle | undefined> | null = null;
let paddleCacheKey = "";

const getPaddle = (clientToken: string, environment: Environments) => {
  const cacheKey = `${environment}:${clientToken}`;

  if (!paddlePromise || paddleCacheKey !== cacheKey) {
    paddleCacheKey = cacheKey;
    paddlePromise = initializePaddle({
      environment,
      token: clientToken,
    });
  }

  return paddlePromise;
};

export const openOrbitPaddleCheckout = async ({
  purchaseKey,
  darkMode,
}: OpenOrbitPaddleCheckoutOptions) => {
  const response = await fetch("/api/billing/paddle/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchaseKey }),
  });
  const payload = (await response.json()) as PaddleCheckoutResponse;

  if (
    !response.ok ||
    !payload.checkoutEnabled ||
    !payload.checkoutAttemptId ||
    !payload.clientToken ||
    !payload.environment ||
    !payload.priceId
  ) {
    const diagnosticDetails = [
      payload.missingVariables?.length
        ? `missing ${payload.missingVariables.join(", ")}`
        : "",
      payload.invalidVariables?.length
        ? `invalid ${payload.invalidVariables.join(", ")}`
        : "",
    ].filter(Boolean);

    throw new Error(
      payload.error ||
        (diagnosticDetails.length
          ? `Paddle checkout is not configured: ${diagnosticDetails.join("; ")}.`
          : "Payments are being configured. Please contact Laboria."),
    );
  }

  const paddle = await getPaddle(payload.clientToken, payload.environment);

  if (!paddle) {
    throw new Error("Could not initialize secure Paddle checkout.");
  }

  paddle.Checkout.open({
    items: [{ priceId: payload.priceId, quantity: 1 }],
    customer: payload.customerEmail
      ? { email: payload.customerEmail }
      : undefined,
    customData: {
      orbit_checkout_attempt_id: payload.checkoutAttemptId,
    },
    settings: {
      displayMode: "overlay",
      theme: darkMode ? "dark" : "light",
    },
  });
};
