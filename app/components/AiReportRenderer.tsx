"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type {
  AiReportDocument,
  AiReportKpi,
  AiReportTone,
} from "@/app/lib/aiReport";

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const tones: Record<AiReportTone, string> = {
  neutral: "border-slate-400/20 bg-slate-500/10 text-slate-300",
  info: "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#4DEBFF]",
  success: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  critical: "border-rose-400/25 bg-rose-500/10 text-rose-300",
};

const riskCellClass = (score: number) =>
  score >= 15
    ? "border-rose-400/30 bg-rose-500/18 text-rose-200"
    : score >= 4
      ? "border-amber-400/30 bg-amber-500/16 text-amber-200"
      : "border-emerald-400/30 bg-emerald-500/14 text-emerald-200";

export default function AiReportRenderer({
  darkMode,
  report,
}: {
  darkMode: boolean;
  report: AiReportDocument;
}) {
  const theme = {
    shell: darkMode
      ? "border-white/10 bg-white/[0.035]"
      : "border-slate-200 bg-white shadow-sm",
    card: darkMode
      ? "border-white/10 bg-white/[0.045]"
      : "border-slate-200 bg-slate-50",
    soft: darkMode ? "text-slate-300" : "text-slate-700",
    muted: darkMode ? "text-slate-400" : "text-slate-500",
    tableHead: darkMode
      ? "bg-[#0a1b35] text-slate-200"
      : "bg-slate-100 text-slate-700",
    tableRow: darkMode
      ? "border-white/10 text-slate-300"
      : "border-slate-200 text-slate-700",
  };

  return (
    <article className={joinClasses("overflow-hidden rounded-2xl border", theme.shell)}>
      <header className="relative overflow-hidden border-b border-[#4DEBFF]/15 bg-[#071225] px-4 py-5 text-white sm:px-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(77,235,255,0.16),transparent_34%),linear-gradient(110deg,transparent,rgba(30,144,255,0.08))]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4DEBFF]">
              <Sparkles size={14} aria-hidden />
              Laboria Orbit AI Report
              <span className="rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-2 py-1">
                {report.reportType}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">
              {report.title}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-300">{report.subtitle}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-[#4DEBFF]/20 bg-[#4DEBFF]/10 px-3 py-2 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4DEBFF]">
              AI Credits Used
            </div>
            <div className="mt-1 text-lg font-semibold">{report.creditsUsed}</div>
          </div>
        </div>
        <div className="relative mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <span className="inline-flex items-center gap-2">
            <Building2 size={14} className="text-[#4DEBFF]" aria-hidden />
            Prepared for: {report.preparedFor}
          </span>
          <span className="inline-flex items-center gap-2">
            <FileText size={14} className="text-[#4DEBFF]" aria-hidden />
            Source: {report.sourceModule}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={14} className="text-[#4DEBFF]" aria-hidden />
            {formatDate(report.createdAt)}
          </span>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {report.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[#1E90FF]/20 bg-[#1E90FF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#4DEBFF]"
            >
              {tag}
            </span>
          ))}
        </div>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {report.kpis.map((kpi) => (
            <KpiCard key={`${kpi.label}-${kpi.value}`} kpi={kpi} />
          ))}
        </section>

        <ReportSection title="Executive Summary" icon={<Gauge size={16} aria-hidden />} theme={theme}>
          <p className={joinClasses("whitespace-pre-line text-sm leading-6", theme.soft)}>
            {report.executiveSummary}
          </p>
        </ReportSection>

        {report.keyFindings.length ? (
          <ReportSection title="Key Findings" icon={<ShieldAlert size={16} aria-hidden />} theme={theme}>
            <div className="grid gap-2 sm:grid-cols-2">
              {report.keyFindings.map((finding, index) => (
                <div
                  key={`${finding}-${index}`}
                  className={joinClasses("rounded-xl border p-3 text-sm leading-5", theme.card, theme.soft)}
                >
                  <span className="mr-2 font-bold text-[#4DEBFF]">{String(index + 1).padStart(2, "0")}</span>
                  {finding}
                </div>
              ))}
            </div>
          </ReportSection>
        ) : null}

        {report.riskMatrix ? (
          <ReportSection title={report.riskMatrix.title} icon={<BarChart3 size={16} aria-hidden />} theme={theme}>
            <div className="overflow-x-auto">
              <div className="grid min-w-[24rem] grid-cols-6 gap-1">
                <div className={joinClasses("grid min-h-10 place-items-center rounded-lg border p-1 text-center text-[10px] font-bold uppercase", theme.card, theme.muted)}>
                  L / S
                </div>
                {[1, 2, 3, 4, 5].map((severity) => (
                  <div key={severity} className={joinClasses("grid min-h-10 place-items-center rounded-lg border text-xs font-bold", theme.card)}>
                    S{severity}
                  </div>
                ))}
                {report.riskMatrix.counts.map((row, rowIndex) => (
                  <RiskMatrixRow key={`matrix-row-${rowIndex}`} probability={5 - rowIndex} row={row} />
                ))}
              </div>
            </div>
          </ReportSection>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {report.sections.map((section) => (
            <ReportSection key={section.heading} title={section.heading} icon={<ClipboardCheck size={16} aria-hidden />} theme={theme}>
              <p className={joinClasses("whitespace-pre-line text-sm leading-6", theme.soft)}>
                {section.content}
              </p>
            </ReportSection>
          ))}
        </div>

        {report.tables.map((table) => (
          <ReportSection key={table.title} title={table.title} icon={<FileText size={16} aria-hidden />} theme={theme}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr>
                    {table.headers.map((header) => (
                      <th key={header} className={joinClasses("border-b px-3 py-2.5 font-semibold", theme.tableHead)}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.title}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${table.title}-${rowIndex}-${cellIndex}`} className={joinClasses("max-w-xs whitespace-pre-line border-b px-3 py-2.5 align-top leading-5", theme.tableRow)}>
                          {cell || " "}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ))}

        {report.actions.length ? (
          <ReportSection title="Recommended Action Plan" icon={<CheckCircle2 size={16} aria-hidden />} theme={theme}>
            <div className="space-y-2">
              {report.actions.map((action, index) => (
                <div key={`${action.title}-${index}`} className={joinClasses("rounded-xl border p-3", theme.card)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{action.title}</span>
                    <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300">
                      {action.priority}
                    </span>
                  </div>
                  <div className={joinClasses("mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs", theme.muted)}>
                    <span>Owner: {action.owner}</span>
                    <span>Due: {action.dueDate}</span>
                    <span>Status: {action.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          {report.recommendations.length ? (
            <ListSection title="Recommendations" items={report.recommendations} theme={theme} />
          ) : null}
          {report.nextSteps.length ? (
            <ListSection title="Next Steps" items={report.nextSteps} theme={theme} />
          ) : null}
        </div>

        {report.quiz.length ? (
          <ReportSection title="Knowledge Check" icon={<ClipboardCheck size={16} aria-hidden />} theme={theme}>
            <div className="grid gap-2 sm:grid-cols-2">
              {report.quiz.map((item, index) => (
                <div key={`${item.question}-${index}`} className={joinClasses("rounded-xl border p-3", theme.card)}>
                  <div className="text-sm font-semibold">{index + 1}. {item.question}</div>
                  <p className={joinClasses("mt-2 text-xs leading-5", theme.muted)}>
                    Supervisor answer guide: {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </ReportSection>
        ) : null}

        <div className="flex gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{report.reviewNote}</span>
        </div>
      </div>
    </article>
  );
}

function KpiCard({ kpi }: { kpi: AiReportKpi }) {
  return (
    <div className={joinClasses("rounded-xl border p-3", tones[kpi.tone ?? "neutral"])}>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">{kpi.label}</div>
      <div className="mt-2 text-xl font-semibold">{kpi.value}</div>
    </div>
  );
}

function RiskMatrixRow({ probability, row }: { probability: number; row: number[] }) {
  return (
    <>
      <div className="grid min-h-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-bold">
        L{probability}
      </div>
      {row.map((count, index) => (
        <div key={`${probability}-${index}`} className={joinClasses("grid min-h-11 place-items-center rounded-lg border text-sm font-bold", riskCellClass(probability * (index + 1)))}>
          {count}
        </div>
      ))}
    </>
  );
}

function ReportSection({
  children,
  icon,
  theme,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  theme: Record<string, string>;
  title: string;
}) {
  return (
    <section className={joinClasses("rounded-xl border p-3.5 sm:p-4", theme.card)}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#4DEBFF]">
        {icon}
        {title}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ListSection({
  items,
  theme,
  title,
}: {
  items: string[];
  theme: Record<string, string>;
  title: string;
}) {
  return (
    <ReportSection title={title} icon={<CheckCircle2 size={16} aria-hidden />} theme={theme}>
      <ul className={joinClasses("space-y-2 text-sm leading-6", theme.soft)}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#4DEBFF]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}
