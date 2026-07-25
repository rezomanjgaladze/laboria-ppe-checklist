import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  getPayPalProductTypeForPlanId,
  getPayPalWebhookId,
  requestPayPalApi,
} from "@/app/lib/paypalBilling";
import {
  parsePayPalCustomId,
  processPayPalCreditPackCapture,
  processPayPalSubscriptionPayment,
} from "@/app/lib/paypalBillingPersistence";
import {
  ORBIT_STARTER_PLAN,
  isOrbitBillingProductType,
  isOrbitPlanName,
  orbitBillingProductCatalog,
  type OrbitBillingProductType,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type PayPalWebhook = {
  id?: unknown;
  event_type?: unknown;
  create_time?: unknown;
  resource?: unknown;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asNullableString = (value: unknown) => asString(value) || null;

const getFirstPurchaseUnit = (resource: JsonObject) => {
  const purchaseUnits = Array.isArray(resource.purchase_units)
    ? resource.purchase_units
    : [];
  return asObject(purchaseUnits[0]);
};

const getRelatedOrderId = (resource: JsonObject) => {
  const supplementaryData = asObject(resource.supplementary_data);
  const relatedIds = asObject(supplementaryData.related_ids);
  return asString(relatedIds.order_id);
};

const getSubscriptionId = (eventName: string, resource: JsonObject) => {
  if (eventName.startsWith("BILLING.SUBSCRIPTION.")) {
    return asString(resource.id);
  }

  return (
    asString(resource.billing_agreement_id) ||
    asString(resource.subscription_id)
  );
};

const getCustomReference = (resource: JsonObject) =>
  parsePayPalCustomId(resource.custom_id) ||
  parsePayPalCustomId(getFirstPurchaseUnit(resource).custom_id);

const getProductType = (
  resource: JsonObject,
  existingProductType?: unknown,
): OrbitBillingProductType | null => {
  const planProductType = getPayPalProductTypeForPlanId(resource.plan_id);
  if (planProductType) return planProductType;

  const customReference = getCustomReference(resource);
  if (customReference) return customReference.productType;

  return isOrbitBillingProductType(existingProductType)
    ? existingProductType
    : null;
};

const getTargetPlan = (
  productType: OrbitBillingProductType | null,
  fallback?: unknown,
) => {
  const configuredPlan = productType
    ? orbitBillingProductCatalog[productType].plan
    : null;
  return configuredPlan || (isOrbitPlanName(fallback) ? fallback : null);
};

const getAccountPlanForStatus = ({
  currentPlan,
  targetPlan,
  status,
  accessEndsAt,
}: {
  currentPlan: OrbitPlanName;
  targetPlan: OrbitPlanName;
  status: string;
  accessEndsAt: string | null;
}) => {
  // Subscription activation confirms buyer approval, but paid entitlement is
  // granted only by the verified PAYMENT.SALE.COMPLETED handler.
  if (status === "active") return currentPlan;
  if (status === "expired") return ORBIT_STARTER_PLAN;
  if (status === "cancelled") {
    const endTime = accessEndsAt ? Date.parse(accessEndsAt) : Number.NaN;
    return Number.isFinite(endTime) && endTime > Date.now()
      ? targetPlan
      : ORBIT_STARTER_PLAN;
  }
  return currentPlan;
};

export const verifyPayPalWebhookSignature = async (
  request: Request,
  webhookEvent: PayPalWebhook,
) => {
  const webhookId = getPayPalWebhookId();
  const transmissionId = request.headers.get("paypal-transmission-id") || "";
  const transmissionTime =
    request.headers.get("paypal-transmission-time") || "";
  const certUrl = request.headers.get("paypal-cert-url") || "";
  const authAlgo = request.headers.get("paypal-auth-algo") || "";
  const transmissionSig =
    request.headers.get("paypal-transmission-sig") || "";

  if (
    !webhookId ||
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  const { response, payload } = await requestPayPalApi<{
    verification_status?: unknown;
  }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  });

  return response.ok && payload?.verification_status === "SUCCESS";
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
  eventName,
  resource,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  eventName: string;
  resource: JsonObject;
}) => {
  const customReference = getCustomReference(resource);
  if (customReference) return customReference.userId;

  const subscriptionId = getSubscriptionId(eventName, resource);
  if (subscriptionId) {
    const { data } = await adminClient
      .from("billing_subscriptions")
      .select("user_id")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }

  const orderId = getRelatedOrderId(resource) || asString(resource.id);
  if (orderId) {
    const { data } = await adminClient
      .from("billing_orders")
      .select("user_id")
      .eq("paypal_order_id", orderId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }

  const subscriber = asObject(resource.subscriber);
  const customerId = asString(subscriber.payer_id);
  if (customerId) {
    const { data } = await adminClient
      .from("billing_customers")
      .select("user_id")
      .eq("paypal_customer_id", customerId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }

  return null;
};

const upsertPayPalCustomer = async ({
  adminClient,
  userId,
  resource,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  userId: string;
  resource: JsonObject;
}) => {
  const subscriber = asObject(resource.subscriber);
  const customerId = asString(subscriber.payer_id);
  if (!customerId) return;

  const { error } = await adminClient.from("billing_customers").upsert(
    {
      user_id: userId,
      provider: "paypal",
      paypal_customer_id: customerId,
      email: asNullableString(subscriber.email_address),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,paypal_customer_id" },
  );

  if (error) throw error;
};

const processSubscriptionLifecycle = async ({
  adminClient,
  eventName,
  userId,
  resource,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  eventName: string;
  userId: string;
  resource: JsonObject;
}) => {
  const subscriptionId = getSubscriptionId(eventName, resource);
  if (!subscriptionId) {
    throw new Error("PayPal subscription event has no subscription ID.");
  }

  const { data: existingSubscription, error: subscriptionLookupError } =
    await adminClient
      .from("billing_subscriptions")
      .select(
        "product_type, plan, status, current_period_end, paypal_plan_id, last_credit_period_key",
      )
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();
  if (subscriptionLookupError) throw subscriptionLookupError;

  const productType = getProductType(
    resource,
    existingSubscription?.product_type,
  );
  const targetPlan = getTargetPlan(productType, existingSubscription?.plan);
  if (
    !productType ||
    !targetPlan ||
    !orbitBillingProductCatalog[productType].plan
  ) {
    throw new Error("PayPal subscription plan is not mapped to Orbit.");
  }

  const statusByEvent: Record<string, string> = {
    "BILLING.SUBSCRIPTION.CREATED": "approval_pending",
    "BILLING.SUBSCRIPTION.ACTIVATED": "active",
    "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
    "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
    "BILLING.SUBSCRIPTION.EXPIRED": "expired",
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "past_due",
  };
  const status =
    statusByEvent[eventName] ||
    asString(resource.status).toLowerCase() ||
    asString(existingSubscription?.status) ||
    "inactive";
  const billingInfo = asObject(resource.billing_info);
  const lastPayment = asObject(billingInfo.last_payment);
  const currentPeriodStart =
    asNullableString(lastPayment.time) ||
    asNullableString(resource.start_time);
  const nextBillingTime = asNullableString(billingInfo.next_billing_time);
  const currentPeriodEnd =
    nextBillingTime ||
    asNullableString(existingSubscription?.current_period_end);
  const cancelledAt =
    status === "cancelled"
      ? asNullableString(resource.status_update_time) ||
        new Date().toISOString()
      : null;
  const updatedAt = new Date().toISOString();
  const { error: subscriptionError } = await adminClient
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        provider: "paypal",
        paypal_subscription_id: subscriptionId,
        paypal_plan_id:
          asNullableString(resource.plan_id) ||
          asNullableString(existingSubscription?.paypal_plan_id),
        product_type: productType,
        plan: targetPlan,
        status,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        renews_at: nextBillingTime,
        cancelled_at: cancelledAt,
        last_credit_period_key:
          asNullableString(existingSubscription?.last_credit_period_key),
        updated_at: updatedAt,
      },
      { onConflict: "paypal_subscription_id" },
    );
  if (subscriptionError) throw subscriptionError;

  const { data: account, error: accountLookupError } = await adminClient
    .from("orbit_billing_accounts")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (accountLookupError) throw accountLookupError;

  const currentPlan = isOrbitPlanName(account?.plan)
    ? account.plan
    : ORBIT_STARTER_PLAN;
  const accountPlan = getAccountPlanForStatus({
    currentPlan,
    targetPlan,
    status,
    accessEndsAt: currentPeriodEnd,
  });
  const { error: accountError } = await adminClient
    .from("orbit_billing_accounts")
    .upsert(
      {
        user_id: userId,
        plan: accountPlan,
        subscription_status: status,
        current_period_ends_at: currentPeriodEnd,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );
  if (accountError) throw accountError;

  await upsertPayPalCustomer({ adminClient, userId, resource });
};

const processRefundOrReversal = async ({
  adminClient,
  eventName,
  resource,
}: {
  adminClient: NonNullable<
    ReturnType<typeof createBillingSupabaseAdminClient>
  >;
  eventName: string;
  resource: JsonObject;
}) => {
  const status = eventName.endsWith("REFUNDED") ? "refunded" : "reversed";
  const orderId = getRelatedOrderId(resource);
  if (orderId) {
    const { error } = await adminClient
      .from("billing_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("paypal_order_id", orderId);
    if (error) throw error;
  }

  const subscriptionId = getSubscriptionId(eventName, resource);
  if (subscriptionId) {
    const { error } = await adminClient
      .from("billing_subscriptions")
      .update({ status: `payment_${status}`, updated_at: new Date().toISOString() })
      .eq("paypal_subscription_id", subscriptionId);
    if (error) throw error;
  }
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  let payload: PayPalWebhook;

  try {
    payload = JSON.parse(rawBody) as PayPalWebhook;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyPayPalWebhookSignature(request, payload);
  } catch (error) {
    console.error("[paypal-webhook] signature verification request failed", {
      error:
        error instanceof Error
          ? error.message
          : "PayPal signature verification failed",
    });
  }

  if (!signatureValid) {
    console.warn("[paypal-webhook] signature verification failed");
    return NextResponse.json(
      { error: "Invalid PayPal webhook signature." },
      { status: 401 },
    );
  }

  const eventName = asString(payload.event_type);
  const eventId = asString(payload.id);
  const resource = asObject(payload.resource);

  if (!eventName || !eventId || !Object.keys(resource).length) {
    return NextResponse.json(
      { error: "Invalid PayPal webhook event." },
      { status: 400 },
    );
  }

  const adminClient = createBillingSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const eventKey = `paypal:${eventId || createHash("sha256").update(rawBody).digest("hex")}`;
  const { data: existingEvent, error: existingEventError } = await adminClient
    .from("billing_events")
    .select("processing_status")
    .eq("provider_event_key", eventKey)
    .maybeSingle();
  if (existingEventError) {
    return NextResponse.json(
      { error: "Could not check billing event history." },
      { status: 500 },
    );
  }
  if (
    existingEvent?.processing_status === "processed" ||
    existingEvent?.processing_status === "ignored" ||
    existingEvent?.processing_status === "processing"
  ) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { error: eventError } = await adminClient.from("billing_events").upsert(
    {
      provider: "paypal",
      provider_event_key: eventKey,
      paypal_event_id: eventId,
      event_name: eventName,
      processing_status: "processing",
      raw_payload: payload,
      error_message: null,
    },
    { onConflict: "provider_event_key" },
  );
  if (eventError) {
    console.error("[paypal-webhook] could not claim event", {
      eventName,
      eventId,
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
      eventName,
      resource,
    });

    if (userId) {
      await adminClient
        .from("billing_events")
        .update({ user_id: userId })
        .eq("provider_event_key", eventKey);
    }

    const subscriptionLifecycleEvents = new Set([
      "BILLING.SUBSCRIPTION.CREATED",
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
    ]);

    if (subscriptionLifecycleEvents.has(eventName)) {
      if (!userId) {
        throw new Error("No Laboria Orbit user reference for subscription.");
      }
      await processSubscriptionLifecycle({
        adminClient,
        eventName,
        userId,
        resource,
      });
    } else if (eventName === "PAYMENT.SALE.COMPLETED") {
      const subscriptionId = getSubscriptionId(eventName, resource);
      const paymentId = asString(resource.id);
      if (!subscriptionId || !paymentId) {
        throw new Error("PayPal subscription payment is missing references.");
      }
      await processPayPalSubscriptionPayment({
        adminClient,
        subscriptionId,
        paymentId,
        eventId,
        paidAt:
          asNullableString(resource.create_time) ||
          asNullableString(payload.create_time),
      });
    } else if (eventName === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = getRelatedOrderId(resource);
      const captureId = asString(resource.id);
      if (!orderId || !captureId) {
        throw new Error("PayPal capture is missing order references.");
      }
      await processPayPalCreditPackCapture({
        adminClient,
        orderId,
        captureId,
        eventId,
      });
    } else if (
      [
        "PAYMENT.CAPTURE.REFUNDED",
        "PAYMENT.CAPTURE.REVERSED",
        "PAYMENT.SALE.REFUNDED",
        "PAYMENT.SALE.REVERSED",
      ].includes(eventName)
    ) {
      await processRefundOrReversal({ adminClient, eventName, resource });
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
    console.info("[paypal-webhook] verified event processed", {
      eventName,
      eventId,
      userId,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Billing event processing failed";
    await markEvent(adminClient, eventKey, "failed", message);
    console.error("[paypal-webhook] verified event processing failed", {
      eventName,
      eventId,
      error: message,
    });
    return NextResponse.json(
      { error: "Could not process verified PayPal webhook." },
      { status: 500 },
    );
  }
}
