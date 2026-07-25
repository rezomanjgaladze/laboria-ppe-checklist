import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  cancelPayPalPendingSubscription,
  inspectPayPalSubscription,
  verifyPayPalSubscriptionReturnState,
} from "@/app/lib/paypalPendingApproval";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paypalSubscriptionIdPattern = /^I-[A-Z0-9]+$/i;

const redirectToBilling = (
  request: Request,
  result: "cancelled" | "pending" | "error",
  message: string,
) => {
  const url = new URL("/", request.url);
  url.searchParams.set("billing", result);
  url.searchParams.set("billing_message", message.slice(0, 180));
  return NextResponse.redirect(url);
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const result = requestUrl.searchParams.get("result");
  const suppliedState = requestUrl.searchParams.get("state") || "";
  const suppliedSubscriptionId =
    requestUrl.searchParams.get("subscription_id") ||
    requestUrl.searchParams.get("token") ||
    "";

  if (result !== "approved" && result !== "cancelled") {
    return redirectToBilling(
      request,
      "error",
      "PayPal returned an invalid subscription result.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToBilling(
      request,
      "error",
      "Sign in to review the PayPal subscription result.",
    );
  }

  if (!verifyPayPalSubscriptionReturnState(user.id, suppliedState)) {
    return redirectToBilling(
      request,
      "error",
      "PayPal returned an invalid or expired approval state.",
    );
  }

  const adminClient = createBillingSupabaseAdminClient();
  if (!adminClient) {
    return redirectToBilling(
      request,
      "error",
      "Billing persistence is not configured.",
    );
  }

  let subscriptionQuery = adminClient
    .from("billing_subscriptions")
    .select("paypal_subscription_id, status")
    .eq("provider", "paypal")
    .eq("user_id", user.id);

  if (
    suppliedSubscriptionId &&
    paypalSubscriptionIdPattern.test(suppliedSubscriptionId)
  ) {
    subscriptionQuery = subscriptionQuery.eq(
      "paypal_subscription_id",
      suppliedSubscriptionId,
    );
  } else {
    subscriptionQuery = subscriptionQuery
      .in("status", ["approval_pending", "approved"])
      .order("updated_at", { ascending: false })
      .limit(1);
  }

  const { data: subscription, error: subscriptionError } =
    await subscriptionQuery.maybeSingle();
  const subscriptionId =
    typeof subscription?.paypal_subscription_id === "string"
      ? subscription.paypal_subscription_id
      : "";

  if (subscriptionError || !subscriptionId) {
    return redirectToBilling(
      request,
      "error",
      "The PayPal approval is not linked to this Orbit account.",
    );
  }

  if (result === "cancelled") {
    const cancellation = await cancelPayPalPendingSubscription(
      subscriptionId,
      "Buyer cancelled Laboria Orbit approval",
    );

    if (!cancellation.cancelled) {
      return redirectToBilling(
        request,
        "error",
        cancellation.error || "PayPal approval could not be cancelled safely.",
      );
    }

    const updatedAt = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("billing_subscriptions")
      .update({
        status: cancellation.status === "expired" ? "expired" : "cancelled",
        cancelled_at: updatedAt,
        updated_at: updatedAt,
      })
      .eq("paypal_subscription_id", subscriptionId);

    if (updateError) {
      return redirectToBilling(
        request,
        "error",
        "PayPal approval was cancelled but Orbit could not update its status.",
      );
    }

    await adminClient
      .from("orbit_billing_accounts")
      .update({
        subscription_status: "cancelled",
        updated_at: updatedAt,
      })
      .eq("user_id", user.id)
      .neq("subscription_status", "active");

    return redirectToBilling(
      request,
      "cancelled",
      "PayPal approval was cancelled. You can restart whenever you are ready.",
    );
  }

  const inspection = await inspectPayPalSubscription(subscriptionId);
  if (!inspection.ok) {
    return redirectToBilling(
      request,
      "pending",
      "Payment confirmation pending.",
    );
  }

  const approved = ["approved", "active"].includes(inspection.status);
  const localStatus = approved ? "approved" : "approval_pending";
  const { error: updateError } = await adminClient
    .from("billing_subscriptions")
    .update({
      status: localStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("paypal_subscription_id", subscriptionId);

  if (updateError) {
    return redirectToBilling(
      request,
      "error",
      "Orbit could not update the PayPal approval status.",
    );
  }

  return redirectToBilling(
    request,
    "pending",
    "Payment confirmation pending.",
  );
}
