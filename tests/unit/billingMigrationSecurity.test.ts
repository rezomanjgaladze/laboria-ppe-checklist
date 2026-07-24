import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260725_lemon_squeezy_billing.sql";
const sql = readFileSync(migrationPath, "utf8").toLowerCase();
const compactSql = sql.replace(/\s+/g, " ");

describe("billing migration security contracts", () => {
  it("revokes sensitive SECURITY DEFINER RPCs from browser roles", () => {
    for (const signature of [
      "grant_orbit_ai_credits( uuid, integer, text, text, text, text, text, text )",
      "spend_orbit_ai_credits( uuid, integer, text, text )",
    ]) {
      expect(compactSql).toContain(
        `revoke all on function public.${signature}`,
      );
    }
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("uses stable event and ledger keys for webhook idempotency", () => {
    expect(sql).toContain("on conflict (entry_key) do nothing");
    expect(sql).toContain("provider_event_key text not null unique");
    expect(sql).toContain("lemon_order_id text not null unique");
    expect(sql).toContain("lemon_subscription_id text not null unique");
  });
});
