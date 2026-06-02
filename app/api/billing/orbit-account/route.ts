import { NextResponse } from "next/server";
import { createPaddleSupabaseAdminClient } from "@/app/lib/paddleBilling";
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

const normalizeBillingAccount = (row: BillingAccountRow | null | undefined) => {
  const plan: OrbitPlanName = isOrbitPlanName(row?.plan)
    ? row.plan
    : ORBIT_STARTER_PLAN;
  const credits =
    typeof row?.ai_credits_balance === "number" &&
    Number.isFinite(row.ai_credits_balance) &&
    row.ai_credits_balance >= 0
      ? Math.floor(row.ai_credits_balance)
      : 0;

  return { plan, credits };
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const adminClient = createPaddleSupabaseAdminClient();
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

  return NextResponse.json({ account: normalizeBillingAccount(data) });
}
