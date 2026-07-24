import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  ORBIT_STARTER_PLAN,
  isOrbitPlanName,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type BillingAccountRow = {
  plan?: unknown;
  ai_credits_balance?: unknown;
};

type BillingSubscriptionRow = {
  status?: unknown;
  renews_at?: unknown;
  ends_at?: unknown;
  update_payment_method_url?: unknown;
  customer_portal_url?: unknown;
};

const normalizeLemonSqueezyUrl = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const normalizeBillingAccount = (
  row: BillingAccountRow | null | undefined,
  subscription?: BillingSubscriptionRow | null,
) => {
  const plan: OrbitPlanName = isOrbitPlanName(row?.plan)
    ? row.plan
    : ORBIT_STARTER_PLAN;
  const credits =
    typeof row?.ai_credits_balance === "number" &&
    Number.isFinite(row.ai_credits_balance) &&
    row.ai_credits_balance >= 0
      ? Math.floor(row.ai_credits_balance)
      : 0;

  return {
    plan,
    credits,
    subscriptionStatus:
      typeof subscription?.status === "string"
        ? subscription.status
        : "inactive",
    renewalDate:
      typeof subscription?.renews_at === "string"
        ? subscription.renews_at
        : null,
    accessEndsAt:
      typeof subscription?.ends_at === "string" ? subscription.ends_at : null,
    updatePaymentMethodUrl: normalizeLemonSqueezyUrl(
      subscription?.update_payment_method_url,
    ),
    customerPortalUrl: normalizeLemonSqueezyUrl(
      subscription?.customer_portal_url,
    ),
  };
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const adminClient = createBillingSupabaseAdminClient();
  const billingClient = adminClient || supabase;

  const { data, error } = await billingClient
    .from("orbit_billing_accounts")
    .select("plan, ai_credits_balance")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[orbit-billing-account] could not read billing account", {
      userId: user.id,
      error,
    });
    return NextResponse.json({ account: normalizeBillingAccount(null) });
  }

  if (!data && adminClient) {
    const { data: inserted, error: insertError } = await adminClient
      .from("orbit_billing_accounts")
      .insert({ user_id: user.id })
      .select("plan, ai_credits_balance")
      .single();

    if (insertError) {
      console.warn("[orbit-billing-account] could not create billing account", {
        userId: user.id,
        error: insertError,
      });
      return NextResponse.json({ account: normalizeBillingAccount(null) });
    }

    return NextResponse.json({ account: normalizeBillingAccount(inserted) });
  }

  const { data: subscription, error: subscriptionError } = await billingClient
    .from("billing_subscriptions")
    .select(
      "status, renews_at, ends_at, update_payment_method_url, customer_portal_url",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.warn("[orbit-billing-account] could not read subscription", {
      userId: user.id,
      errorCode: subscriptionError.code || null,
    });
  }

  return NextResponse.json({
    account: normalizeBillingAccount(data, subscription),
  });
}
