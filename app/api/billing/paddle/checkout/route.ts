import { NextResponse } from "next/server";
import {
  createPaddleSupabaseAdminClient,
  getPaddleClientToken,
  getPaddleEnvironment,
  getPaddlePurchase,
  getPaddleSetupStatus,
} from "@/app/lib/paddleBilling";
import { isPaddlePurchaseKey } from "@/app/lib/paddleCatalog";
import {
  ORBIT_STARTER_PLAN,
  isOrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paymentSetupMessage =
  "Payments are being configured. Please contact Laboria.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const status = getPaddleSetupStatus();

  if (!status.checkoutEnabled) {
    console.warn("[paddle-checkout] setup incomplete", {
      userId: user.id,
      missingVariables: status.missingVariables,
      invalidVariables: status.invalidVariables,
    });
    return NextResponse.json(
      {
        error: paymentSetupMessage,
        checkoutEnabled: false,
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    purchaseKey?: unknown;
  } | null;

  if (!isPaddlePurchaseKey(body?.purchaseKey)) {
    return NextResponse.json(
      { error: "Choose a valid Orbit purchase." },
      { status: 400 },
    );
  }

  const adminClient = createPaddleSupabaseAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: paymentSetupMessage, checkoutEnabled: false },
      { status: 503 },
    );
  }

  const purchase = getPaddlePurchase(body.purchaseKey);

  if (purchase.eligiblePlans?.length) {
    const { data: billingAccount, error: billingAccountError } =
      await adminClient
        .from("orbit_billing_accounts")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

    if (billingAccountError) {
      console.error("[paddle-checkout] could not read billing account", {
        userId: user.id,
        purchaseKey: purchase.key,
        error: billingAccountError,
      });
      return NextResponse.json(
        { error: paymentSetupMessage, checkoutEnabled: false },
        { status: 503 },
      );
    }

    const currentPlan = isOrbitPlanName(billingAccount?.plan)
      ? billingAccount.plan
      : ORBIT_STARTER_PLAN;

    if (!purchase.eligiblePlans.includes(currentPlan)) {
      return NextResponse.json(
        {
          error: `This AI credit pack is available for ${purchase.eligiblePlans.join(", ")}.`,
        },
        { status: 403 },
      );
    }
  }

  const checkoutAttemptId = crypto.randomUUID();
  const { error } = await adminClient
    .from("orbit_paddle_checkout_attempts")
    .insert({
      id: checkoutAttemptId,
      user_id: user.id,
      item_key: purchase.key,
      purchase_type: purchase.purchaseType,
      price_id: purchase.priceId,
      requested_plan: purchase.plan || null,
      requested_credits: purchase.credits || 0,
      status: "pending",
    });

  if (error) {
    console.error("[paddle-checkout] could not create checkout attempt", {
      userId: user.id,
      purchaseKey: purchase.key,
      error,
    });
    return NextResponse.json(
      { error: paymentSetupMessage, checkoutEnabled: false },
      { status: 503 },
    );
  }

  console.info("[paddle-checkout] checkout attempt created", {
    userId: user.id,
    purchaseKey: purchase.key,
    checkoutAttemptId,
  });

  return NextResponse.json({
    checkoutEnabled: true,
    checkoutAttemptId,
    clientToken: getPaddleClientToken(),
    environment: getPaddleEnvironment(),
    priceId: purchase.priceId,
    customerEmail: user.email || "",
  });
}
