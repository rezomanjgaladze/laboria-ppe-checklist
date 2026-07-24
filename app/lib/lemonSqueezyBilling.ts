import "server-only";

import {
  orbitBillingProductCatalog,
  type OrbitBillingProductType,
} from "@/app/lib/orbitPlans";

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";

export const lemonSqueezyRequiredEnvironmentVariables = [
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_STORE_ID",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
  "LEMONSQUEEZY_VARIANT_ORBIT_PLUS",
  "LEMONSQUEEZY_VARIANT_ORBIT_PRO",
  "LEMONSQUEEZY_VARIANT_STARTER_TOPUP",
  "LEMONSQUEEZY_VARIANT_PLUS_PACK",
  "LEMONSQUEEZY_VARIANT_PRO_PACK",
  "NEXT_PUBLIC_BILLING_PROVIDER",
] as const;

export const lemonSqueezyInfrastructureEnvironmentVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const getLemonSqueezyProduct = (
  productType: OrbitBillingProductType,
) => {
  const definition = orbitBillingProductCatalog[productType];

  return {
    ...definition,
    variantId: readEnvironmentValue(definition.variantEnvironmentVariable),
  };
};

export const getLemonSqueezySetupStatus = () => {
  const missingProviderVariables =
    lemonSqueezyRequiredEnvironmentVariables.filter(
      (name) => !readEnvironmentValue(name),
    );
  const missingInfrastructureVariables =
    lemonSqueezyInfrastructureEnvironmentVariables.filter(
      (name) => !readEnvironmentValue(name),
    );
  const invalidVariables: string[] = [];
  const provider = readEnvironmentValue("NEXT_PUBLIC_BILLING_PROVIDER");
  const storeId = readEnvironmentValue("LEMONSQUEEZY_STORE_ID");

  if (provider && provider !== "lemon") {
    invalidVariables.push("NEXT_PUBLIC_BILLING_PROVIDER");
  }

  if (storeId && !/^\d+$/.test(storeId)) {
    invalidVariables.push("LEMONSQUEEZY_STORE_ID");
  }

  Object.values(orbitBillingProductCatalog).forEach((product) => {
    const variantId = readEnvironmentValue(product.variantEnvironmentVariable);

    if (variantId && !/^\d+$/.test(variantId)) {
      invalidVariables.push(product.variantEnvironmentVariable);
    }
  });

  const missingVariables = [
    ...missingProviderVariables,
    ...missingInfrastructureVariables,
  ];
  const checkoutEnabled =
    missingVariables.length === 0 && invalidVariables.length === 0;

  return {
    checkoutEnabled,
    provider: provider || "unconfigured",
    missingVariables,
    missingProviderVariables,
    missingInfrastructureVariables,
    invalidVariables,
    diagnostics: {
      checkoutEnabled,
      apiKeyPresent: Boolean(readEnvironmentValue("LEMONSQUEEZY_API_KEY")),
      storeIdPresent: Boolean(storeId),
      webhookSecretPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_WEBHOOK_SECRET"),
      ),
      plusVariantPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_VARIANT_ORBIT_PLUS"),
      ),
      proVariantPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_VARIANT_ORBIT_PRO"),
      ),
      starterTopupVariantPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_VARIANT_STARTER_TOPUP"),
      ),
      plusPackVariantPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_VARIANT_PLUS_PACK"),
      ),
      proPackVariantPresent: Boolean(
        readEnvironmentValue("LEMONSQUEEZY_VARIANT_PRO_PACK"),
      ),
    },
  };
};

export const formatLemonSqueezySetupMessage = (status: {
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
    ? `Lemon Squeezy checkout is not configured: ${details.join("; ")}.`
    : "Lemon Squeezy checkout is not configured.";
};

export const getLemonSqueezyApiKey = () =>
  readEnvironmentValue("LEMONSQUEEZY_API_KEY");

export const getLemonSqueezyStoreId = () =>
  readEnvironmentValue("LEMONSQUEEZY_STORE_ID");

export const getLemonSqueezyWebhookSecret = () =>
  readEnvironmentValue("LEMONSQUEEZY_WEBHOOK_SECRET");

export const getLemonSqueezyVariantProductType = (
  variantId: unknown,
) => {
  const normalized = String(variantId || "");

  return (
    (Object.keys(orbitBillingProductCatalog) as OrbitBillingProductType[]).find(
      (productType) =>
        getLemonSqueezyProduct(productType).variantId === normalized,
    ) || null
  );
};
