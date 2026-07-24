import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORBIT_STARTER_PLAN,
  getOrbitPlan,
  isOrbitBillingProductType,
  isOrbitPlanName,
  orbitBillingProductCatalog,
  type OrbitBillingProductType,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const buildPayPalCustomId = (
  userId: string,
  productType: OrbitBillingProductType,
) => `orbit|${userId}|${productType}`;

export const parsePayPalCustomId = (value: unknown) => {
  if (typeof value !== "string") return null;

  const [namespace, userId, productType] = value.split("|");
  if (
    namespace !== "orbit" ||
    !uuidPattern.test(userId || "") ||
    !isOrbitBillingProductType(productType)
  ) {
    return null;
  }

  return { userId, productType };
};

type GrantCreditsInput = {
  adminClient: SupabaseClient;
  userId: string;
  credits: number;
  reason: string;
  entryKey: string;
  providerReference: string;
  productType: OrbitBillingProductType;
  source: "subscription" | "credit_pack";
  eventId?: string | null;
  orderId?: string | null;
  subscriptionId?: string | null;
  captureId?: string | null;
};

export const grantPayPalCredits = async ({
  adminClient,
  userId,
  credits,
  reason,
  entryKey,
  providerReference,
  productType,
  source,
  eventId,
  orderId,
  subscriptionId,
  captureId,
}: GrantCreditsInput) => {
  const { data, error } = await adminClient.rpc("grant_orbit_ai_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_reason: reason,
    p_entry_key: entryKey,
    p_provider_reference: providerReference,
    p_provider: "paypal",
    p_product_type: productType,
    p_source: source,
    p_event_id: eventId || null,
    p_paypal_order_id: orderId || null,
    p_paypal_subscription_id: subscriptionId || null,
    p_paypal_capture_id: captureId || null,
  });

  if (error) throw error;

  // A capture return and webhook can race. The RPC prevents duplicate credits;
  // this update enriches the existing ledger row with any metadata that arrived later.
  const ledgerMetadata = {
    ...(eventId ? { event_id: eventId } : {}),
    ...(orderId ? { paypal_order_id: orderId } : {}),
    ...(subscriptionId ? { paypal_subscription_id: subscriptionId } : {}),
    ...(captureId ? { paypal_capture_id: captureId } : {}),
  };

  if (Object.keys(ledgerMetadata).length) {
    const { error: metadataError } = await adminClient
      .from("ai_credit_ledger")
      .update(ledgerMetadata)
      .eq("entry_key", entryKey);
    if (metadataError) throw metadataError;
  }

  return data as { granted?: boolean; duplicate?: boolean } | null;
};

const getAccountPlan = async (
  adminClient: SupabaseClient,
  userId: string,
): Promise<OrbitPlanName> => {
  const { data, error } = await adminClient
    .from("orbit_billing_accounts")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return isOrbitPlanName(data?.plan) ? data.plan : ORBIT_STARTER_PLAN;
};

export const processPayPalCreditPackCapture = async ({
  adminClient,
  orderId,
  captureId,
  eventId,
}: {
  adminClient: SupabaseClient;
  orderId: string;
  captureId: string;
  eventId?: string | null;
}) => {
  const { data: order, error: orderError } = await adminClient
    .from("billing_orders")
    .select("user_id, product_type, status, credits_granted")
    .eq("paypal_order_id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order || typeof order.user_id !== "string") {
    throw new Error("PayPal order is not linked to a Laboria Orbit account.");
  }
  if (!isOrbitBillingProductType(order.product_type)) {
    throw new Error("PayPal order has an invalid Orbit product.");
  }

  const product = orbitBillingProductCatalog[order.product_type];
  if (product.purchaseType !== "credit_pack" || !product.credits) {
    throw new Error("PayPal order is not an AI credit pack.");
  }

  const currentPlan = await getAccountPlan(adminClient, order.user_id);
  if (
    product.eligiblePlans?.length &&
    !product.eligiblePlans.includes(currentPlan)
  ) {
    await adminClient
      .from("billing_orders")
      .update({
        status: "eligibility_failed",
        paypal_capture_id: captureId,
        updated_at: new Date().toISOString(),
      })
      .eq("paypal_order_id", orderId);
    throw new Error(
      `This paid credit pack requires ${product.eligiblePlans.join(" or ")}.`,
    );
  }

  const entryKey = `paypal:capture:${captureId}:${order.product_type}`;
  const result = await grantPayPalCredits({
    adminClient,
    userId: order.user_id,
    credits: product.credits,
    reason: `PayPal AI credit pack: ${product.label}`,
    entryKey,
    providerReference: captureId,
    productType: order.product_type,
    source: "credit_pack",
    eventId: eventId || `capture:${captureId}`,
    orderId,
    captureId,
  });
  const creditsGranted =
    result?.granted || result?.duplicate ? product.credits : 0;
  const { error: updateError } = await adminClient
    .from("billing_orders")
    .update({
      status: "completed",
      paypal_capture_id: captureId,
      credits_granted: creditsGranted,
      updated_at: new Date().toISOString(),
    })
    .eq("paypal_order_id", orderId);

  if (updateError) throw updateError;

  return {
    userId: order.user_id,
    productType: order.product_type,
    creditsGranted,
    duplicate: Boolean(result?.duplicate),
  };
};

export const processPayPalSubscriptionPayment = async ({
  adminClient,
  subscriptionId,
  paymentId,
  eventId,
  paidAt,
}: {
  adminClient: SupabaseClient;
  subscriptionId: string;
  paymentId: string;
  eventId: string;
  paidAt?: string | null;
}) => {
  const { data: subscription, error: subscriptionError } = await adminClient
    .from("billing_subscriptions")
    .select("user_id, product_type, plan")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (subscriptionError) throw subscriptionError;
  if (!subscription || typeof subscription.user_id !== "string") {
    throw new Error(
      "PayPal subscription payment is not linked to a Laboria Orbit account.",
    );
  }

  const productType = isOrbitBillingProductType(subscription.product_type)
    ? subscription.product_type
    : subscription.plan === "Orbit Pro"
      ? "pro_subscription"
      : "plus_subscription";
  const plan = isOrbitPlanName(subscription.plan)
    ? subscription.plan
    : orbitBillingProductCatalog[productType].plan || ORBIT_STARTER_PLAN;
  const credits = getOrbitPlan(plan).includedAiCreditsMonthly;

  if (!credits) {
    throw new Error("PayPal subscription does not include monthly AI credits.");
  }

  const entryKey = `paypal:subscription-payment:${paymentId}:${productType}`;
  const result = await grantPayPalCredits({
    adminClient,
    userId: subscription.user_id,
    credits,
    reason: `${plan} included monthly AI credits`,
    entryKey,
    providerReference: paymentId,
    productType,
    source: "subscription",
    eventId,
    subscriptionId,
  });
  const updatedAt = new Date().toISOString();
  const { error: subscriptionUpdateError } = await adminClient
    .from("billing_subscriptions")
    .update({
      status: "active",
      last_credit_period_key: paymentId,
      current_period_start: paidAt || updatedAt,
      updated_at: updatedAt,
    })
    .eq("paypal_subscription_id", subscriptionId);

  if (subscriptionUpdateError) throw subscriptionUpdateError;

  const { error: accountError } = await adminClient
    .from("orbit_billing_accounts")
    .upsert(
      {
        user_id: subscription.user_id,
        plan,
        subscription_status: "active",
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );

  if (accountError) throw accountError;

  return {
    userId: subscription.user_id,
    productType,
    plan,
    credits,
    duplicate: Boolean(result?.duplicate),
  };
};
