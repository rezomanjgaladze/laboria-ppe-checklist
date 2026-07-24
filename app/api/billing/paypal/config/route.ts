import { NextResponse } from "next/server";
import { getPayPalSetupStatus } from "@/app/lib/paypalBilling";

export const runtime = "nodejs";

export async function GET() {
  const status = getPayPalSetupStatus();

  return NextResponse.json(
    {
      checkoutEnabled: status.checkoutEnabled,
      provider: status.provider,
      mode: status.mode,
      missingVariables: status.missingVariables,
      invalidVariables: status.invalidVariables,
      diagnostics: status.diagnostics,
    },
    { status: status.checkoutEnabled ? 200 : 503 },
  );
}
