import { NextRequest, NextResponse } from "next/server";
import { isOrbitAiTestCreditAdmin } from "@/app/lib/orbitAiAdmin";
import { setupPayPalSandboxCatalog } from "@/app/lib/paypalSandboxSetup";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const isSameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOrbitAiTestCreditAdmin(user.email)) {
    return NextResponse.json(
      { error: "Unauthorized PayPal setup action." },
      { status: 403 },
    );
  }

  try {
    const result = await setupPayPalSandboxCatalog();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PayPal Sandbox setup failed.";
    console.error("[paypal-sandbox-setup] setup failed", {
      adminUserId: user.id,
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
