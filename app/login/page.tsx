"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Factory,
  Loader2,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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

const PRODUCTION_SITE_URL = "https://laboria-ppe-checklist.vercel.app";

const platformSignals = [
  { label: "Access", value: "Encrypted", icon: LockKeyhole },
  { label: "Workflow", value: "Inspection Ready", icon: ScanLine },
  { label: "Safety AI", value: "Operational", icon: Activity },
];

const particles = [
  { className: "left-[8%] top-[18%] h-1.5 w-1.5", delay: "0s" },
  { className: "left-[18%] top-[72%] h-1 w-1", delay: "1.3s" },
  { className: "left-[42%] top-[14%] h-2 w-2", delay: "0.5s" },
  { className: "left-[64%] top-[28%] h-1 w-1", delay: "2s" },
  { className: "left-[78%] top-[78%] h-1.5 w-1.5", delay: "0.9s" },
  { className: "left-[92%] top-[42%] h-1 w-1", delay: "1.6s" },
];

function getNextPath() {
  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next");

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

function getSiteOrigin() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/+$/, "");
  }

  if (window.location.hostname === "localhost") {
    return window.location.origin;
  }

  if (window.location.hostname === "127.0.0.1") {
    return window.location.origin;
  }

  return PRODUCTION_SITE_URL;
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

    const redirectTo = new URL("/auth/callback", getSiteOrigin());
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
    <main className="relative min-h-screen overflow-hidden bg-[#071225] text-[#F5F7FA]">
      <div
        aria-hidden
        className="laboria-login-grid absolute inset-0 opacity-55"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(77,235,255,0.16),transparent_30%),radial-gradient(circle_at_82%_64%,rgba(30,144,255,0.18),transparent_34%),linear-gradient(180deg,rgba(7,18,37,0.35),#071225_86%)]"
      />
      <div
        aria-hidden
        className="laboria-login-scan absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#4DEBFF]/70 to-transparent"
      />

      {particles.map((particle) => (
        <span
          aria-hidden
          key={particle.className}
          className={`laboria-login-particle absolute rounded-full bg-[#4DEBFF] shadow-[0_0_20px_rgba(77,235,255,0.85)] ${particle.className}`}
          style={{ animationDelay: particle.delay }}
        />
      ))}

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid w-full gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:items-stretch">
          <div className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-[#4DEBFF]/14 bg-[#F5F7FA]/[0.045] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-8 lg:min-h-[680px] lg:p-10">
            <div
              aria-hidden
              className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#4DEBFF]/70 to-transparent"
            />
            <div
              aria-hidden
              className="absolute -left-28 top-16 h-80 w-80 rounded-full bg-[#1E90FF]/18 blur-[90px]"
            />
            <div
              aria-hidden
              className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full border border-[#4DEBFF]/18"
            />
            <div
              aria-hidden
              className="laboria-login-orbit absolute bottom-12 right-10 hidden h-56 w-56 rounded-full border border-dashed border-[#4DEBFF]/20 lg:block"
            />

            <div className="relative z-10 flex h-full min-h-[512px] flex-col justify-between gap-10 lg:min-h-[600px]">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.055] px-5 py-4 shadow-[0_22px_70px_rgba(30,144,255,0.16)] backdrop-blur-xl sm:px-6 sm:py-5">
                  <Image
                    src="/laboria-logo.png"
                    alt="Laboria"
                    width={430}
                    height={140}
                    className="h-auto w-[210px] object-contain drop-shadow-[0_0_28px_rgba(77,235,255,0.22)] sm:w-[280px] lg:w-[390px]"
                    priority
                  />
                </div>

                <div className="hidden items-center gap-2 rounded-full border border-[#4DEBFF]/20 bg-[#4DEBFF]/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#4DEBFF] lg:flex">
                  <Sparkles size={14} aria-hidden />
                  Secure
                </div>
              </div>

              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#4DEBFF]/18 bg-[#4DEBFF]/8 px-4 py-2 text-sm font-semibold text-[#BFF8FF] shadow-[0_0_30px_rgba(77,235,255,0.08)]">
                  <ShieldCheck size={16} aria-hidden />
                  Laboria Safety System
                </div>

                <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.04] text-[#F5F7FA] sm:text-5xl lg:text-7xl">
                  AI-Powered Industrial Safety Workspace
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Secure access for Laboria inspection teams, auditors, and
                  safety managers.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {platformSignals.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4DEBFF]/18 bg-[#4DEBFF]/10 text-[#4DEBFF]">
                        <Icon size={18} aria-hidden />
                      </div>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#F5F7FA]">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[28px] border border-[#4DEBFF]/16 bg-[#F5F7FA]/[0.07] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div
              aria-hidden
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#1E90FF] to-transparent"
            />
            <div
              aria-hidden
              className="laboria-login-halo absolute -right-24 top-20 h-64 w-64 rounded-full bg-[#4DEBFF]/12 blur-[82px]"
            />

            <div className="relative z-10 flex min-h-[420px] flex-col justify-center">
              <div className="mb-8 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#4DEBFF]/18 bg-[#4DEBFF]/10 text-[#4DEBFF] shadow-[0_0_24px_rgba(77,235,255,0.12)]">
                  <Factory size={22} aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4DEBFF]">
                    Auth Gateway
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Production workspace
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#071225]/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_rgba(0,0,0,0.25)] sm:p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-[#F5F7FA]">
                  Sign in securely
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Continue with your approved Google account to open the
                  checklist workspace.
                </p>

                <div className="mt-7 grid gap-3">
                  {enabledProviders.map((provider) => {
                    const loading = loadingProvider === provider;

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => signInWithProvider(provider)}
                        disabled={checkingSession || loadingProvider !== null}
                        className="group relative flex min-h-14 w-full items-center justify-between overflow-hidden rounded-2xl border border-[#4DEBFF]/24 bg-[#F5F7FA] px-4 py-3 text-sm font-semibold text-[#071225] shadow-[0_18px_48px_rgba(30,144,255,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#4DEBFF] hover:shadow-[0_22px_70px_rgba(77,235,255,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4DEBFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071225] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]"
                        />
                        <span className="relative flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-[#1E90FF] shadow-sm">
                            G
                          </span>
                          <span>{providerOptions[provider].label}</span>
                        </span>
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#071225] text-[#4DEBFF] transition group-hover:bg-[#1E90FF] group-hover:text-white">
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {checkingSession ? (
                  <p
                    className="mt-5 text-sm text-slate-400"
                    aria-live="polite"
                  >
                    Checking secure session...
                  </p>
                ) : null}

                {error ? (
                  <div
                    className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-xs leading-5 text-slate-400">
                Access is limited to authorized Laboria teams through protected
                Google sign-in.
              </div>
            </div>
          </aside>
        </section>
      </div>

      <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Laboria
      </p>
    </main>
  );
}
