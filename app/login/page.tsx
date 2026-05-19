"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Chrome, Loader2, ShieldCheck } from "lucide-react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type OAuthProvider = Extract<Provider, "google" | "facebook">;

const providerOptions: Record<
  OAuthProvider,
  {
    enabled: boolean;
    label: string;
  }
> = {
  google: {
    enabled: true,
    label: "Continue with Google",
  },
  facebook: {
    enabled: false,
    label: "Continue with Facebook",
  },
};

function getNextPath() {
  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next");

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) {
        return;
      }

      if (data.user) {
        router.replace("/");
        return;
      }

      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const signInWithProvider = async (provider: OAuthProvider) => {
    setError("");
    setLoadingProvider(provider);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", getNextPath());

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.toString(),
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoadingProvider(null);
    }
  };

  const enabledProviders = (
    Object.keys(providerOptions) as OAuthProvider[]
  ).filter((provider) => providerOptions[provider].enabled);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_72%_64%,rgba(99,102,241,0.16),transparent_38%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <section className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:grid-cols-[1fr_440px]">
          <div className="flex min-h-[500px] flex-col justify-between p-8 md:p-10">
            <Image
              src="/laboria-logo.png"
              alt="Laboria"
              width={150}
              height={50}
              className="object-contain"
              priority
            />

            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                <ShieldCheck size={16} />
                <span>Laboria Safety System</span>
              </div>

              <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight md:text-6xl">
                PPE checklist access for approved users.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                Sign in to continue to the Laboria inspection workspace.
              </p>
            </div>

            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Laboria
            </p>
          </div>

          <div className="flex items-center bg-white p-6 text-slate-950 md:p-8">
            <div className="w-full">
              <h2 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your Laboria-approved Google account.
              </p>

              <div className="mt-8 grid gap-3">
                {enabledProviders.map((provider) => {
                  const loading = loadingProvider === provider;

                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => signInWithProvider(provider)}
                      disabled={checkingSession || loadingProvider !== null}
                      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Chrome className="h-5 w-5" />
                      )}
                      <span>{providerOptions[provider].label}</span>
                    </button>
                  );
                })}
              </div>

              {checkingSession ? (
                <p className="mt-5 text-sm text-slate-500">
                  Checking access...
                </p>
              ) : null}

              {error ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
