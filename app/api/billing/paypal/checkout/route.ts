import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createBillingSupabaseAdminClientWithDiagnostics,
  getSupabaseAdminValidationMessage,
} from "@/app/lib/billingServer";
import {
  formatPayPalSetupMessage,
  getPayPalProduct,
  getPayPalSetupStatus,
  getSafePayPalApiError,
  requestPayPalApi,
} from "@/app/lib/paypalBilling";
import { buildPayPalCustomId } from "@/app/lib/paypalBillingPersistence";
import {
  cancelPayPalPendingSubscription,
  createPayPalSubscriptionReturnState,
  getTrustedPayPalApprovalUrl,
  inspectPayPalSubscription,
  isPayPalPendingApprovalExpired,
} from "@/app/lib/paypalPendingApproval";
import {
  ORBIT_STARTER_PLAN,
  isOrbitBillingProductType,
  isOrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const billingMigrationFile =
  "supabase/migrations/20260726_paypal_billing.sql";

type PayPalCheckoutPayload = {
  id?: unknown;
  status?: unknown;
  links?: unknown;
};

const getApplicationOrigin = (request: Request) => {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configuredSiteUrl || new URL(request.url).origin;
  const url = new URL(candidate);

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error("Laboria Orbit public URL must use HTTPS.");
  }

  return url.origin;
};

const isMissingBillingSchema = (error: {
  code?: string;
  message?: string;
}) =>
  error.code === "42P01" ||
  error.code === "42703" ||
  error.code === "PGRST204" ||
  error.code === "PGRST205" ||
  (error.message || "").toLowerCase().includes("schema cache");

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

  const product = getPayPalProduct(body.product_type);
  const setup = getPayPalSetupStatus(body.product_type);

  if (!setup.checkoutEnabled) {
    const error = formatPayPalSetupMessage(setup);
    console.warn("[paypal-checkout] setup incomplete", {
      userId: user.id,
      productType: product.key,
      missingVariables: setup.missingVariables,
      invalidVariables: setup.invalidVariables,
    });
    return NextResponse.json(
      {
        error,
        checkoutEnabled: false,
        missingVariables: setup.missingVariables,
        invalidVariables: setup.invalidVariables,
        diagnostics: setup.diagnostics,
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
  const { error: schemaError } = await adminClient
    .from("billing_orders")
    .select("paypal_order_id")
    .limit(1);
  const readinessError = accountError || schemaError;

  if (readinessError) {
    const migrationMissing = isMissingBillingSchema(readinessError);
    const error = migrationMissing
      ? `Billing database migration missing. Apply ${billingMigrationFile}.`
      : "Billing database readiness check failed.";
    console.error("[paypal-checkout] billing database preflight failed", {
      userId: user.id,
      productType: product.key,
      errorCode: readinessError.code || null,
      migrationRequired: migrationMissing ? billingMigrationFile : null,
    });
    return NextResponse.json(
      {
        error,
        migrationRequired: migrationMissing ? billingMigrationFile : null,
      },
      { status: 503 },
    );
  }

  if (!account) {
    const { error: insertError } = await adminClient
      .from("orbit_billing_accounts")
      .insert({ user_id: user.id });

    if (insertError) {
      return NextResponse.json(
        { error: "Could not initialize the Orbit billing account." },
        { status: 503 },
      );
    }
  }

  const currentPlan = isOrbitPlanName(account?.plan)
    ? account.plan
    : ORBIT_STARTER_PLAN;
  const { data: existingSubscription, error: existingSubscriptionError } =
    await adminClient
      .from("billing_subscriptions")
      .select(
        "paypal_subscription_id, product_type, plan, status, created_at, updated_at",
      )
      .eq("provider", "paypal")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (existingSubscriptionError) {
    return NextResponse.json(
      { error: "Could not verify the current PayPal subscription." },
      { status: 503 },
    );
  }

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

  let origin: string;
  try {
    origin = getApplicationOrigin(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Laboria Orbit public URL is invalid.",
      },
      { status: 503 },
    );
  }

  const customId = buildPayPalCustomId(user.id, product.key);
  const returnState = createPayPalSubscriptionReturnState(user.id);
  const subscriptionReturnUrl = new URL(
    "/api/billing/paypal/subscription-return",
    origin,
  );
  subscriptionReturnUrl.searchParams.set("result", "approved");
  subscriptionReturnUrl.searchParams.set("state", returnState);
  const subscriptionCancelUrl = new URL(subscriptionReturnUrl);
  subscriptionCancelUrl.searchParams.set("result", "cancelled");
  const returnUrl =
    product.purchaseType === "credit_pack"
      ? `${origin}/api/billing/paypal/capture`
      : subscriptionReturnUrl.toString();
  const cancelUrl =
    product.purchaseType === "credit_pack"
      ? `${origin}/?billing=cancelled`
      : subscriptionCancelUrl.toString();

  try {
    if (product.purchaseType === "subscription") {
      const existingStatus =
        typeof existingSubscription?.status === "string"
          ? existingSubscription.status.toLowerCase()
          : "";
      const existingSubscriptionId =
        typeof existingSubscription?.paypal_subscription_id === "string"
          ? existingSubscription.paypal_subscription_id
          : "";
      const existingProductType = isOrbitBillingProductType(
        existingSubscription?.product_type,
      )
        ? existingSubscription.product_type
        : null;

      if (existingSubscriptionId && existingStatus === "approved") {
        return NextResponse.json({
          payment_confirmation_pending: true,
          checkout_type: "subscription",
          message: "Payment confirmation pending.",
        });
      }

      if (
        existingSubscriptionId &&
        existingStatus === "approval_pending"
      ) {
        const sameProduct = existingProductType === product.key;
        const expired = isPayPalPendingApprovalExpired(
          existingSubscription?.created_at,
        );
        const inspection = await inspectPayPalSubscription(
          existingSubscriptionId,
        );

        if (["active", "approved"].includes(inspection.status)) {
          const { error: pendingUpdateError } = await adminClient
            .from("billing_subscriptions")
            .update({
              status: "approved",
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", existingSubscriptionId);
          if (pendingUpdateError) throw pendingUpdateError;

          return NextResponse.json({
            payment_confirmation_pending: true,
            checkout_type: "subscription",
            message: "Payment confirmation pending.",
          });
        }

        if (["cancelled", "expired"].includes(inspection.status)) {
          const { error: pendingUpdateError } = await adminClient
            .from("billing_subscriptions")
            .update({
              status: inspection.status,
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", existingSubscriptionId);
          if (pendingUpdateError) throw pendingUpdateError;
        } else if (!expired && sameProduct && inspection.approvalUrl) {
          return NextResponse.json({
            approval_url: inspection.approvalUrl,
            checkout_type: "subscription",
            reused_pending_approval: true,
          });
        } else {
          const cancellation = await cancelPayPalPendingSubscription(
            existingSubscriptionId,
            expired
              ? "Laboria Orbit pending approval expired"
              : "Laboria Orbit buyer restarted approval",
          );

          if (!cancellation.cancelled) {
            return NextResponse.json(
              {
                error:
                  cancellation.error ||
                  "The pending PayPal approval could not be restarted safely.",
                recoverable_pending_approval: true,
              },
              { status: 409 },
            );
          }

          const { error: pendingUpdateError } = await adminClient
            .from("billing_subscriptions")
            .update({
              status: expired ? "expired" : "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", existingSubscriptionId);
          if (pendingUpdateError) throw pendingUpdateError;
        }
      }

      if (
        existingSubscriptionId &&
        ["active", "suspended"].includes(existingStatus)
      ) {
        if (existingProductType === product.key) {
          return NextResponse.json(
            { error: `${product.label} is already the current subscription.` },
            { status: 409 },
          );
        }

        const { response, payload } =
          await requestPayPalApi<PayPalCheckoutPayload>(
            `/v1/billing/subscriptions/${encodeURIComponent(existingSubscriptionId)}/revise`,
            {
              method: "POST",
              body: JSON.stringify({ plan_id: product.planId }),
            },
            randomUUID(),
          );
        const approvalUrl = getTrustedPayPalApprovalUrl(payload);

        if (!response.ok || !approvalUrl) {
          const error = getSafePayPalApiError(
            payload,
            "PayPal subscription change could not be created.",
          );
          console.error("[paypal-checkout] subscription revision failed", {
            userId: user.id,
            productType: product.key,
            subscriptionId: existingSubscriptionId,
            responseStatus: response.status,
            error,
          });
          return NextResponse.json(
            { error: `PayPal checkout could not be created: ${error}` },
            { status: 502 },
          );
        }

        console.info("[paypal-checkout] subscription revision created", {
          userId: user.id,
          productType: product.key,
          subscriptionId: existingSubscriptionId,
        });
        return NextResponse.json({
          approval_url: approvalUrl,
          checkout_type: "subscription_revision",
        });
      }

      if (
        existingSubscriptionId &&
        ["past_due", "payment_refunded", "payment_reversed"].includes(
          existingStatus,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Resolve the current PayPal subscription status before changing plans.",
          },
          { status: 409 },
        );
      }

      const { response, payload } =
        await requestPayPalApi<PayPalCheckoutPayload>(
          "/v1/billing/subscriptions",
          {
            method: "POST",
            body: JSON.stringify({
              plan_id: product.planId,
              custom_id: customId,
              subscriber: user.email
                ? { email_address: user.email }
                : undefined,
              application_context: {
                brand_name: "Laboria Orbit",
                locale: "en-US",
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            }),
          },
          randomUUID(),
        );
      const approvalUrl = getTrustedPayPalApprovalUrl(payload);
      const subscriptionId =
        typeof payload?.id === "string" ? payload.id : "";

      if (!response.ok || !approvalUrl || !subscriptionId || !product.plan) {
        const error = getSafePayPalApiError(
          payload,
          "PayPal subscription approval could not be created.",
        );
        console.error("[paypal-checkout] subscription creation failed", {
          userId: user.id,
          productType: product.key,
          responseStatus: response.status,
          error,
        });
        return NextResponse.json(
          { error: `PayPal checkout could not be created: ${error}` },
          { status: 502 },
        );
      }

      const { error: subscriptionError } = await adminClient
        .from("billing_subscriptions")
        .upsert(
          {
            user_id: user.id,
            provider: "paypal",
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: product.planId,
            product_type: product.key,
            plan: product.plan,
            status:
              typeof payload?.status === "string"
                ? payload.status.toLowerCase()
                : "approval_pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "paypal_subscription_id" },
        );

      if (subscriptionError) throw subscriptionError;

      console.info("[paypal-checkout] subscription approval created", {
        userId: user.id,
        productType: product.key,
        subscriptionId,
      });
      return NextResponse.json({
        approval_url: approvalUrl,
        checkout_type: "subscription",
      });
    }

    const invoiceId = `orbit-${product.key}-${randomUUID()}`;
    const { response, payload } = await requestPayPalApi<PayPalCheckoutPayload>(
      "/v2/checkout/orders",
      {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: product.key,
              description: product.label,
              custom_id: customId,
              invoice_id: invoiceId,
              amount: {
                currency_code: "USD",
                value: Number(product.priceUsd || 0).toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: "Laboria Orbit",
            landing_page: "LOGIN",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        }),
      },
      randomUUID(),
    );
    const approvalUrl = getTrustedPayPalApprovalUrl(payload);
    const orderId = typeof payload?.id === "string" ? payload.id : "";

    if (!response.ok || !approvalUrl || !orderId) {
      const error = getSafePayPalApiError(
        payload,
        "PayPal order approval could not be created.",
      );
      console.error("[paypal-checkout] order creation failed", {
        userId: user.id,
        productType: product.key,
        responseStatus: response.status,
        error,
      });
      return NextResponse.json(
        { error: `PayPal checkout could not be created: ${error}` },
        { status: 502 },
      );
    }

    const { error: orderError } = await adminClient
      .from("billing_orders")
      .upsert(
        {
          user_id: user.id,
          provider: "paypal",
          paypal_order_id: orderId,
          product_type: product.key,
          status:
            typeof payload?.status === "string"
              ? payload.status.toLowerCase()
              : "created",
          amount_total: Math.round(Number(product.priceUsd || 0) * 100),
          currency: "USD",
          credits_granted: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "paypal_order_id" },
      );

    if (orderError) throw orderError;

    console.info("[paypal-checkout] order approval created", {
      userId: user.id,
      productType: product.key,
      orderId,
    });
    return NextResponse.json({
      approval_url: approvalUrl,
      checkout_type: "order",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PayPal checkout failed.";
    console.error("[paypal-checkout] checkout creation failed", {
      userId: user.id,
      productType: product.key,
      error: message,
    });
    return NextResponse.json(
      { error: `PayPal checkout could not be created: ${message}` },
      { status: 502 },
    );
  }
}
