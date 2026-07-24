import { NextResponse } from "next/server";
import {
  createBillingSupabaseAdminClientWithDiagnostics,
  getSupabaseAdminValidationMessage,
} from "@/app/lib/billingServer";
import {
  formatLemonSqueezySetupMessage,
  getLemonSqueezyApiKey,
  getLemonSqueezyProduct,
  getLemonSqueezySetupStatus,
  getLemonSqueezyStoreId,
} from "@/app/lib/lemonSqueezyBilling";
import {
  ORBIT_STARTER_PLAN,
  isOrbitBillingProductType,
  isOrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const billingMigrationFile =
  "supabase/migrations/20260725_lemon_squeezy_billing.sql";

const safeApiError = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Lemon Squeezy API rejected the checkout request.";
  }

  const errors = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) {
    return "Lemon Squeezy API rejected the checkout request.";
  }

  const detail = errors
    .map((error) =>
      error && typeof error === "object"
        ? (error as { detail?: unknown; title?: unknown }).detail ||
          (error as { title?: unknown }).title
        : null,
    )
    .find((value): value is string => typeof value === "string" && Boolean(value));

  return detail || "Lemon Squeezy API rejected the checkout request.";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    product_type?: unknown;
  } | null;

  if (!isOrbitBillingProductType(body?.product_type)) {
    return NextResponse.json(
      { error: "Choose a valid Orbit purchase." },
      { status: 400 },
    );
  }

  const product = getLemonSqueezyProduct(body.product_type);
  const status = getLemonSqueezySetupStatus();

  if (!status.checkoutEnabled || !product.variantId) {
    const missingVariables = product.variantId
      ? status.missingVariables
      : Array.from(
          new Set([
            ...status.missingVariables,
            product.variantEnvironmentVariable,
          ]),
        );
    const error = formatLemonSqueezySetupMessage({
      missingVariables,
      invalidVariables: status.invalidVariables,
    });

    console.warn("[lemon-checkout] setup incomplete", {
      userId: user.id,
      productType: product.key,
      selectedVariantKey: product.variantEnvironmentVariable,
      selectedVariantPresent: Boolean(product.variantId),
      missingVariables,
      invalidVariables: status.invalidVariables,
    });

    return NextResponse.json(
      {
        error,
        checkoutEnabled: false,
        missingVariables,
        invalidVariables: status.invalidVariables,
        diagnostics: status.diagnostics,
        selectedVariantKey: product.variantEnvironmentVariable,
      },
      { status: 503 },
    );
  }

  const { adminClient, diagnostics } =
    createBillingSupabaseAdminClientWithDiagnostics();

  if (!adminClient) {
    return NextResponse.json(
      {
        error: getSupabaseAdminValidationMessage(diagnostics),
        checkoutEnabled: false,
        supabaseAdminDiagnostics: diagnostics,
      },
      { status: 503 },
    );
  }

  const { data: account, error: accountError } = await adminClient
    .from("orbit_billing_accounts")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError) {
    const missingTable =
      accountError.code === "42P01" ||
      accountError.code === "PGRST205" ||
      accountError.message.toLowerCase().includes("schema cache");
    const error = missingTable
      ? `Billing database migration missing: orbit_billing_accounts table not found. Apply ${billingMigrationFile}.`
      : "Billing database readiness check failed.";

    console.error("[lemon-checkout] billing database preflight failed", {
      userId: user.id,
      productType: product.key,
      errorCode: accountError.code || null,
      migrationRequired: missingTable ? billingMigrationFile : null,
    });

    return NextResponse.json(
      { error, migrationRequired: billingMigrationFile },
      { status: 503 },
    );
  }

  const currentPlan = isOrbitPlanName(account?.plan)
    ? account.plan
    : ORBIT_STARTER_PLAN;

  if (
    product.eligiblePlans?.length &&
    !product.eligiblePlans.includes(currentPlan)
  ) {
    return NextResponse.json(
      {
        error: `This AI credit pack is available for ${product.eligiblePlans.join(", ")}.`,
      },
      { status: 403 },
    );
  }

  const customData = {
    user_id: user.id,
    user_email: user.email || "",
    product_type: product.key,
    plan_target: product.plan || "",
    credits_amount: product.credits || 0,
  };
  const lemonResponse = await fetch(
    "https://api.lemonsqueezy.com/v1/checkouts",
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${getLemonSqueezyApiKey()}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: user.email || undefined,
              custom: customData,
            },
          },
          relationships: {
            store: {
              data: { type: "stores", id: getLemonSqueezyStoreId() },
            },
            variant: {
              data: { type: "variants", id: product.variantId },
            },
          },
        },
      }),
      cache: "no-store",
    },
  );
  const lemonPayload = (await lemonResponse.json().catch(() => null)) as
    | {
        data?: {
          attributes?: { url?: unknown };
        };
      }
    | null;
  const checkoutUrl = lemonPayload?.data?.attributes?.url;

  if (!lemonResponse.ok || typeof checkoutUrl !== "string" || !checkoutUrl) {
    const error = safeApiError(lemonPayload);

    console.error("[lemon-checkout] checkout creation failed", {
      userId: user.id,
      productType: product.key,
      selectedVariantKey: product.variantEnvironmentVariable,
      selectedVariantPresent: Boolean(product.variantId),
      responseStatus: lemonResponse.status,
      error,
    });

    return NextResponse.json(
      { error: `Lemon Squeezy checkout could not be created: ${error}` },
      { status: 502 },
    );
  }

  console.info("[lemon-checkout] checkout created", {
    userId: user.id,
    productType: product.key,
    selectedVariantKey: product.variantEnvironmentVariable,
  });

  return NextResponse.json({ checkout_url: checkoutUrl });
}
