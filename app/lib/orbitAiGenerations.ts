import { ALL_CHECKLISTS, type ChecklistDefinition } from "@/app/data/checklists";
import {
  getActionTrackerStorageKey,
  type HseAction,
} from "@/app/lib/actionTracker";
import { readToolboxTalks } from "@/app/lib/toolboxTalks";
import type {
  OrbitAiSourceModule,
  OrbitAiToolId,
} from "@/app/lib/orbitAi";
import type { OrbitAiStructuredRiskAssessment } from "@/app/lib/orbitAiRiskAssessment";
import type {
  AiReportAction,
  AiReportKpi,
  AiReportQuizItem,
  AiReportTable,
} from "@/app/lib/aiReport";

export type OrbitAiSourceMode = "manual" | "existing_data" | "workspace_data";

export type OrbitAiSourcePreview = {
  fields: Array<{
    label: string;
    value: string;
  }>;
  lists?: Array<{
    label: string;
    items: string[];
  }>;
};

export type OrbitAiSourceRecord = {
  id: string;
  type: string;
  label: string;
  description: string;
  createdAt?: string;
  data: string;
  preview: OrbitAiSourcePreview;
};

export type OrbitAiGeneratedContent = {
  title: string;
  executiveSummary: string;
  keyFindings?: string[];
  kpis?: AiReportKpi[];
  sections: Array<{
    heading: string;
    content: string;
  }>;
  tables?: AiReportTable[];
  recommendations: string[];
  nextSteps: string[];
  actions?: AiReportAction[];
  quiz?: AiReportQuizItem[];
  metadata?: {
    preparedFor: string;
    reportType: string;
  };
  reviewNote: string;
};

export type OrbitAiGeneration = {
  id: string;
  userId: string | null;
  createdAt: string;
  toolId: OrbitAiToolId;
  toolTitle: string;
  sourceModule: OrbitAiSourceModule;
  sourceMode: OrbitAiSourceMode;
  sourceRecord?: OrbitAiSourceRecord;
  inputs: Record<string, string>;
  creditsUsed: number;
  content: OrbitAiGeneratedContent;
  structuredRiskAssessment?: OrbitAiStructuredRiskAssessment;
};

type InspectionRecord = {
  checklist: ChecklistDefinition;
  inspection: Record<string, unknown>;
};

export const orbitAiGenerationsUpdatedEvent =
  "laboria-orbit-ai-generations-updated";

const legacyHistoryKey = "laboria_orbit_ai_generations";
const closedActionStatuses = new Set(["Completed", "Closed"]);
const workspaceTools = new Set<OrbitAiToolId>([
  "workspace-analysis",
  "risk-trends",
  "executive-summary",
  "predictive-warning",
  "prioritize-actions",
  "compliance-assistant",
]);

const getHistoryKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_orbit_ai_generations`
    : legacyHistoryKey;

const getUserStorageKey = (userId: string | null, suffix: string) =>
  userId ? `laboria_${encodeURIComponent(userId)}_${suffix}` : `laboria_${suffix}`;

const readJson = <T>(keys: string[], fallback: T): T => {
  if (typeof window === "undefined") return fallback;

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      return JSON.parse(raw) as T;
    } catch {
      continue;
    }
  }

  return fallback;
};

const compactData = (value: unknown, maxLength = 28000) => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length <= maxLength
    ? serialized
    : `${serialized.slice(0, maxLength)}\n[Additional source data omitted for length]`;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const object = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const array = (value: unknown) => (Array.isArray(value) ? value : []);
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const display = (value: unknown, fallback = "Not specified") =>
  text(value) || fallback;
const list = (items: unknown[], fallback = "No items recorded") => {
  const values = items.map(text).filter(Boolean);
  return values.length ? values : [fallback];
};
const isPast = (value: unknown) => {
  const stringValue = text(value);
  const parsed = new Date(stringValue);
  return Boolean(stringValue) && !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
};
const riskLevel = (score: number) => (score >= 15 ? "High" : score >= 4 ? "Medium" : "Low");
const riskLabel = (score: number) => `${riskLevel(score)} (${score})`;
const getRiskScore = (
  hazard: Record<string, unknown>,
  prefix: "initial" | "residual",
) =>
  number(hazard[`${prefix}Probability`]) *
  number(hazard[`${prefix}Severity`]);

const createRecord = ({
  type,
  id,
  label,
  description,
  createdAt,
  data,
  preview,
}: {
  type: string;
  id: string | number;
  label: string;
  description: string;
  createdAt?: string;
  data: unknown;
  preview: OrbitAiSourcePreview;
}): OrbitAiSourceRecord => ({
  id: `${type}:${id}`,
  type,
  label,
  description,
  createdAt,
  data: compactData(data),
  preview,
});

const readRiskAssessmentData = (userId: string | null) =>
  readJson<Record<string, unknown>[]>(
    [getUserStorageKey(userId, "risk_assessments")],
    [],
  );

const readIncidentData = (userId: string | null) =>
  readJson<Record<string, unknown>[]>(
    [getUserStorageKey(userId, "incident_management")],
    [],
  );

const readInspectionData = (userId: string | null): InspectionRecord[] =>
  ALL_CHECKLISTS.flatMap((checklist) =>
    readJson<Record<string, unknown>[]>(
      [getUserStorageKey(userId, `${checklist.id}_history`)],
      [],
    ).map((inspection) => ({ checklist, inspection })),
  );

const readActionData = (userId: string | null) =>
  readJson<HseAction[]>([getActionTrackerStorageKey(userId)], []);

const readTrainingData = (userId: string | null) =>
  readJson<Record<string, unknown>>(
    [getUserStorageKey(userId, "training_management")],
    {},
  );

const getInspectionFinding = (checklist: ChecklistDefinition, questionId: string) => {
  const [sectionIndex, questionIndex] = questionId.split("-").map(Number);
  return checklist.sections[sectionIndex]?.items[questionIndex]?.EN || questionId;
};

const readRiskAssessments = (userId: string | null) =>
  readRiskAssessmentData(userId).map((assessment, index) => {
    const header = object(assessment.header);
    const hazards = array(assessment.hazards).map(object);
    const title =
      text(header.assessmentTitle) ||
      text(header.title) ||
      text(header.activityTask) ||
      text(header.activity) ||
      `Risk assessment ${index + 1}`;
    const highestInitialRisk = hazards.reduce(
      (highest, hazard) => Math.max(highest, getRiskScore(hazard, "initial")),
      0,
    );
    const highestResidualRisk = hazards.reduce(
      (highest, hazard) => Math.max(highest, getRiskScore(hazard, "residual")),
      0,
    );
    const topHazards = [...hazards]
      .sort((left, right) => getRiskScore(right, "residual") - getRiskScore(left, "residual"))
      .slice(0, 5)
      .map((hazard) => text(hazard.hazardDescription) || text(hazard.workplaceActivity));
    const keyControls = hazards
      .flatMap((hazard) => [
        text(hazard.existingMeasures),
        text(hazard.additionalMeasures),
      ])
      .filter(Boolean)
      .slice(0, 5);

    return createRecord({
      type: "risk-assessment",
      id: String(assessment.id ?? index + 1),
      label: title,
      description: `${text(header.siteLocation) || text(header.site) || "Site not specified"} | ${hazards.length} hazard${hazards.length === 1 ? "" : "s"}`,
      createdAt: text(assessment.savedAt),
      data: assessment,
      preview: {
        fields: [
          { label: "Title", value: title },
          { label: "Site / Location", value: display(header.siteLocation || header.site) },
          { label: "Department", value: display(header.departmentArea || header.department) },
          { label: "Activity / Task", value: display(header.activityTask || header.activity) },
          { label: "Total Hazards", value: String(hazards.length) },
          { label: "Highest Initial Risk", value: highestInitialRisk ? riskLabel(highestInitialRisk) : "Not rated" },
          { label: "Highest Residual Risk", value: highestResidualRisk ? riskLabel(highestResidualRisk) : "Not rated" },
        ],
        lists: [
          { label: "Top Hazards", items: list(topHazards) },
          { label: "Key Controls", items: list(keyControls, "No controls recorded") },
        ],
      },
    });
  });

const readIncidents = (userId: string | null, actions: HseAction[]) =>
  readIncidentData(userId).map((incident, index) =>
    createRecord({
      type: "incident",
      id: String(incident.id ?? index + 1),
      label: text(incident.title) || `Incident ${index + 1}`,
      description: `${text(incident.eventType) || "Recorded event"} | ${text(incident.severity) || "Severity not specified"}`,
      createdAt: text(incident.updatedAt) || text(incident.createdAt),
      data: incident,
      preview: {
        fields: [
          { label: "Incident Title", value: text(incident.title) || `Incident ${index + 1}` },
          { label: "Event Type", value: display(incident.eventType) },
          { label: "Date / Time", value: display(incident.dateTime || incident.updatedAt || incident.createdAt) },
          { label: "Site / Location", value: display(incident.siteLocation) },
          { label: "Severity", value: display(incident.severity) },
          { label: "Affected Person", value: display(incident.affectedPerson) },
          { label: "Actions Created", value: String(actions.filter((action) => action.linkedIncidentId === String(incident.id)).length) },
        ],
        lists: [
          { label: "Immediate Controls", items: list([incident.immediateActionTaken], "No immediate controls recorded") },
          { label: "Description", items: list([incident.description], "No incident description recorded") },
        ],
      },
    }),
  );

const readInspections = (userId: string | null) =>
  readInspectionData(userId).map(({ checklist, inspection }, index) => {
    const result = object(inspection.result);
    const answers = object(inspection.answers);
    const risks = object(inspection.risk);
    const failedIds = Object.entries(answers)
      .filter(([, answer]) => text(answer).toLowerCase() === "no")
      .map(([id]) => id);
    const highRiskIds = Object.entries(risks)
      .filter(([, risk]) => text(risk).toUpperCase() === "H")
      .map(([id]) => id);

    return createRecord({
      type: "inspection",
      id: `${checklist.id}:${String(inspection.id ?? index + 1)}`,
      label: checklist.headerTitleEN,
      description: `${text(inspection.site) || "Site not specified"} | ${Math.round(number(result.percent))}% compliance`,
      createdAt: text(inspection.savedAt) || text(inspection.inspectionDate),
      data: { checklist: checklist.headerTitleEN, inspection },
      preview: {
        fields: [
          { label: "Checklist / Report", value: checklist.headerTitleEN },
          { label: "Site / Location", value: display(inspection.site) },
          { label: "Inspector", value: display(inspection.inspector) },
          { label: "Inspection Date", value: display(inspection.inspectionDate || inspection.savedAt) },
          { label: "Compliance Result", value: `${Math.round(number(result.percent))}% | ${display(result.status, "Status not recorded")}` },
          { label: "High Risk Findings", value: String(highRiskIds.length) },
        ],
        lists: [
          { label: "High Risk Findings", items: list(highRiskIds.map((id) => getInspectionFinding(checklist, id)), "No high-risk findings recorded") },
          { label: "Failed Items / Key Findings", items: list(failedIds.map((id) => getInspectionFinding(checklist, id)), "No failed items recorded") },
        ],
      },
    });
  });

const readActions = (actions: HseAction[]) =>
  actions.map((action) =>
    createRecord({
      type: "action",
      id: action.id,
      label: action.title || "Tracked action",
      description: `${action.priority} priority | ${action.status}`,
      createdAt: action.lastUpdated || action.createdDate,
      data: action,
      preview: {
        fields: [
          { label: "Action Title", value: display(action.title) },
          { label: "Source", value: display(action.sourceModule) },
          { label: "Priority", value: display(action.priority) },
          { label: "Responsible Person", value: display(action.responsiblePerson) },
          { label: "Due Date", value: display(action.dueDate) },
          { label: "Status", value: display(action.status) },
          { label: "Progress", value: `${number(action.progress)}%` },
        ],
      },
    }),
  );

const calculateTrainingCompliance = (training: Record<string, unknown>) => {
  const employees = array(training.employees).map(object);
  const trainingTypes = array(training.trainingTypes).map(object);
  const records = array(training.records).map(object);
  const expected = employees.length * trainingTypes.length;
  if (!expected) return 0;

  const valid = employees.flatMap((employee) =>
    trainingTypes.map((trainingType) =>
      records.some(
        (record) =>
          text(record.employeeId) === text(employee.id) &&
          text(record.trainingTypeId) === text(trainingType.id) &&
          !isPast(record.expiryDate),
      ),
    ),
  ).filter(Boolean).length;

  return Math.round((valid / expected) * 100);
};

const readTraining = (userId: string | null) => {
  const training = readTrainingData(userId);
  const employees = array(training.employees);
  const records = array(training.records);

  return Object.keys(training).length
    ? [
        createRecord({
          type: "training",
          id: "workspace",
          label: "Training compliance workspace",
          description: `${employees.length} employee${employees.length === 1 ? "" : "s"} | ${records.length} training record${records.length === 1 ? "" : "s"}`,
          data: training,
          preview: {
            fields: [
              { label: "Training Workspace", value: "Employee competency and compliance records" },
              { label: "Employees", value: String(employees.length) },
              { label: "Training Records", value: String(records.length) },
              { label: "Compliance", value: `${calculateTrainingCompliance(training)}%` },
            ],
          },
        }),
      ]
    : [];
};

const readToolboxTalkRecords = (userId: string | null) =>
  readToolboxTalks(userId).map((talk) =>
    createRecord({
      type: "toolbox-talk",
      id: talk.id,
      label: talk.content.title,
      description: `${talk.variant === "quiz" ? "Toolbox talk + quiz" : "Toolbox talk"} | ${talk.inputs.department || "Department not specified"}`,
      createdAt: talk.createdAt,
      data: talk,
      preview: {
        fields: [
          { label: "Training / Toolbox Title", value: display(talk.content.title) },
          { label: "Topic", value: display(talk.inputs.topic) },
          { label: "Audience", value: display(talk.inputs.targetAudience) },
          { label: "Duration", value: display(talk.inputs.duration) },
          { label: "Source", value: talk.sourceRiskAssessmentTitle ? `Risk Assessment: ${talk.sourceRiskAssessmentTitle}` : "Manual topic" },
          { label: "Generated Date", value: display(talk.createdAt) },
          { label: "Quiz Included", value: talk.variant === "quiz" ? "Yes" : "No" },
        ],
      },
    }),
  );

const getRelevantTypes = (toolId: OrbitAiToolId) => {
  if (
    toolId === "risk-assessment-basic" ||
    toolId === "suggest-hazards" ||
    toolId === "recommend-controls" ||
    toolId === "risk-review-advanced"
  ) {
    return new Set(["risk-assessment", "inspection", "incident"]);
  }

  if (toolId === "training-material" || toolId === "training-quiz") {
    return new Set(["toolbox-talk", "risk-assessment", "inspection", "incident"]);
  }

  if (
    toolId === "incident-investigation" ||
    toolId === "incident-root-causes" ||
    toolId === "incident-report"
  ) {
    return new Set(["incident"]);
  }

  if (
    toolId === "inspection-analysis" ||
    toolId === "inspection-summary" ||
    toolId === "inspection-actions"
  ) {
    return new Set(["inspection"]);
  }

  if (
    toolId === "corrective-actions" ||
    toolId === "prioritize-actions" ||
    toolId === "suggest-deadlines"
  ) {
    return new Set(["action", "incident", "inspection", "risk-assessment"]);
  }

  return new Set([
    "action",
    "incident",
    "inspection",
    "risk-assessment",
    "training",
    "toolbox-talk",
  ]);
};

export const supportsOrbitAiWorkspaceData = (toolId: OrbitAiToolId) =>
  workspaceTools.has(toolId);

export const readOrbitAiSourceRecords = (
  userId: string | null,
  toolId: OrbitAiToolId,
) => {
  const actions = readActionData(userId);
  const records = [
    ...readRiskAssessments(userId),
    ...readIncidents(userId, actions),
    ...readInspections(userId),
    ...readActions(actions),
    ...readTraining(userId),
    ...readToolboxTalkRecords(userId),
  ];
  const relevantTypes = getRelevantTypes(toolId);

  return records
    .filter((record) => relevantTypes.has(record.type))
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
};

export const readOrbitAiWorkspaceRecord = (
  userId: string | null,
): OrbitAiSourceRecord => {
  const riskAssessments = readRiskAssessmentData(userId);
  const inspections = readInspectionData(userId);
  const incidents = readIncidentData(userId);
  const actions = readActionData(userId);
  const training = readTrainingData(userId);
  const notifications = readJson<Array<Record<string, unknown>>>(
    [getUserStorageKey(userId, "notification_center")],
    [],
  );
  const generations = readJson<Array<Record<string, unknown>>>(
    [getHistoryKey(userId)],
    [],
  );
  const hazards = riskAssessments.flatMap((assessment) =>
    array(assessment.hazards).map(object),
  );
  const highResidualRisks = hazards.filter(
    (hazard) => getRiskScore(hazard, "residual") >= 15,
  ).length;
  const inspectionScores = inspections.map(({ inspection }) =>
    number(object(inspection.result).percent),
  );
  const highRiskFindings = inspections.reduce(
    (total, { inspection }) =>
      total +
      Object.values(object(inspection.risk)).filter(
        (risk) => text(risk).toUpperCase() === "H",
      ).length,
    0,
  );
  const highSeverityIncidents = incidents.filter((incident) =>
    ["High", "Critical"].includes(text(incident.severity)),
  ).length;
  const openActions = actions.filter(
    (action) => !closedActionStatuses.has(action.status),
  );
  const unreadNotifications = notifications.filter(
    (notification) => notification.active !== false && notification.read !== true,
  );
  const criticalNotifications = unreadNotifications.filter(
    (notification) => text(notification.severity) === "Critical",
  );
  const averageInspectionScore = inspectionScores.length
    ? Math.round(
        inspectionScores.reduce((total, score) => total + score, 0) /
          inspectionScores.length,
      )
    : 0;
  const trainingCompliance = calculateTrainingCompliance(training);
  const workspaceSnapshot = {
    summary: {
      riskAssessments: riskAssessments.length,
      hazards: hazards.length,
      highResidualRisks,
      inspections: inspections.length,
      averageInspectionScore,
      highRiskFindings,
      incidents: incidents.length,
      highSeverityIncidents,
      openActions: openActions.length,
      overdueActions: openActions.filter((action) => isPast(action.dueDate)).length,
      trainingCompliance,
      unreadNotifications: unreadNotifications.length,
      criticalNotifications: criticalNotifications.length,
      aiGenerationHistory: generations.length,
    },
    riskAssessments,
    inspections,
    incidents,
    actions,
    training,
    notifications,
    aiGenerationHistory: generations,
  };

  return createRecord({
    type: "workspace-summary",
    id: "current",
    label: "All Workspace Data",
    description: "Cross-module operational intelligence snapshot",
    data: workspaceSnapshot,
    preview: {
      fields: [
        { label: "Risk Assessments", value: String(riskAssessments.length) },
        { label: "Total Hazards", value: String(hazards.length) },
        { label: "High Residual Risks", value: String(highResidualRisks) },
        { label: "Inspections", value: String(inspections.length) },
        { label: "Average Inspection Score", value: `${averageInspectionScore}%` },
        { label: "High-Risk Findings", value: String(highRiskFindings) },
        { label: "Incidents", value: String(incidents.length) },
        { label: "High Severity Incidents", value: String(highSeverityIncidents) },
        { label: "Open Actions", value: String(openActions.length) },
        { label: "Overdue Actions", value: String(openActions.filter((action) => isPast(action.dueDate)).length) },
        { label: "Training Compliance", value: `${trainingCompliance}%` },
        { label: "Unread / Critical Notifications", value: `${unreadNotifications.length} / ${criticalNotifications.length}` },
      ],
    },
  });
};

export const readOrbitAiGenerations = (
  userId: string | null,
): OrbitAiGeneration[] =>
  readJson<OrbitAiGeneration[]>(
    userId ? [getHistoryKey(userId), legacyHistoryKey] : [legacyHistoryKey],
    [],
  );

export const appendOrbitAiGeneration = (
  userId: string | null,
  generation: OrbitAiGeneration,
) => {
  if (typeof window === "undefined") return [];

  const generations = [generation, ...readOrbitAiGenerations(userId)].slice(0, 150);
  window.localStorage.setItem(getHistoryKey(userId), JSON.stringify(generations));
  if (userId) window.localStorage.removeItem(legacyHistoryKey);
  window.dispatchEvent(
    new CustomEvent<OrbitAiGeneration[]>(orbitAiGenerationsUpdatedEvent, {
      detail: generations,
    }),
  );
  return generations;
};

export const createOrbitAiGenerationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `orbit-ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};
