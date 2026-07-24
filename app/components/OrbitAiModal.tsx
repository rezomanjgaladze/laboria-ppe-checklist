"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Coins,
  CreditCard,
  Database,
  Download,
  FileText,
  History,
  LoaderCircle,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import {
  canUseOrbitAiTool,
  getOrbitAiAccount,
  getOrbitAiTool,
  orbitAiAccountUpdatedEvent,
  refreshOrbitAiAccount,
  requestOrbitAiNavigation,
  writeOrbitAiAccount,
  type OrbitAiAccount,
  type OrbitAiContext,
  type OrbitAiSourceModule,
  type OrbitAiToolId,
} from "@/app/lib/orbitAi";
import { getOrbitAiToolRequiredPlan } from "@/app/lib/orbitPlans";
import {
  appendOrbitAiGeneration,
  createOrbitAiGenerationId,
  orbitAiGenerationsUpdatedEvent,
  readOrbitAiGenerations,
  readOrbitAiSourceRecords,
  readOrbitAiWorkspaceRecord,
  supportsOrbitAiWorkspaceData,
  type OrbitAiGeneratedContent,
  type OrbitAiGeneration,
  type OrbitAiSourceRecord,
  type OrbitAiSourceMode,
} from "@/app/lib/orbitAiGenerations";
import ToolboxTalkGeneratorModal from "@/app/components/ToolboxTalkGeneratorModal";
import {
  parseOrbitAiStructuredRiskAssessment,
  type OrbitAiStructuredRiskAssessment,
} from "@/app/lib/orbitAiRiskAssessment";
import AiReportRenderer from "@/app/components/AiReportRenderer";
import { buildOrbitAiReport } from "@/app/lib/aiReport";
import { exportAiReportPdf } from "@/app/lib/aiReportPdf";
import { readWorkspaceSettings } from "@/app/lib/workspaceSettings";

type OrbitAiModalProps = {
  darkMode: boolean;
  userId?: string | null;
  toolId: OrbitAiToolId | null;
  context?: OrbitAiContext;
  sourceModule?: OrbitAiSourceModule;
  onRiskAssessmentGenerated?: (
    assessment: OrbitAiStructuredRiskAssessment,
  ) => boolean;
  onClose: () => void;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const OrbitAiSourcePreview = ({
  source,
  theme,
}: {
  source: OrbitAiSourceRecord;
  theme: { muted: string; soft: string };
}) => (
  <div className="mt-3 rounded-xl border border-[#4DEBFF]/20 bg-[#4DEBFF]/[0.06] p-3">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#4DEBFF]">
      <Database size={14} aria-hidden />
      {source.type === "workspace-summary" ? "Workspace Data Preview" : "Selected Orbit Data"}
    </div>
    <p className="mt-2 text-sm font-semibold">{source.label}</p>
    <p className={joinClasses("mt-1 text-xs", theme.muted)}>{source.description}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {source.preview.fields.map((field) => (
        <div key={`${field.label}-${field.value}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className={joinClasses("text-[10px] font-bold uppercase tracking-[0.1em]", theme.muted)}>
            {field.label}
          </div>
          <div className={joinClasses("mt-1 text-xs font-semibold leading-5", theme.soft)}>
            {field.value}
          </div>
        </div>
      ))}
    </div>
    {source.preview.lists?.map((section) => (
      <div key={section.label} className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
        <div className={joinClasses("text-[10px] font-bold uppercase tracking-[0.1em]", theme.muted)}>
          {section.label}
        </div>
        <ul className={joinClasses("mt-1.5 space-y-1 text-xs leading-5", theme.soft)}>
          {section.items.map((item, index) => (
            <li key={`${section.label}-${index}-${item}`} className="flex gap-2">
              <span className="text-[#4DEBFF]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

export default function OrbitAiModal({
  darkMode,
  userId = null,
  toolId,
  context,
  sourceModule,
  onRiskAssessmentGenerated,
  onClose,
}: OrbitAiModalProps) {
  const tool = toolId ? getOrbitAiTool(toolId) : null;
  const [account, setAccount] = useState(() => getOrbitAiAccount(userId));
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [sourceMode, setSourceMode] = useState<OrbitAiSourceMode>("manual");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [generations, setGenerations] = useState(() =>
    readOrbitAiGenerations(userId),
  );
  const [selectedGeneration, setSelectedGeneration] =
    useState<OrbitAiGeneration | null>(null);
  const [viewMode, setViewMode] = useState<"generate" | "history">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requiredCredits = tool?.getCredits(context) ?? 0;
  const hasPlanAccess = tool ? canUseOrbitAiTool(account, tool.id) : true;
  const hasEnoughCredits = account.credits >= requiredCredits;
  const canGenerate = hasPlanAccess && hasEnoughCredits;
  const requiredPlan = tool ? getOrbitAiToolRequiredPlan(tool.id) : null;
  const sourceRecords = useMemo(
    () => (toolId ? readOrbitAiSourceRecords(userId, toolId) : []),
    [toolId, userId],
  );
  const supportsWorkspaceData = Boolean(
    toolId && supportsOrbitAiWorkspaceData(toolId),
  );
  const workspaceSource = useMemo(
    () => (supportsWorkspaceData ? readOrbitAiWorkspaceRecord(userId) : null),
    [supportsWorkspaceData, userId],
  );
  const selectedSource =
    sourceMode === "workspace_data"
      ? workspaceSource
      : sourceRecords.find((record) => record.id === selectedSourceId);
  const toolHistory = generations.filter(
    (generation) => generation.toolId === toolId,
  );
  const companyProfile = useMemo(
    () => readWorkspaceSettings(userId).companyProfile,
    [userId],
  );
  const selectedReport = useMemo(
    () =>
      selectedGeneration
        ? buildOrbitAiReport(selectedGeneration, companyProfile)
        : null,
    [companyProfile, selectedGeneration],
  );

  useEffect(() => {
    const syncAccount = () => setAccount(getOrbitAiAccount(userId));
    const loadBillingAccount = () => {
      void refreshOrbitAiAccount(userId).catch(() => {
        setAccount(getOrbitAiAccount(userId));
      });
    };

    syncAccount();
    loadBillingAccount();
    window.addEventListener(orbitAiAccountUpdatedEvent, syncAccount);
    window.addEventListener("focus", loadBillingAccount);
    return () => {
      window.removeEventListener(orbitAiAccountUpdatedEvent, syncAccount);
      window.removeEventListener("focus", loadBillingAccount);
    };
  }, [userId]);

  useEffect(() => {
    const syncGenerations = () => setGenerations(readOrbitAiGenerations(userId));
    syncGenerations();
    window.addEventListener(orbitAiGenerationsUpdatedEvent, syncGenerations);
    return () =>
      window.removeEventListener(orbitAiGenerationsUpdatedEvent, syncGenerations);
  }, [userId]);

  useEffect(() => {
    setFormValues({});
    setSourceMode("manual");
    setSelectedSourceId("");
    setSelectedGeneration(null);
    setViewMode("generate");
    setMessage(null);
    setError(null);
  }, [toolId]);

  const theme = {
    panel: darkMode
      ? "border-[#4DEBFF]/22 bg-[#071225] text-white shadow-[0_34px_110px_rgba(0,0,0,0.52)]"
      : "border-[#1E90FF]/20 bg-white text-slate-950 shadow-[0_34px_110px_rgba(15,23,42,0.2)]",
    card: darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-slate-50",
    muted: darkMode ? "text-slate-400" : "text-slate-600",
    soft: darkMode ? "text-slate-300" : "text-slate-700",
    field: darkMode
      ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45"
      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#1E90FF]/50",
  };

  const closeModal = () => {
    setFormValues({});
    setMessage(null);
    setError(null);
    onClose();
  };

  if (toolId === "toolbox-talk" || toolId === "toolbox-talk-quiz") {
    return (
      <ToolboxTalkGeneratorModal
        darkMode={darkMode}
        userId={userId}
        defaultVariant={toolId === "toolbox-talk-quiz" ? "quiz" : "basic"}
        sourceModule={sourceModule}
        onClose={closeModal}
      />
    );
  }

  if (!tool) return null;

  const generate = async () => {
    setError(null);
    setMessage(null);

    if (!hasPlanAccess) {
      setError(`${requiredPlan || "A higher Orbit plan"} is required for this AI feature.`);
      return;
    }
    if (!hasEnoughCredits) {
      setError("Not enough AI credits. Upgrade or buy credits.");
      return;
    }
    if (sourceMode === "manual" && !Object.values(formValues).some((value) => value.trim())) {
      setError("Please add operational context before generating.");
      return;
    }
    if (sourceMode !== "manual" && !selectedSource) {
      setError("Please select an existing Orbit record before generating.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/orbit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          toolTitle: tool.title,
          toolDescription: tool.description,
          sourceModule: sourceModule || tool.sourceModule,
          sourceMode,
          context,
          inputs: formValues,
          sourceRecord: selectedSource,
        }),
      });
      const payload = (await response.json()) as {
        content?: OrbitAiGeneratedContent;
        structuredRiskAssessment?: unknown;
        account?: OrbitAiAccount;
        error?: string;
      };

      if (!response.ok || !payload.content || !payload.account) {
        throw new Error(
          payload.error ||
            "Could not generate this Orbit AI draft. No AI credits were deducted.",
        );
      }

      const structuredRiskAssessment =
        tool.id === "risk-assessment-basic"
          ? parseOrbitAiStructuredRiskAssessment(payload.structuredRiskAssessment)
          : null;

      if (tool.id === "risk-assessment-basic" && !structuredRiskAssessment) {
        throw new Error(
          "AI returned an incomplete risk assessment structure. No AI credits were deducted. Please try again.",
        );
      }

      if (
        structuredRiskAssessment &&
        onRiskAssessmentGenerated &&
        !onRiskAssessmentGenerated(structuredRiskAssessment)
      ) {
        throw new Error(
          "Risk assessment import was cancelled. No AI credits were deducted.",
        );
      }

      const generation: OrbitAiGeneration = {
        id: createOrbitAiGenerationId(),
        userId,
        createdAt: new Date().toISOString(),
        toolId: tool.id,
        toolTitle: tool.title,
        sourceModule: sourceModule || tool.sourceModule,
        sourceMode,
        sourceRecord: selectedSource || undefined,
        inputs: formValues,
        creditsUsed: requiredCredits,
        content: payload.content,
        structuredRiskAssessment: structuredRiskAssessment || undefined,
      };
      const updatedGenerations = appendOrbitAiGeneration(userId, generation);
      writeOrbitAiAccount(userId, payload.account);
      setAccount(payload.account);
      setGenerations(updatedGenerations);
      setSelectedGeneration(generation);
      setMessage(
        structuredRiskAssessment && onRiskAssessmentGenerated
          ? "Editable risk assessment created, saved, and added to the Hazard Register."
          : "Orbit AI draft generated and saved to your AI history.",
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Could not generate this Orbit AI draft. No AI credits were deducted.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/72 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-8">
      <button type="button" aria-label="Close Orbit AI" className="absolute inset-0 cursor-default" onClick={closeModal} />
      <section aria-label={tool.title} className={joinClasses("relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border", theme.panel)}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,235,255,0.15),transparent_28%),radial-gradient(circle_at_100%_22%,rgba(30,144,255,0.12),transparent_30%)]" />
        <header className="relative border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#4DEBFF]"><Bot size={21} aria-hidden /></span>
              <div className="min-w-0">
                <span className="rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">Live Orbit AI</span>
                <h2 className="mt-3 text-xl font-semibold sm:text-2xl">{tool.title}</h2>
                <p className={joinClasses("mt-1 text-sm", theme.muted)}>{sourceModule || tool.sourceModule}</p>
              </div>
            </div>
            <button type="button" aria-label="Close Orbit AI" className={joinClasses("grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:border-[#4DEBFF]/45", theme.card)} onClick={closeModal}><X size={17} aria-hidden /></button>
          </div>
          <p className={joinClasses("mt-4 text-sm leading-6", theme.muted)}>{tool.description}</p>
        </header>

        <div className="relative flex gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          {(["generate", "history"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} className={joinClasses("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition", viewMode === mode ? "bg-[#1E90FF] text-white" : theme.card)}>
              {mode === "generate" ? <Sparkles size={14} aria-hidden /> : <History size={14} aria-hidden />}
              {mode === "generate" ? "Generate" : `AI History (${toolHistory.length})`}
            </button>
          ))}
        </div>

        {viewMode === "history" ? (
          <div className="relative grid gap-3 p-4 sm:p-6">
            {toolHistory.length ? toolHistory.map((generation) => (
              <button key={generation.id} type="button" onClick={() => { setSelectedGeneration(generation); setViewMode("generate"); }} className={joinClasses("rounded-2xl border p-4 text-left transition hover:border-[#4DEBFF]/45", theme.card)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{generation.content.title}</span>
                  <span className={joinClasses("text-xs", theme.muted)}>{formatDate(generation.createdAt)}</span>
                </div>
                <p className={joinClasses("mt-2 text-xs leading-5", theme.muted)}>{generation.sourceRecord ? `Generated from ${generation.sourceRecord.type}: ${generation.sourceRecord.label}` : "Generated from manual operational input"}</p>
              </button>
            )) : <p className={joinClasses("rounded-2xl border p-5 text-sm", theme.card, theme.muted)}>No saved AI generations for this tool yet.</p>}
          </div>
        ) : (
          <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_17rem]">
            <div className="space-y-5">
              <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
                <h3 className="text-sm font-semibold">Generation source</h3>
                <div className={joinClasses("mt-3 grid gap-2", supportsWorkspaceData ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                  <button type="button" onClick={() => setSourceMode("manual")} className={joinClasses("rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition", sourceMode === "manual" ? "border-[#4DEBFF]/50 bg-[#4DEBFF]/10 text-[#4DEBFF]" : theme.card)}>Manual Input</button>
                  <button type="button" onClick={() => setSourceMode("existing_data")} className={joinClasses("rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition", sourceMode === "existing_data" ? "border-[#4DEBFF]/50 bg-[#4DEBFF]/10 text-[#4DEBFF]" : theme.card)}>Single Existing Record</button>
                  {supportsWorkspaceData ? <button type="button" onClick={() => setSourceMode("workspace_data")} className={joinClasses("rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition", sourceMode === "workspace_data" ? "border-[#4DEBFF]/50 bg-[#4DEBFF]/10 text-[#4DEBFF]" : theme.card)}>All Workspace Data</button> : null}
                </div>
                {sourceMode === "existing_data" ? (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold">Select Orbit record</label>
                    <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} className={joinClasses("mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none", theme.field)}>
                      <option value="">Select saved operational data...</option>
                      {sourceRecords.map((record) => <option key={record.id} value={record.id}>{record.label} · {record.description}</option>)}
                    </select>
                    {selectedSource ? <OrbitAiSourcePreview source={selectedSource} theme={theme} /> : null}
                  </div>
                ) : null}
                {sourceMode === "workspace_data" && selectedSource ? <OrbitAiSourcePreview source={selectedSource} theme={theme} /> : null}
              </div>

              <div>
                <h3 className="text-sm font-semibold">{sourceMode === "manual" ? "Required operational context" : "Optional focus for selected data"}</h3>
                <div className="mt-3 space-y-3">
                  {tool.inputs.map((input) => (
                    <label key={input.id} className="block">
                      <span className={joinClasses("mb-1.5 block text-xs font-semibold", theme.soft)}>{input.label}</span>
                      {input.type === "textarea" ? (
                        <textarea rows={3} value={formValues[input.id] ?? ""} placeholder={input.placeholder} className={joinClasses("w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)} onChange={(event) => setFormValues((current) => ({ ...current, [input.id]: event.target.value }))} />
                      ) : input.type === "select" ? (
                        <select value={formValues[input.id] ?? ""} className={joinClasses("w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)} onChange={(event) => setFormValues((current) => ({ ...current, [input.id]: event.target.value }))}>
                          <option value="">{input.placeholder}</option>
                          {(input.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input value={formValues[input.id] ?? ""} placeholder={input.placeholder} className={joinClasses("w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition", theme.field)} onChange={(event) => setFormValues((current) => ({ ...current, [input.id]: event.target.value }))} />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {selectedGeneration && selectedReport ? (
                <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><FileText size={16} className="text-[#4DEBFF]" aria-hidden /><h3 className="text-sm font-semibold">Generated Result</h3></div>
                    <button type="button" onClick={() => exportAiReportPdf(selectedReport)} className="inline-flex items-center gap-2 rounded-xl border border-[#4DEBFF]/30 px-3 py-2 text-xs font-semibold text-[#4DEBFF] transition hover:bg-[#4DEBFF]/10"><Download size={14} aria-hidden />Export PDF</button>
                  </div>
                  <div className="mt-4">
                    <AiReportRenderer darkMode={darkMode} report={selectedReport} />
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-3">
              <div className={joinClasses("rounded-2xl border p-4", theme.card)}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#4DEBFF]"><Coins size={15} aria-hidden />AI credit check</div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className={theme.muted}>Required</span><span className="font-semibold">{requiredCredits} Credits</span></div>
                  <div className="flex justify-between gap-3"><span className={theme.muted}>Available</span><span className="font-semibold">{account.credits} Credits</span></div>
                  <div className="flex justify-between gap-3"><span className={theme.muted}>Plan</span><span className="text-right font-semibold">{account.plan}</span></div>
                </div>
              </div>
              <div className={joinClasses("rounded-2xl border p-4 text-xs leading-5", canGenerate ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-amber-400/25 bg-amber-500/10 text-amber-200")}>
                <div className="flex items-center gap-2 font-semibold">{canGenerate ? <CheckCircle2 size={15} aria-hidden /> : <Lock size={15} aria-hidden />}{canGenerate ? "Credits available" : hasPlanAccess ? "Locked by credit balance" : `${requiredPlan} feature`}</div>
                {!hasPlanAccess ? <p className="mt-2">Upgrade to {requiredPlan} to use this intelligence tool.</p> : !hasEnoughCredits ? <p className="mt-2">Not enough AI credits. Upgrade or buy credits.</p> : null}
              </div>
              <button type="button" disabled={isGenerating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6] disabled:cursor-wait disabled:opacity-70" onClick={() => void generate()}>
                {isGenerating ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
                {isGenerating ? "Generating..." : `Generate · ${requiredCredits} Credits`}
              </button>
              {!canGenerate ? <button type="button" className={joinClasses("flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-[#4DEBFF]/45", theme.card)} onClick={() => { closeModal(); requestOrbitAiNavigation("billing"); }}><CreditCard size={16} aria-hidden />Upgrade / Buy Credits</button> : null}
              {message ? <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-300">{message}</p> : null}
              {error ? <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200">{error}</p> : null}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
