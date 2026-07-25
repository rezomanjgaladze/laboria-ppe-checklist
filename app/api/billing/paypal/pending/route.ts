import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  cancelPayPalPendingSubscription,
  inspectPayPalSubscription,
} from "@/app/lib/paypalPendingApproval";
import { isOrbitBillingProductType } from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json(
          { error: "Invalid request origin." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  }

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

  const adminClient = createBillingSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const { data: pending, error: pendingError } = await adminClient
    .from("billing_subscriptions")
    .select("paypal_subscription_id, product_type, status")
    .eq("provider", "paypal")
    .eq("user_id", user.id)
    .in("status", ["approval_pending", "approved"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    return NextResponse.json(
      { error: "Could not load the pending PayPal approval." },
      { status: 503 },
    );
  }

  const subscriptionId =
    typeof pending?.paypal_subscription_id === "string"
      ? pending.paypal_subscription_id
      : "";
  const productType = isOrbitBillingProductType(pending?.product_type)
    ? pending.product_type
    : null;

  if (!subscriptionId || !productType) {
    return NextResponse.json(
      { error: "No pending PayPal approval was found." },
      { status: 404 },
    );
  }

  const inspection = await inspectPayPalSubscription(subscriptionId);
  if (["active", "approved"].includes(inspection.status)) {
    await adminClient
      .from("billing_subscriptions")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("paypal_subscription_id", subscriptionId);

    return NextResponse.json(
      {
        error:
          "Payment confirmation is already pending and this approval cannot be restarted.",
        payment_confirmation_pending: true,
      },
      { status: 409 },
    );
  }

  let finalStatus = inspection.status;
  if (!["cancelled", "expired"].includes(finalStatus)) {
    const cancellation = await cancelPayPalPendingSubscription(
      subscriptionId,
      "Laboria Orbit buyer started approval over",
    );

    if (!cancellation.cancelled) {
      return NextResponse.json(
        {
          error:
            cancellation.error ||
            "The pending PayPal approval could not be cancelled safely.",
        },
        { status: 409 },
      );
    }
    finalStatus = cancellation.status;
  }

  const updatedAt = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("billing_subscriptions")
    .update({
      status: finalStatus === "expired" ? "expired" : "cancelled",
      cancelled_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq("paypal_subscription_id", subscriptionId);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not clear the pending PayPal approval." },
      { status: 503 },
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

  return NextResponse.json({
    cleared: true,
    product_type: productType,
  });
}
