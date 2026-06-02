import { NextResponse } from "next/server";
import { getPaddleSetupStatus } from "@/app/lib/paddleBilling";

export const runtime = "nodejs";

export async function GET() {
  const status = getPaddleSetupStatus();

  return NextResponse.json({
    checkoutEnabled: status.checkoutEnabled,
    environment: status.environment,
    missingVariables: status.missingVariables,
    invalidVariables: status.invalidVariables,
  });
}
