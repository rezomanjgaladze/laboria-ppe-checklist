"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Moon,
  Plus,
  Save,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

const sourceModuleOptions = [
  "Manual",
  "Inspection",
  "Risk Assessment",
  "Incident",
  "Training",
] as const;

const priorityOptions = ["Low", "Medium", "High", "Critical"] as const;

const statusOptions = [
  "Open",
  "In Progress",
  "Pending Verification",
  "Completed",
  "Closed",
] as const;

type SourceModule = (typeof sourceModuleOptions)[number];
type ActionPriority = (typeof priorityOptions)[number];
type ActionStatus = (typeof statusOptions)[number];

type HseAction = {
  id: string;
  title: string;
  description: string;
  sourceModule: SourceModule;
  priority: ActionPriority;
  responsiblePerson: string;
  department: string;
  siteLocation: string;
  dueDate: string;
  status: ActionStatus;
  progress: number;
  notes: string;
  createdDate: string;
  lastUpdated: string;
  createdBy: string;
  linkedInspectionId?: string;
  linkedRiskAssessmentId?: string;
  linkedIncidentId?: string;
  linkedTrainingGapKey?: string;
};

type ActionFilters = {
  status: "All" | ActionStatus;
  priority: "All" | ActionPriority;
  sourceModule: "All" | SourceModule;
  department: string;
  responsiblePerson: string;
  overdueOnly: boolean;
};

type SortKey =
  | "title"
  | "sourceModule"
  | "priority"
  | "responsiblePerson"
  | "department"
  | "dueDate"
  | "status"
  | "progress";

type SortDirection = "asc" | "desc";

type ActionTrackerModuleProps = {
  userId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  createdBy: string;
};

const emptyFilters: ActionFilters = {
  status: "All",
  priority: "All",
  sourceModule: "All",
  department: "",
  responsiblePerson: "",
  overdueOnly: false,
};

const legacyStorageKey = "laboria_action_tracker_actions";

const getStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_action_tracker_actions`
    : legacyStorageKey;

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const formatDateInput = (date: Date) => date.toISOString().split("T")[0];

const todayInput = () => formatDateInput(new Date());

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
};

const createActionId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createEmptyAction = (createdBy: string): HseAction => {
  const now = new Date().toISOString();

  return {
    id: createActionId(),
    title: "",
    description: "",
    sourceModule: "Manual",
    priority: "Medium",
    responsiblePerson: "",
    department: "",
    siteLocation: "",
    dueDate: todayInput(),
    status: "Open",
    progress: 0,
    notes: "",
    createdDate: now,
    lastUpdated: now,
    createdBy,
  };
};

const isClosedStatus = (status: ActionStatus) =>
  status === "Completed" || status === "Closed";

const isOverdue = (action: HseAction) => {
  if (!action.dueDate || isClosedStatus(action.status)) {
    return false;
  }

  const due = new Date(`${action.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
};

const isThisMonth = (dateValue: string) => {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  const now = new Date();

  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

const normalizeSourceModule = (value: unknown): SourceModule =>
  sourceModuleOptions.includes(value as SourceModule)
    ? (value as SourceModule)
    : "Manual";

const normalizePriority = (value: unknown): ActionPriority =>
  priorityOptions.includes(value as ActionPriority)
    ? (value as ActionPriority)
    : "Medium";

const normalizeStatus = (value: unknown): ActionStatus =>
  statusOptions.includes(value as ActionStatus)
    ? (value as ActionStatus)
    : "Open";

const normalizeAction = (action: Partial<HseAction>): HseAction => {
  const now = new Date().toISOString();

  return {
    id:
      typeof action.id === "string" && action.id.trim().length > 0
        ? action.id
        : createActionId(),
    title: typeof action.title === "string" ? action.title : "",
    description:
      typeof action.description === "string" ? action.description : "",
    sourceModule: normalizeSourceModule(action.sourceModule),
    priority: normalizePriority(action.priority),
    responsiblePerson:
      typeof action.responsiblePerson === "string"
        ? action.responsiblePerson
        : "",
    department: typeof action.department === "string" ? action.department : "",
    siteLocation:
      typeof action.siteLocation === "string" ? action.siteLocation : "",
    dueDate:
      typeof action.dueDate === "string" && action.dueDate.length > 0
        ? action.dueDate
        : todayInput(),
    status: normalizeStatus(action.status),
    progress: clampProgress(
      typeof action.progress === "number" ? action.progress : 0,
    ),
    notes: typeof action.notes === "string" ? action.notes : "",
    createdDate:
      typeof action.createdDate === "string" ? action.createdDate : now,
    lastUpdated:
      typeof action.lastUpdated === "string" ? action.lastUpdated : now,
    createdBy:
      typeof action.createdBy === "string" && action.createdBy.trim().length > 0
        ? action.createdBy
        : "Unknown",
    linkedInspectionId:
      typeof action.linkedInspectionId === "string"
        ? action.linkedInspectionId
        : undefined,
    linkedRiskAssessmentId:
      typeof action.linkedRiskAssessmentId === "string"
        ? action.linkedRiskAssessmentId
        : undefined,
    linkedIncidentId:
      typeof action.linkedIncidentId === "string"
        ? action.linkedIncidentId
        : undefined,
    linkedTrainingGapKey:
      typeof action.linkedTrainingGapKey === "string"
        ? action.linkedTrainingGapKey
        : undefined,
  };
};

const parseActions = (value: string | null): HseAction[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Partial<HseAction> => {
        return Boolean(item && typeof item === "object");
      })
      .map(normalizeAction);
  } catch {
    return [];
  }
};

const mergeActions = (actions: HseAction[]) => {
  const byId = new Map<string, HseAction>();

  actions.forEach((action) => {
    const existing = byId.get(action.id);
    const actionTime = new Date(action.lastUpdated).getTime();
    const existingTime = existing
      ? new Date(existing.lastUpdated).getTime()
      : Number.NEGATIVE_INFINITY;

    if (!existing || actionTime >= existingTime) {
      byId.set(action.id, action);
    }
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.lastUpdated).getTime();
    const bTime = new Date(b.lastUpdated).getTime();
    return bTime - aTime;
  });
};

const readActions = (userId: string | null) => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [getStorageKey(userId)];

  if (userId && !keys.includes(legacyStorageKey)) {
    keys.push(legacyStorageKey);
  }

  return mergeActions(
    keys.flatMap((key) => parseActions(window.localStorage.getItem(key))),
  );
};

const writeActions = (userId: string | null, actions: HseAction[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(actions));

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

type ActionTrackerTheme = ReturnType<typeof getTheme>;

const priorityTone = (priority: ActionPriority, darkMode: boolean) => {
  if (priority === "Critical") {
    return darkMode
      ? "border-rose-400/40 bg-rose-500/12 text-rose-200"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (priority === "High") {
    return darkMode
      ? "border-orange-300/35 bg-orange-400/12 text-orange-100"
      : "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (priority === "Medium") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  return darkMode
    ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const statusTone = (status: ActionStatus, darkMode: boolean) => {
  if (status === "Completed" || status === "Closed") {
    return darkMode
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Pending Verification") {
    return darkMode
      ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (status === "In Progress") {
    return darkMode
      ? "border-[#4DEBFF]/35 bg-[#4DEBFF]/10 text-[#DDFBFF]"
      : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8]";
  }

  return darkMode
    ? "border-slate-400/25 bg-white/[0.04] text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-700";
};

const sourceTone = (sourceModule: SourceModule, darkMode: boolean) => {
  if (sourceModule === "Inspection") {
    return darkMode
      ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";
  }

  if (sourceModule === "Risk Assessment") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (sourceModule === "Incident") {
    return darkMode
      ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (sourceModule === "Training") {
    return darkMode
      ? "border-violet-300/35 bg-violet-400/10 text-violet-100"
      : "border-violet-200 bg-violet-50 text-violet-700";
  }

  return darkMode
    ? "border-slate-400/25 bg-white/[0.04] text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-700";
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
  theme: ActionTrackerTheme;
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
  theme: ActionTrackerTheme;
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
  theme: ActionTrackerTheme;
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

const formatDisplayDate = (value: string) => {
  if (!value) {
    return "No date";
  }

  const date = new Date(`${value}T00:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function ActionTrackerModule({
  userId,
  darkMode,
  onToggleTheme,
  createdBy,
}: ActionTrackerModuleProps) {
  const theme = getTheme(darkMode);
  const [actions, setActions] = useState<HseAction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ActionFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [draftAction, setDraftAction] = useState<HseAction | null>(null);
  const [modalMode, setModalMode] = useState<"new" | "edit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const loadedActions = readActions(userId);
        setActions(loadedActions);

        if (userId) {
          writeActions(userId, loadedActions);
        }
      } catch {
        setNotice("Could not load saved actions.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [userId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const updateFilters = <Key extends keyof ActionFilters>(
    key: Key,
    value: ActionFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const updateDraft = <Key extends keyof HseAction>(
    key: Key,
    value: HseAction[Key],
  ) => {
    setDraftAction((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const openNewAction = () => {
    setDraftAction(createEmptyAction(createdBy));
    setModalMode("new");
  };

  const openEditAction = (action: HseAction) => {
    setDraftAction({ ...action });
    setModalMode("edit");
  };

  const closeModal = () => {
    setDraftAction(null);
    setModalMode(null);
  };

  const saveDraftAction = () => {
    if (!draftAction) {
      return;
    }

    const missingRequiredField = [
      ["Action title", draftAction.title],
      ["Description", draftAction.description],
      ["Responsible person", draftAction.responsiblePerson],
      ["Department", draftAction.department],
      ["Site / Location", draftAction.siteLocation],
      ["Due date", draftAction.dueDate],
    ].find(([, value]) => value.trim().length === 0);

    if (missingRequiredField) {
      setNotice(`${missingRequiredField[0]} is required.`);
      return;
    }

    const now = new Date().toISOString();
    const nextAction: HseAction = {
      ...draftAction,
      title: draftAction.title.trim(),
      description: draftAction.description.trim(),
      responsiblePerson: draftAction.responsiblePerson.trim(),
      department: draftAction.department.trim(),
      siteLocation: draftAction.siteLocation.trim(),
      notes: draftAction.notes.trim(),
      progress: clampProgress(draftAction.progress),
      createdBy: draftAction.createdBy || createdBy,
      lastUpdated: now,
    };

    setActions((current) => {
      const exists = current.some((action) => action.id === nextAction.id);
      const updated = mergeActions(
        exists
          ? current.map((action) =>
              action.id === nextAction.id ? nextAction : action,
            )
          : [nextAction, ...current],
      );

      writeActions(userId, updated);
      return updated;
    });

    setNotice(modalMode === "new" ? "Action created." : "Action updated.");
    closeModal();
  };

  const deleteAction = (actionId: string) => {
    const shouldDelete = window.confirm("Delete this action?");

    if (!shouldDelete) {
      return;
    }

    setActions((current) => {
      const updated = current.filter((action) => action.id !== actionId);
      writeActions(userId, updated);
      return updated;
    });

    if (draftAction?.id === actionId) {
      closeModal();
    }

    setNotice("Action deleted.");
  };

  const summary = useMemo(() => {
    const openActions = actions.filter(
      (action) => !isClosedStatus(action.status),
    ).length;
    const overdueActions = actions.filter(isOverdue).length;
    const criticalActions = actions.filter(
      (action) =>
        action.priority === "Critical" && !isClosedStatus(action.status),
    ).length;
    const completedThisMonth = actions.filter(
      (action) =>
        isClosedStatus(action.status) && isThisMonth(action.lastUpdated),
    ).length;

    return {
      openActions,
      overdueActions,
      criticalActions,
      completedThisMonth,
    };
  }, [actions]);

  const uniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          actions
            .map((action) => action.department.trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [actions],
  );

  const uniqueResponsiblePeople = useMemo(
    () =>
      Array.from(
        new Set(
          actions
            .map((action) => action.responsiblePerson.trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [actions],
  );

  const filteredActions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return actions
      .filter((action) => {
        const searchable = [
          action.title,
          action.description,
          action.sourceModule,
          action.priority,
          action.responsiblePerson,
          action.department,
          action.siteLocation,
          action.status,
          action.notes,
        ]
          .join(" ")
          .toLowerCase();

        if (query && !searchable.includes(query)) {
          return false;
        }

        if (filters.status !== "All" && action.status !== filters.status) {
          return false;
        }

        if (
          filters.priority !== "All" &&
          action.priority !== filters.priority
        ) {
          return false;
        }

        if (
          filters.sourceModule !== "All" &&
          action.sourceModule !== filters.sourceModule
        ) {
          return false;
        }

        if (
          filters.department &&
          action.department.toLowerCase() !== filters.department.toLowerCase()
        ) {
          return false;
        }

        if (
          filters.responsiblePerson &&
          action.responsiblePerson.toLowerCase() !==
            filters.responsiblePerson.toLowerCase()
        ) {
          return false;
        }

        if (filters.overdueOnly && !isOverdue(action)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (sortKey === "progress") {
          return ((aValue as number) - (bValue as number)) * direction;
        }

        if (sortKey === "dueDate") {
          return (
            (new Date(`${a.dueDate}T00:00:00`).getTime() -
              new Date(`${b.dueDate}T00:00:00`).getTime()) *
            direction
          );
        }

        return String(aValue).localeCompare(String(bValue)) * direction;
      });
  }, [actions, filters, searchQuery, sortDirection, sortKey]);

  const statCards = [
    {
      label: "Open Actions",
      value: summary.openActions,
      icon: Clock,
      tone: darkMode
        ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#DDFBFF]"
        : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
    },
    {
      label: "Overdue Actions",
      value: summary.overdueActions,
      icon: Calendar,
      tone: darkMode
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "Critical Actions",
      value: summary.criticalActions,
      icon: TriangleAlert,
      tone: darkMode
        ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
        : "border-rose-200 bg-rose-50 text-rose-700",
    },
    {
      label: "Completed This Month",
      value: summary.completedThisMonth,
      icon: CheckCircle2,
      tone: darkMode
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  ];

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "dueDate" ? "asc" : "desc");
  };

  const activeFilterCount = [
    filters.status !== "All",
    filters.priority !== "All",
    filters.sourceModule !== "All",
    filters.department.length > 0,
    filters.responsiblePerson.length > 0,
    filters.overdueOnly,
  ].filter(Boolean).length;

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
                  Action Tracker
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  HSE Operational Action Board
                </h1>
                <p
                  className={joinClasses(
                    "mt-2 max-w-3xl text-sm leading-6",
                    theme.muted,
                  )}
                >
                  Manage HSE actions, deadlines, responsibilities, corrective
                  measures, and operational follow-up across Laboria workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openNewAction}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  New Action
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
                  onClick={() =>
                    setNotice("Action export will be available soon.")
                  }
                  className={joinClasses(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.exportButton,
                  )}
                >
                  <Download size={16} aria-hidden />
                  Export
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
                      <div
                        className={joinClasses(
                          "mt-3 text-3xl font-bold",
                          theme.heading,
                        )}
                      >
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
              <span className="sr-only">Search actions</span>
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
                placeholder="Search actions, owners, departments, sites, notes..."
                className={joinClasses(
                  "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                  theme.field,
                )}
              />
            </label>
            <div className={joinClasses("text-sm font-semibold", theme.muted)}>
              {filteredActions.length} of {actions.length} actions shown
            </div>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-4 rounded-2xl border border-dashed border-[#4DEBFF]/25 p-4 md:grid-cols-2 xl:grid-cols-6">
              <label>
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Status
                </span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    updateFilters(
                      "status",
                      event.target.value as ActionFilters["status"],
                    )
                  }
                  className={joinClasses(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                >
                  <option value="All">All</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Priority
                </span>
                <select
                  value={filters.priority}
                  onChange={(event) =>
                    updateFilters(
                      "priority",
                      event.target.value as ActionFilters["priority"],
                    )
                  }
                  className={joinClasses(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                >
                  <option value="All">All</option>
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Source Module
                </span>
                <select
                  value={filters.sourceModule}
                  onChange={(event) =>
                    updateFilters(
                      "sourceModule",
                      event.target.value as ActionFilters["sourceModule"],
                    )
                  }
                  className={joinClasses(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                >
                  <option value="All">All</option>
                  {sourceModuleOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Department
                </span>
                <input
                  value={filters.department}
                  onChange={(event) =>
                    updateFilters("department", event.target.value)
                  }
                  list="action-department-filters"
                  placeholder="All"
                  className={joinClasses(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                />
                <datalist id="action-department-filters">
                  {uniqueDepartments.map((department) => (
                    <option key={department} value={department} />
                  ))}
                </datalist>
              </label>
              <label>
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Responsible Person
                </span>
                <input
                  value={filters.responsiblePerson}
                  onChange={(event) =>
                    updateFilters("responsiblePerson", event.target.value)
                  }
                  list="action-responsible-filters"
                  placeholder="All"
                  className={joinClasses(
                    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                />
                <datalist id="action-responsible-filters">
                  {uniqueResponsiblePeople.map((person) => (
                    <option key={person} value={person} />
                  ))}
                </datalist>
              </label>
              <div className="flex items-end">
                <label
                  className={joinClasses(
                    "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    filters.overdueOnly
                      ? darkMode
                        ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                      : theme.ghostButton,
                  )}
                >
                  <input
                    type="checkbox"
                    checked={filters.overdueOnly}
                    onChange={(event) =>
                      updateFilters("overdueOnly", event.target.checked)
                    }
                    className="h-4 w-4 accent-[#1E90FF]"
                  />
                  Overdue only
                </label>
              </div>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters)}
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm font-semibold transition xl:col-span-6",
                    theme.ghostButton,
                  )}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className={theme.tableHead}>
                <tr>
                  {[
                    ["title", "Action Title"],
                    ["sourceModule", "Source"],
                    ["priority", "Priority"],
                    ["responsiblePerson", "Responsible Person"],
                    ["department", "Department"],
                    ["dueDate", "Due Date"],
                    ["status", "Status"],
                    ["progress", "Progress"],
                  ].map(([key, label]) => (
                    <th key={key} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort(key as SortKey)}
                        className="inline-flex items-center gap-1 font-bold"
                      >
                        {label}
                        <span className="text-[10px] opacity-70">
                          {sortKey === key
                            ? sortDirection === "asc"
                              ? "ASC"
                              : "DESC"
                            : ""}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredActions.map((action) => {
                  const overdue = isOverdue(action);

                  return (
                    <tr
                      key={action.id}
                      onClick={() => openEditAction(action)}
                      className={joinClasses(
                        "cursor-pointer border-t transition",
                        theme.row,
                      )}
                    >
                      <td className="max-w-[19rem] px-4 py-4">
                        <div
                          className={joinClasses(
                            "font-semibold",
                            theme.heading,
                          )}
                        >
                          {action.title}
                        </div>
                        <div
                          className={joinClasses(
                            "mt-1 truncate text-xs",
                            theme.muted,
                          )}
                        >
                          {action.siteLocation || "No site"} -{" "}
                          {action.description || "No description"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={sourceTone(action.sourceModule, darkMode)}
                        >
                          {action.sourceModule}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={priorityTone(action.priority, darkMode)}
                        >
                          {action.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {action.responsiblePerson || "Unassigned"}
                      </td>
                      <td className="px-4 py-4">
                        {action.department || "Not set"}
                      </td>
                      <td className="px-4 py-4">
                        <div
                          className={
                            overdue
                              ? "font-semibold text-rose-500"
                              : undefined
                          }
                        >
                          {formatDisplayDate(action.dueDate)}
                        </div>
                        {overdue ? (
                          <div className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-rose-500">
                            Overdue
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={statusTone(action.status, darkMode)}>
                          {action.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-28">
                          <div
                            className={joinClasses(
                              "mb-1 text-xs font-semibold",
                              theme.muted,
                            )}
                          >
                            {action.progress}%
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-700/20">
                            <div
                              className="h-full rounded-full bg-[#1E90FF]"
                              style={{ width: `${action.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-4 lg:hidden">
            {filteredActions.map((action) => {
              const overdue = isOverdue(action);

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => openEditAction(action)}
                  className={joinClasses(
                    "w-full rounded-2xl border p-4 text-left transition",
                    theme.card,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={joinClasses(
                          "font-semibold",
                          theme.heading,
                        )}
                      >
                        {action.title}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge
                          className={sourceTone(action.sourceModule, darkMode)}
                        >
                          {action.sourceModule}
                        </Badge>
                        <span className={joinClasses("text-xs", theme.muted)}>
                          {action.responsiblePerson || "Unassigned"}
                        </span>
                      </div>
                    </div>
                    <Badge className={priorityTone(action.priority, darkMode)}>
                      {action.priority}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={statusTone(action.status, darkMode)}>
                      {action.status}
                    </Badge>
                    {overdue ? (
                      <Badge
                        className={
                          darkMode
                            ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }
                      >
                        Overdue
                      </Badge>
                    ) : null}
                  </div>
                  <div className={joinClasses("mt-3 text-sm", theme.soft)}>
                    {action.department || "No department"} -{" "}
                    {formatDisplayDate(action.dueDate)}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/20">
                    <div
                      className="h-full rounded-full bg-[#1E90FF]"
                      style={{ width: `${action.progress}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {filteredActions.length === 0 ? (
            <div
              className={joinClasses(
                "mt-5 rounded-2xl border border-dashed px-5 py-9 text-center text-sm",
                theme.empty,
              )}
            >
              No actions match the current view.
              <button
                type="button"
                onClick={openNewAction}
                className="ml-2 font-semibold text-[#1E90FF]"
              >
                Create the first action.
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {draftAction ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            className={joinClasses(
              "max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border p-5 shadow-[0_30px_100px_rgba(0,0,0,0.4)] sm:rounded-3xl sm:p-7",
              theme.modal,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={
              modalMode === "new" ? "New action form" : "Action details"
            }
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  {modalMode === "new" ? "New Action" : "Action Details"}
                </div>
                <h2
                  className={joinClasses(
                    "mt-2 text-2xl font-semibold",
                    theme.heading,
                  )}
                >
                  {modalMode === "new"
                    ? "Create HSE action"
                    : draftAction.title || "Untitled action"}
                </h2>
                <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                  Created by {draftAction.createdBy || createdBy} - Created{" "}
                  {new Date(draftAction.createdDate).toLocaleString()}
                </p>
                <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                  Last updated {new Date(draftAction.lastUpdated).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={joinClasses(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition",
                  theme.ghostButton,
                )}
                aria-label="Close action details"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field
                label="Action Title"
                value={draftAction.title}
                onChange={(value) => updateDraft("title", value)}
                theme={theme}
                required
                placeholder="Enter action title"
              />
              <SelectField
                label="Priority"
                value={draftAction.priority}
                onChange={(value) => updateDraft("priority", value)}
                options={priorityOptions}
                theme={theme}
              />
              <TextAreaField
                label="Description"
                value={draftAction.description}
                onChange={(value) => updateDraft("description", value)}
                theme={theme}
                required
                placeholder="Describe the corrective or preventive action..."
              />
              <TextAreaField
                label="Comments / Notes"
                value={draftAction.notes}
                onChange={(value) => updateDraft("notes", value)}
                theme={theme}
                placeholder="Add notes, verification comments, or follow-up context..."
              />
              <SelectField
                label="Source Module"
                value={draftAction.sourceModule}
                onChange={(value) => updateDraft("sourceModule", value)}
                options={sourceModuleOptions}
                theme={theme}
              />
              <SelectField
                label="Status"
                value={draftAction.status}
                onChange={(value) => updateDraft("status", value)}
                options={statusOptions}
                theme={theme}
              />
              <Field
                label="Responsible Person"
                value={draftAction.responsiblePerson}
                onChange={(value) => updateDraft("responsiblePerson", value)}
                theme={theme}
                required
                placeholder="Name or role"
              />
              <Field
                label="Department"
                value={draftAction.department}
                onChange={(value) => updateDraft("department", value)}
                theme={theme}
                required
                placeholder="Department / team"
              />
              <Field
                label="Site / Location"
                value={draftAction.siteLocation}
                onChange={(value) => updateDraft("siteLocation", value)}
                theme={theme}
                required
                placeholder="Site, facility, or area"
              />
              <Field
                label="Due Date"
                value={draftAction.dueDate}
                onChange={(value) => updateDraft("dueDate", value)}
                theme={theme}
                required
                type="date"
              />
              <label className="block md:col-span-2">
                <span
                  className={joinClasses(
                    "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                    theme.label,
                  )}
                >
                  Progress %
                </span>
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem] sm:items-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draftAction.progress}
                    onChange={(event) =>
                      updateDraft(
                        "progress",
                        clampProgress(Number(event.target.value)),
                      )
                    }
                    className="w-full accent-[#1E90FF]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftAction.progress}
                    onChange={(event) =>
                      updateDraft(
                        "progress",
                        clampProgress(Number(event.target.value)),
                      )
                    }
                    className={joinClasses(
                      "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                      theme.field,
                    )}
                  />
                </div>
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              {modalMode === "edit" ? (
                <button
                  type="button"
                  onClick={() => deleteAction(draftAction.id)}
                  className={joinClasses(
                    "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.dangerButton,
                  )}
                >
                  <Trash2 size={16} aria-hidden />
                  Delete
                </button>
              ) : (
                <div />
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
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
                  onClick={saveDraftAction}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  {modalMode === "new" ? (
                    <Plus size={16} aria-hidden />
                  ) : (
                    <Save size={16} aria-hidden />
                  )}
                  {modalMode === "new" ? "Save Action" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
