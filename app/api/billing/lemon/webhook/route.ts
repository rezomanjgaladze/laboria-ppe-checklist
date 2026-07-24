import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  getLemonSqueezyStoreId,
  getLemonSqueezyVariantProductType,
  getLemonSqueezyWebhookSecret,
} from "@/app/lib/lemonSqueezyBilling";
import {
  ORBIT_STARTER_PLAN,
  getOrbitPlan,
  isOrbitBillingProductType,
  isOrbitPlanName,
  orbitBillingProductCatalog,
  type OrbitBillingProductType,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type LemonWebhook = {
  meta?: {
    event_name?: unknown;
    event_id?: unknown;
    custom_data?: unknown;
    test_mode?: unknown;
  };
  data?: {
    id?: unknown;
    type?: unknown;
    attributes?: unknown;
  };
};

type BillingAccountRow = {
  plan?: unknown;
  ai_credits_balance?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const asString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const asNullableString = (value: unknown) => asString(value) || null;

const asNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeProductType = (
  customData: JsonObject,
  attributes: JsonObject,
): OrbitBillingProductType | null => {
  const customProductType = customData.product_type;

  if (isOrbitBillingProductType(customProductType)) {
    return customProductType;
  }

  const firstOrderItem = asObject(attributes.first_order_item);
  return getLemonSqueezyVariantProductType(
    attributes.variant_id || firstOrderItem.variant_id,
  );
};

const isPaidOrder = (attributes: JsonObject) => {
  const status = asString(attributes.status).toLowerCase();
  return status === "paid";
};

export const verifyLemonSqueezyWebhookSignature = (
  rawBody: string,
  signatureHeader: string,
  secret: string,
) => {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
  const actual = Buffer.from(signatureHeader, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const deriveEventKey = (eventName: string, rawBody: string) =>
  createHash("sha256").update(`${eventName}:${rawBody}`).digest("hex");

const getSubscriptionPlan = (
  productType: OrbitBillingProductType | null,
  fallback?: unknown,
): OrbitPlanName => {
  const configuredPlan = productType
    ? orbitBillingProductCatalog[productType].plan
    : null;

  if (configuredPlan) return configuredPlan;
  return isOrbitPlanName(fallback) ? fallback : ORBIT_STARTER_PLAN;
};

const getAccountPlanForSubscription = ({
  currentPlan,
  targetPlan,
  status,
  endsAt,
}: {
  currentPlan: OrbitPlanName;
  targetPlan: OrbitPlanName;
  status: string;
  endsAt: string | null;
}) => {
  if (status === "expired") {
    return ORBIT_STARTER_PLAN;
  }

  if (status === "cancelled") {
    const endTime = endsAt ? Date.parse(endsAt) : Number.NaN;
    return Number.isFinite(endTime) && endTime > Date.now()
      ? targetPlan
      : ORBIT_STARTER_PLAN;
  }

  if (status === "active" || status === "on_trial") {
    return targetPlan;
  }

  return currentPlan;
};

const markEvent = async (
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >,
  eventKey: string,
  status: "processed" | "ignored" | "failed",
  errorMessage?: string,
) =>
  adminClient
    .from("billing_events")
    .update({
      processing_status: status,
      error_message: errorMessage || null,
      processed_at: status === "failed" ? null : new Date().toISOString(),
    })
    .eq("provider_event_key", eventKey);

const resolveUserId = async ({
  adminClient,
  customData,
  attributes,
  dataId,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  customData: JsonObject;
  attributes: JsonObject;
  dataId: string;
}) => {
  const customUserId = asString(customData.user_id);
  if (uuidPattern.test(customUserId)) {
    return customUserId;
  }

  const subscriptionId =
    asString(attributes.subscription_id) ||
    (asString(attributes.status) ? dataId : "");
  if (subscriptionId) {
    const { data } = await adminClient
      .from("billing_subscriptions")
      .select("user_id")
      .eq("lemon_subscription_id", subscriptionId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }

  const customerId = asString(attributes.customer_id);
  if (customerId) {
    const { data } = await adminClient
      .from("billing_customers")
      .select("user_id")
      .eq("lemon_customer_id", customerId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }

  return null;
};

const upsertCustomer = async ({
  adminClient,
  userId,
  attributes,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  userId: string;
  attributes: JsonObject;
}) => {
  const customerId = asString(attributes.customer_id);
  if (!customerId) return;

  const { error } = await adminClient.from("billing_customers").upsert(
    {
      user_id: userId,
      provider: "lemon",
      lemon_customer_id: customerId,
      email:
        asNullableString(attributes.user_email) ||
        asNullableString(attributes.customer_email),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,lemon_customer_id" },
  );

  if (error) throw error;
};

const grantCredits = async ({
  adminClient,
  userId,
  credits,
  reason,
  entryKey,
  providerReference,
  productType,
  source,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  userId: string;
  credits: number;
  reason: string;
  entryKey: string;
  providerReference: string;
  productType: OrbitBillingProductType;
  source: "subscription" | "credit_pack";
}) => {
  const { data, error } = await adminClient.rpc("grant_orbit_ai_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_reason: reason,
    p_entry_key: entryKey,
    p_provider_reference: providerReference,
    p_provider: "lemon",
    p_product_type: productType,
    p_source: source,
  });

  if (error) throw error;
  return data as { granted?: boolean; duplicate?: boolean } | null;
};

const processSubscriptionEvent = async ({
  adminClient,
  eventName,
  userId,
  dataId,
  attributes,
  productType,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  eventName: string;
  userId: string;
  dataId: string;
  attributes: JsonObject;
  productType: OrbitBillingProductType | null;
}) => {
  const subscriptionId =
    asString(attributes.subscription_id) || dataId;
  const { data: existingSubscription } = await adminClient
    .from("billing_subscriptions")
    .select(
      "plan, status, renews_at, last_credit_period_key, lemon_customer_id, lemon_order_id, lemon_variant_id, product_type, update_payment_method_url, customer_portal_url",
    )
    .eq("lemon_subscription_id", subscriptionId)
    .maybeSingle();
  const { data: existingAccount } = await adminClient
    .from("orbit_billing_accounts")
    .select("plan, ai_credits_balance")
    .eq("user_id", userId)
    .maybeSingle<BillingAccountRow>();
  const targetPlan = getSubscriptionPlan(
    productType,
    existingSubscription?.plan,
  );
  const currentPlan = isOrbitPlanName(existingAccount?.plan)
    ? existingAccount.plan
    : ORBIT_STARTER_PLAN;
  const rawStatus =
    asString(attributes.status).toLowerCase() ||
    (eventName === "subscription_payment_failed" ? "past_due" : "active");
  const status =
    eventName === "subscription_resumed" ||
    eventName === "subscription_unpaused" ||
    eventName === "subscription_payment_success"
      ? "active"
      : rawStatus;
  const renewsAt = asNullableString(attributes.renews_at);
  const endsAt = asNullableString(attributes.ends_at);
  const trialEndsAt = asNullableString(attributes.trial_ends_at);
  const urls = asObject(attributes.urls);
  const periodKey =
    renewsAt ||
    asNullableString(attributes.billing_period_end) ||
    asNullableString(attributes.created_at) ||
    dataId;
  const plan = getAccountPlanForSubscription({
    currentPlan,
    targetPlan,
    status,
    endsAt,
  });
  const resolvedProductType =
    productType ||
    (targetPlan === "Orbit Pro"
      ? "pro_subscription"
      : "plus_subscription");
  const billingReason = asString(attributes.billing_reason).toLowerCase();
  const shouldGrantMonthlyCredits =
    (eventName === "subscription_created" ||
      (eventName === "subscription_payment_success" &&
        billingReason !== "initial")) &&
    (status === "active" || status === "on_trial") &&
    plan !== ORBIT_STARTER_PLAN;
  const monthlyCredits = getOrbitPlan(plan).includedAiCreditsMonthly;
  let lastCreditPeriodKey =
    asNullableString(existingSubscription?.last_credit_period_key) || null;

  if (shouldGrantMonthlyCredits && monthlyCredits > 0) {
    const creditResult = await grantCredits({
      adminClient,
      userId,
      credits: monthlyCredits,
      reason: `${plan} included monthly AI credits`,
      entryKey:
        eventName === "subscription_payment_success"
          ? `lemon:subscription-payment:${dataId}:${plan}`
          : `lemon:subscription:${subscriptionId}:${periodKey}:${plan}`,
      providerReference: dataId,
      productType: resolvedProductType,
      source: "subscription",
    });

    if (creditResult?.granted || creditResult?.duplicate) {
      lastCreditPeriodKey = periodKey;
    }
  }

  const { error: subscriptionError } = await adminClient
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        provider: "lemon",
        lemon_subscription_id: subscriptionId,
        lemon_customer_id:
          asNullableString(attributes.customer_id) ||
          existingSubscription?.lemon_customer_id ||
          null,
        lemon_order_id:
          asNullableString(attributes.order_id) ||
          existingSubscription?.lemon_order_id ||
          null,
        lemon_variant_id:
          asNullableString(attributes.variant_id) ||
          existingSubscription?.lemon_variant_id ||
          null,
        product_type: resolvedProductType,
        plan: targetPlan,
        status,
        renews_at: renewsAt,
        ends_at: endsAt,
        trial_ends_at: trialEndsAt,
        update_payment_method_url:
          asNullableString(urls.update_payment_method) ||
          existingSubscription?.update_payment_method_url ||
          null,
        customer_portal_url:
          asNullableString(urls.customer_portal) ||
          asNullableString(urls.customer_portal_update_subscription) ||
          existingSubscription?.customer_portal_url ||
          null,
        last_credit_period_key: lastCreditPeriodKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lemon_subscription_id" },
    );

  if (subscriptionError) throw subscriptionError;

  const { error: accountError } = await adminClient
    .from("orbit_billing_accounts")
    .upsert(
      {
        user_id: userId,
        plan,
        subscription_status: status,
        current_period_ends_at: renewsAt || endsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (accountError) throw accountError;
};

const processOrder = async ({
  adminClient,
  userId,
  dataId,
  attributes,
  productType,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  userId: string;
  dataId: string;
  attributes: JsonObject;
  productType: OrbitBillingProductType;
}) => {
  const product = orbitBillingProductCatalog[productType];
  let creditsGranted = 0;

  if (product.purchaseType === "credit_pack" && product.credits) {
    const { data: account } = await adminClient
      .from("orbit_billing_accounts")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = isOrbitPlanName(account?.plan)
      ? account.plan
      : ORBIT_STARTER_PLAN;

    if (product.eligiblePlans?.length && !product.eligiblePlans.includes(plan)) {
      throw new Error("Credit pack does not match the current Orbit plan.");
    }

    const creditResult = await grantCredits({
      adminClient,
      userId,
      credits: product.credits,
      reason: `Lemon Squeezy AI credit pack: ${product.label}`,
      entryKey: `lemon:order:${dataId}:${productType}`,
      providerReference: dataId,
      productType,
      source: "credit_pack",
    });

    creditsGranted =
      creditResult?.granted || creditResult?.duplicate ? product.credits : 0;
  }

  const firstOrderItem = asObject(attributes.first_order_item);
  const { error } = await adminClient.from("billing_orders").upsert(
    {
      user_id: userId,
      provider: "lemon",
      lemon_order_id: dataId,
      lemon_customer_id: asNullableString(attributes.customer_id),
      lemon_variant_id:
        asNullableString(firstOrderItem.variant_id) ||
        asNullableString(attributes.variant_id),
      product_type: productType,
      status: asString(attributes.status) || "paid",
      amount_total: asNumber(attributes.total),
      currency: asNullableString(attributes.currency),
      credits_granted: creditsGranted,
      ordered_at:
        asNullableString(attributes.created_at) || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lemon_order_id" },
  );

  if (error) throw error;
};

export async function POST(request: Request) {
  const secret = getLemonSqueezyWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Lemon Squeezy webhook is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature") || "";

  if (!verifyLemonSqueezyWebhookSignature(rawBody, signature, secret)) {
    console.warn("[lemon-webhook] signature verification failed");
    return NextResponse.json(
      { error: "Invalid Lemon Squeezy webhook signature." },
      { status: 401 },
    );
  }

  let payload: LemonWebhook;
  try {
    payload = JSON.parse(rawBody) as LemonWebhook;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  const eventName = asString(payload.meta?.event_name);
  const lemonEventId = asNullableString(payload.meta?.event_id);
  const dataId = asString(payload.data?.id);
  const attributes = asObject(payload.data?.attributes);
  const customData = asObject(payload.meta?.custom_data);
  const storeId = asString(attributes.store_id);

  if (!eventName || !dataId) {
    return NextResponse.json(
      { error: "Invalid webhook event." },
      { status: 400 },
    );
  }

  if (storeId && storeId !== getLemonSqueezyStoreId()) {
    return NextResponse.json(
      { error: "Webhook store does not match Laboria Orbit." },
      { status: 403 },
    );
  }

  const adminClient = createBillingSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const eventKey = deriveEventKey(eventName, rawBody);
  const { data: existingEvent } = await adminClient
    .from("billing_events")
    .select("processing_status")
    .eq("provider_event_key", eventKey)
    .maybeSingle();

  if (
    existingEvent?.processing_status === "processed" ||
    existingEvent?.processing_status === "ignored" ||
    existingEvent?.processing_status === "processing"
  ) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { error: eventError } = await adminClient.from("billing_events").upsert(
    {
      provider: "lemon",
      provider_event_key: eventKey,
      lemon_event_id: lemonEventId,
      event_name: eventName,
      processing_status: "processing",
      raw_payload: payload,
      error_message: null,
    },
    { onConflict: "provider_event_key" },
  );

  if (eventError) {
    console.error("[lemon-webhook] could not claim event", {
      eventName,
      errorCode: eventError.code || null,
    });
    return NextResponse.json(
      { error: "Could not persist billing event." },
      { status: 500 },
    );
  }

  try {
    const userId = await resolveUserId({
      adminClient,
      customData,
      attributes,
      dataId,
    });

    if (!userId) {
      await markEvent(
        adminClient,
        eventKey,
        "ignored",
        "No Laboria Orbit user reference",
      );
      return NextResponse.json({ received: true, ignored: true });
    }

    await adminClient
      .from("billing_events")
      .update({ user_id: userId })
      .eq("provider_event_key", eventKey);
    await upsertCustomer({ adminClient, userId, attributes });

    const productType = normalizeProductType(customData, attributes);
    const subscriptionEvents = new Set([
      "subscription_created",
      "subscription_updated",
      "subscription_cancelled",
      "subscription_resumed",
      "subscription_expired",
      "subscription_paused",
      "subscription_unpaused",
      "subscription_payment_success",
      "subscription_payment_failed",
    ]);

    if (subscriptionEvents.has(eventName)) {
      await processSubscriptionEvent({
        adminClient,
        eventName,
        userId,
        dataId,
        attributes,
        productType,
      });
    } else if (
      eventName === "order_created" &&
      productType &&
      isPaidOrder(attributes)
    ) {
      await processOrder({
        adminClient,
        userId,
        dataId,
        attributes,
        productType,
      });
    } else {
      await markEvent(
        adminClient,
        eventKey,
        "ignored",
        "Event does not change Orbit billing state",
      );
      return NextResponse.json({ received: true, ignored: true });
    }

    await markEvent(adminClient, eventKey, "processed");
    console.info("[lemon-webhook] verified event processed", {
      eventName,
      dataId,
      userId,
      productType,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Billing event processing failed";
    await markEvent(adminClient, eventKey, "failed", message);
    console.error("[lemon-webhook] verified event processing failed", {
      eventName,
      dataId,
      error: message,
    });
    return NextResponse.json(
      { error: "Could not process verified Lemon Squeezy webhook." },
      { status: 500 },
    );
  }
}
