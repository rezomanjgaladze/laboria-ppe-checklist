import { NextResponse } from "next/server";
import {
  createPaddleSupabaseAdminClientWithDiagnostics,
  formatPaddleSetupDiagnosticMessage,
  getPaddleClientToken,
  getPaddleEnvironment,
  getPaddlePurchase,
  getPaddleSetupStatus,
  getSupabaseAdminValidationMessage,
  type SupabaseAdminDiagnostics,
} from "@/app/lib/paddleBilling";
import { isPaddlePurchaseKey } from "@/app/lib/paddleCatalog";
import {
  ORBIT_STARTER_PLAN,
  isOrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const stagedBillingMigrationFile =
  "supabase/migrations/20260602_paddle_billing_staged.sql";

type BillingPersistenceOperation =
  | "read_billing_account"
  | "create_checkout_attempt";

type SafeSupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type CheckoutSupabaseAdminDiagnostics =
  Omit<SupabaseAdminDiagnostics, "validationStepFailed"> & {
    validationStepFailed: string;
  };

const getErrorText = (error: SafeSupabaseError) =>
  [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const isTableMissingError = (error: SafeSupabaseError) => {
  const text = getErrorText(error);

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    text.includes("could not find the table") ||
    (text.includes("relation") && text.includes("does not exist")) ||
    text.includes("schema cache")
  );
};

const isColumnMissingError = (error: SafeSupabaseError) => {
  const text = getErrorText(error);

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (text.includes("could not find the") && text.includes("column")) ||
    (text.includes("column") && text.includes("does not exist"))
  );
};

const isServiceRoleRejectedError = (error: SafeSupabaseError) => {
  const text = getErrorText(error);

  return (
    error.status === 401 ||
    error.status === 403 ||
    error.code === "42501" ||
    text.includes("invalid api key") ||
    text.includes("invalid jwt") ||
    (text.includes("jwt") && text.includes("invalid")) ||
    text.includes("permission denied") ||
    text.includes("row-level security")
  );
};

const getBillingPersistenceMessage = (
  operation: BillingPersistenceOperation,
  objectName: string,
  error: SafeSupabaseError,
  supabaseAdminDiagnostics?: CheckoutSupabaseAdminDiagnostics,
) => {
  if (isTableMissingError(error)) {
    return `Billing database migration missing: ${objectName} table not found. Apply ${stagedBillingMigrationFile}.`;
  }

  if (isColumnMissingError(error)) {
    return `Billing database migration incomplete: ${objectName} table schema is missing required columns. Re-apply ${stagedBillingMigrationFile}.`;
  }

  if (isServiceRoleRejectedError(error)) {
    if (
      supabaseAdminDiagnostics?.validationStepFailed &&
      supabaseAdminDiagnostics.validationStepFailed !== "none"
    ) {
      return getSupabaseAdminValidationMessage(
        supabaseAdminDiagnostics as SupabaseAdminDiagnostics,
      );
    }

    return "Billing database authorization failed: Supabase service role key is missing, invalid, or not active in this Vercel environment.";
  }

  if (operation === "read_billing_account") {
    return `Billing database check failed: could not read ${objectName}.`;
  }

  return `Billing database check failed: could not create ${objectName} record.`;
};

const logBillingPersistenceError = ({
  userId,
  purchaseKey,
  operation,
  objectName,
  error,
  supabaseAdminDiagnostics,
}: {
  userId: string;
  purchaseKey: string;
  operation: BillingPersistenceOperation;
  objectName: string;
  error: SafeSupabaseError;
  supabaseAdminDiagnostics?: CheckoutSupabaseAdminDiagnostics;
}) => {
  console.error("[paddle-checkout] billing persistence readiness failed", {
    userId,
    purchaseKey,
    operation,
    objectName,
    failedReadinessChecks: [
      isTableMissingError(error) ? `${objectName}_table_missing` : "",
      isColumnMissingError(error) ? `${objectName}_schema_incomplete` : "",
      isServiceRoleRejectedError(error)
        ? "supabase_service_role_authorization_failed"
        : "",
    ].filter(Boolean),
    supabaseErrorCode: error.code || null,
    supabaseErrorStatus: error.status || null,
    supabaseAdminDiagnostics: supabaseAdminDiagnostics || null,
  });
};

const billingPersistenceErrorResponse = ({
  userId,
  purchaseKey,
  operation,
  objectName,
  error,
  supabaseAdminDiagnostics,
}: {
  userId: string;
  purchaseKey: string;
  operation: BillingPersistenceOperation;
  objectName: string;
  error: SafeSupabaseError;
  supabaseAdminDiagnostics?: CheckoutSupabaseAdminDiagnostics;
}) => {
  logBillingPersistenceError({
    userId,
    purchaseKey,
    operation,
    objectName,
    error,
    supabaseAdminDiagnostics,
  });

  const responseDiagnostics =
    supabaseAdminDiagnostics && isServiceRoleRejectedError(error)
      ? {
          ...supabaseAdminDiagnostics,
          validationStepFailed:
            supabaseAdminDiagnostics.validationStepFailed === "none"
              ? "SUPABASE_DATABASE_AUTHORIZATION_FAILED"
              : supabaseAdminDiagnostics.validationStepFailed,
        }
      : supabaseAdminDiagnostics;

  return NextResponse.json(
    {
      error: getBillingPersistenceMessage(
        operation,
        objectName,
        error,
        responseDiagnostics,
      ),
      checkoutEnabled: false,
      failedReadinessCheck: operation,
      databaseObject: objectName,
      migrationRequired: stagedBillingMigrationFile,
      supabaseAdminDiagnostics: responseDiagnostics || null,
    },
    { status: 503 },
  );
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    purchaseKey?: unknown;
  } | null;

  if (!isPaddlePurchaseKey(body?.purchaseKey)) {
    return NextResponse.json(
      { error: "Choose a valid Orbit purchase." },
      { status: 400 },
    );
  }

  const purchase = getPaddlePurchase(body.purchaseKey);
  const status = getPaddleSetupStatus();

  if (!status.checkoutEnabled) {
    const diagnosticMessage = formatPaddleSetupDiagnosticMessage(status);
    console.warn("[paddle-checkout] setup incomplete", {
      userId: user.id,
      purchaseKey: purchase.key,
      selectedPriceKey: purchase.priceEnvironmentVariable,
      selectedPriceIdPresent: Boolean(purchase.priceId),
      missingVariables: status.missingVariables,
      invalidVariables: status.invalidVariables,
    });
    return NextResponse.json(
      {
        error: diagnosticMessage,
        checkoutEnabled: false,
        missingVariables: status.missingVariables,
        invalidVariables: status.invalidVariables,
        diagnostics: status.diagnostics,
        priceEnvironmentVariable: purchase.priceEnvironmentVariable,
        selectedPriceIdPresent: Boolean(purchase.priceId),
      },
      { status: 503 },
    );
  }

  const {
    adminClient,
    diagnostics: supabaseAdminDiagnostics,
  } = createPaddleSupabaseAdminClientWithDiagnostics();

  if (!adminClient) {
    console.error("[paddle-checkout] setup incomplete", {
      userId: user.id,
      purchaseKey: purchase.key,
      failedReadinessChecks: [supabaseAdminDiagnostics.validationStepFailed],
      supabaseAdminDiagnostics,
    });
    return NextResponse.json(
      {
        error: getSupabaseAdminValidationMessage(supabaseAdminDiagnostics),
        checkoutEnabled: false,
        supabaseAdminDiagnostics,
      },
      { status: 503 },
    );
  }

  if (purchase.eligiblePlans?.length) {
    const { data: billingAccount, error: billingAccountError } =
      await adminClient
        .from("orbit_billing_accounts")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

    if (billingAccountError) {
      return billingPersistenceErrorResponse({
        userId: user.id,
        purchaseKey: purchase.key,
        operation: "read_billing_account",
        objectName: "orbit_billing_accounts",
        error: billingAccountError,
        supabaseAdminDiagnostics,
      });
    }

    const currentPlan = isOrbitPlanName(billingAccount?.plan)
      ? billingAccount.plan
      : ORBIT_STARTER_PLAN;

    if (!purchase.eligiblePlans.includes(currentPlan)) {
      return NextResponse.json(
        {
          error: `This AI credit pack is available for ${purchase.eligiblePlans.join(", ")}.`,
        },
        { status: 403 },
      );
    }
  }

  const checkoutAttemptId = crypto.randomUUID();
  const { error } = await adminClient
    .from("orbit_paddle_checkout_attempts")
    .insert({
      id: checkoutAttemptId,
      user_id: user.id,
      item_key: purchase.key,
      purchase_type: purchase.purchaseType,
      price_id: purchase.priceId,
      requested_plan: purchase.plan || null,
      requested_credits: purchase.credits || 0,
      status: "pending",
    });

  if (error) {
    return billingPersistenceErrorResponse({
      userId: user.id,
      purchaseKey: purchase.key,
      operation: "create_checkout_attempt",
      objectName: "orbit_paddle_checkout_attempts",
      error,
      supabaseAdminDiagnostics,
    });
  }

  console.info("[paddle-checkout] checkout attempt created", {
    userId: user.id,
    purchaseKey: purchase.key,
    checkoutAttemptId,
    environment: getPaddleEnvironment(),
    selectedPriceKey: purchase.priceEnvironmentVariable,
    selectedPriceIdPresent: Boolean(purchase.priceId),
    supabaseAdminDiagnostics,
  });

  return NextResponse.json({
    checkoutEnabled: true,
    checkoutAttemptId,
    clientToken: getPaddleClientToken(),
    environment: getPaddleEnvironment(),
    priceId: purchase.priceId,
    priceEnvironmentVariable: purchase.priceEnvironmentVariable,
    customerEmail: user.email || "",
  });
}
