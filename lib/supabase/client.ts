"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
}
