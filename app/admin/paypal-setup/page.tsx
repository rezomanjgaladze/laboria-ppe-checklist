import { notFound } from "next/navigation";
import { isOrbitAiTestCreditAdmin } from "@/app/lib/orbitAiAdmin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PayPalSandboxSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOrbitAiTestCreditAdmin(user.email)) {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06111f] p-6 text-white">
      <section className="w-full max-w-lg rounded-lg border border-cyan-300/20 bg-[#0b1c2f] p-6 shadow-2xl shadow-cyan-950/40">
        <p className="text-xs font-semibold uppercase text-cyan-300">
          Admin-only Sandbox setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Create PayPal product and plans
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This action is Sandbox-only and reuses exact matching Laboria Orbit
          product and plan records.
        </p>
        <form
          action="/api/admin/setup-paypal-sandbox"
          method="post"
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-md bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            Create or reuse Sandbox plans
          </button>
        </form>
      </section>
    </main>
  );
}
