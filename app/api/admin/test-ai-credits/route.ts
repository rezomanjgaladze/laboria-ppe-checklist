import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import { createClient } from "@/lib/supabase/server";
import { isOrbitAiTestCreditAdmin } from "@/app/lib/orbitAiAdmin";
import type { OrbitAiCreditTopUp } from "@/app/lib/orbitAi";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOrbitAiTestCreditAdmin(user.email)) {
    return NextResponse.json(
      { error: "Unauthorized test credit action." },
      { status: 403 },
    );
  }

  const topUp: OrbitAiCreditTopUp = {
    id: crypto.randomUUID(),
    creditsAdded: 50,
    createdAt: new Date().toISOString(),
    reason: "testing",
  };

  const adminClient = createBillingSupabaseAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await adminClient.rpc("grant_orbit_ai_credits", {
    p_user_id: user.id,
    p_credits: topUp.creditsAdded,
    p_reason: "Testing AI credit top-up",
    p_entry_key: `testing:${topUp.id}`,
    p_provider_reference: null,
    p_provider: null,
    p_product_type: null,
    p_source: "admin_test",
  });

  if (error) {
    console.error("[admin-test-ai-credits] could not add test credits", {
      userId: user.id,
      error,
    });
    return NextResponse.json(
      { error: "Could not add testing credits." },
      { status: 500 },
    );
  }

  return NextResponse.json({ topUp, account: data });
}
