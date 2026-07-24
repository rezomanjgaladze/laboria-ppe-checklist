import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log(JSON.stringify({ configured: false }));
  process.exitCode = 2;
} else {
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const tables = [
    "orbit_billing_accounts",
    "billing_customers",
    "billing_subscriptions",
    "billing_orders",
    "billing_events",
    "ai_credit_ledger",
  ];
  const tableReads = [];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    tableReads.push({
      table,
      rowCount: Array.isArray(data) ? data.length : null,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
    });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "spend_orbit_ai_credits",
    {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_credits: 1,
      p_reason: "boundary check",
      p_entry_key: "boundary-check",
    },
  );
  const { data: storageData, error: storageError } = await supabase.storage
    .from("company-logos")
    .list("", { limit: 1 });

  console.log(
    JSON.stringify(
      {
        configured: true,
        tableReads,
        restrictedRpc: {
          returnedData: rpcData !== null,
          errorCode: rpcError?.code || null,
          errorMessage: rpcError?.message || null,
        },
        privateStorageList: {
          itemCount: Array.isArray(storageData) ? storageData.length : null,
          errorCode: storageError?.name || storageError?.statusCode || null,
          errorMessage: storageError?.message || null,
        },
      },
      null,
      2,
    ),
  );
}
