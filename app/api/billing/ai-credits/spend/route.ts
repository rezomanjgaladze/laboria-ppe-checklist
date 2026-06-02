import { NextResponse } from "next/server";
import { createPaddleSupabaseAdminClient } from "@/app/lib/paddleBilling";
import {
  ORBIT_STARTER_PLAN,
  isOrbitPlanName,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SpendResult = {
  spent?: boolean;
  insufficient?: boolean;
  duplicate?: boolean;
  plan?: unknown;
  credits?: unknown;
};

const normalizeSpendResult = (value: SpendResult | null | undefined) => {
  const plan: OrbitPlanName = isOrbitPlanName(value?.plan)
    ? value.plan
    : ORBIT_STARTER_PLAN;
  const credits =
    typeof value?.credits === "number" &&
    Number.isFinite(value.credits) &&
    value.credits >= 0
      ? Math.floor(value.credits)
      : 0;

  return { plan, credits };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    credits?: unknown;
    reason?: unknown;
    entryKey?: unknown;
  } | null;
  const credits =
    typeof body?.credits === "number" && Number.isFinite(body.credits)
      ? Math.floor(body.credits)
      : 0;

  if (credits <= 0) {
    return NextResponse.json({ error: "Invalid AI credit amount." }, { status: 400 });
  }

  const adminClient = createPaddleSupabaseAdminClient();

  if (!adminClient) {
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const entryKey =
    typeof body?.entryKey === "string" && body.entryKey.trim()
      ? body.entryKey.trim()
      : `ai-spend:${crypto.randomUUID()}`;
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Orbit AI generation";

  const { data, error } = await adminClient.rpc("spend_orbit_ai_credits", {
    p_user_id: user.id,
    p_credits: credits,
    p_reason: reason,
    p_entry_key: entryKey,
  });

  if (error) {
    console.error("[orbit-ai-spend] could not spend credits", {
      userId: user.id,
      credits,
      error,
    });
    return NextResponse.json(
      { error: "Could not update AI credits." },
      { status: 500 },
    );
  }

  const result = data as SpendResult;

  if (result?.insufficient) {
    return NextResponse.json(
      { error: "Not enough AI credits.", account: normalizeSpendResult(result) },
      { status: 402 },
    );
  }

  return NextResponse.json({ account: normalizeSpendResult(result) });
}
