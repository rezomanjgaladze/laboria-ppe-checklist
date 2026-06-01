import { ALL_CHECKLISTS } from "@/app/data/checklists";
import { readActionTrackerActions } from "@/app/lib/actionTracker";
import { readToolboxTalks } from "@/app/lib/toolboxTalks";
import type {
  OrbitAiSourceModule,
  OrbitAiToolId,
} from "@/app/lib/orbitAi";

export type OrbitAiSourceMode = "manual" | "existing_data";

export type OrbitAiSourceRecord = {
  id: string;
  type: string;
  label: string;
  description: string;
  createdAt?: string;
  data: string;
};

export type OrbitAiGeneratedContent = {
  title: string;
  executiveSummary: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  recommendations: string[];
  nextSteps: string[];
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
};

export const orbitAiGenerationsUpdatedEvent =
  "laboria-orbit-ai-generations-updated";

const legacyHistoryKey = "laboria_orbit_ai_generations";

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

const compactData = (value: unknown, maxLength = 18000) => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length <= maxLength
    ? serialized
    : `${serialized.slice(0, maxLength)}\n[Additional source data omitted for length]`;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const createRecord = ({
  type,
  id,
  label,
  description,
  createdAt,
  data,
}: {
  type: string;
  id: string | number;
  label: string;
  description: string;
  createdAt?: string;
  data: unknown;
}): OrbitAiSourceRecord => ({
  id: `${type}:${id}`,
  type,
  label,
  description,
  createdAt,
  data: compactData(data),
});

const readRiskAssessments = (userId: string | null) =>
  readJson<Record<string, unknown>[]>(
    [
      getUserStorageKey(userId, "risk_assessments"),
      "laboria_risk_assessments",
    ],
    [],
  ).map((assessment, index) => {
    const header =
      assessment.header && typeof assessment.header === "object"
        ? (assessment.header as Record<string, unknown>)
        : {};
    const hazards = Array.isArray(assessment.hazards) ? assessment.hazards : [];
    const title =
      text(header.assessmentTitle) ||
      text(header.title) ||
      text(header.activityTask) ||
      text(header.activity) ||
      `Risk assessment ${index + 1}`;

    return createRecord({
      type: "risk-assessment",
      id: String(assessment.id ?? index + 1),
      label: title,
      description: `${text(header.siteLocation) || text(header.site) || "Site not specified"} · ${hazards.length} hazard${hazards.length === 1 ? "" : "s"}`,
      createdAt: text(assessment.savedAt),
      data: assessment,
    });
  });

const readIncidents = (userId: string | null) =>
  readJson<Record<string, unknown>[]>(
    [
      getUserStorageKey(userId, "incident_management"),
      "laboria_incident_management",
    ],
    [],
  ).map((incident, index) =>
    createRecord({
      type: "incident",
      id: String(incident.id ?? index + 1),
      label: text(incident.title) || `Incident ${index + 1}`,
      description: `${text(incident.eventType) || "Recorded event"} · ${text(incident.severity) || "Severity not specified"}`,
      createdAt: text(incident.updatedAt) || text(incident.createdAt),
      data: incident,
    }),
  );

const readInspections = (userId: string | null) =>
  ALL_CHECKLISTS.flatMap((checklist) =>
    readJson<Record<string, unknown>[]>(
      [
        getUserStorageKey(userId, `${checklist.id}_history`),
        `laboria_${checklist.id}_history`,
      ],
      [],
    ).map((inspection, index) => {
      const result =
        inspection.result && typeof inspection.result === "object"
          ? (inspection.result as Record<string, unknown>)
          : {};
      return createRecord({
        type: "inspection",
        id: `${checklist.id}:${String(inspection.id ?? index + 1)}`,
        label: checklist.headerTitleEN,
        description: `${text(inspection.site) || "Site not specified"} · ${Number(result.percent || 0)}% compliance`,
        createdAt: text(inspection.savedAt) || text(inspection.inspectionDate),
        data: { checklist: checklist.headerTitleEN, inspection },
      });
    }),
  );

const readActions = (userId: string | null) =>
  readActionTrackerActions(userId).map((action) =>
    createRecord({
      type: "action",
      id: action.id,
      label: action.title || "Tracked action",
      description: `${action.priority} priority · ${action.status}`,
      createdAt: action.lastUpdated || action.createdDate,
      data: action,
    }),
  );

const readTraining = (userId: string | null) => {
  const training = readJson<Record<string, unknown>>(
    [
      getUserStorageKey(userId, "training_management"),
      "laboria_training_management",
    ],
    {},
  );
  const employees = Array.isArray(training.employees) ? training.employees : [];
  const records = Array.isArray(training.records) ? training.records : [];

  return Object.keys(training).length
    ? [
        createRecord({
          type: "training",
          id: "workspace",
          label: "Training compliance workspace",
          description: `${employees.length} employee${employees.length === 1 ? "" : "s"} · ${records.length} training record${records.length === 1 ? "" : "s"}`,
          data: training,
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
      description: `${talk.variant === "quiz" ? "Toolbox talk + quiz" : "Toolbox talk"} · ${talk.inputs.department || "Department not specified"}`,
      createdAt: talk.createdAt,
      data: talk,
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
    "workspace-summary",
    "action",
    "incident",
    "inspection",
    "risk-assessment",
    "training",
    "toolbox-talk",
  ]);
};

export const readOrbitAiSourceRecords = (
  userId: string | null,
  toolId: OrbitAiToolId,
) => {
  const records = [
    ...readRiskAssessments(userId),
    ...readIncidents(userId),
    ...readInspections(userId),
    ...readActions(userId),
    ...readTraining(userId),
    ...readToolboxTalkRecords(userId),
  ];
  const workspaceRecord = createRecord({
    type: "workspace-summary",
    id: "current",
    label: "Current Orbit workspace",
    description: "Cross-module operational data snapshot",
    data: records.map(({ type, label, description, createdAt, data }) => ({
      type,
      label,
      description,
      createdAt,
      data,
    })),
  });
  const relevantTypes = getRelevantTypes(toolId);

  return [workspaceRecord, ...records]
    .filter((record) => relevantTypes.has(record.type))
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
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
