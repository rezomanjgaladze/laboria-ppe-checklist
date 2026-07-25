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
  product_type?: unknown;
  plan?: unknown;
  renews_at?: unknown;
  ends_at?: unknown;
  current_period_end?: unknown;
  created_at?: unknown;
};

const normalizeBillingAccount = (
  row: BillingAccountRow | null | undefined,
  subscription?: BillingSubscriptionRow | null,
) => {
  const storedPlan: OrbitPlanName = isOrbitPlanName(row?.plan)
    ? row.plan
    : ORBIT_STARTER_PLAN;
  const subscriptionStatus =
    typeof subscription?.status === "string"
      ? subscription.status.toLowerCase()
      : "inactive";
  const periodEnd =
    typeof subscription?.current_period_end === "string"
      ? subscription.current_period_end
      : typeof subscription?.renews_at === "string"
        ? subscription.renews_at
        : typeof subscription?.ends_at === "string"
          ? subscription.ends_at
          : null;
  const accessExpired =
    periodEnd !== null &&
    Number.isFinite(Date.parse(periodEnd)) &&
    Date.parse(periodEnd) <= Date.now();
  const plan =
    subscriptionStatus === "expired" ||
    (subscriptionStatus === "cancelled" && accessExpired)
      ? ORBIT_STARTER_PLAN
      : storedPlan;
  const credits =
    typeof row?.ai_credits_balance === "number" &&
    Number.isFinite(row.ai_credits_balance) &&
    row.ai_credits_balance >= 0
      ? Math.floor(row.ai_credits_balance)
      : 0;
  const pendingApproval =
    ["approval_pending", "approved"].includes(subscriptionStatus) &&
    (subscription?.product_type === "plus_subscription" ||
      subscription?.product_type === "pro_subscription")
      ? {
          productType: subscription.product_type,
          plan:
            subscription?.plan === "Orbit Plus" ||
            subscription?.plan === "Orbit Pro"
              ? subscription.plan
              : subscription.product_type === "pro_subscription"
                ? "Orbit Pro"
                : "Orbit Plus",
          createdAt:
            typeof subscription.created_at === "string"
              ? subscription.created_at
              : null,
          confirmationPending: subscriptionStatus === "approved",
        }
      : null;

  return {
    plan,
    credits,
    subscriptionStatus,
    renewalDate:
      subscriptionStatus === "active" ? periodEnd : null,
    accessEndsAt:
      subscriptionStatus === "cancelled" ? periodEnd : null,
    updatePaymentMethodUrl: null,
    customerPortalUrl: null,
    pendingApproval,
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
      "status, product_type, plan, renews_at, ends_at, current_period_end, created_at",
    )
    .eq("provider", "paypal")
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

  const normalizedAccount = normalizeBillingAccount(data, subscription);

  if (
    adminClient &&
    data?.plan !== normalizedAccount.plan &&
    normalizedAccount.plan === ORBIT_STARTER_PLAN
  ) {
    const { error: downgradeError } = await adminClient
      .from("orbit_billing_accounts")
      .update({
        plan: ORBIT_STARTER_PLAN,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (downgradeError) {
      console.warn("[orbit-billing-account] could not finalize expired access", {
        userId: user.id,
        errorCode: downgradeError.code || null,
      });
    }
  }

  return NextResponse.json({ account: normalizedAccount });
}
