import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  ORBIT_STARTER_PLAN,
  isOrbitPlanName,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";

type BillingAccountRow = {
  plan?: unknown;
  ai_credits_balance?: unknown;
};

type SpendResult = {
  spent?: boolean;
  insufficient?: boolean;
  duplicate?: boolean;
  plan?: unknown;
  credits?: unknown;
};

export type OrbitAiServerAccount = {
  plan: OrbitPlanName;
  credits: number;
};

export type OrbitAiCreditCheck =
  | { ok: true; adminClient: SupabaseClient; account: OrbitAiServerAccount }
  | {
      ok: false;
      status: 402 | 503;
      error: string;
      account?: OrbitAiServerAccount;
    };

export type OrbitAiCreditSpend =
  | { ok: true; account: OrbitAiServerAccount }
  | {
      ok: false;
      status: 402 | 500;
      error: string;
      account?: OrbitAiServerAccount;
    };

const normalizeAccount = (
  row: BillingAccountRow | SpendResult | null | undefined,
): OrbitAiServerAccount => ({
  plan: isOrbitPlanName(row?.plan) ? row.plan : ORBIT_STARTER_PLAN,
  credits:
    typeof (row as SpendResult | undefined)?.credits === "number"
      ? Math.max(0, Math.floor((row as SpendResult).credits as number))
      : typeof (row as BillingAccountRow | undefined)?.ai_credits_balance ===
            "number"
        ? Math.max(
            0,
            Math.floor(
              (row as BillingAccountRow).ai_credits_balance as number,
            ),
          )
        : 0,
});

export async function checkOrbitAiCredits(
  userId: string,
  requiredCredits: number,
): Promise<OrbitAiCreditCheck> {
  const adminClient = createBillingSupabaseAdminClient();

  if (!adminClient) {
    return {
      ok: false,
      status: 503,
      error: "AI credit persistence is not configured.",
    };
  }

  const { data, error } = await adminClient
    .from("orbit_billing_accounts")
    .select("plan, ai_credits_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[orbit-ai-credits] account lookup failed", {
      userId,
      error,
    });
    return {
      ok: false,
      status: 503,
      error: "AI credit balance is temporarily unavailable.",
    };
  }

  let account = normalizeAccount(data);

  if (!data) {
    const { data: inserted, error: insertError } = await adminClient
      .from("orbit_billing_accounts")
      .insert({ user_id: userId })
      .select("plan, ai_credits_balance")
      .single();

    if (insertError) {
      console.error("[orbit-ai-credits] account creation failed", {
        userId,
        error: insertError,
      });
      return {
        ok: false,
        status: 503,
        error: "AI credit balance is temporarily unavailable.",
      };
    }

    account = normalizeAccount(inserted);
  }

  if (account.credits < requiredCredits) {
    return {
      ok: false,
      status: 402,
      error: "Not enough AI credits.",
      account,
    };
  }

  return { ok: true, adminClient, account };
}

export async function spendOrbitAiCreditsAfterSuccess(
  adminClient: SupabaseClient,
  userId: string,
  requiredCredits: number,
  entryKey: string,
  reason: string,
): Promise<OrbitAiCreditSpend> {
  const { data, error } = await adminClient.rpc("spend_orbit_ai_credits", {
    p_user_id: userId,
    p_credits: requiredCredits,
    p_reason: reason,
    p_entry_key: entryKey,
  });

  if (error) {
    console.error("[orbit-ai-credits] post-generation spend failed", {
      userId,
      requiredCredits,
      entryKey,
      error,
    });
    return {
      ok: false,
      status: 500,
      error: "Could not update AI credits. Generated content was not released.",
    };
  }

  const result = data as SpendResult | null;
  const account = normalizeAccount(result);

  if (result?.insufficient) {
    return {
      ok: false,
      status: 402,
      error: "Not enough AI credits.",
      account,
    };
  }

  if (!result?.spent) {
    return {
      ok: false,
      status: 500,
      error: result?.duplicate
        ? "This AI generation was already processed."
        : "Could not update AI credits. Generated content was not released.",
      account,
    };
  }

  return { ok: true, account };
}
