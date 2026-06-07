"use client";

import {
  initializePaddle,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js";
import {
  paddlePurchaseCatalog,
  type PaddlePurchaseKey,
} from "@/app/lib/paddleCatalog";

type PaddleCheckoutResponse = {
  error?: string;
  checkoutEnabled?: boolean;
  checkoutAttemptId?: string;
  clientToken?: string;
  environment?: Environments;
  priceId?: string;
  priceEnvironmentVariable?: string;
  selectedPriceIdPresent?: boolean;
  customerEmail?: string;
  missingVariables?: string[];
  invalidVariables?: string[];
};

type OpenOrbitPaddleCheckoutOptions = {
  purchaseKey: PaddlePurchaseKey;
  darkMode: boolean;
  timeoutMs?: number;
};

let paddlePromise: Promise<Paddle | undefined> | null = null;
let paddleCacheKey = "";

type PaddleCheckoutDiagnostics = {
  paddleJsLoaded: boolean;
  paddleInitialized: boolean;
  clientTokenPresent: boolean;
  environment: Environments | "unknown";
  selectedPriceIdPresent: boolean;
  selectedPriceKey: string;
  checkoutOpenCalled: boolean;
};

const createDiagnostics = (
  purchaseKey: PaddlePurchaseKey,
): PaddleCheckoutDiagnostics => ({
  paddleJsLoaded: typeof window !== "undefined" && Boolean(window.Paddle),
  paddleInitialized: false,
  clientTokenPresent: false,
  environment: "unknown",
  selectedPriceIdPresent: false,
  selectedPriceKey: purchaseKey,
  checkoutOpenCalled: false,
});

const logDiagnostics = (
  stage: string,
  diagnostics: PaddleCheckoutDiagnostics,
) => {
  console.info("[paddle-checkout]", stage, diagnostics);
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

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
  timeoutMs = 10000,
}: OpenOrbitPaddleCheckoutOptions) => {
  const diagnostics = createDiagnostics(purchaseKey);
  logDiagnostics("request-start", diagnostics);

  const response = await withTimeout(
    fetch("/api/billing/paddle/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseKey }),
    }),
    timeoutMs,
    "Checkout opening timed out. Please refresh and try again.",
  );
  const payload = (await response.json()) as PaddleCheckoutResponse;
  const selectedPriceKey =
    payload.priceEnvironmentVariable ||
    paddlePurchaseCatalog[purchaseKey].priceEnvironmentVariable;

  diagnostics.clientTokenPresent = Boolean(payload.clientToken);
  diagnostics.environment = payload.environment || "unknown";
  diagnostics.selectedPriceIdPresent =
    payload.selectedPriceIdPresent ?? Boolean(payload.priceId);
  diagnostics.selectedPriceKey = selectedPriceKey;
  logDiagnostics("checkout-config-response", diagnostics);

  if (
    payload.missingVariables?.includes(selectedPriceKey) ||
    (response.ok && payload.checkoutEnabled && !payload.priceId)
  ) {
    throw new Error(`Paddle checkout cannot open: missing ${selectedPriceKey}`);
  }

  if (
    payload.missingVariables?.includes("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN") ||
    (response.ok && payload.checkoutEnabled && !payload.clientToken)
  ) {
    throw new Error(
      "Paddle checkout cannot open: missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
    );
  }

  if (
    !response.ok ||
    !payload.checkoutEnabled ||
    !payload.checkoutAttemptId ||
    !payload.environment
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

  const clientToken = payload.clientToken;
  const environment = payload.environment;
  const priceId = payload.priceId;

  if (!clientToken || !environment || !priceId) {
    throw new Error("Payments are being configured. Please contact Laboria.");
  }

  let paddle: Paddle | undefined;

  try {
    paddle = await withTimeout(
      getPaddle(clientToken, environment),
      timeoutMs,
      "Checkout opening timed out. Please refresh and try again.",
    );
  } catch (error) {
    paddlePromise = null;
    paddleCacheKey = "";
    if (
      error instanceof Error &&
      error.message === "Checkout opening timed out. Please refresh and try again."
    ) {
      throw error;
    }

    throw new Error("Paddle checkout cannot open: Paddle.js failed to load");
  }
  diagnostics.paddleJsLoaded =
    typeof window !== "undefined" && Boolean(window.Paddle);
  diagnostics.paddleInitialized = Boolean(paddle?.Initialized);
  logDiagnostics("paddle-initialized", diagnostics);

  if (!paddle) {
    throw new Error("Paddle checkout cannot open: Paddle.js failed to load");
  }

  diagnostics.checkoutOpenCalled = true;
  logDiagnostics("checkout-open-called", diagnostics);
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
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
