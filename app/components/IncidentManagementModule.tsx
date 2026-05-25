"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Filter,
  Moon,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import {
  appendActionTrackerAction,
  createActionFromInput,
  getDateInputDaysFromNow,
  readActionTrackerActions,
  type ActionPriority,
  type HseAction,
} from "@/app/lib/actionTracker";

const eventTypeOptions = [
  "Incident",
  "Near Miss",
  "Unsafe Act",
  "Unsafe Condition",
  "First Aid Case",
  "Medical Treatment Case",
  "Lost Time Injury",
  "Property Damage",
  "Environmental Release",
] as const;

const severityOptions = ["Low", "Medium", "High", "Critical"] as const;
const statusOptions = [
  "Reported",
  "Investigation Open",
  "Actions Assigned",
  "Pending Verification",
  "Closed",
] as const;
const yesNoOptions = ["No", "Yes"] as const;
const rootCauseOptions = [
  "Human Factor",
  "Equipment / Machinery",
  "Procedure / System Failure",
  "Missing or Ineffective Training",
  "Supervision / Management",
  "Work Environment",
  "PPE / Protection Failure",
  "Communication Failure",
  "Contractor Control",
  "Emergency Preparedness",
] as const;

type EventType = (typeof eventTypeOptions)[number];
type Severity = (typeof severityOptions)[number];
type IncidentStatus = (typeof statusOptions)[number];
type YesNo = (typeof yesNoOptions)[number];
type RootCause = (typeof rootCauseOptions)[number];

type IncidentEvent = {
  id: string;
  title: string;
  eventType: EventType;
  dateTime: string;
  siteLocation: string;
  department: string;
  reportedBy: string;
  affectedPerson: string;
  jobRole: string;
  immediateArea: string;
  severity: Severity;
  description: string;
  immediateActionTaken: string;
  workStopped: YesNo;
  areaSecured: YesNo;
  injuryOccurred: YesNo;
  propertyDamage: YesNo;
  environmentalImpact: YesNo;
  witnesses: string;
  investigationNotes: string;
  status: IncidentStatus;
  rootCauses: RootCause[];
  rootCauseNotes: string;
  createdAt: string;
  updatedAt: string;
};

type IncidentSuggestion = {
  id: string;
  title: string;
  reason: string;
};

type IncidentFilters = {
  eventType: "All" | EventType;
  severity: "All" | Severity;
  status: "All" | IncidentStatus;
  department: string;
  siteLocation: string;
  dateFrom: string;
  dateTo: string;
};

type IncidentManagementModuleProps = {
  userId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  createdBy: string;
};

const emptyFilters: IncidentFilters = {
  eventType: "All",
  severity: "All",
  status: "All",
  department: "",
  siteLocation: "",
  dateFrom: "",
  dateTo: "",
};

const legacyStorageKey = "laboria_incident_management";

const getStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_incident_management`
    : legacyStorageKey;

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowDateTimeInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const normalizeEventType = (value: unknown): EventType =>
  eventTypeOptions.includes(value as EventType)
    ? (value as EventType)
    : "Incident";

const normalizeSeverity = (value: unknown): Severity =>
  severityOptions.includes(value as Severity) ? (value as Severity) : "Medium";

const normalizeStatus = (value: unknown): IncidentStatus =>
  statusOptions.includes(value as IncidentStatus)
    ? (value as IncidentStatus)
    : "Reported";

const normalizeYesNo = (value: unknown): YesNo =>
  yesNoOptions.includes(value as YesNo) ? (value as YesNo) : "No";

const normalizeRootCauses = (value: unknown): RootCause[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RootCause =>
    rootCauseOptions.includes(item as RootCause),
  );
};

const createEmptyIncident = (): IncidentEvent => {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "",
    eventType: "Incident",
    dateTime: nowDateTimeInput(),
    siteLocation: "",
    department: "",
    reportedBy: "",
    affectedPerson: "",
    jobRole: "",
    immediateArea: "",
    severity: "Medium",
    description: "",
    immediateActionTaken: "",
    workStopped: "No",
    areaSecured: "No",
    injuryOccurred: "No",
    propertyDamage: "No",
    environmentalImpact: "No",
    witnesses: "",
    investigationNotes: "",
    status: "Reported",
    rootCauses: [],
    rootCauseNotes: "",
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeIncident = (incident: Partial<IncidentEvent>): IncidentEvent => {
  const empty = createEmptyIncident();

  return {
    id:
      typeof incident.id === "string" && incident.id.trim().length > 0
        ? incident.id
        : createId(),
    title: typeof incident.title === "string" ? incident.title : "",
    eventType: normalizeEventType(incident.eventType),
    dateTime:
      typeof incident.dateTime === "string" && incident.dateTime.length > 0
        ? incident.dateTime
        : empty.dateTime,
    siteLocation:
      typeof incident.siteLocation === "string" ? incident.siteLocation : "",
    department:
      typeof incident.department === "string" ? incident.department : "",
    reportedBy:
      typeof incident.reportedBy === "string" ? incident.reportedBy : "",
    affectedPerson:
      typeof incident.affectedPerson === "string"
        ? incident.affectedPerson
        : "",
    jobRole: typeof incident.jobRole === "string" ? incident.jobRole : "",
    immediateArea:
      typeof incident.immediateArea === "string" ? incident.immediateArea : "",
    severity: normalizeSeverity(incident.severity),
    description:
      typeof incident.description === "string" ? incident.description : "",
    immediateActionTaken:
      typeof incident.immediateActionTaken === "string"
        ? incident.immediateActionTaken
        : "",
    workStopped: normalizeYesNo(incident.workStopped),
    areaSecured: normalizeYesNo(incident.areaSecured),
    injuryOccurred: normalizeYesNo(incident.injuryOccurred),
    propertyDamage: normalizeYesNo(incident.propertyDamage),
    environmentalImpact: normalizeYesNo(incident.environmentalImpact),
    witnesses: typeof incident.witnesses === "string" ? incident.witnesses : "",
    investigationNotes:
      typeof incident.investigationNotes === "string"
        ? incident.investigationNotes
        : "",
    status: normalizeStatus(incident.status),
    rootCauses: normalizeRootCauses(incident.rootCauses),
    rootCauseNotes:
      typeof incident.rootCauseNotes === "string"
        ? incident.rootCauseNotes
        : "",
    createdAt:
      typeof incident.createdAt === "string" ? incident.createdAt : empty.createdAt,
    updatedAt:
      typeof incident.updatedAt === "string" ? incident.updatedAt : empty.updatedAt,
  };
};

const parseIncidents = (value: string | null): IncidentEvent[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<IncidentEvent> =>
        Boolean(item && typeof item === "object"),
      )
      .map(normalizeIncident);
  } catch {
    return [];
  }
};

const readIncidents = (userId: string | null) => {
  if (typeof window === "undefined") {
    return [];
  }

  const current = parseIncidents(window.localStorage.getItem(getStorageKey(userId)));

  if (current.length > 0) {
    return current;
  }

  if (userId) {
    return parseIncidents(window.localStorage.getItem(legacyStorageKey));
  }

  return [];
};

const writeIncidents = (userId: string | null, incidents: IncidentEvent[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(incidents));

  if (userId) {
    window.localStorage.removeItem(legacyStorageKey);
  }
};

const getTheme = (darkMode: boolean) => ({
  pageText: darkMode ? "text-[#F5F7FA]" : "text-slate-900",
  shell: darkMode
    ? "border-white/10 bg-[#071225]/84 shadow-[0_30px_100px_rgba(0,0,0,0.34)]"
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
  muted: darkMode ? "text-slate-400" : "text-slate-600",
  soft: darkMode ? "text-slate-300" : "text-slate-700",
  heading: darkMode ? "text-white" : "text-slate-950",
  label: darkMode ? "text-slate-400" : "text-slate-600",
  field: darkMode
    ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45 focus:bg-white/[0.075]"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#1E90FF] focus:bg-white focus:ring-4 focus:ring-[#1E90FF]/10",
  ghostButton: darkMode
    ? "border-white/10 bg-white/[0.055] text-slate-100 hover:bg-white/[0.09]"
    : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950",
  themeToggleButton: darkMode
    ? "border-slate-500/30 bg-slate-800 text-white shadow-md hover:bg-slate-700"
    : "border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-100",
  exportButton: darkMode
    ? "border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#DDFBFF] hover:bg-[#4DEBFF]/15"
    : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8] hover:bg-[#1E90FF]/15",
  dangerButton: darkMode
    ? "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  tableHead: darkMode
    ? "border-white/10 bg-white/[0.035] text-slate-300"
    : "border-slate-200 bg-slate-50 text-slate-600",
  row: darkMode
    ? "border-white/10 hover:bg-white/[0.045]"
    : "border-slate-200 hover:bg-slate-50",
  empty: darkMode
    ? "border-white/15 bg-white/[0.03] text-slate-400"
    : "border-slate-300 bg-slate-50 text-slate-500",
  modal: darkMode
    ? "border-white/10 bg-[#071225] text-[#F5F7FA]"
    : "border-slate-200 bg-white text-slate-900",
  notice: darkMode
    ? "border-[#4DEBFF]/20 bg-[#4DEBFF]/10 text-[#DDFBFF]"
    : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
});

type IncidentTheme = ReturnType<typeof getTheme>;

const severityTone = (severity: Severity, darkMode: boolean) => {
  if (severity === "Critical") {
    return darkMode
      ? "border-rose-400/40 bg-rose-500/12 text-rose-100"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (severity === "High") {
    return darkMode
      ? "border-orange-300/35 bg-orange-400/12 text-orange-100"
      : "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (severity === "Medium") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  return darkMode
    ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const statusTone = (status: IncidentStatus, darkMode: boolean) => {
  if (status === "Closed") {
    return darkMode
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Pending Verification") {
    return darkMode
      ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "Actions Assigned") {
    return darkMode
      ? "border-[#4DEBFF]/35 bg-[#4DEBFF]/10 text-[#DDFBFF]"
      : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8]";
  }

  if (status === "Investigation Open") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  return darkMode
    ? "border-slate-400/25 bg-white/[0.04] text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-700";
};

const sourceSuggestionSets: Partial<Record<RootCause, IncidentSuggestion[]>> = {
  "Missing or Ineffective Training": [
    {
      id: "training-record-review",
      title: "Review training records for involved employee",
      reason: "Training gap identified as a root cause.",
    },
    {
      id: "schedule-refresher-training",
      title: "Schedule refresher training",
      reason: "Competency reinforcement is required before task continuation.",
    },
    {
      id: "verify-competency",
      title: "Verify competency before returning to task",
      reason: "Worker capability should be confirmed after the event.",
    },
  ],
  "Equipment / Machinery": [
    {
      id: "inspect-equipment-before-reuse",
      title: "Inspect equipment before reuse",
      reason: "Equipment or machinery contributed to the event.",
    },
    {
      id: "remove-unsafe-equipment",
      title: "Remove equipment from service if unsafe",
      reason: "Unsafe equipment should not remain available for use.",
    },
    {
      id: "review-maintenance-records",
      title: "Review maintenance records",
      reason: "Maintenance history may indicate repeat failures or overdue checks.",
    },
  ],
  "Procedure / System Failure": [
    {
      id: "review-related-procedure",
      title: "Review related procedure",
      reason: "Procedure or system failure was selected as a root cause.",
    },
    {
      id: "communicate-revised-procedure",
      title: "Communicate revised procedure to workers",
      reason: "Workers need clear instruction after procedural changes.",
    },
    {
      id: "verify-procedure-implementation",
      title: "Verify implementation on site",
      reason: "Procedure updates must be confirmed in the field.",
    },
  ],
  "Work Environment": [
    {
      id: "inspect-workplace-conditions",
      title: "Inspect workplace conditions",
      reason: "Work environment was selected as a root cause.",
    },
    {
      id: "improve-housekeeping-access",
      title: "Improve housekeeping or access control",
      reason: "Environmental conditions may require immediate correction.",
    },
    {
      id: "review-environmental-controls",
      title: "Review lighting, ventilation, or weather controls",
      reason: "Site controls should be checked against working conditions.",
    },
  ],
  "PPE / Protection Failure": [
    {
      id: "inspect-ppe-protection",
      title: "Inspect PPE and protective controls",
      reason: "Protection failure was selected as a root cause.",
    },
    {
      id: "replace-defective-ppe",
      title: "Replace defective or unsuitable PPE",
      reason: "Workers should not continue with inadequate protection.",
    },
  ],
  "Communication Failure": [
    {
      id: "conduct-shift-briefing",
      title: "Conduct shift communication briefing",
      reason: "Communication failure contributed to the event.",
    },
    {
      id: "verify-critical-instructions",
      title: "Verify critical instructions are understood",
      reason: "Operational messages should be confirmed before work resumes.",
    },
  ],
  "Supervision / Management": [
    {
      id: "review-supervision-plan",
      title: "Review supervision and monitoring plan",
      reason: "Supervision or management controls may need strengthening.",
    },
    {
      id: "assign-management-follow-up",
      title: "Assign management follow-up",
      reason: "Management review supports sustained corrective action.",
    },
  ],
  "Emergency Preparedness": [
    {
      id: "review-emergency-response",
      title: "Review emergency response arrangements",
      reason: "Emergency preparedness was identified as a root cause.",
    },
    {
      id: "conduct-emergency-briefing",
      title: "Conduct emergency response briefing",
      reason: "Teams should understand emergency roles after the event.",
    },
  ],
};

const formatDisplayDateTime = (value: string) => {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const incidentSuggestionKey = (incidentId: string, suggestionId: string) =>
  `incident:${incidentId}:${suggestionId}`;

const isClosedAction = (action: HseAction) =>
  action.status === "Completed" || action.status === "Closed";

const getIncidentPriority = (severity: Severity): ActionPriority => {
  if (severity === "Critical") {
    return "Critical";
  }

  if (severity === "High") {
    return "High";
  }

  if (severity === "Medium") {
    return "Medium";
  }

  return "Low";
};

const getIncidentDueOffset = (severity: Severity) => {
  if (severity === "Critical") {
    return 1;
  }

  if (severity === "High") {
    return 3;
  }

  return 7;
};

const getSuggestedActions = (incident: IncidentEvent): IncidentSuggestion[] => {
  const suggestions = new Map<string, IncidentSuggestion>();

  incident.rootCauses.forEach((rootCause) => {
    sourceSuggestionSets[rootCause]?.forEach((suggestion) => {
      suggestions.set(suggestion.id, suggestion);
    });
  });

  if (incident.severity === "High" || incident.severity === "Critical") {
    [
      {
        id: "management-review",
        title: "Assign management review",
        reason: "High severity events require management-level follow-up.",
      },
      {
        id: "create-corrective-action",
        title: "Create corrective action",
        reason: "High severity events require formal corrective action tracking.",
      },
      {
        id: "review-related-risk-assessment",
        title: "Review related risk assessment",
        reason: "Risk controls should be checked against the incident scenario.",
      },
      {
        id: "post-incident-toolbox-talk",
        title: "Conduct toolbox talk after investigation",
        reason: "Lessons learned should be communicated to the affected team.",
      },
    ].forEach((suggestion) => suggestions.set(suggestion.id, suggestion));
  }

  if (incident.eventType === "Environmental Release" || incident.environmentalImpact === "Yes") {
    suggestions.set("environmental-response-review", {
      id: "environmental-response-review",
      title: "Review environmental response and cleanup controls",
      reason: "Environmental impact was recorded for this event.",
    });
  }

  if (
    incident.eventType === "Lost Time Injury" ||
    incident.eventType === "Medical Treatment Case" ||
    incident.injuryOccurred === "Yes"
  ) {
    suggestions.set("injury-case-review", {
      id: "injury-case-review",
      title: "Complete injury case review and return-to-work controls",
      reason: "Injury-related events require health and recovery follow-up.",
    });
  }

  if (suggestions.size === 0) {
    suggestions.set("investigation-follow-up", {
      id: "investigation-follow-up",
      title: "Complete incident investigation follow-up",
      reason: "No root cause has been selected yet; create a general follow-up if needed.",
    });
  }

  return Array.from(suggestions.values());
};

const Badge = ({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) => (
  <span
    className={joinClasses(
      "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-bold",
      className,
    )}
  >
    {children}
  </span>
);

const Field = ({
  label,
  value,
  onChange,
  theme,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: IncidentTheme;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={joinClasses(
        "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
        theme.field,
      )}
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  theme,
  required = false,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: IncidentTheme;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={joinClasses(
        "w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition",
        theme.field,
      )}
    />
  </label>
);

const SelectField = <Option extends string>({
  label,
  value,
  onChange,
  options,
  theme,
}: {
  label: string;
  value: Option;
  onChange: (value: Option) => void;
  options: readonly Option[];
  theme: IncidentTheme;
}) => (
  <label className="block">
    <span
      className={joinClasses(
        "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
        theme.label,
      )}
    >
      {label}
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Option)}
      className={joinClasses(
        "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
        theme.field,
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

export default function IncidentManagementModule({
  userId,
  darkMode,
  onToggleTheme,
  createdBy,
}: IncidentManagementModuleProps) {
  const theme = getTheme(darkMode);
  const [incidents, setIncidents] = useState<IncidentEvent[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [draftIncident, setDraftIncident] = useState<IncidentEvent | null>(null);
  const [modalMode, setModalMode] = useState<"new" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<IncidentFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [activeIncidentActionKeys, setActiveIncidentActionKeys] = useState<string[]>([]);
  const [incidentActionCount, setIncidentActionCount] = useState(0);

  const selectedIncident = useMemo(
    () =>
      incidents.find((incident) => incident.id === selectedIncidentId) ??
      incidents[0] ??
      null,
    [incidents, selectedIncidentId],
  );

  const refreshIncidentActions = useCallback(() => {
    try {
      const actions = readActionTrackerActions(userId).filter(
        (action) => action.sourceModule === "Incident",
      );
      const activeKeys = actions
        .filter((action) => !isClosedAction(action))
        .map((action) => action.linkedIncidentId)
        .filter((value): value is string => Boolean(value));

      setIncidentActionCount(actions.length);
      setActiveIncidentActionKeys(Array.from(new Set(activeKeys)));
    } catch {
      setIncidentActionCount(0);
      setActiveIncidentActionKeys([]);
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const loaded = readIncidents(userId);
        setIncidents(loaded);
        setSelectedIncidentId((current) => current ?? loaded[0]?.id ?? null);

        if (userId) {
          writeIncidents(userId, loaded);
        }
      } catch {
        setNotice("Could not load saved incidents.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refreshIncidentActions, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshIncidentActions]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const saveIncidents = (nextIncidents: IncidentEvent[]) => {
    const sorted = [...nextIncidents].sort(
      (a, b) =>
        new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
    );
    setIncidents(sorted);
    writeIncidents(userId, sorted);
    return sorted;
  };

  const updateDraft = <Key extends keyof IncidentEvent>(
    key: Key,
    value: IncidentEvent[Key],
  ) => {
    setDraftIncident((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const toggleRootCause = (rootCause: RootCause) => {
    setDraftIncident((current) => {
      if (!current) {
        return current;
      }

      const hasRootCause = current.rootCauses.includes(rootCause);

      return {
        ...current,
        rootCauses: hasRootCause
          ? current.rootCauses.filter((item) => item !== rootCause)
          : [...current.rootCauses, rootCause],
      };
    });
  };

  const openNewIncident = () => {
    setDraftIncident(createEmptyIncident());
    setModalMode("new");
  };

  const openEditIncident = (incident: IncidentEvent) => {
    setDraftIncident({ ...incident, rootCauses: [...incident.rootCauses] });
    setModalMode("edit");
  };

  const closeModal = () => {
    setDraftIncident(null);
    setModalMode(null);
  };

  const saveDraftIncident = () => {
    if (!draftIncident) {
      return;
    }

    const incident = normalizeIncident({
      ...draftIncident,
      title: draftIncident.title.trim(),
      siteLocation: draftIncident.siteLocation.trim(),
      department: draftIncident.department.trim(),
      reportedBy: draftIncident.reportedBy.trim(),
      affectedPerson: draftIncident.affectedPerson.trim(),
      jobRole: draftIncident.jobRole.trim(),
      immediateArea: draftIncident.immediateArea.trim(),
      description: draftIncident.description.trim(),
      immediateActionTaken: draftIncident.immediateActionTaken.trim(),
      witnesses: draftIncident.witnesses.trim(),
      investigationNotes: draftIncident.investigationNotes.trim(),
      rootCauseNotes: draftIncident.rootCauseNotes.trim(),
      updatedAt: new Date().toISOString(),
    });

    const missing = [
      ["Event title", incident.title],
      ["Date / Time", incident.dateTime],
      ["Site / Location", incident.siteLocation],
      ["Department", incident.department],
      ["Reported by", incident.reportedBy],
      ["Description", incident.description],
    ].find(([, value]) => value.trim().length === 0);

    if (missing) {
      setNotice(`${missing[0]} is required.`);
      return;
    }

    const updated =
      modalMode === "edit"
        ? incidents.map((item) => (item.id === incident.id ? incident : item))
        : [incident, ...incidents];

    const saved = saveIncidents(updated);
    setSelectedIncidentId(incident.id);
    setNotice(modalMode === "edit" ? "Incident updated." : "Incident recorded.");
    closeModal();

    if (saved.length === 1) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" }),
      );
    }
  };

  const deleteIncident = (incident: IncidentEvent) => {
    const shouldDelete = window.confirm("Delete this incident record?");

    if (!shouldDelete) {
      return;
    }

    const updated = saveIncidents(
      incidents.filter((item) => item.id !== incident.id),
    );
    setSelectedIncidentId(updated[0]?.id ?? null);
    setNotice("Incident deleted.");
  };

  const createIncidentAction = (
    incident: IncidentEvent,
    suggestion: IncidentSuggestion,
  ) => {
    const linkedIncidentId = incidentSuggestionKey(incident.id, suggestion.id);
    const existingActiveAction = readActionTrackerActions(userId).find(
      (action) =>
        action.sourceModule === "Incident" &&
        action.linkedIncidentId === linkedIncidentId &&
        !isClosedAction(action),
    );

    if (existingActiveAction) {
      setActiveIncidentActionKeys((current) =>
        current.includes(linkedIncidentId)
          ? current
          : [...current, linkedIncidentId],
      );
      setNotice("Action already exists for this incident suggestion.");
      return;
    }

    const action = createActionFromInput({
      title: suggestion.title,
      description: [
        `Incident title: ${incident.title || "Not provided"}`,
        `Event type: ${incident.eventType}`,
        `Severity: ${incident.severity}`,
        `Site / Location: ${incident.siteLocation || "Not provided"}`,
        `Department: ${incident.department || "Not provided"}`,
        `Incident description: ${incident.description || "Not provided"}`,
        `Selected root causes: ${
          incident.rootCauses.length > 0
            ? incident.rootCauses.join(", ")
            : "Not selected"
        }`,
        `Immediate action taken: ${
          incident.immediateActionTaken || "Not provided"
        }`,
        `Suggested action reason: ${suggestion.reason}`,
      ].join("\n"),
      sourceModule: "Incident",
      priority: getIncidentPriority(incident.severity),
      responsiblePerson: "",
      department: incident.department,
      siteLocation: incident.siteLocation,
      dueDate: getDateInputDaysFromNow(getIncidentDueOffset(incident.severity)),
      notes: "Created from Incident Management workflow suggestion.",
      createdBy,
      linkedIncidentId,
    });

    appendActionTrackerAction(userId, action);
    setActiveIncidentActionKeys((current) =>
      current.includes(linkedIncidentId)
        ? current
        : [...current, linkedIncidentId],
    );
    setIncidentActionCount((current) => current + 1);

    if (incident.status === "Reported" || incident.status === "Investigation Open") {
      const updatedIncident = {
        ...incident,
        status: "Actions Assigned" as const,
        updatedAt: new Date().toISOString(),
      };
      saveIncidents(
        incidents.map((item) =>
          item.id === incident.id ? updatedIncident : item,
        ),
      );
      setSelectedIncidentId(incident.id);
    }

    setNotice("Action created from incident workflow.");
  };

  const similarEventCount = (incident: IncidentEvent) =>
    incidents.filter((item) => {
      if (item.id === incident.id) {
        return false;
      }

      const hasSharedRootCause = item.rootCauses.some((rootCause) =>
        incident.rootCauses.includes(rootCause),
      );

      return (
        item.eventType === incident.eventType ||
        (!!item.department && item.department === incident.department) ||
        hasSharedRootCause
      );
    }).length;

  const filteredIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return incidents.filter((incident) => {
      const searchable = [
        incident.title,
        incident.eventType,
        incident.severity,
        incident.status,
        incident.department,
        incident.siteLocation,
        incident.reportedBy,
        incident.affectedPerson,
        incident.description,
        incident.rootCauses.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (filters.eventType !== "All" && incident.eventType !== filters.eventType) {
        return false;
      }

      if (filters.severity !== "All" && incident.severity !== filters.severity) {
        return false;
      }

      if (filters.status !== "All" && incident.status !== filters.status) {
        return false;
      }

      if (
        filters.department &&
        incident.department.toLowerCase() !== filters.department.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.siteLocation &&
        incident.siteLocation.toLowerCase() !== filters.siteLocation.toLowerCase()
      ) {
        return false;
      }

      const incidentTime = new Date(incident.dateTime).getTime();

      if (
        filters.dateFrom &&
        incidentTime < new Date(`${filters.dateFrom}T00:00:00`).getTime()
      ) {
        return false;
      }

      if (
        filters.dateTo &&
        incidentTime > new Date(`${filters.dateTo}T23:59:59`).getTime()
      ) {
        return false;
      }

      return true;
    });
  }, [filters, incidents, searchQuery]);

  const uniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          incidents
            .map((incident) => incident.department.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [incidents],
  );

  const uniqueSites = useMemo(
    () =>
      Array.from(
        new Set(
          incidents
            .map((incident) => incident.siteLocation.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [incidents],
  );

  const summary = useMemo(
    () => ({
      totalEvents: incidents.length,
      openInvestigations: incidents.filter((incident) => incident.status !== "Closed")
        .length,
      highSeverityEvents: incidents.filter(
        (incident) =>
          incident.severity === "High" || incident.severity === "Critical",
      ).length,
      actionsCreated: incidentActionCount,
    }),
    [incidentActionCount, incidents],
  );

  const selectedSuggestions = selectedIncident
    ? getSuggestedActions(selectedIncident)
    : [];
  const activeFilterCount = [
    filters.eventType !== "All",
    filters.severity !== "All",
    filters.status !== "All",
    filters.department.length > 0,
    filters.siteLocation.length > 0,
    filters.dateFrom.length > 0,
    filters.dateTo.length > 0,
  ].filter(Boolean).length;

  const statCards = [
    {
      label: "Total Events",
      value: summary.totalEvents,
      icon: ClipboardList,
      tone: darkMode
        ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#DDFBFF]"
        : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
    },
    {
      label: "Open Investigations",
      value: summary.openInvestigations,
      icon: CalendarDays,
      tone: darkMode
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "High Severity Events",
      value: summary.highSeverityEvents,
      icon: ShieldAlert,
      tone: darkMode
        ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
        : "border-rose-200 bg-rose-50 text-rose-700",
    },
    {
      label: "Actions Created",
      value: summary.actionsCreated,
      icon: CheckCircle2,
      tone: darkMode
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  ];

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
            "overflow-hidden rounded-3xl border backdrop-blur-2xl",
            theme.shell,
          )}
        >
          <div
            className={joinClasses(
              "border-b px-5 py-5 sm:px-7",
              theme.shellHeader,
            )}
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Incident Management
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Incident Workflow Engine
                </h1>
                <p className={joinClasses("mt-2 max-w-3xl text-sm leading-6", theme.muted)}>
                  Record HSE events, classify causes, generate operational
                  follow-up actions, and track investigation status through
                  closure.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openNewIncident}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  New Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className={joinClasses(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.ghostButton,
                  )}
                >
                  <Filter size={16} aria-hidden />
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={joinClasses(
                    "inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-200",
                    theme.themeToggleButton,
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
            </div>

            {notice ? (
              <div
                className={joinClasses(
                  "mt-4 rounded-xl border px-4 py-3 text-sm font-semibold",
                  theme.notice,
                )}
                role="status"
              >
                {notice}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-4">
            {statCards.map((card) => {
              const CardIcon = card.icon;

              return (
                <div
                  key={card.label}
                  className={joinClasses("rounded-2xl border p-4", theme.card)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className={joinClasses(
                          "text-xs font-semibold uppercase tracking-[0.16em]",
                          theme.label,
                        )}
                      >
                        {card.label}
                      </div>
                      <div className={joinClasses("mt-3 text-3xl font-bold", theme.heading)}>
                        {card.value}
                      </div>
                    </div>
                    <span
                      className={joinClasses(
                        "flex h-11 w-11 items-center justify-center rounded-2xl border",
                        card.tone,
                      )}
                    >
                      <CardIcon size={20} aria-hidden />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <section
          className={joinClasses(
            "rounded-3xl border p-5 backdrop-blur-2xl sm:p-7",
            theme.panel,
          )}
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <span className="sr-only">Search incidents</span>
              <Search
                className={joinClasses(
                  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
                  theme.muted,
                )}
                size={18}
                aria-hidden
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search incidents, people, sites, departments, root causes..."
                className={joinClasses(
                  "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                  theme.field,
                )}
              />
            </label>
            <div className={joinClasses("text-sm font-semibold", theme.muted)}>
              {filteredIncidents.length} of {incidents.length} events shown
            </div>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-4 rounded-2xl border border-dashed border-[#4DEBFF]/25 p-4 md:grid-cols-2 xl:grid-cols-7">
              <SelectField
                label="Event Type"
                value={filters.eventType}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, eventType: value }))
                }
                options={["All", ...eventTypeOptions] as const}
                theme={theme}
              />
              <SelectField
                label="Severity"
                value={filters.severity}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, severity: value }))
                }
                options={["All", ...severityOptions] as const}
                theme={theme}
              />
              <SelectField
                label="Status"
                value={filters.status}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, status: value }))
                }
                options={["All", ...statusOptions] as const}
                theme={theme}
              />
              <label>
                <span className={joinClasses("mb-2 block text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                  Department
                </span>
                <input
                  value={filters.department}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  list="incident-departments"
                  placeholder="All"
                  className={joinClasses("w-full rounded-xl border px-4 py-3 text-sm outline-none transition", theme.field)}
                />
                <datalist id="incident-departments">
                  {uniqueDepartments.map((department) => (
                    <option key={department} value={department} />
                  ))}
                </datalist>
              </label>
              <label>
                <span className={joinClasses("mb-2 block text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                  Site
                </span>
                <input
                  value={filters.siteLocation}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      siteLocation: event.target.value,
                    }))
                  }
                  list="incident-sites"
                  placeholder="All"
                  className={joinClasses("w-full rounded-xl border px-4 py-3 text-sm outline-none transition", theme.field)}
                />
                <datalist id="incident-sites">
                  {uniqueSites.map((site) => (
                    <option key={site} value={site} />
                  ))}
                </datalist>
              </label>
              <Field
                label="From"
                value={filters.dateFrom}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, dateFrom: value }))
                }
                theme={theme}
                type="date"
              />
              <Field
                label="To"
                value={filters.dateTo}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, dateTo: value }))
                }
                theme={theme}
                type="date"
              />
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters)}
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm font-semibold transition xl:col-span-7",
                    theme.ghostButton,
                  )}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
            <div className="space-y-3">
              {filteredIncidents.map((incident) => {
                const isSelected = selectedIncident?.id === incident.id;
                const similarCount = similarEventCount(incident);
                const actionCount = readActionTrackerActions(userId).filter(
                  (action) =>
                    action.sourceModule === "Incident" &&
                    action.linkedIncidentId?.startsWith(`incident:${incident.id}:`),
                ).length;

                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={joinClasses(
                      "w-full rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-[#4DEBFF]/40 bg-[#1E90FF]/12 shadow-[0_16px_44px_rgba(30,144,255,0.16)]"
                        : theme.card,
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={severityTone(incident.severity, darkMode)}>
                            {incident.severity}
                          </Badge>
                          <Badge className={statusTone(incident.status, darkMode)}>
                            {incident.status}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-base font-semibold">
                          {incident.title}
                        </h3>
                        <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                          {incident.eventType} / {incident.department || "No department"}
                        </p>
                      </div>
                      <div className={joinClasses("text-sm sm:text-right", theme.muted)}>
                        <div>{formatDisplayDateTime(incident.dateTime)}</div>
                        <div className="mt-1">{incident.siteLocation}</div>
                      </div>
                    </div>
                    <div className={joinClasses("mt-3 grid gap-2 text-sm sm:grid-cols-2", theme.soft)}>
                      <div>Affected: {incident.affectedPerson || "Not provided"}</div>
                      <div>Actions Created: {actionCount}</div>
                    </div>
                    {similarCount > 0 ? (
                      <div
                        className={joinClasses(
                          "mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
                          darkMode
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                            : "border-amber-200 bg-amber-50 text-amber-800",
                        )}
                      >
                        <AlertTriangle size={14} aria-hidden />
                        Similar events found in history.
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {filteredIncidents.length === 0 ? (
                <div
                  className={joinClasses(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    theme.empty,
                  )}
                >
                  No incident records found. Create an event to start an
                  investigation workflow.
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              {selectedIncident ? (
                <div className={joinClasses("rounded-3xl border p-5", theme.card)}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#4DEBFF]">
                        Investigation Workspace
                      </div>
                      <h2 className="mt-2 text-xl font-semibold">
                        {selectedIncident.title}
                      </h2>
                      <p className={joinClasses("mt-2 text-sm leading-6", theme.muted)}>
                        {selectedIncident.description || "No description provided."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditIncident(selectedIncident)}
                        className={joinClasses(
                          "rounded-xl border p-2 transition",
                          theme.ghostButton,
                        )}
                        aria-label="Edit incident"
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteIncident(selectedIncident)}
                        className={joinClasses(
                          "rounded-xl border p-2 transition",
                          theme.dangerButton,
                        )}
                        aria-label="Delete incident"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className={joinClasses("rounded-2xl border p-4", theme.panel)}>
                      <div className={joinClasses("text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                        Event Profile
                      </div>
                      <div className={joinClasses("mt-3 space-y-2 text-sm", theme.soft)}>
                        <div>Type: {selectedIncident.eventType}</div>
                        <div>Department: {selectedIncident.department || "Not provided"}</div>
                        <div>Site: {selectedIncident.siteLocation || "Not provided"}</div>
                        <div>Area: {selectedIncident.immediateArea || "Not provided"}</div>
                        <div>Reported by: {selectedIncident.reportedBy || "Not provided"}</div>
                      </div>
                    </div>
                    <div className={joinClasses("rounded-2xl border p-4", theme.panel)}>
                      <div className={joinClasses("text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                        Immediate Controls
                      </div>
                      <div className={joinClasses("mt-3 space-y-2 text-sm", theme.soft)}>
                        <div>Work stopped: {selectedIncident.workStopped}</div>
                        <div>Area secured: {selectedIncident.areaSecured}</div>
                        <div>Injury occurred: {selectedIncident.injuryOccurred}</div>
                        <div>Property damage: {selectedIncident.propertyDamage}</div>
                        <div>Environmental impact: {selectedIncident.environmentalImpact}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className={joinClasses("mb-3 text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                      Investigation Timeline
                    </div>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {statusOptions.map((status, index) => {
                        const activeIndex = statusOptions.indexOf(selectedIncident.status);
                        const isComplete = index <= activeIndex;

                        return (
                          <div
                            key={status}
                            className={joinClasses(
                              "rounded-2xl border p-3 text-xs font-semibold transition",
                              isComplete
                                ? "border-[#4DEBFF]/35 bg-[#1E90FF]/12 text-[#4DEBFF]"
                                : theme.ghostButton,
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={joinClasses(
                                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                                  isComplete
                                    ? "border-[#4DEBFF]/40 bg-[#1E90FF]/20"
                                    : "border-current/20",
                                )}
                              >
                                {index + 1}
                              </span>
                              {status}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className={joinClasses("mb-3 text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                      Root Cause Builder
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedIncident.rootCauses.length > 0 ? (
                        selectedIncident.rootCauses.map((rootCause) => (
                          <Badge key={rootCause} className={theme.notice}>
                            {rootCause}
                          </Badge>
                        ))
                      ) : (
                        <span className={joinClasses("text-sm", theme.muted)}>
                          No root causes selected yet.
                        </span>
                      )}
                    </div>
                    {selectedIncident.rootCauseNotes ? (
                      <p className={joinClasses("mt-3 text-sm leading-6", theme.muted)}>
                        {selectedIncident.rootCauseNotes}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <div className={joinClasses("mb-3 text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                      Smart Workflow Suggestions
                    </div>
                    <div className="space-y-3">
                      {selectedSuggestions.map((suggestion) => {
                        const key = incidentSuggestionKey(
                          selectedIncident.id,
                          suggestion.id,
                        );
                        const hasActiveAction =
                          activeIncidentActionKeys.includes(key);

                        return (
                          <div
                            key={suggestion.id}
                            className={joinClasses(
                              "rounded-2xl border p-4",
                              theme.panel,
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="font-semibold">{suggestion.title}</h3>
                                <p className={joinClasses("mt-1 text-sm leading-6", theme.muted)}>
                                  {suggestion.reason}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={hasActiveAction}
                                onClick={() =>
                                  hasActiveAction
                                    ? undefined
                                    : createIncidentAction(
                                        selectedIncident,
                                        suggestion,
                                      )
                                }
                                className={joinClasses(
                                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                                  hasActiveAction
                                    ? `${theme.notice} cursor-not-allowed opacity-85`
                                    : theme.exportButton,
                                )}
                              >
                                <Plus size={15} aria-hidden />
                                {hasActiveAction ? "Action Created" : "Create Action"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {similarEventCount(selectedIncident) > 0 ? (
                    <div
                      className={joinClasses(
                        "mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold",
                        darkMode
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                          : "border-amber-200 bg-amber-50 text-amber-800",
                      )}
                    >
                      Similar events found in history.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  className={joinClasses(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    theme.empty,
                  )}
                >
                  Select or create an incident to view investigation workflow.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {draftIncident ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div
            className={joinClasses(
              "relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border p-5 shadow-[0_30px_100px_rgba(0,0,0,0.34)] sm:p-7",
              theme.modal,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Incident Management
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {modalMode === "new" ? "Record New Event" : "Edit Event"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={joinClasses(
                  "rounded-xl border p-2 transition",
                  theme.ghostButton,
                )}
                aria-label="Close modal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Event Title"
                value={draftIncident.title}
                onChange={(value) => updateDraft("title", value)}
                theme={theme}
                required
              />
              <SelectField
                label="Event Type"
                value={draftIncident.eventType}
                onChange={(value) => updateDraft("eventType", value)}
                options={eventTypeOptions}
                theme={theme}
              />
              <Field
                label="Date / Time"
                value={draftIncident.dateTime}
                onChange={(value) => updateDraft("dateTime", value)}
                theme={theme}
                type="datetime-local"
                required
              />
              <Field
                label="Site / Location"
                value={draftIncident.siteLocation}
                onChange={(value) => updateDraft("siteLocation", value)}
                theme={theme}
                required
              />
              <Field
                label="Department"
                value={draftIncident.department}
                onChange={(value) => updateDraft("department", value)}
                theme={theme}
                required
              />
              <Field
                label="Reported By"
                value={draftIncident.reportedBy}
                onChange={(value) => updateDraft("reportedBy", value)}
                theme={theme}
                required
              />
              <Field
                label="Involved / Affected Person"
                value={draftIncident.affectedPerson}
                onChange={(value) => updateDraft("affectedPerson", value)}
                theme={theme}
              />
              <Field
                label="Job Role / Position"
                value={draftIncident.jobRole}
                onChange={(value) => updateDraft("jobRole", value)}
                theme={theme}
              />
              <Field
                label="Immediate Area"
                value={draftIncident.immediateArea}
                onChange={(value) => updateDraft("immediateArea", value)}
                theme={theme}
              />
              <SelectField
                label="Severity"
                value={draftIncident.severity}
                onChange={(value) => updateDraft("severity", value)}
                options={severityOptions}
                theme={theme}
              />
              <SelectField
                label="Status"
                value={draftIncident.status}
                onChange={(value) => updateDraft("status", value)}
                options={statusOptions}
                theme={theme}
              />
              <Field
                label="Witnesses"
                value={draftIncident.witnesses}
                onChange={(value) => updateDraft("witnesses", value)}
                theme={theme}
              />
              <SelectField
                label="Work Stopped?"
                value={draftIncident.workStopped}
                onChange={(value) => updateDraft("workStopped", value)}
                options={yesNoOptions}
                theme={theme}
              />
              <SelectField
                label="Area Secured?"
                value={draftIncident.areaSecured}
                onChange={(value) => updateDraft("areaSecured", value)}
                options={yesNoOptions}
                theme={theme}
              />
              <SelectField
                label="Injury Occurred?"
                value={draftIncident.injuryOccurred}
                onChange={(value) => updateDraft("injuryOccurred", value)}
                options={yesNoOptions}
                theme={theme}
              />
              <SelectField
                label="Property Damage?"
                value={draftIncident.propertyDamage}
                onChange={(value) => updateDraft("propertyDamage", value)}
                options={yesNoOptions}
                theme={theme}
              />
              <SelectField
                label="Environmental Impact?"
                value={draftIncident.environmentalImpact}
                onChange={(value) => updateDraft("environmentalImpact", value)}
                options={yesNoOptions}
                theme={theme}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <TextAreaField
                label="Description of What Happened"
                value={draftIncident.description}
                onChange={(value) => updateDraft("description", value)}
                theme={theme}
                required
                rows={5}
              />
              <TextAreaField
                label="Immediate Action Taken"
                value={draftIncident.immediateActionTaken}
                onChange={(value) => updateDraft("immediateActionTaken", value)}
                theme={theme}
                rows={5}
              />
              <TextAreaField
                label="Investigation Notes"
                value={draftIncident.investigationNotes}
                onChange={(value) => updateDraft("investigationNotes", value)}
                theme={theme}
                rows={5}
              />
              <TextAreaField
                label="Root Cause Notes"
                value={draftIncident.rootCauseNotes}
                onChange={(value) => updateDraft("rootCauseNotes", value)}
                theme={theme}
                rows={5}
              />
            </div>

            <div className="mt-5">
              <div className={joinClasses("mb-3 text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
                Root Cause Builder
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rootCauseOptions.map((rootCause) => {
                  const selected = draftIncident.rootCauses.includes(rootCause);

                  return (
                    <button
                      key={rootCause}
                      type="button"
                      onClick={() => toggleRootCause(rootCause)}
                      className={joinClasses(
                        "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition",
                        selected
                          ? "border-[#4DEBFF]/40 bg-[#1E90FF]/15 text-[#4DEBFF]"
                          : theme.ghostButton,
                      )}
                    >
                      {rootCause}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className={joinClasses(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  theme.ghostButton,
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraftIncident}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
              >
                <Plus size={16} aria-hidden />
                Save Event
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
