import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  paddlePurchaseCatalog,
  type PaddlePurchaseKey,
} from "@/app/lib/paddleCatalog";
import { getSupabaseConfig } from "@/lib/supabase/config";

const paddlePriceEnvironmentVariables = Array.from(
  new Set(
    Object.values(paddlePurchaseCatalog).map(
      (purchase) => purchase.priceEnvironmentVariable,
    ),
  ),
);

export const paddleRequiredEnvironmentVariables = [
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_ENVIRONMENT",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  ...paddlePriceEnvironmentVariables,
] as const;

export const paddleInfrastructureEnvironmentVariables = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";
const isEnvironmentValuePresent = (name: string) =>
  Boolean(readEnvironmentValue(name));

export const getPaddleEnvironment = () =>
  readEnvironmentValue("PADDLE_ENVIRONMENT") === "production"
    ? "production"
    : "sandbox";

export const getPaddlePurchase = (purchaseKey: PaddlePurchaseKey) => {
  const definition = paddlePurchaseCatalog[purchaseKey];

  return {
    ...definition,
    priceId: readEnvironmentValue(definition.priceEnvironmentVariable),
  };
};

export const getPaddleSetupStatus = () => {
  const missingPaddleVariables = paddleRequiredEnvironmentVariables.filter(
    (name) => !readEnvironmentValue(name),
  );
  const missingInfrastructureVariables =
    paddleInfrastructureEnvironmentVariables.filter(
      (name) => !readEnvironmentValue(name),
    );
  const invalidVariables: string[] = [];
  const environmentValue = readEnvironmentValue("PADDLE_ENVIRONMENT");
  const clientToken = readEnvironmentValue("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");

  if (
    environmentValue &&
    environmentValue !== "sandbox" &&
    environmentValue !== "production"
  ) {
    invalidVariables.push("PADDLE_ENVIRONMENT");
  }

  if (
    clientToken &&
    ((getPaddleEnvironment() === "sandbox" && !clientToken.startsWith("test_")) ||
      (getPaddleEnvironment() === "production" &&
        !clientToken.startsWith("live_")))
  ) {
    invalidVariables.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  }

  Object.values(paddlePurchaseCatalog).forEach((definition) => {
    const priceId = readEnvironmentValue(definition.priceEnvironmentVariable);

    if (priceId && !priceId.startsWith("pri_")) {
      invalidVariables.push(definition.priceEnvironmentVariable);
    }
  });

  const missingVariables = [
    ...missingPaddleVariables,
    ...missingInfrastructureVariables,
  ];

  return {
    checkoutEnabled:
      missingVariables.length === 0 && invalidVariables.length === 0,
    environment: getPaddleEnvironment(),
    missingVariables,
    missingPaddleVariables,
    missingInfrastructureVariables,
    invalidVariables,
    diagnostics: {
      checkoutEnabled:
        missingVariables.length === 0 && invalidVariables.length === 0,
      clientTokenPresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
      ),
      plusPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PLUS",
      ),
      proPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PRO",
      ),
      starterTopupPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_STARTER_TOPUP",
      ),
      plusPackPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_PLUS_PACK",
      ),
      proPackPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_PRO_PACK",
      ),
    },
  };
};

export const formatPaddleSetupDiagnosticMessage = (status: {
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
    ? `Paddle checkout is not configured: ${details.join("; ")}.`
    : "Paddle checkout is not configured.";
};

export const getPaddleClientToken = () =>
  readEnvironmentValue("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");

export const createPaddleSupabaseAdminClient = () => {
  const serviceRoleKey = readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    return null;
  }

  const { supabaseUrl } = getSupabaseConfig();

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};
