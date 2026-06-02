"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  Filter,
  Gauge,
  GraduationCap,
  HeartPulse,
  Lock,
  Moon,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ALL_CHECKLISTS } from "@/app/data/checklists";
import type { OrbitNotification } from "@/app/lib/notificationCenter";
import OrbitAiModal from "@/app/components/OrbitAiModal";
import {
  getOrbitAiAccount,
  getOrbitAiTool,
  orbitAiAccountUpdatedEvent,
  type OrbitAiToolId,
} from "@/app/lib/orbitAi";
import {
  ORBIT_PRO_PLAN,
  isOrbitAiToolAvailableForPlan,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";
import {
  readActionTrackerActions,
  type HseAction,
} from "@/app/lib/actionTracker";
import type { WorkspaceSettings } from "@/app/lib/workspaceSettings";
import {
  createWorkspaceNavigationIntent,
  type WorkspaceNavigationIntent,
  type WorkspaceNavigationRequest,
} from "@/app/lib/workspaceNavigation";

type OrbitCommandCenterModuleProps = {
  userId: string | null;
  darkMode: boolean;
  workspaceSettings: WorkspaceSettings;
  notifications: OrbitNotification[];
  onToggleTheme: () => void;
  onNavigate: (intent: WorkspaceNavigationIntent) => void;
  onOpenNotification: (notification: OrbitNotification) => void;
  onOpenNotificationCenter: () => void;
};

type TimePeriod = "Last 7 days" | "Last 30 days" | "This month" | "All time";
type RiskLevelFilter = "All risk levels" | "Low" | "Medium" | "High";

type DashboardFilters = {
  site: string;
  department: string;
  incidentType: string;
  riskLevel: RiskLevelFilter;
  timePeriod: TimePeriod;
};

type IncidentEvent = {
  id: string;
  title: string;
  eventType: string;
  dateTime: string;
  siteLocation: string;
  department: string;
  severity: string;
  status: string;
  description: string;
  rootCauses: string[];
  reportedBy: string;
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
  responsiblePerson: string;
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
  comments: Record<string, string>;
  result: {
    percent: number;
    status: string;
  };
  savedAt: string;
};

type DashboardData = {
  actions: HseAction[];
  incidents: IncidentEvent[];
  training: TrainingData;
  risks: RiskAssessment[];
  inspections: SavedInspection[];
};

type FeedItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  source: string;
  tone: "info" | "success" | "warning" | "critical";
  icon: LucideIcon;
  navigation?: WorkspaceNavigationRequest;
};

type KpiCard = {
  label: string;
  value: number;
  suffix?: string;
  detail: string;
  trend: number;
  sparkline: number[];
  icon: LucideIcon;
  tone: "blue" | "green" | "yellow" | "red" | "cyan";
  navigation?: WorkspaceNavigationRequest;
  action?: "scroll-risk-overview";
};

type ChartDatum = {
  label: string;
  value: number;
  secondary?: number;
};

const emptyTrainingData: TrainingData = {
  employees: [],
  trainingTypes: [],
  records: [],
};

const defaultFilters: DashboardFilters = {
  site: "All Sites",
  department: "All Departments",
  incidentType: "All Incident Types",
  riskLevel: "All risk levels",
  timePeriod: "All time",
};

const timePeriodOptions: TimePeriod[] = [
  "Last 7 days",
  "Last 30 days",
  "This month",
  "All time",
];

const riskLevelOptions: RiskLevelFilter[] = [
  "All risk levels",
  "Low",
  "Medium",
  "High",
];

const commonDepartmentLabels = [
  "Operations",
  "Maintenance",
  "Warehouse",
  "Office",
  "Contractors",
];

const rootCauseLabels = [
  "Human Factor",
  "Procedure / System Failure",
  "Missing or Ineffective Training",
  "Work Environment",
  "Supervision / Management",
  "PPE / Protection Failure",
  "Communication Failure",
];

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const getTheme = (darkMode: boolean) => ({
  page: darkMode
    ? "bg-[#061022] text-[#F5F7FA]"
    : "bg-slate-50 text-slate-950",
  shell: darkMode
    ? "border-white/10 bg-[#071225]/86 shadow-[0_30px_100px_rgba(0,0,0,0.34)]"
    : "border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]",
  card: darkMode
    ? "border-white/10 bg-white/[0.055] shadow-[0_22px_80px_rgba(0,0,0,0.24)]"
    : "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
  softCard: darkMode
    ? "border-white/10 bg-white/[0.04]"
    : "border-slate-200 bg-slate-50/80",
  input: darkMode
    ? "border-white/10 bg-[#08172D]/85 text-white shadow-inner shadow-black/10"
    : "border-slate-200 bg-white text-slate-900 shadow-sm",
  muted: darkMode ? "text-slate-400" : "text-slate-600",
  soft: darkMode ? "text-slate-300" : "text-slate-700",
  heading: darkMode ? "text-white" : "text-slate-950",
  line: darkMode ? "border-white/10" : "border-slate-200",
});

const getUserStorageKey = (userId: string | null, suffix: string) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_${suffix}`
    : `laboria_${suffix}`;

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

const formatDateTime = (value: Date) =>
  value.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const compactNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard" }).format(
    Math.round(value),
  );

const percentage = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 100;

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleString(undefined, { month: "short" });

const recentMonths = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1 - index),
      1,
    );
    return {
      key: monthKey(date),
      label: monthLabel(date),
    };
  });
};

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

  return date >= new Date(now.getFullYear(), now.getMonth(), 1);
};

const matchesSelection = (value: string, selected: string, allLabel: string) =>
  selected === allLabel || value === selected;

const isClosedAction = (action: HseAction) =>
  action.status === "Completed" || action.status === "Closed";

const isOverdueAction = (action: HseAction) => {
  if (!action.dueDate || isClosedAction(action)) {
    return false;
  }

  const dueDate = new Date(`${action.dueDate}T23:59:59`);
  return Number.isFinite(dueDate.getTime()) && dueDate.getTime() < Date.now();
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

const primaryActionDate = (action: HseAction) =>
  action.lastUpdated || action.createdDate || action.dueDate;

const primaryIncidentDate = (incident: IncidentEvent) =>
  incident.dateTime || incident.updatedAt || incident.createdAt;

const primaryRiskDate = (assessment: RiskAssessment) =>
  assessment.header.assessmentDate || assessment.savedAt;

const primaryInspectionDate = (inspection: SavedInspection) =>
  inspection.inspectionDate || inspection.savedAt;

const readIncidents = (userId: string | null): IncidentEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [
    getUserStorageKey(userId, "incident_management"),
    "laboria_incident_management",
  ];
  const seen = new Set<string>();

  return keys
    .flatMap((key) => {
      const parsed = safeJsonParse(window.localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
    })
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: getString(item.id) || `${Date.now()}-${Math.random()}`,
      title: getString(item.title) || "Untitled incident",
      eventType: getString(item.eventType) || "Incident",
      dateTime: getString(item.dateTime),
      siteLocation: getString(item.siteLocation),
      department: getString(item.department),
      severity: getString(item.severity) || "Medium",
      status: getString(item.status) || "Reported",
      description: getString(item.description),
      reportedBy: getString(item.reportedBy),
      rootCauses: Array.isArray(item.rootCauses)
        ? item.rootCauses.filter(
            (rootCause): rootCause is string => typeof rootCause === "string",
          )
        : [],
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
  const seen = new Set<number>();

  return keys
    .flatMap((key) => {
      const parsed = safeJsonParse(window.localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
    })
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
                initialProbability: clamp(
                  getNumber(hazard.initialProbability, 1),
                  1,
                  5,
                ),
                initialSeverity: clamp(
                  getNumber(hazard.initialSeverity, 1),
                  1,
                  5,
                ),
                residualProbability: clamp(
                  getNumber(hazard.residualProbability, 1),
                  1,
                  5,
                ),
                residualSeverity: clamp(
                  getNumber(hazard.residualSeverity, 1),
                  1,
                  5,
                ),
                responsiblePerson: getString(hazard.responsiblePerson),
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
      const parsed = safeJsonParse(window.localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
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
        id: getNumber(item.id, Date.now()),
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

const loadDashboardData = (userId: string | null): DashboardData => ({
  actions: readActionTrackerActions(userId),
  incidents: readIncidents(userId),
  training: readTrainingData(userId),
  risks: readRiskAssessments(userId),
  inspections: readInspections(userId),
});

const filterDashboardData = (
  data: DashboardData,
  filters: DashboardFilters,
): DashboardData => {
  const actions = data.actions.filter(
    (action) =>
      isWithinTimePeriod(primaryActionDate(action), filters.timePeriod) &&
      matchesSelection(action.siteLocation, filters.site, "All Sites") &&
      matchesSelection(action.department, filters.department, "All Departments"),
  );
  const incidents = data.incidents.filter(
    (incident) =>
      isWithinTimePeriod(primaryIncidentDate(incident), filters.timePeriod) &&
      matchesSelection(incident.siteLocation, filters.site, "All Sites") &&
      matchesSelection(
        incident.department,
        filters.department,
        "All Departments",
      ) &&
      matchesSelection(
        incident.eventType,
        filters.incidentType,
        "All Incident Types",
      ),
  );
  const risks = data.risks
    .filter(
      (assessment) =>
        isWithinTimePeriod(primaryRiskDate(assessment), filters.timePeriod) &&
        matchesSelection(assessment.header.site, filters.site, "All Sites") &&
        matchesSelection(
          assessment.header.department,
          filters.department,
          "All Departments",
        ),
    )
    .map((assessment) => ({
      ...assessment,
      hazards:
        filters.riskLevel === "All risk levels"
          ? assessment.hazards
          : assessment.hazards.filter(
              (hazard) =>
                hazardResidualLevel(hazard) === filters.riskLevel ||
                hazardInitialLevel(hazard) === filters.riskLevel,
            ),
    }));
  const employees = data.training.employees.filter(
    (employee) =>
      matchesSelection(employee.siteLocation, filters.site, "All Sites") &&
      matchesSelection(employee.department, filters.department, "All Departments"),
  );
  const employeeIds = new Set(employees.map((employee) => employee.id));
  const trainingRecords = data.training.records.filter(
    (record) =>
      employeeIds.has(record.employeeId) &&
      isWithinTimePeriod(
        record.completedDate || record.expiryDate,
        filters.timePeriod,
      ),
  );
  const inspections = data.inspections.filter(
    (inspection) =>
      isWithinTimePeriod(primaryInspectionDate(inspection), filters.timePeriod) &&
      matchesSelection(inspection.site, filters.site, "All Sites") &&
      filters.department === "All Departments",
  );

  return {
    actions,
    incidents,
    risks,
    inspections,
    training: {
      employees,
      trainingTypes: data.training.trainingTypes,
      records: trainingRecords,
    },
  };
};

const getFilterOptions = (data: DashboardData) => {
  const sites = new Set<string>();
  const departments = new Set<string>();
  const incidentTypes = new Set<string>();

  data.actions.forEach((action) => {
    if (action.siteLocation) sites.add(action.siteLocation);
    if (action.department) departments.add(action.department);
  });
  data.incidents.forEach((incident) => {
    if (incident.siteLocation) sites.add(incident.siteLocation);
    if (incident.department) departments.add(incident.department);
    if (incident.eventType) incidentTypes.add(incident.eventType);
  });
  data.risks.forEach((assessment) => {
    if (assessment.header.site) sites.add(assessment.header.site);
    if (assessment.header.department) departments.add(assessment.header.department);
  });
  data.training.employees.forEach((employee) => {
    if (employee.siteLocation) sites.add(employee.siteLocation);
    if (employee.department) departments.add(employee.department);
  });
  data.inspections.forEach((inspection) => {
    if (inspection.site) sites.add(inspection.site);
  });

  return {
    sites: Array.from(sites).sort((a, b) => a.localeCompare(b)),
    departments: Array.from(departments).sort((a, b) => a.localeCompare(b)),
    incidentTypes: Array.from(incidentTypes).sort((a, b) => a.localeCompare(b)),
  };
};

const getTrainingStatus = (expiryDate: string) => {
  const expiry = toDate(expiryDate);

  if (!expiry) {
    return "Missing";
  }

  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
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

const getTrainingCompliance = (training: TrainingData) => {
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

  const total = activeEmployees.length * training.trainingTypes.length;

  return {
    valid,
    expiringSoon,
    expired,
    missing,
    total,
    percent: percentage(valid, total),
  };
};

const getInspectionPassRate = (inspections: SavedInspection[]) => {
  if (inspections.length === 0) {
    return 100;
  }

  const passed = inspections.filter(
    (inspection) =>
      inspection.result.status.toLowerCase().includes("pass") ||
      inspection.result.percent >= 80,
  ).length;

  return percentage(passed, inspections.length);
};

const getFailedInspectionFindings = (inspections: SavedInspection[]) =>
  inspections.reduce(
    (count, inspection) =>
      count +
      Object.values(inspection.answers).filter((answer) => answer === "no")
        .length,
    0,
  );

const getRiskCounts = (risks: RiskAssessment[]) => {
  let low = 0;
  let medium = 0;
  let high = 0;

  risks.forEach((assessment) => {
    assessment.hazards.forEach((hazard) => {
      const level =
        hazardResidualLevel(hazard) === "High"
          ? "High"
          : hazardInitialLevel(hazard);

      if (level === "High") {
        high += 1;
      } else if (level === "Medium") {
        medium += 1;
      } else {
        low += 1;
      }
    });
  });

  return { low, medium, high, total: low + medium + high };
};

const buildMonthlySeries = (
  items: Array<{ date: string; value?: number }>,
  mode: "count" | "average" = "count",
) =>
  recentMonths().map((month) => {
    const monthItems = items.filter((item) => {
      const date = toDate(item.date);
      return date && monthKey(date) === month.key;
    });

    if (mode === "average") {
      const values = monthItems
        .map((item) => item.value ?? 0)
        .filter((item) => item > 0);

      return {
        label: month.label,
        value:
          values.length > 0
            ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length)
            : 0,
      };
    }

    return {
      label: month.label,
      value: monthItems.length,
    };
  });

const buildActionSeries = (actions: HseAction[]) =>
  recentMonths().map((month) => {
    const opened = actions.filter((action) => {
      const date = toDate(action.createdDate);
      return date && monthKey(date) === month.key;
    }).length;
    const completed = actions.filter((action) => {
      const date = toDate(action.lastUpdated);
      return date && monthKey(date) === month.key && isClosedAction(action);
    }).length;

    return {
      label: month.label,
      value: opened,
      secondary: completed,
    };
  });

const buildTrainingByDepartment = (training: TrainingData): ChartDatum[] => {
  const departments = Array.from(
    new Set(
      training.employees
        .map((employee) => employee.department)
        .filter(Boolean),
    ),
  );
  const labels = departments.length > 0 ? departments : commonDepartmentLabels;

  return labels.slice(0, 5).map((department) => {
    const employees = training.employees.filter(
      (employee) =>
        employee.status !== "Inactive" && employee.department === department,
    );
    let valid = 0;
    const total = employees.length * training.trainingTypes.length;

    employees.forEach((employee) => {
      training.trainingTypes.forEach((trainingType) => {
        const record = getLatestRecord(
          training.records,
          employee.id,
          trainingType.id,
        );

        if (record && getTrainingStatus(record.expiryDate) === "Valid") {
          valid += 1;
        }
      });
    });

    return {
      label: department,
      value: percentage(valid, total),
      secondary: total,
    };
  });
};

const buildIncidentSeverity = (incidents: IncidentEvent[]): ChartDatum[] => {
  const labels = ["Low", "Medium", "High", "Critical"];

  return labels.map((label) => ({
    label,
    value: incidents.filter((incident) => incident.severity === label).length,
  }));
};

const buildRiskCategoryDistribution = (risks: RiskAssessment[]): ChartDatum[] => {
  const counts = new Map<string, number>();

  risks.forEach((assessment) => {
    const label =
      assessment.header.activity ||
      assessment.header.sector ||
      assessment.header.title ||
      "Uncategorized";

    counts.set(label, (counts.get(label) ?? 0) + assessment.hazards.length);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
};

const buildRootCauseDistribution = (incidents: IncidentEvent[]): ChartDatum[] =>
  rootCauseLabels
    .map((label) => ({
      label: label
        .replace("Procedure / System Failure", "Procedure Failure")
        .replace("Missing or Ineffective Training", "Training Gap")
        .replace("Supervision / Management", "Supervision")
        .replace("PPE / Protection Failure", "PPE Failure"),
      value: incidents.filter((incident) => incident.rootCauses.includes(label))
        .length,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

const buildFeedItems = (data: DashboardData): FeedItem[] => {
  const actionItems: FeedItem[] = data.actions.map((action) => ({
    id: `action-${action.id}`,
    title: isOverdueAction(action)
      ? `Action overdue: ${action.title || "Untitled action"}`
      : `${isClosedAction(action) ? "Action completed" : "Action updated"}: ${
          action.title || "Untitled action"
        }`,
    detail: `${action.sourceModule} | ${action.responsiblePerson || "Unassigned"}${
      action.siteLocation ? ` | ${action.siteLocation}` : ""
    }`,
    timestamp: primaryActionDate(action),
    source: "Action Tracker",
    tone: isOverdueAction(action)
      ? "critical"
      : isClosedAction(action)
        ? "success"
        : action.priority === "Critical" || action.priority === "High"
          ? "warning"
          : "info",
    icon: CheckCircle2,
    navigation: {
      moduleId: "action-tracker",
      action: "open-record",
      recordId: action.id,
    },
  }));
  const incidentItems: FeedItem[] = data.incidents.map((incident) => ({
    id: `incident-${incident.id}`,
    title: `Incident created: ${incident.title}`,
    detail: `${incident.eventType} | ${incident.severity} severity${
      incident.department ? ` | ${incident.department}` : ""
    }`,
    timestamp: primaryIncidentDate(incident),
    source: "Incident Management",
    tone:
      incident.severity === "Critical" || incident.severity === "High"
        ? "critical"
        : "warning",
    icon: HeartPulse,
    navigation: {
      moduleId: "incident-management",
      action: "open-record",
      recordId: incident.id,
    },
  }));
  const riskItems: FeedItem[] = data.risks.map((assessment) => ({
    id: `risk-${assessment.id}`,
    title: `Risk assessment updated: ${
      assessment.header.title || assessment.header.activity || "Assessment"
    }`,
    detail: `${assessment.hazards.length} hazards | ${
      assessment.header.site || "No site"
    }`,
    timestamp: primaryRiskDate(assessment),
    source: "Risk Assessments",
    tone: assessment.hazards.some((hazard) => hazardResidualLevel(hazard) === "High")
      ? "critical"
      : "info",
    icon: TriangleAlert,
    navigation: {
      moduleId: "risk-assessments",
      action: "open-record",
      recordId: String(assessment.id),
    },
  }));
  const inspectionItems: FeedItem[] = data.inspections.map((inspection) => ({
    id: `inspection-${inspection.id}`,
    title: `Inspection completed: ${inspection.result.percent}%`,
    detail: `${inspection.site || inspection.company || "Workspace"} | ${
      Object.values(inspection.answers).filter((answer) => answer === "no").length
    } findings`,
    timestamp: primaryInspectionDate(inspection),
    source: "Inspections",
    tone: inspection.result.percent >= 80 ? "success" : "warning",
    icon: ClipboardCheck,
    navigation: {
      moduleId: "inspections",
      action: "history",
      recordId: String(inspection.id),
    },
  }));
  const trainingItems: FeedItem[] = data.training.records.map((record) => {
    const employee = data.training.employees.find(
      (item) => item.id === record.employeeId,
    );
    const trainingType = data.training.trainingTypes.find(
      (item) => item.id === record.trainingTypeId,
    );
    const status = getTrainingStatus(record.expiryDate);

    return {
      id: `training-${record.id}`,
      title:
        status === "Expired"
          ? `Training expired: ${trainingType?.name || "Training"}`
          : `Training record added: ${trainingType?.name || "Training"}`,
      detail: `${employee?.name || "Employee"}${
        employee?.department ? ` | ${employee.department}` : ""
      }`,
      timestamp: record.completedDate || record.expiryDate,
      source: "Training Management",
      tone:
        status === "Expired"
          ? "critical"
          : status === "Expiring Soon"
            ? "warning"
            : "success",
      icon: GraduationCap,
      navigation: {
        moduleId: "training-management",
        action: "compliance",
      },
    } satisfies FeedItem;
  });

  return [
    ...actionItems,
    ...incidentItems,
    ...riskItems,
    ...inspectionItems,
    ...trainingItems,
  ]
    .filter((item) => toDate(item.timestamp))
    .sort((a, b) => {
      const aTime = toDate(a.timestamp)?.getTime() ?? 0;
      const bTime = toDate(b.timestamp)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 10);
};

const buildNeedsAttention = (data: DashboardData) => {
  const training = getTrainingCompliance(data.training);
  const riskCounts = getRiskCounts(data.risks);
  const overdueCritical = data.actions.filter(
    (action) => action.priority === "Critical" && isOverdueAction(action),
  ).length;
  const openHighIncidents = data.incidents.filter(
    (incident) =>
      incident.status !== "Closed" &&
      (incident.severity === "High" || incident.severity === "Critical"),
  ).length;
  const lowInspectionCount = data.inspections.filter(
    (inspection) => inspection.result.percent > 0 && inspection.result.percent < 80,
  ).length;
  const repeatedRootCauseCount = buildRootCauseDistribution(data.incidents).filter(
    (item) => item.value >= 2,
  ).length;

  return [
    {
      title: "Overdue critical actions",
      count: overdueCritical,
      source: "Action Tracker",
      tone: "critical" as const,
    },
    {
      title: "High residual risks",
      count: riskCounts.high,
      source: "Risk Assessments",
      tone: "critical" as const,
    },
    {
      title: "Open high severity incidents",
      count: openHighIncidents,
      source: "Incident Management",
      tone: "critical" as const,
    },
    {
      title: "Training gaps",
      count: training.expired + training.missing,
      source: "Training Management",
      tone: training.expired > 0 ? ("critical" as const) : ("warning" as const),
    },
    {
      title: "Low inspection compliance",
      count: lowInspectionCount,
      source: "Inspections",
      tone: "warning" as const,
    },
    {
      title: "Repeated root cause patterns",
      count: repeatedRootCauseCount,
      source: "Incident Management",
      tone: "warning" as const,
    },
  ].filter((item) => item.count > 0);
};

const calculateSafetyScore = (data: DashboardData) => {
  const actions = data.actions;
  const training = getTrainingCompliance(data.training);
  const riskCounts = getRiskCounts(data.risks);
  const incidentPenalty = data.incidents.reduce((score, incident) => {
    if (incident.status === "Closed") {
      return score;
    }

    if (incident.severity === "Critical") {
      return score + 14;
    }

    if (incident.severity === "High") {
      return score + 10;
    }

    if (incident.severity === "Medium") {
      return score + 4;
    }

    return score + 1;
  }, 0);
  const actionCompletion = percentage(
    actions.filter(isClosedAction).length,
    actions.length,
  );
  const actionScore = clamp(
    actionCompletion - actions.filter(isOverdueAction).length * 5,
  );
  const riskScore = clamp(100 - riskCounts.high * 8 - riskCounts.medium * 2);
  const inspectionScore =
    data.inspections.length > 0
      ? Math.round(
          data.inspections.reduce(
            (sum, inspection) => sum + inspection.result.percent,
            0,
          ) / data.inspections.length,
        )
      : 100;
  const trainingScore = training.percent;
  const incidentScore = clamp(100 - incidentPenalty);

  return Math.round(
    (actionScore + riskScore + inspectionScore + trainingScore + incidentScore) /
      5,
  );
};

const makeSparkline = (base: number, invert = false) => {
  const safe = Number.isFinite(base) ? base : 0;
  const values = [
    safe * 0.62,
    safe * 0.78 + 1,
    safe * 0.7 + 2,
    safe * 0.88 + 1,
    safe * 0.92 + 3,
    safe,
  ].map((value) => Math.max(0, Math.round(value)));

  return invert ? [...values].reverse() : values;
};

const toneClasses = {
  blue: {
    text: "text-[#1E90FF]",
    bg: "bg-[#1E90FF]/12",
    border: "border-[#1E90FF]/28",
    glow: "shadow-[0_18px_55px_rgba(30,144,255,0.16)]",
  },
  cyan: {
    text: "text-[#4DEBFF]",
    bg: "bg-[#4DEBFF]/12",
    border: "border-[#4DEBFF]/28",
    glow: "shadow-[0_18px_55px_rgba(77,235,255,0.14)]",
  },
  green: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-400/28",
    glow: "shadow-[0_18px_55px_rgba(16,185,129,0.12)]",
  },
  yellow: {
    text: "text-amber-300",
    bg: "bg-amber-400/12",
    border: "border-amber-300/28",
    glow: "shadow-[0_18px_55px_rgba(245,158,11,0.12)]",
  },
  red: {
    text: "text-rose-300",
    bg: "bg-rose-500/12",
    border: "border-rose-300/28",
    glow: "shadow-[0_18px_55px_rgba(244,63,94,0.15)]",
  },
};

export default function OrbitCommandCenterModule({
  userId,
  darkMode,
  workspaceSettings,
  notifications,
  onToggleTheme,
  onNavigate,
  onOpenNotification,
  onOpenNotificationCenter,
}: OrbitCommandCenterModuleProps) {
  const theme = getTheme(darkMode);
  const [data, setData] = useState<DashboardData>(() => loadDashboardData(userId));
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [aiAccount, setAiAccount] = useState(() => getOrbitAiAccount(userId));
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{
    likelihood: number;
    severity: number;
  } | null>(null);
  const [aiPreviewToolId, setAiPreviewToolId] = useState<OrbitAiToolId | null>(null);
  const riskOverviewRef = useRef<HTMLDivElement | null>(null);

  const navigate = (request: WorkspaceNavigationRequest) => {
    onNavigate(createWorkspaceNavigationIntent(request));
  };

  useEffect(() => {
    const load = () => setData(loadDashboardData(userId));

    load();

    const handleStorage = () => load();
    const handleVisibility = () => {
      if (!document.hidden) {
        load();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId]);

  useEffect(() => {
    const syncAiAccount = () => setAiAccount(getOrbitAiAccount(userId));

    syncAiAccount();
    window.addEventListener(orbitAiAccountUpdatedEvent, syncAiAccount);
    window.addEventListener("storage", syncAiAccount);
    window.addEventListener("focus", syncAiAccount);

    return () => {
      window.removeEventListener(orbitAiAccountUpdatedEvent, syncAiAccount);
      window.removeEventListener("storage", syncAiAccount);
      window.removeEventListener("focus", syncAiAccount);
    };
  }, [userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const filterOptions = useMemo(() => getFilterOptions(data), [data]);
  const filteredData = useMemo(
    () => filterDashboardData(data, filters),
    [data, filters],
  );

  const metrics = useMemo(() => {
    const openActions = filteredData.actions.filter((action) => !isClosedAction(action));
    const overdueActions = filteredData.actions.filter(isOverdueAction);
    const riskCounts = getRiskCounts(filteredData.risks);
    const activeIncidents = filteredData.incidents.filter(
      (incident) => incident.status !== "Closed",
    );
    const training = getTrainingCompliance(filteredData.training);
    const inspectionPassRate = getInspectionPassRate(filteredData.inspections);
    const safetyScore = calculateSafetyScore(filteredData);
    const actionSeries = buildActionSeries(filteredData.actions);
    const inspectionSeries = buildMonthlySeries(
      filteredData.inspections.map((inspection) => ({
        date: primaryInspectionDate(inspection),
        value: inspection.result.percent,
      })),
      "average",
    );
    const incidentSeries = buildMonthlySeries(
      filteredData.incidents.map((incident) => ({
        date: primaryIncidentDate(incident),
      })),
    );
    const highRiskSeries = buildMonthlySeries(
      filteredData.risks.flatMap((assessment) =>
        assessment.hazards
          .filter(
            (hazard) =>
              hazardResidualLevel(hazard) === "High" ||
              hazardInitialLevel(hazard) === "High",
          )
          .map(() => ({
            date: primaryRiskDate(assessment),
          })),
      ),
    );

    return {
      openActions,
      overdueActions,
      riskCounts,
      activeIncidents,
      training,
      inspectionPassRate,
      safetyScore,
      actionSeries,
      inspectionSeries,
      incidentSeries,
      highRiskSeries,
    };
  }, [filteredData]);

  const kpis: KpiCard[] = [
    {
      label: "Open Actions",
      value: metrics.openActions.length,
      detail: `${filteredData.actions.filter(isClosedAction).length} completed`,
      trend: metrics.openActions.length > 0 ? -metrics.overdueActions.length : 8,
      sparkline: metrics.actionSeries.map((item) => item.value),
      icon: CheckCircle2,
      tone: metrics.overdueActions.length > 0 ? "yellow" : "blue",
      navigation: { moduleId: "action-tracker", action: "filter-open" },
    },
    {
      label: "Overdue Actions",
      value: metrics.overdueActions.length,
      detail: "Past due and not closed",
      trend: metrics.overdueActions.length > 0 ? -12 : 9,
      sparkline: makeSparkline(metrics.overdueActions.length, true),
      icon: Clock,
      tone: metrics.overdueActions.length > 0 ? "red" : "green",
      navigation: { moduleId: "action-tracker", action: "filter-overdue" },
    },
    {
      label: "High Risks",
      value: metrics.riskCounts.high,
      detail: `${metrics.riskCounts.total} risk items tracked`,
      trend: metrics.riskCounts.high > 0 ? -10 : 7,
      sparkline: metrics.highRiskSeries.map((item) => item.value),
      icon: TriangleAlert,
      tone: metrics.riskCounts.high > 0 ? "red" : "green",
      navigation: { moduleId: "risk-assessments", action: "filter-high" },
    },
    {
      label: "Active Incidents",
      value: metrics.activeIncidents.length,
      detail: `${filteredData.incidents.length} total events`,
      trend: metrics.activeIncidents.length > 0 ? -6 : 10,
      sparkline: metrics.incidentSeries.map((item) => item.value),
      icon: HeartPulse,
      tone: metrics.activeIncidents.length > 0 ? "yellow" : "green",
      navigation: { moduleId: "incident-management", action: "filter-active" },
    },
    {
      label: "Training Compliance",
      value: metrics.training.percent,
      suffix: "%",
      detail: `${metrics.training.expired + metrics.training.missing} gaps`,
      trend: metrics.training.percent >= 85 ? 9 : -8,
      sparkline: makeSparkline(metrics.training.percent),
      icon: GraduationCap,
      tone:
        metrics.training.percent >= 85
          ? "green"
          : metrics.training.percent >= 65
            ? "yellow"
            : "red",
      navigation: { moduleId: "training-management", action: "compliance" },
    },
    {
      label: "Inspection Pass Rate",
      value: metrics.inspectionPassRate,
      suffix: "%",
      detail: `${getFailedInspectionFindings(filteredData.inspections)} open findings`,
      trend: metrics.inspectionPassRate >= 80 ? 8 : -7,
      sparkline: metrics.inspectionSeries.map((item) => item.value),
      icon: ClipboardCheck,
      tone:
        metrics.inspectionPassRate >= 85
          ? "green"
          : metrics.inspectionPassRate >= 70
            ? "yellow"
            : "red",
      navigation: { moduleId: "inspections", action: "history" },
    },
    {
      label: "AI Credits Remaining",
      value: aiAccount.credits,
      detail: `${aiAccount.plan} plan`,
      trend: 0,
      sparkline:
        aiAccount.credits > 0
          ? makeSparkline(aiAccount.credits)
          : [0, 0, 0, 0, 0, 0],
      icon: Bot,
      tone: "cyan",
      navigation: { moduleId: "settings", action: "billing" },
    },
    {
      label: "Overall Safety Score",
      value: metrics.safetyScore,
      suffix: "%",
      detail: "Composite Orbit signal",
      trend: metrics.safetyScore >= 80 ? 11 : -9,
      sparkline: makeSparkline(metrics.safetyScore),
      icon: Gauge,
      tone:
        metrics.safetyScore >= 85
          ? "green"
          : metrics.safetyScore >= 70
            ? "yellow"
            : "red",
      action: "scroll-risk-overview",
    },
  ];

  const feedItems = useMemo(() => buildFeedItems(filteredData), [filteredData]);
  const attentionItems = useMemo(
    () => buildNeedsAttention(filteredData),
    [filteredData],
  );
  const incidentSeverity = useMemo(
    () => buildIncidentSeverity(filteredData.incidents),
    [filteredData.incidents],
  );
  const trainingByDepartment = useMemo(
    () => buildTrainingByDepartment(filteredData.training),
    [filteredData.training],
  );
  const riskDistribution = useMemo(
    () => buildRiskCategoryDistribution(filteredData.risks),
    [filteredData.risks],
  );
  const rootCauseDistribution = useMemo(
    () => buildRootCauseDistribution(filteredData.incidents),
    [filteredData.incidents],
  );

  const companyProfile = workspaceSettings.companyProfile;
  const companyName = companyProfile.companyName || "Orbit Workspace";

  return (
    <section
      className={joinClasses(
        "relative overflow-hidden rounded-[2rem] border p-4 sm:p-5 xl:p-7",
        theme.shell,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(77,235,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(77,235,255,0.08) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
          }}
        />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#1E90FF]/16 blur-3xl" />
        <div className="absolute right-0 top-44 h-80 w-80 rounded-full bg-[#4DEBFF]/12 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#4DEBFF]/60 to-transparent" />
      </div>

      <div className="relative z-10 space-y-6">
        <header
          className={joinClasses(
            "relative overflow-hidden rounded-[1.75rem] border p-5 sm:p-7",
            darkMode
              ? "border-[#4DEBFF]/15 bg-[#071225]/78"
              : "border-[#1E90FF]/15 bg-white/90",
          )}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-8 top-8 h-40 w-40 rounded-full border border-[#4DEBFF]/20" />
            <div className="absolute left-14 top-14 h-28 w-28 rounded-full border border-[#1E90FF]/25" />
            <div className="absolute bottom-7 right-12 h-36 w-36 rounded-full border border-[#4DEBFF]/15" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#4DEBFF]/30 to-transparent" />
          </div>
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_0.95fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#4DEBFF]/20 bg-[#4DEBFF]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#4DEBFF]">
                <Radar size={14} aria-hidden />
                Orbit live command layer
              </div>
              <div className="space-y-3">
                <h1
                  className={joinClasses(
                    "max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl",
                    theme.heading,
                  )}
                >
                  Laboria Orbit Command Center
                </h1>
                <p className={joinClasses("max-w-2xl text-base sm:text-lg", theme.soft)}>
                  Real-time operational intelligence for health & safety teams.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <HeroSignal
                  icon={ShieldCheck}
                  label="Subscription"
                  value={aiAccount.plan}
                  darkMode={darkMode}
                />
                <HeroSignal
                  icon={Sparkles}
                  label="AI credits"
                  value={`${aiAccount.credits} remaining`}
                  darkMode={darkMode}
                />
                <HeroSignal
                  icon={CalendarClock}
                  label="Live time"
                  value={formatDateTime(currentTime)}
                  darkMode={darkMode}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={joinClasses(
                    "inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200",
                    darkMode
                      ? "border-white/10 bg-white/[0.055] text-slate-200 hover:border-[#4DEBFF]/45 hover:bg-[#4DEBFF]/10 hover:text-[#4DEBFF]"
                      : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#1E90FF]/45 hover:text-[#1E90FF]",
                  )}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {darkMode ? (
                    <Sun size={18} aria-hidden />
                  ) : (
                    <Moon size={18} aria-hidden />
                  )}
                </button>
              </div>
              <div
                className={joinClasses(
                  "rounded-3xl border p-5",
                  darkMode
                    ? "border-white/10 bg-white/[0.055]"
                    : "border-slate-200 bg-slate-50/90",
                )}
              >
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-[#4DEBFF]/25 bg-[#071225] shadow-[0_18px_50px_rgba(30,144,255,0.22)]">
                  {companyProfile.logoDataUrl ? (
                    <Image
                      src={companyProfile.logoDataUrl}
                      alt={`${companyName} logo`}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <Building2 className="h-7 w-7 text-[#4DEBFF]" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={joinClasses("text-xs font-semibold uppercase tracking-[0.2em]", theme.muted)}>
                    Active company
                  </p>
                  <h2 className={joinClasses("truncate text-xl font-semibold", theme.heading)}>
                    {companyName}
                  </h2>
                  <p className={joinClasses("truncate text-sm", theme.muted)}>
                    {companyProfile.industrySector ||
                      companyProfile.mainSiteLocation ||
                      "Company profile ready for configuration"}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric label="Sites" value={filterOptions.sites.length || 1} darkMode={darkMode} />
                <MiniMetric label="Departments" value={filterOptions.departments.length || 1} darkMode={darkMode} />
              </div>
              </div>
            </div>
          </div>
        </header>

        <FilterBar
          filters={filters}
          options={filterOptions}
          darkMode={darkMode}
          onChange={setFilters}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <KpiCard
              key={item.label}
              item={item}
              darkMode={darkMode}
              onClick={() => {
                if (item.navigation) {
                  navigate(item.navigation);
                  return;
                }

                riskOverviewRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <AiIntelligenceCenter
            darkMode={darkMode}
            plan={aiAccount.plan}
            onPreview={setAiPreviewToolId}
          />
          <div className="space-y-5">
            <QuickActionPanel
              darkMode={darkMode}
              aiCredits={aiAccount.credits}
              onNavigate={navigate}
              onAiPreview={() => setAiPreviewToolId("toolbox-talk")}
            />
            <NotificationSummaryPanel
              darkMode={darkMode}
              notifications={notifications}
              onOpenNotification={onOpenNotification}
              onOpenNotificationCenter={onOpenNotificationCenter}
            />
            <ChartCard
              title="Recurring Incident Factors"
              subtitle="Root cause patterns from incident history"
              darkMode={darkMode}
            >
              <HorizontalBars data={rootCauseDistribution} darkMode={darkMode} />
            </ChartCard>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
          <RiskHeatmap
            risks={filteredData.risks}
            darkMode={darkMode}
            onSelectCell={(likelihood, severity) =>
              setSelectedHeatmapCell({ likelihood, severity })
            }
          />
          <ActivityFeed
            items={feedItems}
            darkMode={darkMode}
            onNavigate={navigate}
          />
        </div>

        <div
          ref={riskOverviewRef}
          className="scroll-mt-6 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"
        >
          <SafetyScorePanel
            score={metrics.safetyScore}
            attentionItems={attentionItems}
            darkMode={darkMode}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Inspection Pass / Finding Trend"
              subtitle="Pass rate trend and failed finding pressure"
              darkMode={darkMode}
            >
              <AreaLineChart
                data={metrics.inspectionSeries}
                color="#4DEBFF"
                darkMode={darkMode}
              />
            </ChartCard>
            <ChartCard
              title="Open vs Completed Actions"
              subtitle="Operational closure velocity by month"
              darkMode={darkMode}
            >
              <DualBarChart data={metrics.actionSeries} darkMode={darkMode} />
            </ChartCard>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard
            title="Incident Severity Breakdown"
            subtitle="Events by severity class"
            darkMode={darkMode}
          >
            <DonutChart data={incidentSeverity} darkMode={darkMode} />
          </ChartCard>
          <ChartCard
            title="Training Compliance"
            subtitle="Department-level competency coverage"
            darkMode={darkMode}
          >
            <RadialDepartmentGrid data={trainingByDepartment} darkMode={darkMode} />
          </ChartCard>
          <ChartCard
            title="Risk Category Distribution"
            subtitle="Where risk assessment hazards concentrate"
            darkMode={darkMode}
          >
            <HorizontalBars data={riskDistribution} darkMode={darkMode} />
          </ChartCard>
        </div>

      </div>
      {selectedHeatmapCell ? (
        <HeatmapRiskPanel
          cell={selectedHeatmapCell}
          risks={filteredData.risks}
          darkMode={darkMode}
          onClose={() => setSelectedHeatmapCell(null)}
          onNavigate={navigate}
        />
      ) : null}
      <OrbitAiModal
        darkMode={darkMode}
        userId={userId}
        toolId={aiPreviewToolId}
        sourceModule="Command Center"
        onClose={() => setAiPreviewToolId(null)}
      />
    </section>
  );
}

function HeroSignal({
  icon: Icon,
  label,
  value,
  darkMode,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  darkMode: boolean;
}) {
  return (
    <div
      className={joinClasses(
        "rounded-2xl border p-3",
        darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-white/80",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#4DEBFF]" aria-hidden />
        <span className={joinClasses("text-[11px] font-semibold uppercase tracking-[0.18em]", darkMode ? "text-slate-400" : "text-slate-500")}>
          {label}
        </span>
      </div>
      <p className={joinClasses("mt-2 text-sm font-semibold", darkMode ? "text-white" : "text-slate-950")}>
        {value}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  darkMode,
}: {
  label: string;
  value: number;
  darkMode: boolean;
}) {
  return (
    <div
      className={joinClasses(
        "rounded-2xl border px-3 py-3",
        darkMode ? "border-white/10 bg-[#071225]/60" : "border-slate-200 bg-white",
      )}
    >
      <p className={joinClasses("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>
        {label}
      </p>
      <p className={joinClasses("mt-1 text-xl font-semibold", darkMode ? "text-white" : "text-slate-950")}>
        {value}
      </p>
    </div>
  );
}

function FilterBar({
  filters,
  options,
  darkMode,
  onChange,
}: {
  filters: DashboardFilters;
  options: ReturnType<typeof getFilterOptions>;
  darkMode: boolean;
  onChange: (filters: DashboardFilters) => void;
}) {
  const theme = getTheme(darkMode);

  return (
    <div
      className={joinClasses(
        "rounded-3xl border p-4",
        darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-white",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-[#4DEBFF]" aria-hidden />
        <h3 className={joinClasses("text-sm font-semibold", theme.heading)}>
          Operational filters
        </h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectField
          label="Site"
          value={filters.site}
          options={["All Sites", ...options.sites]}
          darkMode={darkMode}
          onChange={(value) => onChange({ ...filters, site: value })}
        />
        <SelectField
          label="Department"
          value={filters.department}
          options={["All Departments", ...options.departments]}
          darkMode={darkMode}
          onChange={(value) => onChange({ ...filters, department: value })}
        />
        <SelectField
          label="Incident Type"
          value={filters.incidentType}
          options={["All Incident Types", ...options.incidentTypes]}
          darkMode={darkMode}
          onChange={(value) => onChange({ ...filters, incidentType: value })}
        />
        <SelectField
          label="Risk Level"
          value={filters.riskLevel}
          options={riskLevelOptions}
          darkMode={darkMode}
          onChange={(value) =>
            onChange({ ...filters, riskLevel: value as RiskLevelFilter })
          }
        />
        <SelectField
          label="Time Period"
          value={filters.timePeriod}
          options={timePeriodOptions}
          darkMode={darkMode}
          onChange={(value) =>
            onChange({ ...filters, timePeriod: value as TimePeriod })
          }
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  darkMode,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  darkMode: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className={joinClasses("text-xs font-semibold", darkMode ? "text-slate-400" : "text-slate-600")}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={joinClasses(
          "w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition focus:border-[#4DEBFF]",
          darkMode
            ? "border-white/10 bg-[#08172D] text-white"
            : "border-slate-200 bg-white text-slate-900",
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  item,
  darkMode,
  onClick,
}: {
  item: KpiCard;
  darkMode: boolean;
  onClick: () => void;
}) {
  const tone = toneClasses[item.tone];
  const Icon = item.icon;
  const value = `${compactNumber(item.value)}${item.suffix ?? ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${item.label}`}
      className={joinClasses(
        "group relative cursor-pointer overflow-hidden rounded-3xl border p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-[#4DEBFF]/45 focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/60",
        darkMode ? "border-white/10 bg-white/[0.05]" : "border-slate-200 bg-white",
        tone.glow,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4DEBFF]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={joinClasses("text-xs font-semibold uppercase tracking-[0.18em]", darkMode ? "text-slate-400" : "text-slate-500")}>
            {item.label}
          </p>
          <p className={joinClasses("mt-3 text-3xl font-semibold tracking-tight", darkMode ? "text-white" : "text-slate-950")}>
            {value}
          </p>
        </div>
        <div className={joinClasses("rounded-2xl border p-3", tone.bg, tone.border)}>
          <Icon className={joinClasses("h-5 w-5", tone.text)} aria-hidden />
        </div>
      </div>
      <Sparkline values={item.sparkline} color={item.tone === "red" ? "#FB7185" : item.tone === "green" ? "#34D399" : "#4DEBFF"} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={joinClasses("truncate text-xs", darkMode ? "text-slate-400" : "text-slate-600")}>
          {item.detail}
        </span>
        <span
          className={joinClasses(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
            item.trend >= 0
              ? "bg-emerald-500/12 text-emerald-400"
              : "bg-rose-500/12 text-rose-300",
          )}
        >
          <ArrowUpRight
            className={joinClasses("h-3 w-3", item.trend < 0 && "rotate-90")}
            aria-hidden
          />
          {item.trend > 0 ? "+" : ""}
          {item.trend}%
        </span>
      </div>
    </button>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const safeValues = values.length > 0 ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * 120;
      const y = 34 - (value / max) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 120 38" className="mt-4 h-10 w-full" aria-hidden>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" x2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#spark-${color.replace("#", "")})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function RiskHeatmap({
  risks,
  darkMode,
  onSelectCell,
}: {
  risks: RiskAssessment[];
  darkMode: boolean;
  onSelectCell: (likelihood: number, severity: number) => void;
}) {
  const theme = getTheme(darkMode);
  const counts = new Map<string, number>();

  risks.forEach((assessment) => {
    assessment.hazards.forEach((hazard) => {
      const key = `${hazard.residualProbability}-${hazard.residualSeverity}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);

  return (
    <ChartCard
      title="Orbit Risk Heatmap"
      subtitle="Interactive 5x5 residual risk concentration: likelihood vs severity"
      darkMode={darkMode}
      icon={Radar}
    >
      <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="hidden h-full writing-mode-vertical text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 lg:block">
          Severity
        </div>
        <div>
          <div className="grid grid-cols-5 gap-2">
            {[5, 4, 3, 2, 1].flatMap((severity) =>
              [1, 2, 3, 4, 5].map((likelihood) => {
                const score = likelihood * severity;
                const level = riskLevelFromScore(score);
                const count = counts.get(`${likelihood}-${severity}`) ?? 0;
                const intensity = total > 0 ? count / Math.max(...counts.values()) : 0;
                const color =
                  level === "High"
                    ? "from-rose-500/70 to-red-600/45 border-rose-300/35"
                    : level === "Medium"
                      ? "from-amber-400/62 to-orange-500/38 border-amber-300/35"
                      : "from-emerald-400/55 to-emerald-600/32 border-emerald-300/35";

                return (
                  <button
                    type="button"
                    key={`${likelihood}-${severity}`}
                    title={`Likelihood ${likelihood}, Severity ${severity}: ${count} hazards`}
                    aria-label={`Open likelihood ${likelihood}, severity ${severity} risks`}
                    onClick={() => onSelectCell(likelihood, severity)}
                    className={joinClasses(
                      "group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border bg-gradient-to-br p-2 text-left transition duration-300 hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-white/70",
                      color,
                    )}
                    style={{
                      opacity: count > 0 ? 1 : 0.55,
                      boxShadow:
                        count > 0
                          ? `0 0 ${18 + intensity * 28}px rgba(77,235,255,${
                              0.1 + intensity * 0.18
                            })`
                          : undefined,
                    }}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <span className="text-[10px] font-semibold text-white/80">
                        {likelihood}x{severity}
                      </span>
                      <span className="text-2xl font-semibold text-white">
                        {count}
                      </span>
                    </div>
                    <div className="absolute inset-x-2 bottom-2 h-px scale-x-0 bg-white/70 transition group-hover:scale-x-100" />
                  </button>
                );
              }),
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className={theme.muted}>Likelihood</span>
            <span className={theme.muted}>{total} residual risk points mapped</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function ActivityFeed({
  items,
  darkMode,
  onNavigate,
}: {
  items: FeedItem[];
  darkMode: boolean;
  onNavigate: (request: WorkspaceNavigationRequest) => void;
}) {
  const theme = getTheme(darkMode);
  const visibleItems =
    items.length > 0
      ? items
      : [
          {
            id: "system-ready",
            title: "Command Center connected",
            detail: "Create inspections, risks, incidents, trainings, or actions to populate live feed.",
            timestamp: new Date().toISOString(),
            source: "Orbit System",
            tone: "info" as const,
            icon: Cpu,
          },
        ];

  return (
    <ChartCard
      title="Operational Activity Feed"
      subtitle="Newest operational signals across all modules"
      darkMode={darkMode}
      icon={Activity}
    >
      <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const tone =
            item.tone === "critical"
              ? "border-rose-300/30 bg-rose-500/10 text-rose-300"
              : item.tone === "warning"
                ? "border-amber-300/30 bg-amber-400/10 text-amber-300"
                : item.tone === "success"
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300"
                  : "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#4DEBFF]";

          return (
            <button
              type="button"
              key={item.id}
              disabled={!item.navigation}
              onClick={() => {
                if (item.navigation) {
                  onNavigate(item.navigation);
                }
              }}
              className={joinClasses(
                "group relative w-full overflow-hidden rounded-2xl border p-3 text-left transition duration-200",
                item.navigation
                  ? "cursor-pointer hover:border-[#4DEBFF]/45 hover:bg-[#1E90FF]/10 hover:shadow-[0_14px_40px_rgba(30,144,255,0.12)] focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/50"
                  : "cursor-default",
                darkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-slate-50",
              )}
            >
              <span className="absolute inset-y-0 left-0 w-1 -translate-x-full bg-[#4DEBFF] transition-transform duration-200 group-hover:translate-x-0" />
              <div className="flex gap-3">
                <div className={joinClasses("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", tone)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={joinClasses("text-sm font-semibold", theme.heading)}>
                      {item.title}
                    </p>
                    <span className="rounded-full border border-[#4DEBFF]/20 bg-[#4DEBFF]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4DEBFF]">
                      {item.source}
                    </span>
                  </div>
                  <p className={joinClasses("mt-1 text-xs", theme.muted)}>
                    {item.detail}
                  </p>
                  <p className={joinClasses("mt-2 text-[11px]", theme.muted)}>
                    {toDate(item.timestamp)?.toLocaleString() ?? "Just now"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}

function SafetyScorePanel({
  score,
  attentionItems,
  darkMode,
}: {
  score: number;
  attentionItems: ReturnType<typeof buildNeedsAttention>;
  darkMode: boolean;
}) {
  const theme = getTheme(darkMode);
  const stroke = score >= 85 ? "#34D399" : score >= 70 ? "#FBBF24" : "#FB7185";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <ChartCard
      title="Safety Performance Score"
      subtitle="Composite signal from actions, risks, incidents, training, and inspections"
      darkMode={darkMode}
      icon={Target}
    >
      <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
        <div className="relative mx-auto h-52 w-52">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              strokeWidth="12"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className={joinClasses("text-5xl font-semibold", theme.heading)}>
                {score}%
              </p>
              <p className={joinClasses("mt-1 text-xs font-semibold uppercase tracking-[0.2em]", theme.muted)}>
                Overall Orbit Safety Score
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className={joinClasses("font-semibold", theme.heading)}>
              Needs attention
            </h4>
            <span className={joinClasses("text-xs", theme.muted)}>
              {attentionItems.length} active signals
            </span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              All critical indicators are under control.
            </div>
          ) : (
            attentionItems.slice(0, 5).map((item) => (
              <div
                key={`${item.source}-${item.title}`}
                className={joinClasses(
                  "flex items-center justify-between gap-3 rounded-2xl border p-3",
                  item.tone === "critical"
                    ? "border-rose-300/25 bg-rose-500/10"
                    : "border-amber-300/25 bg-amber-400/10",
                )}
              >
                <div className="min-w-0">
                  <p className={joinClasses("truncate text-sm font-semibold", theme.heading)}>
                    {item.title}
                  </p>
                  <p className={joinClasses("text-xs", theme.muted)}>{item.source}</p>
                </div>
                <span
                  className={joinClasses(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    item.tone === "critical"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-amber-400/20 text-amber-300",
                  )}
                >
                  {item.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </ChartCard>
  );
}

function ChartCard({
  title,
  subtitle,
  darkMode,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  darkMode: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const theme = getTheme(darkMode);

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border p-4 sm:p-5",
        theme.card,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4DEBFF]/45 to-transparent" />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="h-4 w-4 text-[#4DEBFF]" aria-hidden /> : null}
            <h3 className={joinClasses("font-semibold", theme.heading)}>{title}</h3>
          </div>
          <p className={joinClasses("mt-1 text-sm", theme.muted)}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function AreaLineChart({
  data,
  color,
  darkMode,
}: {
  data: ChartDatum[];
  color: string;
  darkMode: boolean;
}) {
  const values = data.map((item) => item.value);
  const max = Math.max(...values, 100, 1);
  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 260;
      const y = 110 - (item.value / max) * 90;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,120 ${points} 260,120`;

  return (
    <div className="h-48">
      <svg viewBox="0 0 260 140" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="orbit-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1="0"
            x2="260"
            y1={24 + line * 28}
            y2={24 + line * 28}
            stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
          />
        ))}
        <polygon points={areaPoints} fill="url(#orbit-area)" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
      </svg>
      <div className="grid grid-cols-6 gap-1 text-center text-[11px] text-slate-500">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function DualBarChart({
  data,
  darkMode,
}: {
  data: ChartDatum[];
  darkMode: boolean;
}) {
  const max = Math.max(
    ...data.flatMap((item) => [item.value, item.secondary ?? 0]),
    1,
  );

  return (
    <div className="flex h-52 items-end gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end justify-center gap-1.5">
            <div
              className="w-3 rounded-t-full bg-[#1E90FF]"
              style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
            <div
              className="w-3 rounded-t-full bg-emerald-400"
              style={{
                height: `${Math.max(4, ((item.secondary ?? 0) / max) * 100)}%`,
              }}
            />
          </div>
          <span className={joinClasses("text-[11px]", darkMode ? "text-slate-400" : "text-slate-500")}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, darkMode }: { data: ChartDatum[]; darkMode: boolean }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = ["#34D399", "#FBBF24", "#FB7185", "#EF4444", "#4DEBFF"];
  const segments = data.reduce<
    Array<{
      label: string;
      value: number;
      strokeLength: number;
      strokeOffset: number;
      color: string;
    }>
  >((items, item, index) => {
    const previousOffset =
      items.length > 0
        ? items[items.length - 1].strokeOffset + items[items.length - 1].strokeLength
        : 25;
    const strokeLength = total > 0 ? (item.value / total) * 264 : 0;

    return [
      ...items,
      {
        label: item.label,
        value: item.value,
        strokeLength,
        strokeOffset: previousOffset,
        color: colors[index % colors.length],
      },
    ];
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
      <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
          strokeWidth="16"
        />
        {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={segment.color}
              strokeDasharray={`${segment.strokeLength} ${
                264 - segment.strokeLength
              }`}
              strokeDashoffset={-segment.strokeOffset}
              strokeLinecap="round"
              strokeWidth="16"
            />
        ))}
      </svg>
      <div className="space-y-2">
        {data.map((item, index) => (
          <LegendRow
            key={item.label}
            label={item.label}
            value={item.value}
            color={colors[index % colors.length]}
            darkMode={darkMode}
          />
        ))}
      </div>
    </div>
  );
}

function LegendRow({
  label,
  value,
  color,
  darkMode,
}: {
  label: string;
  value: number;
  color: string;
  darkMode: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={joinClasses("inline-flex min-w-0 items-center gap-2", darkMode ? "text-slate-300" : "text-slate-700")}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className={joinClasses("font-semibold", darkMode ? "text-white" : "text-slate-950")}>
        {value}
      </span>
    </div>
  );
}

function RadialDepartmentGrid({
  data,
  darkMode,
}: {
  data: ChartDatum[];
  darkMode: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((item) => {
        const color =
          item.value >= 85 ? "#34D399" : item.value >= 65 ? "#FBBF24" : "#FB7185";
        const circumference = 2 * Math.PI * 24;
        const offset = circumference - (item.value / 100) * circumference;

        return (
          <div
            key={item.label}
            className={joinClasses(
              "flex items-center gap-3 rounded-2xl border p-3",
              darkMode ? "border-white/10 bg-white/[0.035]" : "border-slate-200 bg-slate-50",
            )}
          >
            <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
              <circle cx="32" cy="32" r="24" fill="none" stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"} strokeWidth="7" />
              <circle cx="32" cy="32" r="24" fill="none" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="7" />
            </svg>
            <div className="min-w-0">
              <p className={joinClasses("truncate text-sm font-semibold", darkMode ? "text-white" : "text-slate-950")}>
                {item.label}
              </p>
              <p className={joinClasses("text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>
                {item.value}% compliant
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  data,
  darkMode,
}: {
  data: ChartDatum[];
  darkMode: boolean;
}) {
  const rows = data.length > 0 ? data : [{ label: "No live records yet", value: 0 }];
  const max = Math.max(...rows.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={joinClasses("truncate", darkMode ? "text-slate-300" : "text-slate-700")}>
              {item.label}
            </span>
            <span className={joinClasses("font-semibold", darkMode ? "text-white" : "text-slate-950")}>
              {item.value}
            </span>
          </div>
          <div className={joinClasses("h-2 overflow-hidden rounded-full", darkMode ? "bg-white/10" : "bg-slate-100")}>
            <div
              className={joinClasses(
                "h-full rounded-full",
                index % 3 === 0
                  ? "bg-[#4DEBFF]"
                  : index % 3 === 1
                    ? "bg-[#1E90FF]"
                    : "bg-amber-400",
              )}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HeatmapRiskPanel({
  cell,
  risks,
  darkMode,
  onClose,
  onNavigate,
}: {
  cell: { likelihood: number; severity: number };
  risks: RiskAssessment[];
  darkMode: boolean;
  onClose: () => void;
  onNavigate: (request: WorkspaceNavigationRequest) => void;
}) {
  const theme = getTheme(darkMode);
  const relatedHazards = risks.flatMap((assessment) =>
    assessment.hazards
      .filter(
        (hazard) =>
          hazard.residualProbability === cell.likelihood &&
          hazard.residualSeverity === cell.severity,
      )
      .map((hazard) => ({
        assessment,
        hazard,
        score: hazard.residualProbability * hazard.residualSeverity,
      })),
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Close risk heatmap details"
        onClick={onClose}
      />
      <aside
        className={joinClasses(
          "relative z-10 h-full w-full max-w-xl overflow-y-auto border-l p-5 shadow-[-24px_0_80px_rgba(0,0,0,0.34)] sm:p-7",
          darkMode
            ? "border-white/10 bg-[#071225] text-white"
            : "border-slate-200 bg-white text-slate-950",
        )}
        aria-label="Risk heatmap cell details"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4DEBFF]">
              Orbit Risk Heatmap
            </div>
            <h3 className="mt-2 text-2xl font-semibold">
              Likelihood {cell.likelihood} x Severity {cell.severity}
            </h3>
            <p className={joinClasses("mt-2 text-sm", theme.muted)}>
              {relatedHazards.length} related residual risk{" "}
              {relatedHazards.length === 1 ? "hazard" : "hazards"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={joinClasses(
              "rounded-xl border p-2 transition hover:border-[#4DEBFF]/45",
              darkMode ? "border-white/10 bg-white/[0.05]" : "border-slate-200 bg-slate-50",
            )}
            aria-label="Close risk heatmap details"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {relatedHazards.length === 0 ? (
            <div
              className={joinClasses(
                "rounded-2xl border border-dashed p-6 text-sm leading-6",
                darkMode ? "border-white/15 text-slate-300" : "border-slate-300 text-slate-600",
              )}
            >
              No risks exist in this matrix zone for the active Command Center
              filters.
            </div>
          ) : (
            relatedHazards.map(({ assessment, hazard, score }, index) => (
              <div
                key={`${assessment.id}-${hazard.hazardDescription}-${index}`}
                className={joinClasses(
                  "rounded-2xl border p-4",
                  darkMode ? "border-white/10 bg-white/[0.045]" : "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
                    Residual risk {score} / {riskLevelFromScore(score)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        moduleId: "risk-assessments",
                        action: "open-record",
                        recordId: String(assessment.id),
                      })
                    }
                    className="text-xs font-semibold text-[#4DEBFF] transition hover:text-white"
                  >
                    Open assessment
                  </button>
                </div>
                <h4 className={joinClasses("mt-3 font-semibold", theme.heading)}>
                  {hazard.hazardDescription ||
                    hazard.workplaceActivity ||
                    assessment.header.title ||
                    "Untitled hazard"}
                </h4>
                <div className={joinClasses("mt-3 grid gap-2 text-sm sm:grid-cols-2", theme.soft)}>
                  <div>Department: {assessment.header.department || "Not assigned"}</div>
                  <div>Risk owner: {hazard.responsiblePerson || "Unassigned"}</div>
                  <div>Likelihood: {hazard.residualProbability}</div>
                  <div>Severity: {hazard.residualSeverity}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function AiIntelligenceCenter({
  darkMode,
  plan,
  onPreview,
}: {
  darkMode: boolean;
  plan: OrbitPlanName;
  onPreview: (toolId: OrbitAiToolId) => void;
}) {
  const theme = getTheme(darkMode);
  const insights = [
    {
      toolId: "workspace-analysis" as const,
      title: "AI Workspace Analysis",
      detail: "Review actions, incidents, risks, inspections, and training signals in one controlled analysis.",
      icon: ShieldCheck,
    },
    {
      toolId: "risk-trends" as const,
      title: "AI Risk Trends",
      detail: "Surface recurring risk patterns and operational movement across workflows.",
      icon: HeartPulse,
    },
    {
      toolId: "executive-summary" as const,
      title: "AI Executive Summary",
      detail: "Prepare a management-ready monthly operational HSE summary.",
      icon: Zap,
    },
    {
      toolId: "predictive-warning" as const,
      title: "AI Predictive Warning",
      detail: "Preview department-level early warning intelligence for HSE teams.",
      icon: GraduationCap,
    },
  ];

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-3xl border p-5",
        darkMode
          ? "border-[#4DEBFF]/15 bg-[#071225]/78 shadow-[0_24px_80px_rgba(77,235,255,0.08)]"
          : "border-[#1E90FF]/15 bg-white shadow-[0_20px_70px_rgba(30,144,255,0.10)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(77,235,255,0.18),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(30,144,255,0.14),transparent_30%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#4DEBFF]" aria-hidden />
              <h3 className={joinClasses("text-lg font-semibold", theme.heading)}>
                Orbit AI Intelligence Center
              </h3>
            </div>
            <p className={joinClasses("mt-1 text-sm", theme.muted)}>
              Live AI operating layer for proactive HSE intelligence.
            </p>
          </div>
          <span className="rounded-full border border-[#4DEBFF]/30 bg-[#4DEBFF]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#4DEBFF]">
            Live AI
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => {
            const Icon = insight.icon;
            const availableForPlan = isOrbitAiToolAvailableForPlan(
              plan,
              insight.toolId,
            );
            return (
              <button
                type="button"
                key={insight.title}
                onClick={() => onPreview(insight.toolId)}
                className={joinClasses(
                  "cursor-pointer rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#4DEBFF]/45 hover:shadow-[0_14px_42px_rgba(77,235,255,0.10)] focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/50",
                  darkMode ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-white/75",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#4DEBFF]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={joinClasses("text-sm font-semibold", theme.heading)}>
                        {insight.title}
                      </h4>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1E90FF]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4DEBFF]">
                        <Lock size={10} aria-hidden />
                        {availableForPlan ? ORBIT_PRO_PLAN : "Pro only"}
                      </span>
                    </div>
                    <p className={joinClasses("mt-2 text-xs leading-5", theme.muted)}>
                      {insight.detail}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#4DEBFF]/20 bg-[#4DEBFF]/10 px-2 py-1 text-[10px] font-semibold text-[#4DEBFF]">
                      {getOrbitAiTool(insight.toolId).creditLabel} /{" "}
                      {availableForPlan ? "Live" : "Upgrade required"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuickActionPanel({
  darkMode,
  aiCredits,
  onNavigate,
  onAiPreview,
}: {
  darkMode: boolean;
  aiCredits: number;
  onNavigate: (request: WorkspaceNavigationRequest) => void;
  onAiPreview: () => void;
}) {
  const toolboxTalkCredits = getOrbitAiTool("toolbox-talk").getCredits();
  const actions: Array<{
    label: string;
    icon: LucideIcon;
    navigation?: WorkspaceNavigationRequest;
    aiPreview?: boolean;
  }> = [
    {
      label: "New Inspection",
      icon: ClipboardCheck,
      navigation: { moduleId: "inspections", action: "new" },
    },
    {
      label: "New Incident",
      icon: HeartPulse,
      navigation: { moduleId: "incident-management", action: "new" },
    },
    {
      label: "New Risk Assessment",
      icon: TriangleAlert,
      navigation: { moduleId: "risk-assessments", action: "new" },
    },
    {
      label: "Assign Action",
      icon: CheckCircle2,
      navigation: { moduleId: "action-tracker", action: "new" },
    },
    {
      label: "Add Training",
      icon: GraduationCap,
      navigation: { moduleId: "training-management", action: "new-record" },
    },
    { label: "Generate AI Toolbox Talk", icon: Sparkles, aiPreview: true },
  ];

  return (
    <ChartCard
      title="Quick Action Panel"
      subtitle="Fast entry points for daily HSE operations"
      darkMode={darkMode}
      icon={Plus}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                if (action.navigation) {
                  onNavigate(action.navigation);
                } else if (action.aiPreview) {
                  onAiPreview();
                }
              }}
              className={joinClasses(
                "group flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-semibold transition",
                "hover:-translate-y-0.5 hover:border-[#4DEBFF]/40 hover:shadow-[0_12px_36px_rgba(77,235,255,0.10)] focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/50",
                darkMode ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-900",
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#4DEBFF]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                {action.label}
                {action.aiPreview ? (
                  <span className="mt-1 block text-xs font-medium text-[#4DEBFF]">
                    {getOrbitAiTool("toolbox-talk").creditLabel} /{" "}
                    {aiCredits >= toolboxTalkCredits ? "Available" : "Locked"}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}

function NotificationSummaryPanel({
  darkMode,
  notifications,
  onOpenNotification,
  onOpenNotificationCenter,
}: {
  darkMode: boolean;
  notifications: OrbitNotification[];
  onOpenNotification: (notification: OrbitNotification) => void;
  onOpenNotificationCenter: () => void;
}) {
  const activeNotifications = notifications.filter((notification) => notification.active);
  const unreadNotifications = activeNotifications.filter(
    (notification) => !notification.read,
  );
  const criticalNotifications = unreadNotifications.filter(
    (notification) => notification.severity === "Critical",
  );
  const latestNotifications = activeNotifications.slice(0, 3);

  return (
    <ChartCard
      title="Notifications"
      subtitle="Live workflow alerts and attention signals"
      darkMode={darkMode}
      icon={BellRing}
    >
      <div className="grid grid-cols-2 gap-3">
        <div
          className={joinClasses(
            "rounded-2xl border p-3",
            darkMode
              ? "border-cyan-400/20 bg-cyan-500/[0.06]"
              : "border-cyan-200 bg-cyan-50",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1E90FF]">
            Unread
          </p>
          <p className={joinClasses("mt-1 text-2xl font-semibold", darkMode ? "text-white" : "text-slate-900")}>
            {unreadNotifications.length}
          </p>
        </div>
        <div
          className={joinClasses(
            "rounded-2xl border p-3",
            darkMode
              ? "border-rose-400/20 bg-rose-500/[0.06]"
              : "border-rose-200 bg-rose-50",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-400">
            Critical
          </p>
          <p className={joinClasses("mt-1 text-2xl font-semibold", darkMode ? "text-white" : "text-slate-900")}>
            {criticalNotifications.length}
          </p>
        </div>
      </div>

      {latestNotifications.length > 0 ? (
        <div className="mt-4 space-y-2">
          {latestNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={joinClasses(
                "group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                "hover:-translate-y-0.5 hover:border-[#4DEBFF]/40 hover:shadow-[0_10px_30px_rgba(77,235,255,0.08)]",
                darkMode
                  ? "border-white/10 bg-white/[0.035]"
                  : "border-slate-200 bg-slate-50",
              )}
              onClick={() => onOpenNotification(notification)}
            >
              <span
                className={joinClasses(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  notification.severity === "Critical"
                    ? "bg-rose-400"
                    : notification.severity === "Warning"
                      ? "bg-amber-400"
                      : notification.severity === "Success"
                        ? "bg-emerald-400"
                        : "bg-cyan-400",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={joinClasses("block truncate text-xs font-semibold", darkMode ? "text-slate-100" : "text-slate-800")}>
                  {notification.title}
                </span>
                <span className={joinClasses("mt-1 block truncate text-[11px]", darkMode ? "text-slate-500" : "text-slate-500")}>
                  {notification.sourceModule}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-[#4DEBFF]" aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <div
          className={joinClasses(
            "mt-4 rounded-xl border border-dashed px-3 py-4 text-center text-xs",
            darkMode
              ? "border-white/10 text-slate-500"
              : "border-slate-200 text-slate-500",
          )}
        >
          All critical indicators are under control.
        </div>
      )}

      <button
        type="button"
        className={joinClasses(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
          darkMode
            ? "border-cyan-400/20 bg-cyan-500/[0.06] text-cyan-200 hover:border-cyan-300/45 hover:bg-cyan-500/[0.1]"
            : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-100",
        )}
        onClick={onOpenNotificationCenter}
      >
        Open Notification Center
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </ChartCard>
  );
}
