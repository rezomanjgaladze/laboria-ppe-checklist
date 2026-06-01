import { NextResponse } from "next/server";
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

  return NextResponse.json({ topUp });
}
