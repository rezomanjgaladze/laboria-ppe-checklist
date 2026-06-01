"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  GraduationCap,
  HeartPulse,
  LineChart,
  Moon,
  Radar,
  ShieldAlert,
  Sun,
  Target,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ALL_CHECKLISTS } from "@/app/data/checklists";
import {
  readActionTrackerActions,
  type HseAction,
} from "@/app/lib/actionTracker";
import OrbitAiToolStrip from "@/app/components/OrbitAiToolStrip";

type AnalyticsModuleProps = {
  userId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
};

type IncidentEvent = {
  id: string;
  title: string;
  eventType: string;
  dateTime: string;
  siteLocation: string;
  department: string;
  severity: string;
  description: string;
  immediateActionTaken: string;
  status: string;
  rootCauses: string[];
  rootCauseNotes: string;
  createdAt: string;
  updatedAt: string;
};

type TrainingData = {
  employees: Array<{
    id: string;
    name: string;
    department: string;
    position: string;
    siteLocation: string;
    status: string;
  }>;
  trainingTypes: Array<{
    id: string;
    name: string;
    category: string;
    riskLevel: string;
  }>;
  records: Array<{
    id: string;
    employeeId: string;
    trainingTypeId: string;
    completedDate: string;
    expiryDate: string;
  }>;
};

type HazardRow = {
  workplaceActivity: string;
  hazardDescription: string;
  possibleConsequence: string;
  existingMeasures: string;
  additionalMeasures: string;
  initialProbability: number;
  initialSeverity: number;
  residualProbability: number;
  residualSeverity: number;
  status: string;
  comments: string;
};

type RiskAssessment = {
  id: number;
  header: {
    site: string;
    department: string;
    title: string;
    sector: string;
    activity: string;
    assessmentDate: string;
  };
  hazards: HazardRow[];
  savedAt: string;
};

type SavedInspection = {
  id: number;
  company: string;
  site: string;
  inspectionDate: string;
  answers: Record<string, string>;
  risk: Record<string, string>;
  comments?: Record<string, string>;
  result?: {
    percent: number;
    status: string;
  };
  savedAt: string;
};

type AnalyticsData = {
  actions: HseAction[];
  incidents: IncidentEvent[];
  training: TrainingData;
  risks: RiskAssessment[];
  inspections: SavedInspection[];
};

type ChartPoint = {
  label: string;
  open: number;
  completed: number;
};

type InspectionPoint = {
  label: string;
  score: number;
  failed: number;
};

type KpiCardData = {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  accent: string;
  trend: number;
  sparkline: number[];
};

type TimePeriod = "Last 7 days" | "Last 30 days" | "This month" | "All time";

type SourceFilter =
  | "All sources"
  | "Action Tracker"
  | "Risk Assessments"
  | "Incident Management"
  | "Training Management"
  | "Inspections";

type AnalyticsFilters = {
  timePeriod: TimePeriod;
  site: string;
  department: string;
  source: SourceFilter;
};

type AttentionAlert = {
  title: string;
  source: SourceFilter;
  severity: "good" | "info" | "warning" | "critical";
  count: number;
  detail: string;
};

type OperationalProblem = {
  label: string;
  source: SourceFilter;
  value: number;
  severity: "info" | "warning" | "critical";
};

type ActivityFeedItem = {
  id: string;
  label: string;
  source: SourceFilter;
  date: string;
  tone: "info" | "success" | "warning" | "critical";
};

type HeatmapRow = {
  label: string;
  cells: Array<{
    label: string;
    value: number;
  }>;
};

const emptyTrainingData: TrainingData = {
  employees: [],
  trainingTypes: [],
  records: [],
};

const defaultFilters: AnalyticsFilters = {
  timePeriod: "All time",
  site: "All sites",
  department: "All departments",
  source: "All sources",
};

const timePeriodOptions: TimePeriod[] = [
  "Last 7 days",
  "Last 30 days",
  "This month",
  "All time",
];

const sourceFilterOptions: SourceFilter[] = [
  "All sources",
  "Action Tracker",
  "Risk Assessments",
  "Incident Management",
  "Training Management",
  "Inspections",
];

const attentionActivityMatchers = [
  {
    label: "Working at Height",
    pattern: /height|roof|scaffold|ladder|fall|edge protection/i,
  },
  {
    label: "Electrical Work",
    pattern: /electric|cable|arc|power|energized|switchgear|transformer/i,
  },
  {
    label: "Confined Space",
    pattern: /confined|oxygen|atmosphere|vessel|manhole/i,
  },
  {
    label: "Forklift Operations",
    pattern: /forklift|reach truck|pallet truck|industrial truck/i,
  },
  {
    label: "Lifting Operations",
    pattern: /crane|lifting|rigging|sling|hoist|dropped load/i,
  },
  {
    label: "Chemical Handling",
    pattern: /chemical|solvent|corrosive|toxic|flammable|gas|spill|reagent/i,
  },
];

const rootCauseMap = [
  { label: "Human Factor", keys: ["Human Factor"] },
  { label: "Procedure Failure", keys: ["Procedure / System Failure"] },
  { label: "Training Gap", keys: ["Missing or Ineffective Training"] },
  { label: "Work Environment", keys: ["Work Environment"] },
  { label: "Supervision Failure", keys: ["Supervision / Management"] },
  { label: "PPE Failure", keys: ["PPE / Protection Failure"] },
  { label: "Communication Failure", keys: ["Communication Failure"] },
];

const incidentTypeChartLabels = [
  "Near Miss",
  "First Aid",
  "Medical Treatment",
  "Lost Time Injury",
  "Property Damage",
  "Environmental Incident",
];

const departmentTrainingLabels = [
  "Construction",
  "Electrical",
  "Warehouse",
  "Office",
  "Maintenance",
];

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const getTheme = (darkMode: boolean) => ({
  pageText: darkMode ? "text-[#F5F7FA]" : "text-slate-900",
  shell: darkMode
    ? "border-white/10 bg-[#071225]/88 shadow-[0_30px_100px_rgba(0,0,0,0.34)]"
    : "border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
  shellHeader: darkMode
    ? "border-white/10 bg-white/[0.035]"
    : "border-slate-200 bg-slate-50/80",
  card: darkMode
    ? "border-white/10 bg-white/[0.045]"
    : "border-slate-200 bg-white shadow-sm",
  panel: darkMode
    ? "border-white/10 bg-[#071225]/72 shadow-[0_20px_70px_rgba(0,0,0,0.22)]"
    : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
  elevated: darkMode
    ? "border-white/10 bg-white/[0.06] shadow-[0_20px_70px_rgba(0,0,0,0.26)]"
    : "border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)]",
  muted: darkMode ? "text-slate-400" : "text-slate-600",
  soft: darkMode ? "text-slate-300" : "text-slate-700",
  heading: darkMode ? "text-white" : "text-slate-950",
  label: darkMode ? "text-slate-400" : "text-slate-600",
  themeToggleButton: darkMode
    ? "border-slate-500/30 bg-slate-800 text-white shadow-md hover:bg-slate-700"
    : "border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-100",
  glow: darkMode
    ? "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_20%_0%,rgba(77,235,255,0.18),transparent_36%),radial-gradient(circle_at_90%_30%,rgba(30,144,255,0.14),transparent_34%)]"
    : "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_20%_0%,rgba(30,144,255,0.14),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(77,235,255,0.12),transparent_36%)]",
});

const getUserStorageKey = (userId: string | null, suffix: string) =>
  userId ? `laboria_${encodeURIComponent(userId)}_${suffix}` : `laboria_${suffix}`;

const safeJsonParse = (value: string | null): unknown => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const getNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const getPrimaryActionDate = (action: HseAction) =>
  action.createdDate || action.lastUpdated || action.dueDate;

const getPrimaryIncidentDate = (incident: IncidentEvent) =>
  incident.dateTime || incident.createdAt || incident.updatedAt;

const getPrimaryRiskDate = (assessment: RiskAssessment) =>
  assessment.header.assessmentDate || assessment.savedAt;

const getPrimaryInspectionDate = (inspection: SavedInspection) =>
  inspection.inspectionDate || inspection.savedAt;

const isWithinTimePeriod = (value: string, period: TimePeriod) => {
  if (period === "All time") {
    return true;
  }

  const date = toDate(value);

  if (!date) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  if (period === "Last 7 days") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return date >= start;
  }

  if (period === "Last 30 days") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    return date >= start;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= monthStart;
};

const matchesFilterValue = (value: string, selected: string, allLabel: string) =>
  selected === allLabel || value === selected;

const isClosedAction = (action: HseAction) =>
  action.status === "Completed" || action.status === "Closed";

const isOverdueAction = (action: HseAction) => {
  if (!action.dueDate || isClosedAction(action)) {
    return false;
  }

  const due = new Date(`${action.dueDate}T23:59:59`);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
};

const riskLevelFromScore = (score: number) => {
  if (score <= 3) {
    return "Low";
  }

  if (score <= 12) {
    return "Medium";
  }

  return "High";
};

const hazardResidualLevel = (hazard: HazardRow) =>
  riskLevelFromScore(hazard.residualProbability * hazard.residualSeverity);

const hazardInitialLevel = (hazard: HazardRow) =>
  riskLevelFromScore(hazard.initialProbability * hazard.initialSeverity);

const readIncidents = (userId: string | null): IncidentEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [
    getUserStorageKey(userId, "incident_management"),
    "laboria_incident_management",
  ];
  const parsed = keys.flatMap((key) => {
    const value = safeJsonParse(window.localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  });
  const seen = new Set<string>();

  return parsed
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: getString(item.id) || `${Date.now()}-${Math.random()}`,
      title: getString(item.title),
      eventType: getString(item.eventType) || "Incident",
      dateTime: getString(item.dateTime),
      siteLocation: getString(item.siteLocation),
      department: getString(item.department),
      severity: getString(item.severity) || "Medium",
      description: getString(item.description),
      immediateActionTaken: getString(item.immediateActionTaken),
      status: getString(item.status) || "Reported",
      rootCauses: Array.isArray(item.rootCauses)
        ? item.rootCauses.filter(
            (rootCause): rootCause is string => typeof rootCause === "string",
          )
        : [],
      rootCauseNotes: getString(item.rootCauseNotes),
      createdAt: getString(item.createdAt),
      updatedAt: getString(item.updatedAt),
    }))
    .filter((incident) => {
      if (seen.has(incident.id)) {
        return false;
      }

      seen.add(incident.id);
      return true;
    });
};

const readTrainingData = (userId: string | null): TrainingData => {
  if (typeof window === "undefined") {
    return emptyTrainingData;
  }

  const keys = [
    getUserStorageKey(userId, "training_management"),
    "laboria_training_management",
  ];
  const value = keys
    .map((key) => safeJsonParse(window.localStorage.getItem(key)))
    .find((item) => item && typeof item === "object") as
    | Record<string, unknown>
    | undefined;

  if (!value) {
    return emptyTrainingData;
  }

  return {
    employees: Array.isArray(value.employees)
      ? value.employees
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === "object"),
          )
          .map((employee) => ({
            id: getString(employee.id),
            name: getString(employee.name),
            department: getString(employee.department),
            position: getString(employee.position),
            siteLocation: getString(employee.siteLocation),
            status: getString(employee.status) || "Active",
          }))
      : [],
    trainingTypes: Array.isArray(value.trainingTypes)
      ? value.trainingTypes
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === "object"),
          )
          .map((trainingType) => ({
            id: getString(trainingType.id),
            name: getString(trainingType.name),
            category: getString(trainingType.category),
            riskLevel: getString(trainingType.riskLevel) || "Medium",
          }))
      : [],
    records: Array.isArray(value.records)
      ? value.records
          .filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === "object"),
          )
          .map((record) => ({
            id: getString(record.id),
            employeeId: getString(record.employeeId),
            trainingTypeId: getString(record.trainingTypeId),
            completedDate: getString(record.completedDate),
            expiryDate: getString(record.expiryDate),
          }))
      : [],
  };
};

const readRiskAssessments = (userId: string | null): RiskAssessment[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [
    getUserStorageKey(userId, "risk_assessments"),
    "laboria_risk_assessments",
  ];
  const parsed = keys.flatMap((key) => {
    const value = safeJsonParse(window.localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  });
  const seen = new Set<number>();

  return parsed
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => {
      const header =
        item.header && typeof item.header === "object"
          ? (item.header as Record<string, unknown>)
          : {};

      return {
        id: getNumber(item.id, Date.now()),
        header: {
          site: getString(header.site),
          department: getString(header.department),
          title: getString(header.title),
          sector: getString(header.sector),
          activity: getString(header.activity),
          assessmentDate: getString(header.assessmentDate),
        },
        hazards: Array.isArray(item.hazards)
          ? item.hazards
              .filter((hazard): hazard is Record<string, unknown> =>
                Boolean(hazard && typeof hazard === "object"),
              )
              .map((hazard) => ({
                workplaceActivity: getString(hazard.workplaceActivity),
                hazardDescription: getString(hazard.hazardDescription),
                possibleConsequence: getString(hazard.possibleConsequence),
                existingMeasures: getString(hazard.existingMeasures),
                additionalMeasures: getString(hazard.additionalMeasures),
                initialProbability: getNumber(hazard.initialProbability, 1),
                initialSeverity: getNumber(hazard.initialSeverity, 1),
                residualProbability: getNumber(hazard.residualProbability, 1),
                residualSeverity: getNumber(hazard.residualSeverity, 1),
                status: getString(hazard.status) || "Open",
                comments: getString(hazard.comments),
              }))
          : [],
        savedAt: getString(item.savedAt),
      };
    })
    .filter((assessment) => {
      if (seen.has(assessment.id)) {
        return false;
      }

      seen.add(assessment.id);
      return true;
    });
};

const readInspections = (userId: string | null): SavedInspection[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const seen = new Set<number>();

  return ALL_CHECKLISTS.flatMap((checklist) => {
    const keys = [
      getUserStorageKey(userId, `${checklist.id}_history`),
      `laboria_${checklist.id}_history`,
    ];

    return keys.flatMap((key) => {
      const value = safeJsonParse(window.localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    });
  })
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => {
      const result =
        item.result && typeof item.result === "object"
          ? (item.result as Record<string, unknown>)
          : {};

      return {
        id: getNumber(item.id),
        company: getString(item.company),
        site: getString(item.site),
        inspectionDate: getString(item.inspectionDate),
        answers:
          item.answers && typeof item.answers === "object"
            ? (item.answers as Record<string, string>)
            : {},
        risk:
          item.risk && typeof item.risk === "object"
            ? (item.risk as Record<string, string>)
            : {},
        comments:
          item.comments && typeof item.comments === "object"
            ? (item.comments as Record<string, string>)
            : {},
        result: {
          percent: getNumber(result.percent),
          status: getString(result.status),
        },
        savedAt: getString(item.savedAt),
      };
    })
    .filter((inspection) => {
      if (seen.has(inspection.id)) {
        return false;
      }

      seen.add(inspection.id);
      return true;
    });
};

const loadAnalyticsData = (userId: string | null): AnalyticsData => ({
  actions: readActionTrackerActions(userId),
  incidents: readIncidents(userId),
  training: readTrainingData(userId),
  risks: readRiskAssessments(userId),
  inspections: readInspections(userId),
});

const getFilterOptions = (data: AnalyticsData) => {
  const sites = new Set<string>();
  const departments = new Set<string>();

  data.actions.forEach((action) => {
    if (action.siteLocation) {
      sites.add(action.siteLocation);
    }

    if (action.department) {
      departments.add(action.department);
    }
  });

  data.incidents.forEach((incident) => {
    if (incident.siteLocation) {
      sites.add(incident.siteLocation);
    }

    if (incident.department) {
      departments.add(incident.department);
    }
  });

  data.risks.forEach((assessment) => {
    if (assessment.header.site) {
      sites.add(assessment.header.site);
    }

    if (assessment.header.department) {
      departments.add(assessment.header.department);
    }
  });

  data.training.employees.forEach((employee) => {
    if (employee.siteLocation) {
      sites.add(employee.siteLocation);
    }

    if (employee.department) {
      departments.add(employee.department);
    }
  });

  data.inspections.forEach((inspection) => {
    if (inspection.site) {
      sites.add(inspection.site);
    }
  });

  return {
    sites: Array.from(sites).sort((a, b) => a.localeCompare(b)),
    departments: Array.from(departments).sort((a, b) => a.localeCompare(b)),
  };
};

const sourceEnabled = (selected: SourceFilter, source: SourceFilter) =>
  selected === "All sources" || selected === source;

const filterAnalyticsData = (
  data: AnalyticsData,
  filters: AnalyticsFilters,
): AnalyticsData => {
  const actions = sourceEnabled(filters.source, "Action Tracker")
    ? data.actions.filter(
        (action) =>
          isWithinTimePeriod(getPrimaryActionDate(action), filters.timePeriod) &&
          matchesFilterValue(action.siteLocation, filters.site, "All sites") &&
          matchesFilterValue(
            action.department,
            filters.department,
            "All departments",
          ),
      )
    : [];
  const incidents = sourceEnabled(filters.source, "Incident Management")
    ? data.incidents.filter(
        (incident) =>
          isWithinTimePeriod(
            getPrimaryIncidentDate(incident),
            filters.timePeriod,
          ) &&
          matchesFilterValue(
            incident.siteLocation,
            filters.site,
            "All sites",
          ) &&
          matchesFilterValue(
            incident.department,
            filters.department,
            "All departments",
          ),
      )
    : [];
  const risks = sourceEnabled(filters.source, "Risk Assessments")
    ? data.risks.filter(
        (assessment) =>
          isWithinTimePeriod(getPrimaryRiskDate(assessment), filters.timePeriod) &&
          matchesFilterValue(assessment.header.site, filters.site, "All sites") &&
          matchesFilterValue(
            assessment.header.department,
            filters.department,
            "All departments",
          ),
      )
    : [];
  const trainingEmployees = sourceEnabled(filters.source, "Training Management")
    ? data.training.employees.filter(
        (employee) =>
          matchesFilterValue(employee.siteLocation, filters.site, "All sites") &&
          matchesFilterValue(
            employee.department,
            filters.department,
            "All departments",
          ),
      )
    : [];
  const trainingRecords = sourceEnabled(filters.source, "Training Management")
    ? data.training.records.filter((record) =>
        isWithinTimePeriod(
          record.completedDate || record.expiryDate,
          filters.timePeriod,
        ),
      )
    : [];
  const inspections = sourceEnabled(filters.source, "Inspections")
    ? data.inspections.filter(
        (inspection) =>
          isWithinTimePeriod(
            getPrimaryInspectionDate(inspection),
            filters.timePeriod,
          ) && matchesFilterValue(inspection.site, filters.site, "All sites"),
      )
    : [];

  return {
    actions,
    incidents,
    risks,
    inspections:
      filters.department === "All departments" ? inspections : [],
    training: {
      employees: trainingEmployees,
      trainingTypes: sourceEnabled(filters.source, "Training Management")
        ? data.training.trainingTypes
        : [],
      records: trainingRecords.filter((record) =>
        trainingEmployees.some((employee) => employee.id === record.employeeId),
      ),
    },
  };
};

const monthLabel = (date: Date) =>
  date.toLocaleString(undefined, { month: "short" });

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getRecentMonths = (count: number) => {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
    };
  });
};

const percentage = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const getTrainingStatus = (expiryDate: string) => {
  const date = toDate(expiryDate);

  if (!date) {
    return "Missing";
  }

  const today = new Date();
  const daysUntilExpiry = Math.ceil(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return "Expired";
  }

  if (daysUntilExpiry <= 30) {
    return "Expiring Soon";
  }

  return "Valid";
};

const getLatestRecord = (
  records: TrainingData["records"],
  employeeId: string,
  trainingTypeId: string,
) =>
  records
    .filter(
      (record) =>
        record.employeeId === employeeId &&
        record.trainingTypeId === trainingTypeId,
    )
    .sort((a, b) => {
      const aTime = toDate(a.completedDate)?.getTime() ?? 0;
      const bTime = toDate(b.completedDate)?.getTime() ?? 0;
      return bTime - aTime;
    })[0];

const getTrainingGapCounts = (training: TrainingData) => {
  const activeEmployees = training.employees.filter(
    (employee) => employee.status !== "Inactive",
  );
  let valid = 0;
  let expiringSoon = 0;
  let expired = 0;
  let missing = 0;

  activeEmployees.forEach((employee) => {
    training.trainingTypes.forEach((trainingType) => {
      const record = getLatestRecord(
        training.records,
        employee.id,
        trainingType.id,
      );
      const status = record ? getTrainingStatus(record.expiryDate) : "Missing";

      if (status === "Valid") {
        valid += 1;
      } else if (status === "Expiring Soon") {
        expiringSoon += 1;
      } else if (status === "Expired") {
        expired += 1;
      } else {
        missing += 1;
      }
    });
  });

  return {
    valid,
    expiringSoon,
    expired,
    missing,
    total: activeEmployees.length * training.trainingTypes.length,
  };
};

const buildActionTrend = (actions: HseAction[]): ChartPoint[] => {
  const months = getRecentMonths(6);

  return months.map((month) => {
    const open = actions.filter((action) => {
      const date = toDate(action.createdDate);
      return !isClosedAction(action) && date && monthKey(date) === month.key;
    }).length;
    const completed = actions.filter((action) => {
      const date = toDate(action.lastUpdated);
      return isClosedAction(action) && date && monthKey(date) === month.key;
    }).length;

    return {
      label: month.label,
      open,
      completed,
    };
  });
};

const buildInspectionTrend = (inspections: SavedInspection[]): InspectionPoint[] =>
  [...inspections]
    .sort((a, b) => {
      const aDate = toDate(a.inspectionDate || a.savedAt)?.getTime() ?? 0;
      const bDate = toDate(b.inspectionDate || b.savedAt)?.getTime() ?? 0;
      return aDate - bDate;
    })
    .slice(-8)
    .map((inspection, index) => ({
      label:
        toDate(inspection.inspectionDate || inspection.savedAt)?.toLocaleString(
          undefined,
          { month: "short", day: "numeric" },
        ) ?? `I${index + 1}`,
      score: Math.round(inspection.result?.percent ?? 0),
      failed: Object.values(inspection.answers).filter((answer) => answer === "no")
        .length,
    }));

const buildRootCauseCounts = (incidents: IncidentEvent[]) =>
  rootCauseMap.map((item) => ({
    label: item.label,
    value: incidents.filter((incident) =>
      incident.rootCauses.some((rootCause) => item.keys.includes(rootCause)),
    ).length,
  }));

const buildIncidentTypeCounts = (incidents: IncidentEvent[]) =>
  incidentTypeChartLabels.map((label) => {
    const value = incidents.filter((incident) => {
      if (label === "First Aid") {
        return incident.eventType === "First Aid Case";
      }

      if (label === "Medical Treatment") {
        return incident.eventType === "Medical Treatment Case";
      }

      if (label === "Lost Time Injury") {
        return incident.eventType === "Lost Time Injury";
      }

      if (label === "Environmental Incident") {
        return incident.eventType === "Environmental Release";
      }

      return incident.eventType === label;
    }).length;

    return { label, value };
  });

const buildTrainingCompliance = (training: TrainingData) =>
  departmentTrainingLabels.map((department) => {
    const employees = training.employees.filter(
      (employee) =>
        employee.status !== "Inactive" &&
        employee.department.toLowerCase().includes(department.toLowerCase()),
    );
    const total = employees.length * training.trainingTypes.length;
    let valid = 0;
    let expired = 0;
    let expiringSoon = 0;

    employees.forEach((employee) => {
      training.trainingTypes.forEach((trainingType) => {
        const record = getLatestRecord(
          training.records,
          employee.id,
          trainingType.id,
        );
        const status = record ? getTrainingStatus(record.expiryDate) : "Missing";

        if (status === "Valid") {
          valid += 1;
        } else if (status === "Expired") {
          expired += 1;
        } else if (status === "Expiring Soon") {
          expiringSoon += 1;
        }
      });
    });

    return {
      label: department,
      value: percentage(valid, total),
      total,
      expired,
      expiringSoon,
    };
  });

const buildHighRiskActivities = (risks: RiskAssessment[]) =>
  attentionActivityMatchers.map((matcher) => {
    const value = risks.reduce((count, assessment) => {
      const assessmentText = [
        assessment.header.title,
        assessment.header.activity,
        assessment.header.sector,
      ].join(" ");

      return (
        count +
        assessment.hazards.filter((hazard) => {
          const hazardText = [
            assessmentText,
            hazard.workplaceActivity,
            hazard.hazardDescription,
            hazard.possibleConsequence,
            hazard.additionalMeasures,
            hazard.comments,
          ].join(" ");
          const isHigh =
            hazardResidualLevel(hazard) === "High" ||
            hazardInitialLevel(hazard) === "High";

          return isHigh && matcher.pattern.test(hazardText);
        }).length
      );
    }, 0);

    return {
      label: matcher.label,
      value,
    };
  });

const deriveProblemCounts = (data: AnalyticsData) => {
  const textPool = [
    ...data.incidents.flatMap((incident) => [
      incident.title,
      incident.description,
      incident.immediateActionTaken,
      incident.rootCauseNotes,
      ...incident.rootCauses,
    ]),
    ...data.risks.flatMap((assessment) =>
      assessment.hazards.flatMap((hazard) => [
        assessment.header.activity,
        hazard.workplaceActivity,
        hazard.hazardDescription,
        hazard.additionalMeasures,
        hazard.comments,
      ]),
    ),
    ...data.inspections.flatMap((inspection) =>
      Object.values(inspection.comments ?? {}),
    ),
  ]
    .join(" ")
    .toLowerCase();
  const trainingGaps = getTrainingGapCounts(data.training);
  const failedInspectionItems = data.inspections.reduce(
    (count, inspection) =>
      count +
      Object.values(inspection.answers).filter((answer) => answer === "no").length,
    0,
  );

  const highRiskWorkAtHeight = data.risks.reduce(
    (count, assessment) =>
      count +
      assessment.hazards.filter(
        (hazard) =>
          hazardResidualLevel(hazard) === "High" &&
          /height|roof|scaffold|ladder|fall/i.test(
            `${assessment.header.activity} ${hazard.workplaceActivity} ${hazard.hazardDescription}`,
          ),
      ).length,
    0,
  );
  const overdueActions = data.actions.filter(isOverdueAction).length;

  const problems: OperationalProblem[] = [
    {
      label: "PPE non-compliance",
      source: "Inspections",
      value:
        failedInspectionItems +
        (textPool.match(/\bppe\b|personal protective|helmet|glove|goggles/g)
          ?.length ?? 0),
      severity: failedInspectionItems > 5 ? "critical" : "warning",
    },
    {
      label: "Training gaps",
      source: "Training Management" as const,
      value: trainingGaps.expired + trainingGaps.missing,
      severity: trainingGaps.expired > 0 ? "critical" : "warning",
    },
    {
      label: "Unsafe access",
      source: "Risk Assessments" as const,
      value:
        textPool.match(/access|ladder|scaffold|walkway|height|roof/g)?.length ?? 0,
      severity: "warning",
    },
    {
      label: "Procedure deviation",
      source: "Incident Management" as const,
      value:
        data.incidents.filter((incident) =>
          incident.rootCauses.includes("Procedure / System Failure"),
        ).length +
        (textPool.match(/procedure|permit|system failure|deviation/g)?.length ??
          0),
      severity: "warning",
    },
    {
      label: "Housekeeping failures",
      source: "Inspections" as const,
      value: textPool.match(/housekeeping|waste|clutter|spill|trip/g)?.length ?? 0,
      severity: "info",
    },
    {
      label: "Working at height risk",
      source: "Risk Assessments" as const,
      value: highRiskWorkAtHeight,
      severity: "critical",
    },
    {
      label: "Overdue actions",
      source: "Action Tracker" as const,
      value: overdueActions,
      severity: overdueActions > 0 ? "critical" : "info",
    },
  ];

  return problems
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
};

const buildRecurringFactors = (incidents: IncidentEvent[]) => {
  const counts = new Map<string, number>();

  incidents.forEach((incident) => {
    [incident.eventType, incident.department, ...incident.rootCauses]
      .filter(Boolean)
      .forEach((factor) => {
        counts.set(factor, (counts.get(factor) ?? 0) + 1);
      });
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
};

const buildRiskHeatmap = (data: AnalyticsData): HeatmapRow[] => {
  const trainingGaps = getTrainingGapCounts(data.training);
  const highRisks = data.risks.reduce(
    (count, assessment) =>
      count +
      assessment.hazards.filter((hazard) => hazardResidualLevel(hazard) === "High")
        .length,
    0,
  );
  const inspectionFindings = data.inspections.reduce(
    (count, inspection) =>
      count +
      Object.values(inspection.answers).filter((answer) => answer === "no").length,
    0,
  );
  const openActionRisk = data.actions.filter((action) => !isClosedAction(action)).length;
  const incidentRisk = data.incidents.filter(
    (incident) => incident.status !== "Closed",
  ).length;

  return [
    {
      label: "Action Tracker",
      cells: [
        { label: "Actions", value: openActionRisk },
        { label: "Incidents", value: 0 },
        { label: "Risks", value: 0 },
        { label: "Training gaps", value: 0 },
        { label: "Findings", value: 0 },
      ],
    },
    {
      label: "Incident Management",
      cells: [
        { label: "Actions", value: data.actions.filter((action) => action.sourceModule === "Incident" && !isClosedAction(action)).length },
        { label: "Incidents", value: incidentRisk },
        { label: "Risks", value: 0 },
        { label: "Training gaps", value: 0 },
        { label: "Findings", value: 0 },
      ],
    },
    {
      label: "Risk Assessments",
      cells: [
        { label: "Actions", value: data.actions.filter((action) => action.sourceModule === "Risk Assessment" && !isClosedAction(action)).length },
        { label: "Incidents", value: 0 },
        { label: "Risks", value: highRisks },
        { label: "Training gaps", value: 0 },
        { label: "Findings", value: 0 },
      ],
    },
    {
      label: "Training Management",
      cells: [
        { label: "Actions", value: data.actions.filter((action) => action.sourceModule === "Training" && !isClosedAction(action)).length },
        { label: "Incidents", value: 0 },
        { label: "Risks", value: 0 },
        {
          label: "Training gaps",
          value: trainingGaps.expired + trainingGaps.missing,
        },
        { label: "Findings", value: 0 },
      ],
    },
    {
      label: "Inspections",
      cells: [
        { label: "Actions", value: data.actions.filter((action) => action.sourceModule === "Inspection" && !isClosedAction(action)).length },
        { label: "Incidents", value: 0 },
        { label: "Risks", value: 0 },
        { label: "Training gaps", value: 0 },
        { label: "Findings", value: inspectionFindings },
      ],
    },
  ];
};

const makeNeedsAttention = (data: AnalyticsData): AttentionAlert[] => {
  const trainingGaps = getTrainingGapCounts(data.training);
  const overdueCritical = data.actions.filter(
    (action) => action.priority === "Critical" && isOverdueAction(action),
  ).length;
  const highResidualRisks = data.risks.reduce(
    (count, assessment) =>
      count +
      assessment.hazards.filter((hazard) => hazardResidualLevel(hazard) === "High")
        .length,
    0,
  );
  const highSeverityIncidents = data.incidents.filter(
    (incident) =>
      incident.status !== "Closed" &&
      (incident.severity === "High" || incident.severity === "Critical"),
  ).length;
  const rootCauseCounts = buildRecurringFactors(data.incidents);
  const repeatedRootCauses = rootCauseCounts.filter((item) => item.value >= 2).length;
  const lowComplianceInspections = data.inspections.filter(
    (inspection) => (inspection.result?.percent ?? 0) > 0 && (inspection.result?.percent ?? 0) < 80,
  ).length;

  const alerts: AttentionAlert[] = [
    {
      title: "Overdue critical actions",
      source: "Action Tracker",
      severity: "critical",
      count: overdueCritical,
      detail: `${overdueCritical} critical actions are past due`,
    },
    {
      title: "Expired trainings",
      source: "Training Management",
      severity: "critical",
      count: trainingGaps.expired,
      detail: `${trainingGaps.expired} employee training records are expired`,
    },
    {
      title: "Missing training records",
      source: "Training Management",
      severity: "warning",
      count: trainingGaps.missing,
      detail: `${trainingGaps.missing} required training assignments are missing`,
    },
    {
      title: "High residual risk detected",
      source: "Risk Assessments",
      severity: "critical",
      count: highResidualRisks,
      detail: `${highResidualRisks} high residual risk hazards remain in assessments`,
    },
    {
      title: "Open high severity incidents",
      source: "Incident Management",
      severity: "critical",
      count: highSeverityIncidents,
      detail: `${highSeverityIncidents} high or critical incidents remain open`,
    },
    {
      title: "Repeated incident/root cause patterns",
      source: "Incident Management",
      severity: "warning",
      count: repeatedRootCauses,
      detail: `${repeatedRootCauses} recurring factors appear more than once`,
    },
    {
      title: "Low inspection compliance",
      source: "Inspections",
      severity: "warning",
      count: lowComplianceInspections,
      detail: `${lowComplianceInspections} inspections are below 80% compliance`,
    },
  ];

  return alerts.filter((item) => item.count > 0);
};

const buildActionPriorityCounts = (actions: HseAction[]) =>
  ["Low", "Medium", "High", "Critical"].map((label) => ({
    label,
    value: actions.filter((action) => action.priority === label).length,
  }));

const buildRecentActivity = (data: AnalyticsData): ActivityFeedItem[] => {
  const actionItems = data.actions.flatMap((action) => {
    const items: ActivityFeedItem[] = [
      {
        id: `action-created-${action.id}`,
        label: `Action created: ${action.title || "Untitled action"}`,
        source: "Action Tracker",
        date: action.createdDate,
        tone:
          action.priority === "Critical"
            ? "critical"
            : action.priority === "High"
              ? "warning"
              : "info",
      },
    ];

    if (isClosedAction(action)) {
      items.push({
        id: `action-closed-${action.id}`,
        label: `Action completed: ${action.title || "Untitled action"}`,
        source: "Action Tracker",
        date: action.lastUpdated,
        tone: "success",
      });
    }

    return items;
  });
  const incidentItems = data.incidents.map((incident) => ({
    id: `incident-${incident.id}`,
    label: `Incident recorded: ${incident.title || incident.eventType}`,
    source: "Incident Management" as const,
    date: getPrimaryIncidentDate(incident),
    tone:
      incident.severity === "Critical" || incident.severity === "High"
        ? ("critical" as const)
        : ("warning" as const),
  }));
  const riskItems = data.risks.map((assessment) => ({
    id: `risk-${assessment.id}`,
    label: `Risk assessment saved: ${assessment.header.title || assessment.header.activity || "Untitled assessment"}`,
    source: "Risk Assessments" as const,
    date: getPrimaryRiskDate(assessment),
    tone: assessment.hazards.some((hazard) => hazardResidualLevel(hazard) === "High")
      ? ("critical" as const)
      : ("info" as const),
  }));
  const trainingItems = data.training.records.map((record) => {
    const employee = data.training.employees.find(
      (item) => item.id === record.employeeId,
    );
    const trainingType = data.training.trainingTypes.find(
      (item) => item.id === record.trainingTypeId,
    );

    return {
      id: `training-${record.id}`,
      label: `Training record added: ${employee?.name || "Employee"} - ${trainingType?.name || "Training"}`,
      source: "Training Management" as const,
      date: record.completedDate || record.expiryDate,
      tone: getTrainingStatus(record.expiryDate) === "Expired"
        ? ("warning" as const)
        : ("success" as const),
    };
  });
  const inspectionItems = data.inspections.map((inspection) => ({
    id: `inspection-${inspection.id}`,
    label: `Inspection saved: ${inspection.site || inspection.company || "Inspection"}`,
    source: "Inspections" as const,
    date: getPrimaryInspectionDate(inspection),
    tone: (inspection.result?.percent ?? 0) < 80 ? ("warning" as const) : ("success" as const),
  }));

  return [
    ...actionItems,
    ...incidentItems,
    ...riskItems,
    ...trainingItems,
    ...inspectionItems,
  ]
    .filter((item) => Boolean(item.date))
    .sort((a, b) => {
      const aTime = toDate(a.date)?.getTime() ?? 0;
      const bTime = toDate(b.date)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 8);
};

const buildCompliancePercent = (data: AnalyticsData) => {
  const metrics: number[] = [];
  const trainingGaps = getTrainingGapCounts(data.training);

  if (data.actions.length > 0) {
    metrics.push(
      percentage(data.actions.filter(isClosedAction).length, data.actions.length),
    );
  }

  if (data.inspections.length > 0) {
    metrics.push(
      Math.round(
        data.inspections.reduce(
          (sum, inspection) => sum + (inspection.result?.percent ?? 0),
          0,
        ) / data.inspections.length,
      ),
    );
  }

  if (trainingGaps.total > 0) {
    metrics.push(percentage(trainingGaps.valid, trainingGaps.total));
  }

  const hazards = data.risks.flatMap((assessment) => assessment.hazards);
  if (hazards.length > 0) {
    metrics.push(
      percentage(
        hazards.filter((hazard) => hazardResidualLevel(hazard) !== "High").length,
        hazards.length,
      ),
    );
  }

  if (data.incidents.length > 0) {
    metrics.push(
      percentage(
        data.incidents.filter((incident) => incident.status === "Closed").length,
        data.incidents.length,
      ),
    );
  }

  if (metrics.length === 0) {
    return 0;
  }

  return Math.round(metrics.reduce((sum, metric) => sum + metric, 0) / metrics.length);
};

const trendForLast30Days = (dates: string[]) => {
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  const current = dates.filter((value) => {
    const time = toDate(value)?.getTime();
    return time && now - time <= 30 * day;
  }).length;
  const previous = dates.filter((value) => {
    const time = toDate(value)?.getTime();
    return time && now - time > 30 * day && now - time <= 60 * day;
  }).length;

  return current - previous;
};

const formatValue = (value: number, suffix = "") =>
  `${Math.round(value).toLocaleString()}${suffix}`;

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const start = performance.now();
    const duration = 720;

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <>{formatValue(displayValue, suffix)}</>;
}

function Sparkline({
  values,
  stroke,
  muted,
}: {
  values: number[];
  stroke: string;
  muted: string;
}) {
  const maxValue = Math.max(1, ...values);
  const points =
    values.length > 1
      ? values
          .map((value, index) => {
            const x = (index / (values.length - 1)) * 100;
            const y = 34 - (value / maxValue) * 28;
            return `${x},${y}`;
          })
          .join(" ")
      : "0,28 100,28";

  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full overflow-visible" aria-hidden>
      <polyline
        fill="none"
        points="0,34 100,34"
        stroke={muted}
        strokeDasharray="3 4"
        strokeWidth="1"
      />
      <polyline
        fill="none"
        points={points}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-current/15 p-5 text-center text-sm opacity-75">
      {label}
    </div>
  );
}

function KpiCard({
  card,
  darkMode,
}: {
  card: KpiCardData;
  darkMode: boolean;
}) {
  const Icon = card.icon;
  const TrendIcon =
    card.trend > 0 ? ArrowUpRight : card.trend < 0 ? ArrowDownRight : ArrowRight;
  const trendLabel =
    card.trend === 0 ? "Stable" : `${card.trend > 0 ? "+" : ""}${card.trend} vs previous period`;

  return (
    <div
      className={joinClasses(
        "group relative min-w-0 overflow-hidden rounded-3xl border p-4 transition duration-300 hover:-translate-y-1",
        darkMode
          ? "border-white/10 bg-white/[0.055] shadow-[0_22px_70px_rgba(0,0,0,0.24)]"
          : "border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.10)]",
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-80"
        style={{ background: card.accent }}
      />
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-35"
        style={{ background: card.accent }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={joinClasses(
              "break-words text-[11px] font-bold uppercase leading-tight tracking-[0.12em]",
              darkMode ? "text-slate-400" : "text-slate-600",
            )}
          >
            {card.label}
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            <AnimatedNumber value={card.value} suffix={card.suffix} />
          </div>
        </div>
        <div
          className="rounded-2xl border p-3"
          style={{
            borderColor: `${card.accent}55`,
            background: `${card.accent}18`,
            color: card.accent,
          }}
        >
          <Icon size={22} aria-hidden />
        </div>
      </div>
      <div className="mt-4">
        <Sparkline
          values={card.sparkline}
          stroke={card.accent}
          muted={darkMode ? "rgba(148,163,184,0.22)" : "rgba(100,116,139,0.22)"}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
        <TrendIcon
          size={15}
          className={
            card.trend > 0
              ? "text-[#4DEBFF]"
              : card.trend < 0
                ? "text-rose-400"
                : darkMode
                  ? "text-slate-400"
                  : "text-slate-500"
          }
          aria-hidden
        />
        <span className={darkMode ? "text-slate-300" : "text-slate-600"}>
          {trendLabel}
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  darkMode,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  darkMode: boolean;
}) {
  return (
    <section
      className={joinClasses(
        "relative min-w-0 overflow-hidden rounded-3xl border p-5 transition duration-300 hover:-translate-y-0.5",
        darkMode
          ? "border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
          : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#4DEBFF]/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p
              className={joinClasses(
                "mt-1 text-sm leading-6",
                darkMode ? "text-slate-400" : "text-slate-600",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          className={joinClasses(
            "rounded-2xl border p-2",
            darkMode
              ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#DDFBFF]"
              : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
          )}
        >
          <Icon size={18} aria-hidden />
        </div>
      </div>
      <div className="relative mt-5">{children}</div>
    </section>
  );
}

function LineTrendChart({
  data,
  darkMode,
}: {
  data: ChartPoint[];
  darkMode: boolean;
}) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.open, item.completed]));
  const buildPath = (key: "open" | "completed") =>
    data
      .map((item, index) => {
        const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
        const y = 74 - (item[key] / maxValue) * 58;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  if (data.every((item) => item.open === 0 && item.completed === 0)) {
    return <EmptyState label="No Action Tracker trend data yet." />;
  }

  return (
    <div className="min-h-[250px]">
      <svg viewBox="0 0 100 84" className="h-56 w-full overflow-visible" aria-hidden>
        {[16, 32, 48, 64, 80].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke={darkMode ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)"}
            strokeDasharray="2 4"
          />
        ))}
        <path
          d={`${buildPath("open")} L 100 80 L 0 80 Z`}
          fill="rgba(77,235,255,0.10)"
        />
        <path
          d={buildPath("open")}
          fill="none"
          stroke="#4DEBFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
        <path
          d={buildPath("completed")}
          fill="none"
          stroke="#22C55E"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </svg>
      <div className="grid grid-cols-6 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4DEBFF]" />
          Open
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      </div>
    </div>
  );
}

function DonutChart({
  data,
  darkMode,
}: {
  data: Array<{ label: string; value: number }>;
  darkMode: boolean;
}) {
  const colors = ["#4DEBFF", "#1E90FF", "#F59E0B", "#EF4444", "#8B5CF6", "#22C55E"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? data
          .map((item, index) => {
            const start = cursor;
            const size = (item.value / total) * 100;
            cursor += size;
            return `${colors[index]} ${start}% ${cursor}%`;
          })
          .join(", ")
      : `${darkMode ? "rgba(148,163,184,0.16)" : "rgba(203,213,225,0.7)"} 0% 100%`;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
      <div className="relative mx-auto h-52 w-52">
        <div
          className="h-full w-full rounded-full shadow-[0_0_40px_rgba(77,235,255,0.12)]"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div
          className={joinClasses(
            "absolute inset-8 flex flex-col items-center justify-center rounded-full border text-center",
            darkMode ? "border-white/10 bg-[#071225]" : "border-slate-200 bg-white",
          )}
        >
          <div className="text-3xl font-bold">{total}</div>
          <div className={joinClasses("text-xs uppercase tracking-[0.14em]", darkMode ? "text-slate-400" : "text-slate-600")}>
            Events
          </div>
        </div>
      </div>
      {total > 0 ? (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: colors[index] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No incident event categories recorded yet." />
      )}
    </div>
  );
}

function HorizontalBars({
  data,
  emptyLabel,
  color = "#4DEBFF",
  darkMode,
  showPercent = false,
}: {
  data: Array<{ label: string; value: number }>;
  emptyLabel: string;
  color?: string;
  darkMode: boolean;
  showPercent?: boolean;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const visibleData = data.filter((item) => item.value > 0);

  if (visibleData.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="space-y-3">
      {visibleData.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 font-semibold">
              {item.value}
              {showPercent && totalValue > 0
                ? ` (${percentage(item.value, totalValue)}%)`
                : ""}
            </span>
          </div>
          <div
            className={joinClasses(
              "h-3 overflow-hidden rounded-full",
              darkMode ? "bg-white/10" : "bg-slate-100",
            )}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(8, (item.value / maxValue) * 100)}%`,
                background: `linear-gradient(90deg, ${color}, #1E90FF)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RadialProgress({
  item,
  darkMode,
}: {
  item: {
    label: string;
    value: number;
    total: number;
    expired?: number;
    expiringSoon?: number;
  };
  darkMode: boolean;
}) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (item.value / 100) * circumference;
  const hasData = item.total > 0;

  return (
    <div
      className={joinClasses(
        "rounded-2xl border p-4 text-center",
        darkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50",
      )}
    >
      <svg viewBox="0 0 100 100" className="mx-auto h-24 w-24 -rotate-90">
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="38"
          stroke={darkMode ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.16)"}
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          fill="none"
          r="38"
          stroke={hasData ? "#4DEBFF" : darkMode ? "#334155" : "#CBD5E1"}
          strokeDasharray={circumference}
          strokeDashoffset={hasData ? offset : circumference}
          strokeLinecap="round"
          strokeWidth="9"
        />
      </svg>
      <div className="-mt-[68px] mb-9 text-xl font-bold">
        {hasData ? `${item.value}%` : "N/A"}
      </div>
      <div className="mt-2 text-sm font-semibold">{item.label}</div>
      <div className={joinClasses("mt-1 text-xs", darkMode ? "text-slate-400" : "text-slate-600")}>
        {hasData ? `${item.total} requirements` : "No employee data"}
      </div>
      {hasData ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
          <div
            className={joinClasses(
              "rounded-lg border px-2 py-1",
              darkMode
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            Soon {item.expiringSoon ?? 0}
          </div>
          <div
            className={joinClasses(
              "rounded-lg border px-2 py-1",
              darkMode
                ? "border-rose-400/20 bg-rose-500/10 text-rose-100"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            Expired {item.expired ?? 0}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VerticalBarChart({
  data,
  darkMode,
}: {
  data: Array<{ label: string; value: number }>;
  darkMode: boolean;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  if (data.every((item) => item.value === 0)) {
    return <EmptyState label="No high-risk activity patterns found yet." />;
  }

  return (
    <div className="flex min-h-[260px] items-end gap-3 overflow-x-auto pb-2">
      {data.map((item) => (
        <div key={item.label} className="flex min-w-[82px] flex-1 flex-col items-center gap-3">
          <div className="flex h-40 w-full items-end rounded-2xl border border-current/10 p-1">
            <div
              className="w-full rounded-xl bg-gradient-to-t from-rose-500 via-amber-400 to-[#4DEBFF] transition-all duration-700"
              style={{ height: `${Math.max(8, (item.value / maxValue) * 100)}%` }}
            />
          </div>
          <div className="text-center text-xs font-semibold leading-tight">{item.value}</div>
          <div className={joinClasses("text-center text-[11px] leading-tight", darkMode ? "text-slate-400" : "text-slate-600")}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectionTrend({
  data,
  darkMode,
}: {
  data: InspectionPoint[];
  darkMode: boolean;
}) {
  if (data.length === 0) {
    return <EmptyState label="No saved inspection history yet." />;
  }

  const maxFailed = Math.max(1, ...data.map((item) => item.failed));
  const scorePath = data
    .map((item, index) => {
      const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
      const y = 72 - (item.score / 100) * 58;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const failedPath = data
    .map((item, index) => {
      const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
      const y = 72 - (item.failed / maxFailed) * 58;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox="0 0 100 84" className="h-56 w-full overflow-visible" aria-hidden>
        {[16, 32, 48, 64, 80].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke={darkMode ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)"}
            strokeDasharray="2 4"
          />
        ))}
        <path
          d={scorePath}
          fill="none"
          stroke="#4DEBFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d={failedPath}
          fill="none"
          stroke="#F97316"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
      </svg>
      <div className="grid gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4DEBFF]" />
          Score
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          Failed findings
        </span>
      </div>
    </div>
  );
}

const heatTone = (value: number, darkMode: boolean) => {
  if (value >= 12) {
    return darkMode
      ? "bg-rose-500/28 text-rose-50 border-rose-400/30"
      : "bg-rose-100 text-rose-800 border-rose-200";
  }

  if (value >= 7) {
    return darkMode
      ? "bg-orange-400/24 text-orange-50 border-orange-300/30"
      : "bg-orange-100 text-orange-800 border-orange-200";
  }

  if (value >= 3) {
    return darkMode
      ? "bg-amber-300/20 text-amber-50 border-amber-300/30"
      : "bg-amber-100 text-amber-800 border-amber-200";
  }

  return darkMode
    ? "bg-emerald-400/12 text-emerald-50 border-emerald-300/20"
    : "bg-emerald-50 text-emerald-800 border-emerald-200";
};

function RiskHeatmap({
  data,
  darkMode,
  hasData,
}: {
  data: HeatmapRow[];
  darkMode: boolean;
  hasData: boolean;
}) {
  const hasSignals = data.some((row) =>
    row.cells.some((cell) => cell.value > 0),
  );

  return (
    <div>
      {!hasData ? (
        <div className="mb-4 rounded-2xl border border-dashed border-current/15 p-4 text-sm opacity-75">
          No data available yet. Create actions, incidents, trainings, risk
          assessments, or inspections to populate this risk heatmap.
        </div>
      ) : !hasSignals ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-500">
          No active exposure signals detected in the selected filters.
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <div className="min-w-[520px] space-y-2">
        {data.map((row) => (
          <div key={row.label} className="grid grid-cols-[140px_1fr] gap-2">
            <div className={joinClasses("truncate rounded-xl border px-3 py-2 text-sm font-semibold", darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-slate-50")}>
              {row.label}
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))` }}>
              {row.cells.map((cell) => (
                <div
                  key={`${row.label}-${cell.label}`}
                  className={joinClasses(
                    "rounded-xl border px-3 py-2 text-center text-xs font-bold",
                    heatTone(cell.value, darkMode),
                  )}
                  title={`${row.label} / ${cell.label}: ${cell.value}`}
                >
                  <div className="truncate">{cell.label}</div>
                  <div className="mt-1 text-lg">{hasData ? cell.value : "-"}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

function BubbleFactors({
  data,
  darkMode,
}: {
  data: Array<{ label: string; value: number }>;
  darkMode: boolean;
}) {
  if (data.length === 0) {
    return <EmptyState label="No recurring incident factors detected yet." />;
  }

  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="flex min-h-[250px] flex-wrap items-center justify-center gap-3">
      {data.map((item, index) => {
        const size = 72 + (item.value / maxValue) * 72;
        return (
          <div
            key={item.label}
            className={joinClasses(
              "flex shrink-0 flex-col items-center justify-center rounded-full border p-3 text-center transition duration-300 hover:scale-105",
              darkMode
                ? "border-[#4DEBFF]/20 bg-[#4DEBFF]/10 text-[#DDFBFF]"
                : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
            )}
            style={{
              width: size,
              height: size,
              animationDelay: `${index * 80}ms`,
            }}
          >
            <div className="text-xl font-bold">{item.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight">
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const severityTone = (
  severity: "good" | "success" | "info" | "warning" | "critical",
  darkMode: boolean,
) => {
  if (severity === "critical") {
    return darkMode
      ? "border-rose-400/30 bg-rose-500/12 text-rose-100"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (severity === "warning") {
    return darkMode
      ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (severity === "good" || severity === "success") {
    return darkMode
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return darkMode
    ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#DDFBFF]"
    : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]";
};

const sourceIcon = (source: SourceFilter): LucideIcon => {
  if (source === "Action Tracker") {
    return CheckCircle2;
  }

  if (source === "Risk Assessments") {
    return TriangleAlert;
  }

  if (source === "Incident Management") {
    return HeartPulse;
  }

  if (source === "Training Management") {
    return GraduationCap;
  }

  if (source === "Inspections") {
    return ClipboardCheck;
  }

  return Radar;
};

const formatActivityDate = (value: string) => {
  const date = toDate(value);

  if (!date) {
    return "No date";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function FilterBar({
  filters,
  options,
  onChange,
  darkMode,
}: {
  filters: AnalyticsFilters;
  options: ReturnType<typeof getFilterOptions>;
  onChange: <Key extends keyof AnalyticsFilters>(
    key: Key,
    value: AnalyticsFilters[Key],
  ) => void;
  darkMode: boolean;
}) {
  const fieldClass = joinClasses(
    "h-11 w-full rounded-xl border px-3 text-sm font-semibold outline-none transition",
    darkMode
      ? "border-white/10 bg-[#071225] text-white focus:border-[#4DEBFF]/45"
      : "border-slate-200 bg-white text-slate-900 focus:border-[#1E90FF] focus:ring-4 focus:ring-[#1E90FF]/10",
  );
  const labelClass = joinClasses(
    "text-[11px] font-bold uppercase tracking-[0.12em]",
    darkMode ? "text-slate-400" : "text-slate-600",
  );

  return (
    <div className="relative border-b border-white/10 px-5 py-4 sm:px-7">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0">
          <span className={labelClass}>Time period</span>
          <select
            className={joinClasses(fieldClass, "mt-2")}
            value={filters.timePeriod}
            onChange={(event) =>
              onChange("timePeriod", event.target.value as TimePeriod)
            }
          >
            {timePeriodOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={labelClass}>Site / Location</span>
          <select
            className={joinClasses(fieldClass, "mt-2")}
            value={filters.site}
            onChange={(event) => onChange("site", event.target.value)}
          >
            <option>All sites</option>
            {options.sites.map((site) => (
              <option key={site}>{site}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={labelClass}>Department</span>
          <select
            className={joinClasses(fieldClass, "mt-2")}
            value={filters.department}
            onChange={(event) => onChange("department", event.target.value)}
          >
            <option>All departments</option>
            {options.departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={labelClass}>Source module</span>
          <select
            className={joinClasses(fieldClass, "mt-2")}
            value={filters.source}
            onChange={(event) =>
              onChange("source", event.target.value as SourceFilter)
            }
          >
            {sourceFilterOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function NeedsAttentionPanel({
  alerts,
  darkMode,
}: {
  alerts: AttentionAlert[];
  darkMode: boolean;
}) {
  return (
    <section
      className={joinClasses(
        "relative min-w-0 overflow-hidden rounded-3xl border p-5",
        darkMode
          ? "border-rose-400/20 bg-rose-500/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
          : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
      )}
    >
      <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-rose-500/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-rose-300">
            <AlertTriangle size={14} aria-hidden />
            Needs Attention
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            Operational alert queue
          </h2>
        </div>
        <div className="rounded-2xl border border-current/15 px-3 py-2 text-2xl font-bold">
          {alerts.length}
        </div>
      </div>
      <div className="relative mt-5 space-y-3">
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const Icon = sourceIcon(alert.source);

            return (
              <div
                key={`${alert.source}-${alert.title}`}
                className={joinClasses(
                  "rounded-2xl border p-4 transition hover:-translate-y-0.5",
                  severityTone(alert.severity, darkMode),
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon size={15} aria-hidden />
                      <h3 className="font-semibold">{alert.title}</h3>
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {alert.source}
                      </span>
                    </div>
                    <p className="mt-1 text-sm opacity-85">{alert.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-xl border border-current/20 px-3 py-1 text-lg font-bold">
                      {alert.count}
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-current/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] opacity-90 transition hover:opacity-100"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div
            className={joinClasses(
              "rounded-2xl border p-5 text-sm font-semibold",
              severityTone("good", darkMode),
            )}
          >
            All critical indicators are under control.
          </div>
        )}
      </div>
    </section>
  );
}

function PriorityBreakdown({
  data,
  darkMode,
}: {
  data: Array<{ label: string; value: number }>;
  darkMode: boolean;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors: Record<string, string> = {
    Low: "#22C55E",
    Medium: "#F59E0B",
    High: "#F97316",
    Critical: "#EF4444",
  };

  if (total === 0) {
    return <EmptyState label="No Action Tracker priority data available yet." />;
  }

  return (
    <div>
      <div
        className={joinClasses(
          "flex h-8 overflow-hidden rounded-full border",
          darkMode ? "border-white/10 bg-white/10" : "border-slate-200 bg-slate-100",
        )}
      >
        {data.map((item) => (
          <div
            key={item.label}
            className="h-full transition-all duration-700"
            style={{
              width: `${(item.value / total) * 100}%`,
              background: colors[item.label],
            }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.map((item) => (
          <div
            key={item.label}
            className={joinClasses(
              "rounded-2xl border p-3",
              darkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colors[item.label] }}
              />
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-bold">{item.value}</div>
            <div className={joinClasses("mt-1 text-xs", darkMode ? "text-slate-400" : "text-slate-600")}>
              {percentage(item.value, total)}% of actions
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationalProblemsRanking({
  data,
  darkMode,
}: {
  data: OperationalProblem[];
  darkMode: boolean;
}) {
  if (data.length === 0) {
    return (
      <EmptyState label="No data available yet. Create actions/incidents/trainings to populate this chart." />
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div
          key={item.label}
          className={joinClasses(
            "rounded-2xl border p-4",
            darkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
                  {index + 1}
                </span>
                <h3 className="font-semibold">{item.label}</h3>
                <span
                  className={joinClasses(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                    severityTone(item.severity, darkMode),
                  )}
                >
                  {item.severity}
                </span>
              </div>
              <div className={joinClasses("mt-2 text-xs font-semibold uppercase tracking-[0.12em]", darkMode ? "text-slate-400" : "text-slate-600")}>
                {item.source}
              </div>
            </div>
            <div className="rounded-2xl border border-current/15 px-4 py-2 text-2xl font-bold">
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivityFeed({
  data,
  darkMode,
}: {
  data: ActivityFeedItem[];
  darkMode: boolean;
}) {
  if (data.length === 0) {
    return (
      <EmptyState label="No data available yet. New actions, incidents, trainings, risk assessments, and inspections will appear here." />
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const Icon = sourceIcon(item.source);

        return (
          <div
            key={item.id}
            className={joinClasses(
              "flex items-start gap-3 rounded-2xl border p-3",
              darkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50",
            )}
          >
            <div className={joinClasses("rounded-xl border p-2", severityTone(item.tone, darkMode))}>
              <Icon size={15} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-semibold">{item.label}</div>
              <div className={joinClasses("mt-1 flex flex-wrap gap-2 text-xs", darkMode ? "text-slate-400" : "text-slate-600")}>
                <span>{item.source}</span>
                <span aria-hidden>•</span>
                <span>{formatActivityDate(item.date)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HseAnalyticsModule({
  userId,
  darkMode,
  onToggleTheme,
}: AnalyticsModuleProps) {
  const theme = getTheme(darkMode);
  const [data, setData] = useState<AnalyticsData>(() => ({
    actions: [],
    incidents: [],
    training: emptyTrainingData,
    risks: [],
    inspections: [],
  }));
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);

  useEffect(() => {
    const load = () => setData(loadAnalyticsData(userId));
    const timeoutId = window.setTimeout(load, 0);

    window.addEventListener("storage", load);
    window.addEventListener("focus", load);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("storage", load);
      window.removeEventListener("focus", load);
    };
  }, [userId]);

  const filterOptions = useMemo(() => getFilterOptions(data), [data]);
  const filteredData = useMemo(
    () => filterAnalyticsData(data, filters),
    [data, filters],
  );
  const updateFilter = <Key extends keyof AnalyticsFilters>(
    key: Key,
    value: AnalyticsFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const analytics = useMemo(() => {
    const actionTrend = buildActionTrend(filteredData.actions);
    const incidentTypeCounts = buildIncidentTypeCounts(filteredData.incidents);
    const rootCauseCounts = buildRootCauseCounts(filteredData.incidents);
    const trainingGaps = getTrainingGapCounts(filteredData.training);
    const trainingCompliance = buildTrainingCompliance(filteredData.training);
    const highRiskActivities = buildHighRiskActivities(filteredData.risks);
    const inspectionTrend = buildInspectionTrend(filteredData.inspections);
    const riskHeatmap = buildRiskHeatmap(filteredData);
    const topProblems = deriveProblemCounts(filteredData);
    const recurringFactors = buildRecurringFactors(filteredData.incidents);
    const needsAttention = makeNeedsAttention(filteredData);
    const actionPriorityCounts = buildActionPriorityCounts(filteredData.actions);
    const recentActivity = buildRecentActivity(filteredData);
    const highResidualRisks = filteredData.risks.reduce(
      (count, assessment) =>
        count +
        assessment.hazards.filter(
          (hazard) =>
            hazardResidualLevel(hazard) === "High" && hazard.status !== "Closed",
        ).length,
      0,
    );
    const openIncidents = filteredData.incidents.filter(
      (incident) => incident.status !== "Closed",
    ).length;
    const overallCompliance = buildCompliancePercent(filteredData);
    const actionSparkline = actionTrend.map((item) => item.open + item.completed);
    const inspectionSparkline =
      inspectionTrend.length > 0 ? inspectionTrend.map((item) => item.score) : [0, 0, 0];

    return {
      actionTrend,
      incidentTypeCounts,
      rootCauseCounts,
      trainingGaps,
      trainingCompliance,
      highRiskActivities,
      inspectionTrend,
      riskHeatmap,
      topProblems,
      recurringFactors,
      needsAttention,
      actionPriorityCounts,
      recentActivity,
      kpis: [
        {
          label: "Open Actions",
          value: filteredData.actions.filter((action) => !isClosedAction(action)).length,
          icon: CheckCircle2,
          accent: "#4DEBFF",
          trend: trendForLast30Days(
            filteredData.actions
              .filter((action) => !isClosedAction(action))
              .map((action) => action.createdDate),
          ),
          sparkline: actionTrend.map((item) => item.open),
        },
        {
          label: "Overdue Actions",
          value: filteredData.actions.filter(isOverdueAction).length,
          icon: AlertTriangle,
          accent: "#F97316",
          trend: trendForLast30Days(
            filteredData.actions.filter(isOverdueAction).map((action) => action.dueDate),
          ),
          sparkline: actionSparkline,
        },
        {
          label: "Critical Risks",
          value: highResidualRisks,
          icon: ShieldAlert,
          accent: "#EF4444",
          trend: trendForLast30Days(filteredData.risks.map((risk) => risk.savedAt)),
          sparkline: highRiskActivities.map((item) => item.value),
        },
        {
          label: "Open Incidents",
          value: openIncidents,
          icon: HeartPulse,
          accent: "#8B5CF6",
          trend: trendForLast30Days(
            filteredData.incidents
              .filter((incident) => incident.status !== "Closed")
              .map((incident) => incident.dateTime || incident.createdAt),
          ),
          sparkline: incidentTypeCounts.map((item) => item.value),
        },
        {
          label: "Expired Trainings",
          value: trainingGaps.expired,
          icon: GraduationCap,
          accent: "#F59E0B",
          trend: 0,
          sparkline: [
            trainingGaps.valid,
            trainingGaps.expiringSoon,
            trainingGaps.expired,
            trainingGaps.missing,
          ],
        },
        {
          label: "Overall Compliance",
          value: overallCompliance,
          suffix: "%",
          icon: Target,
          accent: "#22C55E",
          trend: inspectionTrend.length > 1
            ? inspectionTrend[inspectionTrend.length - 1].score -
              inspectionTrend[inspectionTrend.length - 2].score
            : 0,
          sparkline: inspectionSparkline,
        },
      ] satisfies KpiCardData[],
    };
  }, [filteredData]);

  const hasAnyData =
    data.actions.length +
      data.incidents.length +
      data.risks.length +
      data.inspections.length +
      data.training.employees.length +
      data.training.records.length >
    0;
  const hasFilteredData =
    filteredData.actions.length +
      filteredData.incidents.length +
      filteredData.risks.length +
      filteredData.inspections.length +
      filteredData.training.employees.length +
      filteredData.training.records.length >
    0;

  return (
    <div
      className={joinClasses(
        "relative z-10 min-h-screen w-full min-w-0 px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-10 lg:py-10",
        theme.pageText,
      )}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div
          className={joinClasses(
            "relative overflow-hidden rounded-3xl border backdrop-blur-2xl",
            theme.shell,
            theme.glow,
          )}
        >
          <div className="absolute inset-0 opacity-30">
            <div className="h-full w-full bg-[linear-gradient(rgba(77,235,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(77,235,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
          </div>
          <div className="relative flex flex-col gap-5 border-b border-white/10 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#4DEBFF]">
                <Radar size={14} aria-hidden />
                HSE Analytics
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
                HSE Operational Intelligence Dashboard
              </h1>
              <p
                className={joinClasses(
                  "mt-3 max-w-4xl text-sm leading-6 sm:text-base",
                  theme.muted,
                )}
              >
                Monitor operational risks, incidents, actions, training compliance,
                and inspection performance across all Laboria workflows.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className={joinClasses(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
                theme.themeToggleButton,
              )}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
          </div>

          <FilterBar
            filters={filters}
            options={filterOptions}
            onChange={updateFilter}
            darkMode={darkMode}
          />

          <div className="relative px-5 pt-5 sm:px-7">
            <OrbitAiToolStrip
              darkMode={darkMode}
              userId={userId}
              compact
              title="Analytics AI"
              sourceModule="HSE Analytics"
              toolIds={[
                "workspace-analysis",
                "risk-trends",
                "executive-summary",
                "predictive-warning",
              ]}
            />
          </div>

          <div className="relative grid gap-4 p-5 sm:p-7 md:grid-cols-2 xl:grid-cols-6">
            {analytics.kpis.map((card) => (
              <KpiCard key={card.label} card={card} darkMode={darkMode} />
            ))}
          </div>
        </div>

        {!hasAnyData ? (
          <div
            className={joinClasses(
              "rounded-3xl border p-6 text-sm leading-6",
              theme.panel,
              theme.muted,
            )}
          >
            Analytics will populate as users save inspections, risk assessments,
            actions, training records, and incident workflows. No operational records
            are stored yet.
          </div>
        ) : null}

        {hasAnyData && !hasFilteredData ? (
          <div
            className={joinClasses(
              "rounded-3xl border p-6 text-sm leading-6",
              theme.panel,
              theme.muted,
            )}
          >
            No data is available for the selected analytics filters. Adjust the
            period, site, department, or source module to widen the command view.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <NeedsAttentionPanel
              alerts={analytics.needsAttention}
              darkMode={darkMode}
            />
          </div>
          <ChartCard
            title="Action Priority Breakdown"
            subtitle="Low, medium, high, and critical actions"
            icon={ShieldAlert}
            className="xl:col-span-5"
            darkMode={darkMode}
          >
            <PriorityBreakdown
              data={analytics.actionPriorityCounts}
              darkMode={darkMode}
            />
          </ChartCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <ChartCard
            title="Action Completion Trend"
            subtitle="Open and completed actions by month"
            icon={LineChart}
            className="xl:col-span-7"
            darkMode={darkMode}
          >
            <LineTrendChart data={analytics.actionTrend} darkMode={darkMode} />
          </ChartCard>

          <ChartCard
            title="Incident Severity Breakdown"
            subtitle="Event categories recorded in Incident Management"
            icon={HeartPulse}
            className="xl:col-span-5"
            darkMode={darkMode}
          >
            <DonutChart data={analytics.incidentTypeCounts} darkMode={darkMode} />
          </ChartCard>

          <ChartCard
            title="Root Cause Analysis"
            subtitle="Recurring investigation causes"
            icon={TriangleAlert}
            className="xl:col-span-5"
            darkMode={darkMode}
          >
            <HorizontalBars
              data={analytics.rootCauseCounts}
              emptyLabel="No incident root causes selected yet."
              darkMode={darkMode}
              showPercent
            />
          </ChartCard>

          <ChartCard
            title="Training Compliance"
            subtitle="Department competency coverage"
            icon={GraduationCap}
            className="xl:col-span-7"
            darkMode={darkMode}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {analytics.trainingCompliance.map((item) => (
                <RadialProgress key={item.label} item={item} darkMode={darkMode} />
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="High Risk Activities"
            subtitle="High initial or residual risks from assessments"
            icon={Flame}
            className="xl:col-span-6"
            darkMode={darkMode}
          >
            <VerticalBarChart data={analytics.highRiskActivities} darkMode={darkMode} />
          </ChartCard>

          <ChartCard
            title="Inspection Performance"
            subtitle="Inspection scores and failed findings over time"
            icon={ClipboardCheck}
            className="xl:col-span-6"
            darkMode={darkMode}
          >
            <InspectionTrend data={analytics.inspectionTrend} darkMode={darkMode} />
          </ChartCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <ChartCard
            title="Risk Heatmap"
            subtitle="Site and department exposure from live workflow data"
            icon={Zap}
            className="xl:col-span-7"
            darkMode={darkMode}
          >
            <RiskHeatmap
              data={analytics.riskHeatmap}
              darkMode={darkMode}
              hasData={hasFilteredData}
            />
          </ChartCard>

          <ChartCard
            title="Recent Operational Activity"
            subtitle="Latest saved records across Laboria workflows"
            icon={LineChart}
            className="xl:col-span-5"
            darkMode={darkMode}
          >
            <RecentActivityFeed
              data={analytics.recentActivity}
              darkMode={darkMode}
            />
          </ChartCard>

          <ChartCard
            title="Top Operational Problems"
            subtitle="Ranked themes from inspections, incidents, risk controls, and training gaps"
            icon={BarChart3}
            className="xl:col-span-6"
            darkMode={darkMode}
          >
            <OperationalProblemsRanking
              data={analytics.topProblems}
              darkMode={darkMode}
            />
          </ChartCard>

          <ChartCard
            title="Recurring Incident Factors"
            subtitle="Repeated event types, departments, and root causes"
            icon={Radar}
            className="xl:col-span-6"
            darkMode={darkMode}
          >
            <BubbleFactors data={analytics.recurringFactors} darkMode={darkMode} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
