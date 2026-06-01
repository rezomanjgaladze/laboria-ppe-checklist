"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Coins,
  CreditCard,
  Download,
  History,
  Loader2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  getOrbitAiAccount,
  orbitAiAccountUpdatedEvent,
  requestOrbitAiNavigation,
  spendOrbitAiCredits,
  type OrbitAiAccount,
  type OrbitAiSourceModule,
} from "@/app/lib/orbitAi";
import {
  appendToolboxTalk,
  createToolboxTalkId,
  readToolboxTalks,
  toolboxTalksUpdatedEvent,
  type GeneratedToolboxTalk,
  type ToolboxTalkContent,
  type ToolboxTalkInputs,
  type ToolboxTalkVariant,
} from "@/app/lib/toolboxTalks";

type ToolboxTalkGeneratorModalProps = {
  darkMode: boolean;
  userId: string | null;
  defaultVariant: ToolboxTalkVariant;
  sourceModule?: OrbitAiSourceModule;
  onClose: () => void;
};

type ViewMode = "generate" | "result" | "history";

const BASIC_CREDITS = 3;
const QUIZ_CREDITS = 5;
const REVIEW_NOTE =
  "Review and adapt this toolbox talk to your specific workplace conditions before use.";

const defaultInputs: ToolboxTalkInputs = {
  topic: "",
  industrySector: "",
  department: "",
  targetAudience: "",
  duration: "10 minutes",
  language: "English",
  riskLevel: "Medium",
  keyHazardsNotes: "",
};

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const saveToolboxTalkPdf = (talk: GeneratedToolboxTalk) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    pdf.addPage();
    y = 18;
  };

  const addWrapped = (
    text: string,
    options: { size?: number; color?: [number, number, number]; gap?: number } = {},
  ) => {
    const size = options.size ?? 9;
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [51, 65, 85]));
    const lines = pdf.splitTextToSize(text, contentWidth) as string[];
    const height = Math.max(lines.length, 1) * (size * 0.42) + (options.gap ?? 2);
    ensureSpace(height);
    pdf.text(lines, margin, y);
    y += height;
  };

  const addSection = (title: string, body: string | string[]) => {
    ensureSpace(14);
    pdf.setFillColor(235, 247, 255);
    pdf.roundedRect(margin, y - 4, contentWidth, 9, 2, 2, "F");
    pdf.setTextColor(7, 89, 168);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin + 3, y + 2);
    y += 10;
    pdf.setFont("helvetica", "normal");

    if (Array.isArray(body)) {
      body.forEach((item) => addWrapped(`- ${item}`));
    } else {
      addWrapped(body);
    }

    y += 2;
  };

  pdf.setFillColor(7, 18, 37);
  pdf.rect(0, 0, pageWidth, 36, "F");
  pdf.setTextColor(77, 235, 255);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("LABORIA ORBIT", margin, 13);
  pdf.setTextColor(245, 247, 250);
  pdf.setFontSize(18);
  pdf.text("AI Toolbox Talk", margin, 23);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated ${formatDateTime(talk.createdAt)}`, margin, 30);
  y = 46;

  pdf.setTextColor(7, 18, 37);
  pdf.setFont("helvetica", "bold");
  addWrapped(talk.content.title, { size: 16, color: [7, 18, 37], gap: 4 });
  pdf.setFont("helvetica", "normal");
  addWrapped(
    `${talk.inputs.industrySector} | ${talk.inputs.department} | ${talk.inputs.riskLevel} risk | ${talk.content.duration}`,
    { color: [71, 85, 105] },
  );
  y += 3;

  addSection("Objective", talk.content.objective);
  addSection("Target audience", talk.content.targetAudience);
  addSection("Key hazards", talk.content.keyHazards);
  addSection("Main discussion script", talk.content.mainDiscussionScript);
  addSection("Safe work practices", talk.content.safeWorkPractices);
  addSection("Worker questions", talk.content.workerQuestions);
  addSection("Supervisor notes", talk.content.supervisorNotes);
  addSection("Attendance / signature section", talk.content.attendanceSignatureSection);

  if (talk.content.quiz.length) {
    addSection(
      "Knowledge-check quiz",
      talk.content.quiz.map(
        (item, index) => `${index + 1}. ${item.question}\nAnswer: ${item.answer}`,
      ),
    );
  }

  addSection("Closing reminder", talk.content.closingReminder);
  addWrapped(talk.content.reviewNote || REVIEW_NOTE, {
    color: [180, 83, 9],
    size: 9,
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Generated by Laboria Orbit HSE Workspace | Confidential toolbox talk", margin, pageHeight - 6);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, {
      align: "right",
    });
  }

  const fileName = talk.content.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  pdf.save(`${fileName || "laboria-toolbox-talk"}.pdf`);
};

export default function ToolboxTalkGeneratorModal({
  darkMode,
  userId,
  defaultVariant,
  sourceModule,
  onClose,
}: ToolboxTalkGeneratorModalProps) {
  const [variant, setVariant] = useState<ToolboxTalkVariant>(defaultVariant);
  const [inputs, setInputs] = useState<ToolboxTalkInputs>(defaultInputs);
  const [account, setAccount] = useState<OrbitAiAccount>(() =>
    getOrbitAiAccount(userId),
  );
  const [talks, setTalks] = useState<GeneratedToolboxTalk[]>(() =>
    readToolboxTalks(userId),
  );
  const [selectedTalk, setSelectedTalk] = useState<GeneratedToolboxTalk | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("generate");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const requiredCredits = variant === "quiz" ? QUIZ_CREDITS : BASIC_CREDITS;
  const hasEnoughCredits = account.credits >= requiredCredits;
  const completedInputs = useMemo(
    () => Object.values(inputs).filter((value) => value.trim()).length,
    [inputs],
  );
  const theme = {
    panel: darkMode
      ? "border-[#4DEBFF]/22 bg-[#071225] text-white shadow-[0_34px_110px_rgba(0,0,0,0.56)]"
      : "border-[#1E90FF]/20 bg-white text-slate-950 shadow-[0_34px_110px_rgba(15,23,42,0.2)]",
    card: darkMode
      ? "border-white/10 bg-white/[0.045]"
      : "border-slate-200 bg-slate-50",
    muted: darkMode ? "text-slate-400" : "text-slate-600",
    soft: darkMode ? "text-slate-200" : "text-slate-700",
    field: darkMode
      ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#1E90FF]/50",
  };

  useEffect(() => {
    const syncAccount = () => setAccount(getOrbitAiAccount(userId));
    const syncTalks = () => setTalks(readToolboxTalks(userId));

    syncAccount();
    syncTalks();
    window.addEventListener(orbitAiAccountUpdatedEvent, syncAccount);
    window.addEventListener(toolboxTalksUpdatedEvent, syncTalks);

    return () => {
      window.removeEventListener(orbitAiAccountUpdatedEvent, syncAccount);
      window.removeEventListener(toolboxTalksUpdatedEvent, syncTalks);
    };
  }, [userId]);

  const updateInput = (key: keyof ToolboxTalkInputs, value: string) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const openTalk = (talk: GeneratedToolboxTalk) => {
    setSelectedTalk(talk);
    setViewMode("result");
    setError(null);
    setMessage(null);
  };

  const generate = async () => {
    setError(null);
    setMessage(null);

    if (completedInputs !== Object.keys(defaultInputs).length) {
      setError("Please complete every toolbox talk input before generating.");
      return;
    }

    if (!hasEnoughCredits) {
      setError("Not enough AI credits. Upgrade or buy credits.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/toolbox-talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, inputs }),
      });
      const payload = (await response.json()) as {
        content?: ToolboxTalkContent;
        error?: string;
      };

      if (!response.ok || !payload.content) {
        throw new Error(
          payload.error ||
            "Could not generate the toolbox talk. No AI credits were deducted.",
        );
      }

      const updatedAccount = spendOrbitAiCredits(userId, requiredCredits);

      if (!updatedAccount) {
        throw new Error(
          "Your AI credit balance changed before this talk could be saved. No AI credits were deducted.",
        );
      }

      const talk: GeneratedToolboxTalk = {
        id: createToolboxTalkId(),
        userId,
        createdAt: new Date().toISOString(),
        variant,
        creditsUsed: requiredCredits,
        inputs,
        content: payload.content,
      };
      const updatedTalks = appendToolboxTalk(userId, talk);
      setAccount(updatedAccount);
      setTalks(updatedTalks);
      setSelectedTalk(talk);
      setViewMode("result");
      setMessage("Toolbox talk generated and saved to your AI history.");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Could not generate the toolbox talk. No AI credits were deducted.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/72 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-8">
      <button
        type="button"
        aria-label="Close AI Toolbox Talk Generator"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        aria-label="AI Toolbox Talk Generator"
        className={joinClasses(
          "relative z-10 mx-auto my-auto w-full max-w-7xl overflow-hidden rounded-3xl border",
          theme.panel,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(77,235,255,0.15),transparent_25%),radial-gradient(circle_at_100%_18%,rgba(30,144,255,0.12),transparent_28%)]" />
        <header className="relative border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#4DEBFF] shadow-[0_0_28px_rgba(77,235,255,0.12)]">
                <Bot size={21} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
                    Live AI Generation
                  </span>
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                    Orbit AI
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  AI Toolbox Talk Generator
                </h2>
                <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                  {sourceModule || "Training Management"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close AI Toolbox Talk Generator"
              className={joinClasses(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:border-[#4DEBFF]/45",
                theme.card,
              )}
              onClick={onClose}
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        </header>

        <div className="relative flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          {(["generate", "result", "history"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={joinClasses(
                "rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition",
                viewMode === mode
                  ? "border-[#4DEBFF]/35 bg-[#4DEBFF]/12 text-[#4DEBFF]"
                  : theme.card,
              )}
            >
              {mode === "result" ? "Generated talk" : mode}
            </button>
          ))}
        </div>

        <div className="relative grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <main className="min-w-0">
            {viewMode === "generate" ? (
              <GeneratorForm
                account={account}
                completedInputs={completedInputs}
                darkMode={darkMode}
                error={error}
                hasEnoughCredits={hasEnoughCredits}
                inputs={inputs}
                isGenerating={isGenerating}
                message={message}
                requiredCredits={requiredCredits}
                theme={theme}
                variant={variant}
                onGenerate={() => void generate()}
                onUpgrade={() => {
                  onClose();
                  requestOrbitAiNavigation("billing");
                }}
                onInputChange={updateInput}
                onVariantChange={setVariant}
              />
            ) : viewMode === "result" ? (
              selectedTalk ? (
                <ToolboxTalkView
                  darkMode={darkMode}
                  message={message}
                  talk={selectedTalk}
                  theme={theme}
                  onExport={() => saveToolboxTalkPdf(selectedTalk)}
                />
              ) : (
                <EmptyState
                  message="Generate a toolbox talk or choose one from AI generation history."
                  theme={theme}
                />
              )
            ) : talks.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {talks.map((talk) => (
                  <button
                    key={talk.id}
                    type="button"
                    onClick={() => openTalk(talk)}
                    className={joinClasses(
                      "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-[#4DEBFF]/40",
                      theme.card,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ClipboardList size={18} className="shrink-0 text-[#4DEBFF]" aria-hidden />
                      <span className="rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#4DEBFF]">
                        {talk.creditsUsed} credits
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{talk.content.title}</h3>
                    <p className={joinClasses("mt-2 text-xs", theme.muted)}>
                      {formatDateTime(talk.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                message="No toolbox talks have been generated yet."
                theme={theme}
              />
            )}
          </main>

          <aside className="space-y-3">
            <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
                <Coins size={15} aria-hidden />
                AI credit balance
              </div>
              <div className="mt-4 text-3xl font-bold">{account.credits}</div>
              <p className={joinClasses("mt-1 text-xs", theme.muted)}>Credits available</p>
              <div className={joinClasses("mt-4 border-t pt-3 text-xs", darkMode ? "border-white/10" : "border-slate-200")}>
                {account.plan}
              </div>
            </div>

            <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
                  <History size={15} aria-hidden />
                  AI history
                </div>
                <span className="text-sm font-bold">{talks.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {talks.slice(0, 3).map((talk) => (
                  <button
                    key={talk.id}
                    type="button"
                    onClick={() => openTalk(talk)}
                    className={joinClasses(
                      "w-full rounded-xl border px-3 py-2 text-left text-xs transition hover:border-[#4DEBFF]/35",
                      theme.card,
                    )}
                  >
                    <span className="line-clamp-2 font-semibold">{talk.content.title}</span>
                  </button>
                ))}
                {!talks.length ? (
                  <p className={joinClasses("text-xs leading-5", theme.muted)}>
                    Successful generations will be saved here.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function GeneratorForm({
  account,
  completedInputs,
  darkMode,
  error,
  hasEnoughCredits,
  inputs,
  isGenerating,
  message,
  requiredCredits,
  theme,
  variant,
  onGenerate,
  onUpgrade,
  onInputChange,
  onVariantChange,
}: {
  account: OrbitAiAccount;
  completedInputs: number;
  darkMode: boolean;
  error: string | null;
  hasEnoughCredits: boolean;
  inputs: ToolboxTalkInputs;
  isGenerating: boolean;
  message: string | null;
  requiredCredits: number;
  theme: Record<string, string>;
  variant: ToolboxTalkVariant;
  onGenerate: () => void;
  onUpgrade: () => void;
  onInputChange: (key: keyof ToolboxTalkInputs, value: string) => void;
  onVariantChange: (variant: ToolboxTalkVariant) => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Toolbox talk inputs</h3>
          <p className={joinClasses("mt-1 text-xs leading-5", theme.muted)}>
            Add verified operational context. AI credits are deducted only after a successful generation.
          </p>
        </div>
        <span className={joinClasses("text-xs font-semibold", theme.muted)}>
          {completedInputs}/{Object.keys(defaultInputs).length} added
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField label="Topic" value={inputs.topic} placeholder="Working safely at height" theme={theme} onChange={(value) => onInputChange("topic", value)} />
        <TextField label="Industry / Sector" value={inputs.industrySector} placeholder="Construction" theme={theme} onChange={(value) => onInputChange("industrySector", value)} />
        <TextField label="Department" value={inputs.department} placeholder="Site operations" theme={theme} onChange={(value) => onInputChange("department", value)} />
        <TextField label="Target audience" value={inputs.targetAudience} placeholder="Supervisors, workers, contractors" theme={theme} onChange={(value) => onInputChange("targetAudience", value)} />
        <TextField label="Duration" value={inputs.duration} placeholder="10 minutes" theme={theme} onChange={(value) => onInputChange("duration", value)} />
        <SelectField label="Language" value={inputs.language} options={["English", "Georgian", "Spanish", "French", "German"]} theme={theme} onChange={(value) => onInputChange("language", value)} />
        <SelectField label="Risk level" value={inputs.riskLevel} options={["Low", "Medium", "High", "Critical"]} theme={theme} onChange={(value) => onInputChange("riskLevel", value)} />
        <label className="block sm:col-span-2">
          <span className={joinClasses("mb-1.5 block text-xs font-semibold", theme.soft)}>
            Key hazards / notes
          </span>
          <textarea
            rows={4}
            value={inputs.keyHazardsNotes}
            placeholder="Add the verified hazards, site conditions, controls, and any important supervisor notes..."
            className={joinClasses("w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)}
            onChange={(event) => onInputChange("keyHazardsNotes", event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {([
          { id: "basic" as const, title: "Basic Toolbox Talk", credits: BASIC_CREDITS, note: "Professional supervisor-ready talk" },
          { id: "quiz" as const, title: "Toolbox Talk + Quiz", credits: QUIZ_CREDITS, note: "Includes worker knowledge check" },
        ]).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onVariantChange(option.id)}
            className={joinClasses(
              "rounded-2xl border p-4 text-left transition hover:border-[#4DEBFF]/40",
              variant === option.id
                ? "border-[#4DEBFF]/40 bg-[#4DEBFF]/10"
                : theme.card,
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{option.title}</span>
              <span className="text-xs font-bold text-[#4DEBFF]">{option.credits} Credits</span>
            </div>
            <p className={joinClasses("mt-2 text-xs", theme.muted)}>{option.note}</p>
          </button>
        ))}
      </div>

      <div className={joinClasses("mt-5 rounded-2xl border p-4", theme.card)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Coins size={16} className="text-[#4DEBFF]" aria-hidden />
              {requiredCredits} AI Credits required
            </div>
            <p className={joinClasses("mt-1 text-xs", theme.muted)}>
              Current balance: {account.credits} Credits
            </p>
          </div>
          <div
            className={joinClasses(
              "rounded-full border px-3 py-1 text-xs font-bold",
              hasEnoughCredits
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-400"
                : "border-amber-400/25 bg-amber-500/10 text-amber-400",
            )}
          >
            {hasEnoughCredits ? "Credits available" : "Not enough AI credits"}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300" role="alert">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="mt-4 flex gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isGenerating}
          onClick={onGenerate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6] disabled:cursor-wait disabled:opacity-70"
        >
          {isGenerating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
          {isGenerating ? "Generating toolbox talk..." : `Generate Toolbox Talk - ${requiredCredits} Credits`}
        </button>
        {!hasEnoughCredits ? (
          <button
            type="button"
            onClick={onUpgrade}
            className={joinClasses("inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-[#4DEBFF]/45", theme.card)}
          >
            <CreditCard size={16} aria-hidden />
            Buy Credits / Upgrade
          </button>
        ) : null}
      </div>

      <p className={joinClasses("mt-4 text-xs leading-5", darkMode ? "text-amber-200/85" : "text-amber-700")}>
        {REVIEW_NOTE}
      </p>
    </div>
  );
}

function ToolboxTalkView({
  message,
  talk,
  theme,
  onExport,
}: {
  darkMode: boolean;
  message: string | null;
  talk: GeneratedToolboxTalk;
  theme: Record<string, string>;
  onExport: () => void;
}) {
  return (
    <article>
      {message ? (
        <div className="mb-4 flex gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
            Generated toolbox talk
          </div>
          <h3 className="mt-2 text-xl font-semibold">{talk.content.title}</h3>
          <p className={joinClasses("mt-2 text-xs", theme.muted)}>
            {formatDateTime(talk.createdAt)} | {talk.creditsUsed} AI Credits used
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
        >
          <Download size={16} aria-hidden />
          Export PDF
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <ContentSection title="Objective" body={talk.content.objective} theme={theme} />
        <ContentSection title="Target audience" body={talk.content.targetAudience} theme={theme} />
        <ContentSection title="Duration" body={talk.content.duration} theme={theme} />
        <ContentSection title="Key hazards" items={talk.content.keyHazards} theme={theme} />
        <ContentSection title="Main discussion script" body={talk.content.mainDiscussionScript} theme={theme} />
        <ContentSection title="Safe work practices" items={talk.content.safeWorkPractices} theme={theme} />
        <ContentSection title="Worker questions" items={talk.content.workerQuestions} theme={theme} />
        <ContentSection title="Supervisor notes" body={talk.content.supervisorNotes} theme={theme} />
        <ContentSection title="Attendance / signature section" body={talk.content.attendanceSignatureSection} theme={theme} />
        {talk.content.quiz.length ? (
          <ContentSection
            title="Knowledge-check quiz"
            items={talk.content.quiz.map((item) => `${item.question} Answer: ${item.answer}`)}
            theme={theme}
          />
        ) : null}
        <ContentSection title="Closing reminder" body={talk.content.closingReminder} theme={theme} />
      </div>

      <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300">
        {talk.content.reviewNote || REVIEW_NOTE}
      </p>
    </article>
  );
}

function ContentSection({
  title,
  body,
  items,
  theme,
}: {
  title: string;
  body?: string;
  items?: string[];
  theme: Record<string, string>;
}) {
  return (
    <section className={joinClasses("rounded-2xl border p-4", theme.card)}>
      <h4 className="text-sm font-semibold text-[#4DEBFF]">{title}</h4>
      {body ? <p className={joinClasses("mt-2 whitespace-pre-line text-sm leading-6", theme.soft)}>{body}</p> : null}
      {items ? (
        <ul className={joinClasses("mt-2 space-y-2 text-sm leading-6", theme.soft)}>
          {items.map((item, index) => <li key={`${title}-${index}`}>- {item}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function EmptyState({
  message,
  theme,
}: {
  message: string;
  theme: Record<string, string>;
}) {
  return (
    <div className={joinClasses("rounded-2xl border p-8 text-center", theme.card)}>
      <ClipboardList size={24} className="mx-auto text-[#4DEBFF]" aria-hidden />
      <p className={joinClasses("mt-3 text-sm leading-6", theme.muted)}>{message}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  theme,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  theme: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={joinClasses("mb-1.5 block text-xs font-semibold", theme.soft)}>{label}</span>
      <input value={value} placeholder={placeholder} className={joinClasses("w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  theme,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  theme: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={joinClasses("mb-1.5 block text-xs font-semibold", theme.soft)}>{label}</span>
      <select value={value} className={joinClasses("w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
