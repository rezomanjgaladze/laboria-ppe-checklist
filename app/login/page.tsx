"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Fingerprint,
  Gauge,
  GraduationCap,
  Loader2,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
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

const systemReadouts = [
  { label: "Workspace Core", value: "Operational", icon: Activity },
  { label: "Access Layer", value: "Protected", icon: LockKeyhole },
  { label: "Intelligence Layer", value: "Preparing", icon: BrainCircuit },
];

const capabilityPreviews = [
  {
    label: "Inspections",
    value: "Active",
    icon: ClipboardCheck,
    accent: "text-emerald-300",
  },
  {
    label: "Incident Workflow Engine",
    value: "Active",
    icon: TriangleAlert,
    accent: "text-amber-200",
  },
  {
    label: "Risk Assessment Monitoring",
    value: "Active",
    icon: ShieldCheck,
    accent: "text-[#4DEBFF]",
  },
  {
    label: "Training Compliance",
    value: "Active",
    icon: GraduationCap,
    accent: "text-blue-200",
  },
  {
    label: "Operational Analytics",
    value: "Active",
    icon: BarChart3,
    accent: "text-cyan-200",
  },
  {
    label: "AI Intelligence Layer",
    value: "Coming Soon",
    icon: BrainCircuit,
    accent: "text-violet-200",
  },
];

const coordinateMarks = [
  "left-[11%] top-[18%]",
  "left-[17%] top-[74%]",
  "left-[31%] top-[30%]",
  "left-[67%] top-[21%]",
  "left-[82%] top-[68%]",
  "left-[91%] top-[39%]",
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
      <div aria-hidden className="laboria-auth-blueprint absolute inset-0" />
      <div aria-hidden className="laboria-auth-vignette absolute inset-0" />
      <div
        aria-hidden
        className="laboria-auth-scan absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#4DEBFF]/70 to-transparent"
      />
      <div
        aria-hidden
        className="laboria-auth-glow absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E90FF]/16 blur-[110px]"
      />
      <div
        aria-hidden
        className="laboria-auth-corner-glow absolute bottom-[-12rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[#4DEBFF]/12 blur-[96px]"
      />

      {coordinateMarks.map((position, index) => (
        <span
          aria-hidden
          key={position}
          className={`laboria-auth-coordinate absolute hidden h-2 w-2 rounded-full border border-[#4DEBFF]/50 bg-[#071225] shadow-[0_0_22px_rgba(77,235,255,0.45)] sm:block ${position}`}
          style={{ animationDelay: `${index * 0.65}s` }}
        />
      ))}

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-4 py-7 sm:px-6 lg:px-8">
        <div className="relative flex w-full flex-col items-center">
          <div
            aria-hidden
            className="laboria-auth-map absolute left-1/2 top-[46%] hidden h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#4DEBFF]/10 lg:block"
          />
          <div
            aria-hidden
            className="laboria-auth-map laboria-auth-map-reverse absolute left-1/2 top-[46%] hidden h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1E90FF]/15 lg:block"
          />

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#4DEBFF]/18 bg-[#F5F7FA]/[0.055] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#BFF8FF] shadow-[0_0_40px_rgba(77,235,255,0.08)] backdrop-blur-xl">
            <ScanLine size={14} aria-hidden />
            Operational HSE platform access
          </div>

          <div className="relative flex items-center justify-center">
            <div
              aria-hidden
              className="laboria-auth-crosshair absolute h-[min(88vw,34rem)] w-[min(88vw,34rem)] rounded-full border border-[#4DEBFF]/15"
            />
            <div
              aria-hidden
              className="laboria-auth-ring absolute h-[min(78vw,28rem)] w-[min(78vw,28rem)] rounded-full border border-dashed border-[#4DEBFF]/22"
            />
            <div
              aria-hidden
              className="laboria-auth-ring laboria-auth-ring-slow absolute h-[min(62vw,22rem)] w-[min(62vw,22rem)] rounded-full border border-[#1E90FF]/18"
            />

            <div className="relative flex h-[min(58vw,15rem)] w-[min(58vw,15rem)] items-center justify-center rounded-full border border-white/10 bg-[#F5F7FA]/[0.075] p-7 shadow-[0_38px_120px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl sm:h-60 sm:w-60 sm:p-8 lg:h-64 lg:w-64 lg:p-9">
              <div
                aria-hidden
                className="absolute inset-4 rounded-full border border-[#4DEBFF]/12"
              />
              <div
                aria-hidden
                className="laboria-auth-logo-light absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(77,235,255,0.24),transparent_58%)]"
              />
              <div className="relative z-10 rounded-2xl border border-white/60 bg-white px-5 py-4 shadow-[0_22px_70px_rgba(77,235,255,0.22)] sm:px-6 sm:py-5">
                <Image
                  src="/laboria-logo.png"
                  alt="Laboria"
                  width={520}
                  height={170}
                  className="h-auto w-full max-w-[190px] object-contain sm:max-w-[215px] lg:max-w-[230px]"
                  priority
                />
              </div>
            </div>
          </div>

          <div className="mt-5 max-w-4xl text-center sm:mt-6">
            <h1 className="text-balance text-4xl font-semibold leading-[1.02] text-[#F5F7FA] sm:text-5xl lg:text-6xl">
              Laboria HSE Workspace
            </h1>
            <h2 className="mx-auto mt-3 max-w-3xl text-pretty text-xl font-medium leading-tight text-[#BFF8FF] sm:text-2xl">
              Enterprise HSE operational workspace for inspections, incidents,
              training, analytics, and AI-driven safety workflows.
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-pretty text-base leading-7 text-slate-300">
              Integrated industrial safety, risk, incident, training, and
              operational intelligence workspace for modern industrial teams.
            </p>
          </div>

          <div className="hidden w-full max-w-3xl gap-3 lg:absolute lg:top-[13rem] lg:grid lg:max-w-6xl lg:grid-cols-3 lg:px-4">
            {systemReadouts.map((item, index) => {
              const Icon = item.icon;
              const alignment =
                index === 1
                  ? "lg:translate-y-[21rem]"
                  : index === 2
                    ? "lg:justify-self-end"
                    : "";

              return (
                <div
                  key={item.label}
                  className={`laboria-auth-readout rounded-2xl border border-white/10 bg-[#F5F7FA]/[0.055] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl ${alignment}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4DEBFF]/18 bg-[#4DEBFF]/10 text-[#4DEBFF]">
                      <Icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#F5F7FA]">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-300/18 bg-violet-400/[0.07] px-4 py-2 text-xs font-semibold text-violet-100 shadow-[0_0_48px_rgba(139,92,246,0.12)] backdrop-blur-xl">
            <BrainCircuit size={14} aria-hidden />
            Future AI-powered HSE intelligence layer
          </div>

          <div className="relative mt-5 w-full max-w-[31rem] sm:mt-6">
            <div
              aria-hidden
              className="absolute -inset-px rounded-[2rem] bg-gradient-to-r from-[#1E90FF]/35 via-[#4DEBFF]/45 to-[#1E90FF]/20 blur"
            />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071225]/78 p-5 shadow-[0_34px_110px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-6">
              <div
                aria-hidden
                className="laboria-auth-panel-sheen absolute inset-0"
              />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4DEBFF]">
                      Identity gateway
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[#F5F7FA]">
                      Sign in to continue
                    </h3>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/18 bg-[#4DEBFF]/10 text-[#4DEBFF]">
                    <Fingerprint size={21} aria-hidden />
                  </span>
                </div>

                <div className="mt-6 grid gap-3">
                  {enabledProviders.map((provider) => {
                    const loading = loadingProvider === provider;

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => signInWithProvider(provider)}
                        disabled={checkingSession || loadingProvider !== null}
                        className="group relative flex min-h-14 w-full items-center justify-between overflow-hidden rounded-2xl border border-[#4DEBFF]/28 bg-[#F5F7FA] px-4 py-3 text-sm font-semibold text-[#071225] shadow-[0_18px_54px_rgba(30,144,255,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#4DEBFF] hover:shadow-[0_24px_72px_rgba(77,235,255,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4DEBFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071225] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-0 translate-x-[-130%] bg-gradient-to-r from-transparent via-white/75 to-transparent transition-transform duration-700 group-hover:translate-x-[130%]"
                        />
                        <span className="relative flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-[#1E90FF] shadow-sm"
                          >
                            G
                          </span>
                          <span className="truncate">
                            {providerOptions[provider].label}
                          </span>
                        </span>
                        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#071225] text-[#4DEBFF] transition group-hover:bg-[#1E90FF] group-hover:text-white">
                          {loading ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <ArrowRight
                              className="h-4 w-4 transition group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-xs leading-5 text-slate-400">
                  <Gauge
                    className="h-4 w-4 shrink-0 text-[#4DEBFF]"
                    aria-hidden
                  />
                  <span>
                    Secure access for authorized industrial safety and
                    operational teams.
                  </span>
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
            </div>
          </div>

          <div className="mt-7 grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            {capabilityPreviews.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="laboria-auth-capability-card group rounded-2xl border border-white/10 bg-[#F5F7FA]/[0.052] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-[#4DEBFF]/30 hover:bg-[#F5F7FA]/[0.075]"
                  style={{ animationDelay: `${index * 0.22}s` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/18 bg-[#4DEBFF]/10 text-[#4DEBFF] transition group-hover:border-[#4DEBFF]/36 group-hover:bg-[#4DEBFF]/14">
                      <Icon size={19} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F5F7FA]">
                        {item.label}
                      </p>
                      <p
                        className={`mt-1 text-[11px] font-bold uppercase tracking-[0.18em] ${item.accent}`}
                      >
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
