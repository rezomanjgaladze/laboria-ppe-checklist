import { NextResponse } from "next/server";
import { getLemonSqueezySetupStatus } from "@/app/lib/lemonSqueezyBilling";

export const runtime = "nodejs";

export async function GET() {
  const status = getLemonSqueezySetupStatus();

  return NextResponse.json({
    checkoutEnabled: status.checkoutEnabled,
    provider: status.provider,
    missingVariables: status.missingVariables,
    invalidVariables: status.invalidVariables,
    diagnostics: status.diagnostics,
  });
}
