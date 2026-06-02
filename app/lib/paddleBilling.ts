import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  paddlePurchaseCatalog,
  type PaddlePurchaseKey,
} from "@/app/lib/paddleCatalog";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const paddleRequiredEnvironmentVariables = [
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_ENVIRONMENT",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PLUS",
  "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PRO",
  "NEXT_PUBLIC_PADDLE_PRICE_STARTER_TOPUP",
  "NEXT_PUBLIC_PADDLE_PRICE_PLUS_PACK",
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_PACK",
] as const;

export const paddleInfrastructureEnvironmentVariables = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";

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
  };
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
