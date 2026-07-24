import "server-only";

import {
  orbitBillingProductCatalog,
  type OrbitBillingProductType,
} from "@/app/lib/orbitPlans";

export type PayPalMode = "sandbox" | "live";

type PayPalErrorPayload = {
  name?: unknown;
  message?: unknown;
  details?: unknown;
};

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";

const commonCheckoutVariables = [
  "PAYPAL_MODE",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "NEXT_PUBLIC_BILLING_PROVIDER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const paypalRequiredEnvironmentVariables = [
  ...commonCheckoutVariables,
  "PAYPAL_PLAN_ORBIT_PLUS",
  "PAYPAL_PLAN_ORBIT_PRO",
] as const;

export const getPayPalMode = (): PayPalMode | null => {
  const mode = readEnvironmentValue("PAYPAL_MODE").toLowerCase();
  return mode === "sandbox" || mode === "live" ? mode : null;
};

export const getPayPalApiBaseUrl = () =>
  getPayPalMode() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export const getPayPalWebhookId = () =>
  readEnvironmentValue("PAYPAL_WEBHOOK_ID");

export const getPayPalProduct = (productType: OrbitBillingProductType) => {
  const definition = orbitBillingProductCatalog[productType];
  const planEnvironmentVariable = definition.paypalPlanEnvironmentVariable;

  return {
    ...definition,
    planEnvironmentVariable,
    planId: planEnvironmentVariable
      ? readEnvironmentValue(planEnvironmentVariable)
      : "",
  };
};

export const getPayPalProductTypeForPlanId = (
  planId: unknown,
): OrbitBillingProductType | null => {
  const normalized = typeof planId === "string" ? planId.trim() : "";

  if (!normalized) return null;

  return (
    (Object.keys(orbitBillingProductCatalog) as OrbitBillingProductType[]).find(
      (productType) => getPayPalProduct(productType).planId === normalized,
    ) || null
  );
};

const getRequiredVariables = (
  productType?: OrbitBillingProductType,
): string[] => {
  if (!productType) {
    return [...paypalRequiredEnvironmentVariables];
  }

  const product = getPayPalProduct(productType);
  return [
    ...commonCheckoutVariables,
    ...(product.planEnvironmentVariable
      ? [product.planEnvironmentVariable]
      : []),
  ];
};

export const getPayPalSetupStatus = (
  productType?: OrbitBillingProductType,
) => {
  const requiredVariables = getRequiredVariables(productType);
  const missingVariables = requiredVariables.filter(
    (name) => !readEnvironmentValue(name),
  );
  const invalidVariables: string[] = [];
  const provider = readEnvironmentValue("NEXT_PUBLIC_BILLING_PROVIDER");
  const modeValue = readEnvironmentValue("PAYPAL_MODE").toLowerCase();

  if (provider && provider !== "paypal") {
    invalidVariables.push("NEXT_PUBLIC_BILLING_PROVIDER");
  }

  if (modeValue && modeValue !== "sandbox" && modeValue !== "live") {
    invalidVariables.push("PAYPAL_MODE");
  }

  for (const key of ["PAYPAL_PLAN_ORBIT_PLUS", "PAYPAL_PLAN_ORBIT_PRO"]) {
    if (!requiredVariables.includes(key)) continue;
    const planId = readEnvironmentValue(key);
    if (planId && !/^P-[A-Z0-9]+$/i.test(planId)) {
      invalidVariables.push(key);
    }
  }

  const checkoutEnabled =
    missingVariables.length === 0 && invalidVariables.length === 0;

  return {
    checkoutEnabled,
    provider: provider || "unconfigured",
    mode: getPayPalMode() || modeValue || "unconfigured",
    missingVariables,
    invalidVariables: Array.from(new Set(invalidVariables)),
    diagnostics: {
      checkoutEnabled,
      billingProvider: provider || "unconfigured",
      paypalMode: getPayPalMode() || modeValue || "unconfigured",
      paypalClientConfigured: Boolean(
        readEnvironmentValue("PAYPAL_CLIENT_ID") &&
          readEnvironmentValue("PAYPAL_CLIENT_SECRET"),
      ),
      paypalWebhookConfigured: Boolean(getPayPalWebhookId()),
      plusPlanPresent: Boolean(readEnvironmentValue("PAYPAL_PLAN_ORBIT_PLUS")),
      proPlanPresent: Boolean(readEnvironmentValue("PAYPAL_PLAN_ORBIT_PRO")),
      serviceRolePresent: Boolean(
        readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
      ),
    },
  };
};

export const formatPayPalSetupMessage = (status: {
  missingVariables: string[];
  invalidVariables: string[];
}) => {
  const details = [
    status.missingVariables.length
      ? `missing ${status.missingVariables.join(", ")}`
      : "",
    status.invalidVariables.length
      ? `invalid ${status.invalidVariables.join(", ")}`
      : "",
  ].filter(Boolean);

  return details.length
    ? `PayPal checkout cannot open: ${details.join("; ")}.`
    : "PayPal checkout cannot open because billing is not configured.";
};

export const getSafePayPalApiError = (
  payload: unknown,
  fallback = "PayPal rejected the request.",
) => {
  if (!payload || typeof payload !== "object") return fallback;

  const candidate = payload as PayPalErrorPayload;
  const details = Array.isArray(candidate.details) ? candidate.details : [];
  const detail = details
    .map((item) =>
      item && typeof item === "object"
        ? (item as { description?: unknown; issue?: unknown }).description ||
          (item as { issue?: unknown }).issue
        : null,
    )
    .find((value): value is string => typeof value === "string" && Boolean(value));

  if (detail) return detail;
  if (typeof candidate.message === "string" && candidate.message) {
    return candidate.message;
  }
  if (typeof candidate.name === "string" && candidate.name) {
    return candidate.name;
  }

  return fallback;
};

export const getPayPalAccessToken = async () => {
  const clientId = readEnvironmentValue("PAYPAL_CLIENT_ID");
  const clientSecret = readEnvironmentValue("PAYPAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal access token cannot be created: missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.",
    );
  }

  const response = await fetch(`${getPayPalApiBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: unknown }
    | null;

  if (
    !response.ok ||
    typeof payload?.access_token !== "string" ||
    !payload.access_token
  ) {
    const error = getSafePayPalApiError(
      payload,
      "PayPal API authentication failed.",
    );
    console.error("[paypal-auth] access token request failed", {
      mode: getPayPalMode() || "unconfigured",
      responseStatus: response.status,
      error,
    });
    throw new Error(error);
  }

  return payload.access_token;
};

export const requestPayPalApi = async <T>(
  path: string,
  init: RequestInit,
  requestId?: string,
) => {
  const accessToken = await getPayPalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  if (requestId) headers.set("PayPal-Request-Id", requestId);

  const response = await fetch(`${getPayPalApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  return { response, payload };
};
