import type { OrbitAiGeneration } from "@/app/lib/orbitAiGenerations";
import type { OrbitAiStructuredRiskAssessment } from "@/app/lib/orbitAiRiskAssessment";
import type { GeneratedToolboxTalk } from "@/app/lib/toolboxTalks";
import type { CompanyProfileSettings } from "@/app/lib/workspaceSettings";

export const AI_REPORT_REVIEW_NOTE =
  "Review and adapt this AI-generated report to your specific workplace conditions before use.";

export type AiReportTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "critical";

export type AiReportKpi = {
  label: string;
  value: string;
  tone?: AiReportTone;
};

export type AiReportTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type AiReportAction = {
  title: string;
  priority: string;
  owner: string;
  dueDate: string;
  status: string;
};

export type AiReportQuizItem = {
  question: string;
  answer: string;
};

export type AiReportRiskMatrix = {
  title: string;
  counts: number[][];
};

export type AiReportDocument = {
  id: string;
  reportType: string;
  title: string;
  subtitle: string;
  sourceModule: string;
  sourceLabel?: string;
  createdAt: string;
  creditsUsed: number;
  preparedFor: string;
  companyProfile: CompanyProfileSettings;
  executiveSummary: string;
  keyFindings: string[];
  kpis: AiReportKpi[];
  sections: Array<{ heading: string; content: string }>;
  tables: AiReportTable[];
  recommendations: string[];
  nextSteps: string[];
  actions: AiReportAction[];
  quiz: AiReportQuizItem[];
  tags: string[];
  reviewNote: string;
  riskMatrix?: AiReportRiskMatrix;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const strings = (value: unknown) =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];

const getRiskLevel = (score: number) =>
  score >= 15 ? "High" : score >= 4 ? "Medium" : "Low";

const riskScore = (
  hazard: OrbitAiStructuredRiskAssessment["hazards"][number],
  type: "initial" | "residual",
) =>
  type === "initial"
    ? hazard.initialProbability * hazard.initialSeverity
    : hazard.residualProbability * hazard.residualSeverity;

const getGenericReportType = (toolId: string) => {
  if (toolId.includes("incident")) return "Incident Investigation";
  if (toolId.includes("inspection")) return "Inspection Intelligence";
  if (toolId.includes("risk") || toolId.includes("hazard")) {
    return "Risk Assessment";
  }
  if (toolId.includes("training") || toolId.includes("toolbox")) {
    return "Training & Competency";
  }
  if (
    toolId.includes("workspace") ||
    toolId.includes("trend") ||
    toolId.includes("executive") ||
    toolId.includes("predictive")
  ) {
    return "Operational Intelligence";
  }
  if (
    toolId.includes("action") ||
    toolId.includes("deadline") ||
    toolId.includes("prioritize")
  ) {
    return "Corrective Action";
  }
  return "Orbit AI Report";
};

const normalizeTable = (value: unknown): AiReportTable | null => {
  if (!value || typeof value !== "object") return null;
  const table = value as Partial<AiReportTable>;
  const headers = strings(table.headers);
  const rows = Array.isArray(table.rows)
    ? table.rows
        .filter(Array.isArray)
        .map((row) => row.map((cell) => text(cell)))
        .filter((row) => row.some(Boolean))
    : [];
  if (!text(table.title) || !headers.length || !rows.length) return null;
  return { title: text(table.title), headers, rows };
};

const normalizeAction = (value: unknown): AiReportAction | null => {
  if (!value || typeof value !== "object") return null;
  const action = value as Partial<AiReportAction>;
  if (!text(action.title)) return null;
  return {
    title: text(action.title),
    priority: text(action.priority) || "Review",
    owner: text(action.owner) || "To be assigned",
    dueDate: text(action.dueDate) || "To be agreed",
    status: text(action.status) || "Proposed",
  };
};

const normalizeQuiz = (value: unknown): AiReportQuizItem | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AiReportQuizItem>;
  if (!text(item.question)) return null;
  return {
    question: text(item.question),
    answer: text(item.answer) || "Supervisor review required",
  };
};

const parsePlainTextSections = (value: string) => {
  const blocks = value
    .split(/\n(?=[A-Z][A-Za-z0-9 /&-]{2,48}:?\s*$)/m)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length < 2) return [];

  return blocks.map((block, index) => {
    const [firstLine, ...rest] = block.split("\n");
    const cleanHeading = firstLine.replace(/:$/, "").trim();
    return {
      heading: cleanHeading || `Report Section ${index + 1}`,
      content: rest.join("\n").trim() || firstLine,
    };
  });
};

const riskAssessmentReportParts = (
  assessment: OrbitAiStructuredRiskAssessment,
) => {
  const hazards = assessment.hazards;
  const highInitial = hazards.filter((hazard) => riskScore(hazard, "initial") >= 15);
  const highResidual = hazards.filter(
    (hazard) => riskScore(hazard, "residual") >= 15,
  );
  const openActions = hazards.filter((hazard) => hazard.status !== "Closed");
  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);

  hazards.forEach((hazard) => {
    matrix[5 - hazard.residualProbability][hazard.residualSeverity - 1] += 1;
  });

  return {
    kpis: [
      { label: "Total Hazards", value: String(hazards.length), tone: "info" as const },
      {
        label: "High Initial Risks",
        value: String(highInitial.length),
        tone: highInitial.length ? ("critical" as const) : ("success" as const),
      },
      {
        label: "High Residual Risks",
        value: String(highResidual.length),
        tone: highResidual.length ? ("critical" as const) : ("success" as const),
      },
      {
        label: "Open Actions",
        value: String(openActions.length),
        tone: openActions.length ? ("warning" as const) : ("success" as const),
      },
    ],
    keyFindings: hazards
      .slice()
      .sort((left, right) => riskScore(right, "residual") - riskScore(left, "residual"))
      .slice(0, 6)
      .map(
        (hazard) =>
          `${hazard.hazardDescription} - residual risk ${getRiskLevel(
            riskScore(hazard, "residual"),
          )} (${riskScore(hazard, "residual")})`,
      ),
    riskMatrix: {
      title: "Residual Risk Matrix",
      counts: matrix,
    },
    table: {
      title: "Editable Hazard Register",
      headers: [
        "Activity / Hazard",
        "Consequence",
        "Existing Controls",
        "Initial",
        "Additional Controls",
        "Residual",
        "Owner / Status",
      ],
      rows: hazards.map((hazard) => [
        `${hazard.workplaceActivity}\n${hazard.hazardDescription}`,
        hazard.possibleConsequence,
        hazard.existingMeasures,
        `${getRiskLevel(riskScore(hazard, "initial"))} ${riskScore(hazard, "initial")}`,
        hazard.additionalMeasures,
        `${getRiskLevel(riskScore(hazard, "residual"))} ${riskScore(hazard, "residual")}`,
        `${hazard.responsiblePerson || "To be assigned"}\n${hazard.status}`,
      ]),
    },
  };
};

export const buildOrbitAiReport = (
  generation: OrbitAiGeneration,
  companyProfile: CompanyProfileSettings,
): AiReportDocument => {
  const content = generation.content;
  const assessmentParts = generation.structuredRiskAssessment
    ? riskAssessmentReportParts(generation.structuredRiskAssessment)
    : null;
  const generatedSections = content.sections?.filter(
    (section) => text(section.heading) && text(section.content),
  ) ?? [];
  const sections =
    generatedSections.length > 0
      ? generatedSections
      : parsePlainTextSections(content.executiveSummary);
  const contentKpis = (content.kpis ?? [])
    .filter((kpi) => text(kpi.label) && text(kpi.value))
    .map((kpi) => ({ ...kpi, label: text(kpi.label), value: text(kpi.value) }));
  const contentTables = (content.tables ?? [])
    .map(normalizeTable)
    .filter((table): table is AiReportTable => Boolean(table));
  const contentActions = (content.actions ?? [])
    .map(normalizeAction)
    .filter((action): action is AiReportAction => Boolean(action));
  const contentQuiz = (content.quiz ?? [])
    .map(normalizeQuiz)
    .filter((item): item is AiReportQuizItem => Boolean(item));
  const reportType = content.metadata?.reportType || getGenericReportType(generation.toolId);

  return {
    id: generation.id,
    reportType,
    title: content.title,
    subtitle: `${generation.toolTitle} | Laboria Orbit AI`,
    sourceModule: generation.sourceModule,
    sourceLabel: generation.sourceRecord?.label,
    createdAt: generation.createdAt,
    creditsUsed: generation.creditsUsed,
    preparedFor:
      content.metadata?.preparedFor || companyProfile.companyName || "Orbit Workspace",
    companyProfile,
    executiveSummary: content.executiveSummary,
    keyFindings:
      assessmentParts?.keyFindings.length
        ? assessmentParts.keyFindings
        : content.keyFindings?.length
          ? content.keyFindings
          : content.recommendations.slice(0, 5),
    kpis:
      assessmentParts?.kpis.length
        ? assessmentParts.kpis
        : contentKpis.length
          ? contentKpis
          : [
              { label: "AI Credits Used", value: String(generation.creditsUsed), tone: "info" },
              { label: "Report Sections", value: String(sections.length), tone: "neutral" },
              {
                label: "Recommendations",
                value: String(content.recommendations.length),
                tone: "warning",
              },
            ],
    sections,
    tables: [
      ...(assessmentParts ? [assessmentParts.table] : []),
      ...contentTables,
    ],
    recommendations: content.recommendations,
    nextSteps: content.nextSteps,
    actions: contentActions,
    quiz: contentQuiz,
    tags: [reportType, generation.sourceModule, `${generation.creditsUsed} AI Credits`],
    reviewNote: AI_REPORT_REVIEW_NOTE,
    riskMatrix: assessmentParts?.riskMatrix,
  };
};

export const buildToolboxTalkAiReport = (
  talk: GeneratedToolboxTalk,
  companyProfile: CompanyProfileSettings,
): AiReportDocument => ({
  id: talk.id,
  reportType: "Toolbox Talk",
  title: talk.content.title,
  subtitle: "Supervisor-ready safety briefing | Laboria Orbit AI",
  sourceModule: "Training Management",
  sourceLabel:
    talk.sourceType === "risk_assessment"
      ? `Risk Assessment: ${talk.sourceRiskAssessmentTitle || "Untitled Risk Assessment"}`
      : "Manual topic",
  createdAt: talk.createdAt,
  creditsUsed: talk.creditsUsed,
  preparedFor: companyProfile.companyName || "Orbit Workspace",
  companyProfile,
  executiveSummary: talk.content.objective,
  keyFindings: talk.content.keyHazards,
  kpis: [
    { label: "Duration", value: talk.content.duration, tone: "info" },
    { label: "Risk Level", value: talk.inputs.riskLevel, tone: talk.inputs.riskLevel === "High" || talk.inputs.riskLevel === "Critical" ? "critical" : "warning" },
    { label: "Hazard Focus", value: String(talk.content.keyHazards.length), tone: "warning" },
    { label: "Quiz Questions", value: String(talk.content.quiz.length), tone: talk.content.quiz.length ? "info" : "neutral" },
  ],
  sections: [
    { heading: "Target Audience", content: talk.content.targetAudience },
    { heading: "Main Discussion Script", content: talk.content.mainDiscussionScript },
    { heading: "Supervisor Notes", content: talk.content.supervisorNotes },
    { heading: "Closing Reminder", content: talk.content.closingReminder },
  ],
  tables: [
    {
      title: "Attendance & Signature Register",
      headers: ["No.", "Worker Name", "Role / Team", "Signature"],
      rows: Array.from({ length: 8 }, (_, index) => [
        String(index + 1),
        "",
        "",
        "",
      ]),
    },
  ],
  recommendations: talk.content.safeWorkPractices,
  nextSteps: talk.content.workerQuestions,
  actions: [],
  quiz: talk.content.quiz,
  tags: [
    talk.inputs.industrySector,
    talk.inputs.department,
    `${talk.creditsUsed} AI Credits`,
  ].filter(Boolean),
  reviewNote: AI_REPORT_REVIEW_NOTE,
});
