"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Coins,
  CreditCard,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import {
  getOrbitAiAccount,
  getOrbitAiTool,
  requestOrbitAiNavigation,
  type OrbitAiContext,
  type OrbitAiSourceModule,
  type OrbitAiToolId,
} from "@/app/lib/orbitAi";

type OrbitAiModalProps = {
  darkMode: boolean;
  toolId: OrbitAiToolId | null;
  context?: OrbitAiContext;
  sourceModule?: OrbitAiSourceModule;
  onClose: () => void;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function OrbitAiModal({
  darkMode,
  toolId,
  context,
  sourceModule,
  onClose,
}: OrbitAiModalProps) {
  const tool = toolId ? getOrbitAiTool(toolId) : null;
  const account = getOrbitAiAccount();
  const requiredCredits = tool?.getCredits(context) ?? 0;
  const hasEnoughCredits = account.credits >= requiredCredits;
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const theme = {
    panel: darkMode
      ? "border-[#4DEBFF]/22 bg-[#071225] text-white shadow-[0_34px_110px_rgba(0,0,0,0.52)]"
      : "border-[#1E90FF]/20 bg-white text-slate-950 shadow-[0_34px_110px_rgba(15,23,42,0.2)]",
    card: darkMode
      ? "border-white/10 bg-white/[0.045]"
      : "border-slate-200 bg-slate-50",
    muted: darkMode ? "text-slate-400" : "text-slate-600",
    soft: darkMode ? "text-slate-300" : "text-slate-700",
    field: darkMode
      ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#1E90FF]/50",
  };

  const closeModal = () => {
    setFormValues({});
    setMessage(null);
    onClose();
  };

  const inputCompletion = useMemo(
    () =>
      tool?.inputs.filter((input) => formValues[input.id]?.trim()).length ?? 0,
    [formValues, tool],
  );

  if (!tool) return null;

  const generatePreview = () => {
    if (!hasEnoughCredits) {
      setMessage("Not enough AI credits. Upgrade or buy credits.");
      return;
    }

    setMessage("AI generation will be activated soon.");
  };

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/68 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-8">
      <button
        type="button"
        aria-label="Close Orbit AI preview"
        className="absolute inset-0 cursor-default"
        onClick={closeModal}
      />
      <section
        aria-label={`${tool.title} preview`}
        className={joinClasses(
          "relative z-10 my-auto w-full max-w-3xl overflow-hidden rounded-3xl border",
          theme.panel,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,235,255,0.15),transparent_28%),radial-gradient(circle_at_100%_22%,rgba(30,144,255,0.12),transparent_30%)]" />
        <div className="relative border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#4DEBFF] shadow-[0_0_28px_rgba(77,235,255,0.12)]">
                <Bot size={21} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                    Enterprise AI
                  </span>
                  <span className="rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
                    Preview Mode
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  {tool.title}
                </h2>
                <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                  {sourceModule || tool.sourceModule}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Orbit AI preview"
              className={joinClasses(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:border-[#4DEBFF]/45",
                theme.card,
              )}
              onClick={closeModal}
            >
              <X size={17} aria-hidden />
            </button>
          </div>
          <p className={joinClasses("mt-4 text-sm leading-6", theme.muted)}>
            {tool.description}
          </p>
        </div>

        <div className="relative grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_16rem]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Required inputs</h3>
                <p className={joinClasses("mt-1 text-xs", theme.muted)}>
                  Add context for the future controlled generation workflow.
                </p>
              </div>
              <span className={joinClasses("text-xs font-semibold", theme.muted)}>
                {inputCompletion}/{tool.inputs.length} added
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {tool.inputs.map((input) => (
                <label key={input.id} className="block">
                  <span className={joinClasses("mb-1.5 block text-xs font-semibold", theme.soft)}>
                    {input.label}
                  </span>
                  {input.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={formValues[input.id] ?? ""}
                      placeholder={input.placeholder}
                      className={joinClasses(
                        "w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition",
                        theme.field,
                      )}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [input.id]: event.target.value,
                        }))
                      }
                    />
                  ) : input.type === "select" ? (
                    <select
                      value={formValues[input.id] ?? ""}
                      className={joinClasses(
                        "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition",
                        theme.field,
                      )}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [input.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">{input.placeholder}</option>
                      {(input.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={formValues[input.id] ?? ""}
                      placeholder={input.placeholder}
                      className={joinClasses(
                        "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition",
                        theme.field,
                      )}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [input.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>

            <div className={joinClasses("mt-5 rounded-2xl border p-4", theme.card)}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#4DEBFF]" aria-hidden />
                <h3 className="text-sm font-semibold">Output preview</h3>
              </div>
              <p className={joinClasses("mt-2 text-xs leading-5", theme.muted)}>
                Generated operational content will appear here after the AI service is
                activated. No external API request is sent in Preview Mode.
              </p>
            </div>
          </div>

          <aside className="space-y-3">
            <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
                <Coins size={15} aria-hidden />
                AI credit check
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={theme.muted}>Required</span>
                  <span className="font-semibold">{requiredCredits} Credits</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={theme.muted}>Available</span>
                  <span className="font-semibold">{account.credits} Credits</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={theme.muted}>Current plan</span>
                  <span className="text-right font-semibold">{account.plan}</span>
                </div>
              </div>
            </div>

            <div
              className={joinClasses(
                "rounded-2xl border p-4 text-xs leading-5",
                hasEnoughCredits
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-400/25 bg-amber-500/10 text-amber-200",
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {hasEnoughCredits ? (
                  <CheckCircle2 size={15} aria-hidden />
                ) : (
                  <Lock size={15} aria-hidden />
                )}
                {hasEnoughCredits ? "Credits available" : "Locked by credit balance"}
              </div>
              {!hasEnoughCredits ? (
                <p className="mt-2">Not enough AI credits. Upgrade or buy credits.</p>
              ) : null}
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
              onClick={generatePreview}
            >
              <Sparkles size={16} aria-hidden />
              Generate Preview
            </button>
            {!hasEnoughCredits ? (
              <button
                type="button"
                className={joinClasses(
                  "flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-[#4DEBFF]/45",
                  theme.card,
                )}
                onClick={() => {
                  closeModal();
                  requestOrbitAiNavigation("billing");
                }}
              >
                <CreditCard size={16} aria-hidden />
                Upgrade / Buy Credits
              </button>
            ) : null}
          </aside>
        </div>

        {message ? (
          <div className="relative border-t border-white/10 px-4 py-3 text-sm font-semibold text-[#4DEBFF] sm:px-6">
            {message}
          </div>
        ) : null}
      </section>
    </div>
  );
}
