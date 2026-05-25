"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Filter,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import {
  appendActionTrackerAction,
  createActionFromInput,
  getDateInputDaysFromNow,
  type ActionPriority,
} from "@/app/lib/actionTracker";

const employeeStatusOptions = ["Active", "Inactive"] as const;
const trainingRiskOptions = ["Low", "Medium", "High"] as const;
const trainingStatusOptions = [
  "Valid",
  "Expiring Soon",
  "Expired",
  "Missing",
] as const;
const tabOptions = [
  "Employees",
  "Training Matrix",
  "Training Library",
  "Training Records",
] as const;

type EmployeeStatus = (typeof employeeStatusOptions)[number];
type TrainingRiskLevel = (typeof trainingRiskOptions)[number];
type TrainingComplianceStatus = (typeof trainingStatusOptions)[number];
type TrainingTab = (typeof tabOptions)[number];

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  siteLocation: string;
  supervisor: string;
  status: EmployeeStatus;
};

type TrainingType = {
  id: string;
  name: string;
  category: string;
  validityMonths: number;
  refresherFrequency: string;
  riskLevel: TrainingRiskLevel;
  mandatoryRoles: string;
  description: string;
};

type TrainingRecord = {
  id: string;
  employeeId: string;
  trainingTypeId: string;
  completedDate: string;
  expiryDate: string;
  trainer: string;
  certificateNumber: string;
  notes: string;
};

type TrainingData = {
  employees: Employee[];
  trainingTypes: TrainingType[];
  records: TrainingRecord[];
};

type TrainingManagementModuleProps = {
  userId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  createdBy: string;
};

type ModalState =
  | { type: "employee"; mode: "new" | "edit"; draft: Employee }
  | { type: "training"; mode: "new" | "edit"; draft: TrainingType }
  | { type: "record"; mode: "new" | "edit"; draft: TrainingRecord }
  | null;

type MatrixFilters = {
  department: string;
  siteLocation: string;
  status: "All" | TrainingComplianceStatus;
  trainingTypeId: string;
};

const defaultTrainingTypes: TrainingType[] = [
  {
    id: "fire-safety",
    name: "Fire Safety",
    category: "Emergency Preparedness",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "Medium",
    mandatoryRoles: "All employees",
    description:
      "Core fire prevention, alarm response, evacuation, extinguisher awareness, and emergency assembly training.",
  },
  {
    id: "ppe-awareness",
    name: "PPE Awareness",
    category: "General HSE",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "Medium",
    mandatoryRoles: "All operational employees",
    description:
      "Selection, inspection, use, storage, and limitations of required personal protective equipment.",
  },
  {
    id: "working-at-height",
    name: "Working at Height",
    category: "High-Risk Work",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "High",
    mandatoryRoles: "Maintenance, construction, supervisors, contractors",
    description:
      "Safe access, fall prevention, fall protection equipment, edge protection, rescue planning, and supervision requirements.",
  },
  {
    id: "electrical-safety",
    name: "Electrical Safety",
    category: "Electrical Safety",
    validityMonths: 24,
    refresherFrequency: "Every 2 years",
    riskLevel: "High",
    mandatoryRoles: "Electrical workers, maintenance, supervisors",
    description:
      "Electrical hazard awareness, isolation principles, safe equipment use, and emergency response for electrical incidents.",
  },
  {
    id: "first-aid",
    name: "First Aid",
    category: "Emergency Preparedness",
    validityMonths: 24,
    refresherFrequency: "Every 2 years",
    riskLevel: "Medium",
    mandatoryRoles: "First aiders, supervisors, designated responders",
    description:
      "Workplace first aid response, casualty assessment, escalation, and incident support until medical help arrives.",
  },
  {
    id: "confined-space",
    name: "Confined Space",
    category: "High-Risk Work",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "High",
    mandatoryRoles: "Entrants, attendants, rescuers, supervisors",
    description:
      "Confined space hazards, atmospheric testing, permits, ventilation, communication, standby duties, and rescue arrangements.",
  },
  {
    id: "manual-handling",
    name: "Manual Handling",
    category: "Ergonomics",
    validityMonths: 24,
    refresherFrequency: "Every 2 years",
    riskLevel: "Medium",
    mandatoryRoles: "Warehouse, operations, housekeeping, maintenance",
    description:
      "Manual handling risk factors, lifting technique, team lifting, mechanical aids, and prevention of musculoskeletal injuries.",
  },
  {
    id: "forklift-safety",
    name: "Forklift Safety",
    category: "Mobile Equipment",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "High",
    mandatoryRoles: "Forklift operators, warehouse supervisors",
    description:
      "Forklift operation controls, pedestrian separation, load stability, pre-use checks, charging/refueling hazards, and traffic rules.",
  },
  {
    id: "chemical-safety",
    name: "Chemical Safety",
    category: "Chemical Safety",
    validityMonths: 12,
    refresherFrequency: "Annual refresher",
    riskLevel: "High",
    mandatoryRoles: "Chemical handlers, cleaners, laboratory, maintenance",
    description:
      "Chemical labeling, SDS awareness, exposure controls, spill response, storage compatibility, and PPE requirements.",
  },
];

const emptyMatrixFilters: MatrixFilters = {
  department: "",
  siteLocation: "",
  status: "All",
  trainingTypeId: "",
};

const legacyStorageKey = "laboria_training_management";

const getStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_training_management`
    : legacyStorageKey;

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const numberOrDefault = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeEmployeeStatus = (value: unknown): EmployeeStatus =>
  employeeStatusOptions.includes(value as EmployeeStatus)
    ? (value as EmployeeStatus)
    : "Active";

const normalizeTrainingRisk = (value: unknown): TrainingRiskLevel =>
  trainingRiskOptions.includes(value as TrainingRiskLevel)
    ? (value as TrainingRiskLevel)
    : "Medium";

const normalizeEmployee = (employee: Partial<Employee>): Employee => ({
  id:
    typeof employee.id === "string" && employee.id.trim().length > 0
      ? employee.id
      : createId(),
  name: typeof employee.name === "string" ? employee.name : "",
  employeeId:
    typeof employee.employeeId === "string" ? employee.employeeId : "",
  department:
    typeof employee.department === "string" ? employee.department : "",
  position: typeof employee.position === "string" ? employee.position : "",
  siteLocation:
    typeof employee.siteLocation === "string" ? employee.siteLocation : "",
  supervisor:
    typeof employee.supervisor === "string" ? employee.supervisor : "",
  status: normalizeEmployeeStatus(employee.status),
});

const normalizeTrainingType = (
  trainingType: Partial<TrainingType>,
): TrainingType => ({
  id:
    typeof trainingType.id === "string" && trainingType.id.trim().length > 0
      ? trainingType.id
      : createId(),
  name: typeof trainingType.name === "string" ? trainingType.name : "",
  category:
    typeof trainingType.category === "string" ? trainingType.category : "",
  validityMonths: numberOrDefault(trainingType.validityMonths, 12),
  refresherFrequency:
    typeof trainingType.refresherFrequency === "string"
      ? trainingType.refresherFrequency
      : "",
  riskLevel: normalizeTrainingRisk(trainingType.riskLevel),
  mandatoryRoles:
    typeof trainingType.mandatoryRoles === "string"
      ? trainingType.mandatoryRoles
      : "",
  description:
    typeof trainingType.description === "string"
      ? trainingType.description
      : "",
});

const normalizeTrainingRecord = (
  record: Partial<TrainingRecord>,
): TrainingRecord => ({
  id:
    typeof record.id === "string" && record.id.trim().length > 0
      ? record.id
      : createId(),
  employeeId: typeof record.employeeId === "string" ? record.employeeId : "",
  trainingTypeId:
    typeof record.trainingTypeId === "string" ? record.trainingTypeId : "",
  completedDate:
    typeof record.completedDate === "string" ? record.completedDate : "",
  expiryDate: typeof record.expiryDate === "string" ? record.expiryDate : "",
  trainer: typeof record.trainer === "string" ? record.trainer : "",
  certificateNumber:
    typeof record.certificateNumber === "string"
      ? record.certificateNumber
      : "",
  notes: typeof record.notes === "string" ? record.notes : "",
});

const getDefaultTrainingData = (): TrainingData => ({
  employees: [],
  trainingTypes: defaultTrainingTypes.map((trainingType) => ({
    ...trainingType,
  })),
  records: [],
});

const normalizeTrainingData = (value: Partial<TrainingData>): TrainingData => ({
  employees: Array.isArray(value.employees)
    ? (value.employees as unknown[])
        .filter((employee): employee is Partial<Employee> =>
          Boolean(employee && typeof employee === "object"),
        )
        .map(normalizeEmployee)
    : [],
  trainingTypes: Array.isArray(value.trainingTypes)
    ? (value.trainingTypes as unknown[])
        .filter((trainingType): trainingType is Partial<TrainingType> =>
          Boolean(trainingType && typeof trainingType === "object"),
        )
        .map(normalizeTrainingType)
    : defaultTrainingTypes.map((trainingType) => ({ ...trainingType })),
  records: Array.isArray(value.records)
    ? (value.records as unknown[])
        .filter((record): record is Partial<TrainingRecord> =>
          Boolean(record && typeof record === "object"),
        )
        .map(normalizeTrainingRecord)
    : [],
});

const parseTrainingData = (value: string | null): TrainingData | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return normalizeTrainingData(parsed as Partial<TrainingData>);
  } catch {
    return null;
  }
};

const readTrainingData = (userId: string | null): TrainingData => {
  if (typeof window === "undefined") {
    return getDefaultTrainingData();
  }

  const current = parseTrainingData(
    window.localStorage.getItem(getStorageKey(userId)),
  );

  if (current) {
    return current;
  }

  if (userId) {
    const legacy = parseTrainingData(window.localStorage.getItem(legacyStorageKey));

    if (legacy) {
      return legacy;
    }
  }

  return getDefaultTrainingData();
};

const writeTrainingData = (userId: string | null, data: TrainingData) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(data));

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

type TrainingTheme = ReturnType<typeof getTheme>;

const todayStart = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const dateInput = (date: Date) => date.toISOString().split("T")[0];

const addMonthsToDate = (dateValue: string, months: number) => {
  if (!dateValue) {
    return "";
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + months);
  return dateInput(date);
};

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

const daysUntil = (value: string) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const date = new Date(`${value}T00:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return Number.NEGATIVE_INFINITY;
  }

  return Math.ceil((date.getTime() - todayStart().getTime()) / 86400000);
};

const getRecordStatus = (record?: TrainingRecord | null) => {
  if (!record || !record.expiryDate) {
    return "Missing" as const;
  }

  const remainingDays = daysUntil(record.expiryDate);

  if (remainingDays < 0) {
    return "Expired" as const;
  }

  if (remainingDays <= 30) {
    return "Expiring Soon" as const;
  }

  return "Valid" as const;
};

const getLatestRecord = (
  records: TrainingRecord[],
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
      const aTime = new Date(`${a.expiryDate || a.completedDate}T00:00:00`).getTime();
      const bTime = new Date(`${b.expiryDate || b.completedDate}T00:00:00`).getTime();
      return bTime - aTime;
    })[0] ?? null;

const statusTone = (
  status: TrainingComplianceStatus,
  darkMode: boolean,
) => {
  if (status === "Valid") {
    return darkMode
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Expiring Soon") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "Expired") {
    return darkMode
      ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  return darkMode
    ? "border-slate-400/25 bg-white/[0.04] text-slate-200"
    : "border-slate-200 bg-slate-50 text-slate-700";
};

const riskTone = (risk: TrainingRiskLevel, darkMode: boolean) => {
  if (risk === "High") {
    return darkMode
      ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (risk === "Medium") {
    return darkMode
      ? "border-amber-400/35 bg-amber-400/12 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-800";
  }

  return darkMode
    ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
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
  theme: TrainingTheme;
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
  theme: TrainingTheme;
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
  theme: TrainingTheme;
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

const createEmptyEmployee = (): Employee => ({
  id: createId(),
  name: "",
  employeeId: "",
  department: "",
  position: "",
  siteLocation: "",
  supervisor: "",
  status: "Active",
});

const createEmptyTrainingType = (): TrainingType => ({
  id: createId(),
  name: "",
  category: "",
  validityMonths: 12,
  refresherFrequency: "Annual refresher",
  riskLevel: "Medium",
  mandatoryRoles: "",
  description: "",
});

const createEmptyTrainingRecord = (
  employeeId = "",
  trainingTypeId = "",
  trainingType?: TrainingType,
): TrainingRecord => {
  const completedDate = dateInput(new Date());

  return {
    id: createId(),
    employeeId,
    trainingTypeId,
    completedDate,
    expiryDate: trainingType
      ? addMonthsToDate(completedDate, trainingType.validityMonths)
      : "",
    trainer: "",
    certificateNumber: "",
    notes: "",
  };
};

export default function TrainingManagementModule({
  userId,
  darkMode,
  onToggleTheme,
  createdBy,
}: TrainingManagementModuleProps) {
  const theme = getTheme(darkMode);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TrainingTab>("Employees");
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [trainingSearch, setTrainingSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [matrixFilters, setMatrixFilters] =
    useState<MatrixFilters>(emptyMatrixFilters);
  const [createdTrainingActionKeys, setCreatedTrainingActionKeys] = useState<
    string[]
  >([]);

  const persistData = (nextData: TrainingData) => {
    writeTrainingData(userId, nextData);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const data = readTrainingData(userId);
        setEmployees(data.employees);
        setTrainingTypes(data.trainingTypes);
        setRecords(data.records);

        if (userId) {
          writeTrainingData(userId, data);
        }
      } catch {
        setNotice("Could not load saved training data.");
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

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const trainingById = useMemo(
    () =>
      new Map(trainingTypes.map((trainingType) => [trainingType.id, trainingType])),
    [trainingTypes],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "Active"),
    [employees],
  );

  const trainingCellStatus = useCallback(
    (
      employeeId: string,
      trainingTypeId: string,
    ): TrainingComplianceStatus =>
      getRecordStatus(getLatestRecord(records, employeeId, trainingTypeId)),
    [records],
  );

  const summary = useMemo(() => {
    let validTrainings = 0;
    let expiringSoon = 0;
    let expiredTrainings = 0;

    activeEmployees.forEach((employee) => {
      trainingTypes.forEach((trainingType) => {
        const status = trainingCellStatus(employee.id, trainingType.id);

        if (status === "Valid") {
          validTrainings += 1;
        } else if (status === "Expiring Soon") {
          expiringSoon += 1;
        } else if (status === "Expired") {
          expiredTrainings += 1;
        }
      });
    });

    return {
      totalEmployees: employees.length,
      validTrainings,
      expiringSoon,
      expiredTrainings,
    };
  }, [activeEmployees, employees.length, trainingCellStatus, trainingTypes]);

  const uniqueDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.department.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [employees],
  );

  const uniqueSites = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.siteLocation.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      if (!query) {
        return true;
      }

      return [
        employee.name,
        employee.employeeId,
        employee.department,
        employee.position,
        employee.siteLocation,
        employee.supervisor,
        employee.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [employeeSearch, employees]);

  const filteredTrainingTypes = useMemo(() => {
    const query = trainingSearch.trim().toLowerCase();

    return trainingTypes.filter((trainingType) => {
      if (!query) {
        return true;
      }

      return [
        trainingType.name,
        trainingType.category,
        trainingType.refresherFrequency,
        trainingType.riskLevel,
        trainingType.mandatoryRoles,
        trainingType.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [trainingSearch, trainingTypes]);

  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();

    return records
      .map((record) => ({
        record,
        employee: employeeById.get(record.employeeId),
        trainingType: trainingById.get(record.trainingTypeId),
        status: getRecordStatus(record),
      }))
      .filter(({ record, employee, trainingType, status }) => {
        if (!query) {
          return true;
        }

        return [
          employee?.name ?? "",
          employee?.employeeId ?? "",
          employee?.department ?? "",
          employee?.siteLocation ?? "",
          trainingType?.name ?? "",
          trainingType?.category ?? "",
          record.trainer,
          record.certificateNumber,
          status,
          record.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [employeeById, recordSearch, records, trainingById]);

  const matrixTrainingTypes = useMemo(
    () =>
      matrixFilters.trainingTypeId
        ? trainingTypes.filter(
            (trainingType) =>
              trainingType.id === matrixFilters.trainingTypeId,
          )
        : trainingTypes,
    [matrixFilters.trainingTypeId, trainingTypes],
  );

  const matrixEmployees = useMemo(() => {
    const query = matrixSearch.trim().toLowerCase();

    return activeEmployees.filter((employee) => {
      const searchable = [
        employee.name,
        employee.employeeId,
        employee.department,
        employee.position,
        employee.siteLocation,
        employee.supervisor,
      ]
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (
        matrixFilters.department &&
        employee.department !== matrixFilters.department
      ) {
        return false;
      }

      if (
        matrixFilters.siteLocation &&
        employee.siteLocation !== matrixFilters.siteLocation
      ) {
        return false;
      }

      if (matrixFilters.status !== "All") {
        return matrixTrainingTypes.some(
          (trainingType) =>
            trainingCellStatus(employee.id, trainingType.id) ===
            matrixFilters.status,
        );
      }

      return true;
    });
  }, [
    activeEmployees,
    matrixFilters.department,
    matrixFilters.siteLocation,
    matrixFilters.status,
    matrixSearch,
    matrixTrainingTypes,
    trainingCellStatus,
  ]);

  const saveTrainingData = (
    nextEmployees = employees,
    nextTrainingTypes = trainingTypes,
    nextRecords = records,
  ) => {
    persistData({
      employees: nextEmployees,
      trainingTypes: nextTrainingTypes,
      records: nextRecords,
    });
  };

  const openNewEmployee = () =>
    setModal({ type: "employee", mode: "new", draft: createEmptyEmployee() });

  const openNewTrainingType = () =>
    setModal({
      type: "training",
      mode: "new",
      draft: createEmptyTrainingType(),
    });

  const openNewRecord = (employeeId = "", trainingTypeId = "") => {
    const trainingType = trainingById.get(trainingTypeId);
    setModal({
      type: "record",
      mode: "new",
      draft: createEmptyTrainingRecord(employeeId, trainingTypeId, trainingType),
    });
  };

  const closeModal = () => setModal(null);

  const updateEmployeeDraft = <Key extends keyof Employee>(
    key: Key,
    value: Employee[Key],
  ) => {
    setModal((current) =>
      current?.type === "employee"
        ? { ...current, draft: { ...current.draft, [key]: value } }
        : current,
    );
  };

  const updateTrainingDraft = <Key extends keyof TrainingType>(
    key: Key,
    value: TrainingType[Key],
  ) => {
    setModal((current) =>
      current?.type === "training"
        ? { ...current, draft: { ...current.draft, [key]: value } }
        : current,
    );
  };

  const updateRecordDraft = <Key extends keyof TrainingRecord>(
    key: Key,
    value: TrainingRecord[Key],
  ) => {
    setModal((current) => {
      if (current?.type !== "record") {
        return current;
      }

      const nextDraft = { ...current.draft, [key]: value };

      if (key === "trainingTypeId") {
        const trainingType = trainingById.get(String(value));

        if (trainingType && nextDraft.completedDate) {
          nextDraft.expiryDate = addMonthsToDate(
            nextDraft.completedDate,
            trainingType.validityMonths,
          );
        }
      }

      if (key === "completedDate") {
        const trainingType = trainingById.get(nextDraft.trainingTypeId);

        if (trainingType) {
          nextDraft.expiryDate = addMonthsToDate(
            String(value),
            trainingType.validityMonths,
          );
        }
      }

      return { ...current, draft: nextDraft };
    });
  };

  const saveModal = () => {
    if (!modal) {
      return;
    }

    if (modal.type === "employee") {
      const employee = normalizeEmployee(modal.draft);
      const missing = [
        ["Employee name", employee.name],
        ["Employee ID", employee.employeeId],
        ["Department", employee.department],
        ["Position", employee.position],
        ["Site / Location", employee.siteLocation],
      ].find(([, value]) => value.trim().length === 0);

      if (missing) {
        setNotice(`${missing[0]} is required.`);
        return;
      }

      setEmployees((current) => {
        const updated =
          modal.mode === "edit"
            ? current.map((item) => (item.id === employee.id ? employee : item))
            : [employee, ...current];
        saveTrainingData(updated);
        return updated;
      });

      setNotice(modal.mode === "edit" ? "Employee updated." : "Employee added.");
      closeModal();
      return;
    }

    if (modal.type === "training") {
      const trainingType = normalizeTrainingType(modal.draft);
      const missing = [
        ["Training name", trainingType.name],
        ["Category", trainingType.category],
        ["Refresher frequency", trainingType.refresherFrequency],
      ].find(([, value]) => value.trim().length === 0);

      if (missing) {
        setNotice(`${missing[0]} is required.`);
        return;
      }

      setTrainingTypes((current) => {
        const updated =
          modal.mode === "edit"
            ? current.map((item) =>
                item.id === trainingType.id ? trainingType : item,
              )
            : [trainingType, ...current];
        saveTrainingData(employees, updated);
        return updated;
      });

      setNotice(
        modal.mode === "edit" ? "Training type updated." : "Training type added.",
      );
      closeModal();
      return;
    }

    const record = normalizeTrainingRecord(modal.draft);
    const missing = [
      ["Employee", record.employeeId],
      ["Training type", record.trainingTypeId],
      ["Completed date", record.completedDate],
      ["Expiry date", record.expiryDate],
    ].find(([, value]) => value.trim().length === 0);

    if (missing) {
      setNotice(`${missing[0]} is required.`);
      return;
    }

    setRecords((current) => {
      const updated =
        modal.mode === "edit"
          ? current.map((item) => (item.id === record.id ? record : item))
          : [record, ...current];
      saveTrainingData(employees, trainingTypes, updated);
      return updated;
    });

    setNotice(
      modal.mode === "edit" ? "Training record updated." : "Training record added.",
    );
    closeModal();
  };

  const deleteEmployee = (employee: Employee) => {
    const shouldDelete = window.confirm(
      "Delete this employee and related training records?",
    );

    if (!shouldDelete) {
      return;
    }

    const nextEmployees = employees.filter((item) => item.id !== employee.id);
    const nextRecords = records.filter(
      (record) => record.employeeId !== employee.id,
    );
    setEmployees(nextEmployees);
    setRecords(nextRecords);
    saveTrainingData(nextEmployees, trainingTypes, nextRecords);
    setNotice("Employee deleted.");
  };

  const deleteTrainingType = (trainingType: TrainingType) => {
    const shouldDelete = window.confirm(
      "Delete this training type and related records?",
    );

    if (!shouldDelete) {
      return;
    }

    const nextTrainingTypes = trainingTypes.filter(
      (item) => item.id !== trainingType.id,
    );
    const nextRecords = records.filter(
      (record) => record.trainingTypeId !== trainingType.id,
    );
    setTrainingTypes(nextTrainingTypes);
    setRecords(nextRecords);
    saveTrainingData(employees, nextTrainingTypes, nextRecords);
    setNotice("Training type deleted.");
  };

  const deleteRecord = (record: TrainingRecord) => {
    const shouldDelete = window.confirm("Delete this training record?");

    if (!shouldDelete) {
      return;
    }

    const nextRecords = records.filter((item) => item.id !== record.id);
    setRecords(nextRecords);
    saveTrainingData(employees, trainingTypes, nextRecords);
    setNotice("Training record deleted.");
  };

  const getTrainingActionKey = (
    employee: Employee,
    trainingType: TrainingType,
    status: TrainingComplianceStatus,
  ) => `training:${employee.id}:${trainingType.id}:${status}`;

  const createTrainingAction = (
    employee: Employee,
    trainingType: TrainingType,
    status: TrainingComplianceStatus,
    record?: TrainingRecord | null,
  ) => {
    const actionKey = getTrainingActionKey(employee, trainingType, status);

    if (createdTrainingActionKeys.includes(actionKey)) {
      const shouldCreateAnother = window.confirm(
        "A training action may already exist for this item. Create another?",
      );

      if (!shouldCreateAnother) {
        return;
      }
    }

    const priority: ActionPriority =
      trainingType.riskLevel === "High"
        ? status === "Expired"
          ? "Critical"
          : "High"
        : "Medium";
    const expiryLabel = record?.expiryDate
      ? formatDisplayDate(record.expiryDate)
      : "No valid record";
    const action = createActionFromInput({
      title: `Provide ${trainingType.name} refresher training`,
      description: [
        `Employee: ${employee.name || "Not provided"}`,
        `Employee ID: ${employee.employeeId || "Not provided"}`,
        `Training status: ${status}`,
        `Missing/expired training: ${trainingType.name}`,
        `Expiry date: ${expiryLabel}`,
        `Role: ${employee.position || "Not provided"}`,
        `Department: ${employee.department || "Not provided"}`,
        `Site / Location: ${employee.siteLocation || "Not provided"}`,
        `Training risk level: ${trainingType.riskLevel}`,
      ].join("\n"),
      sourceModule: "Training",
      priority,
      responsiblePerson: "",
      department: employee.department,
      siteLocation: employee.siteLocation,
      dueDate: getDateInputDaysFromNow(7),
      notes: "Created from Training Management compliance matrix.",
      createdBy,
    });

    appendActionTrackerAction(userId, action);
    setCreatedTrainingActionKeys((current) =>
      current.includes(actionKey) ? current : [...current, actionKey],
    );
    setNotice("Action created from training compliance gap.");
  };

  const statCards = [
    {
      label: "Total Employees",
      value: summary.totalEmployees,
      icon: Users,
      tone: darkMode
        ? "border-[#4DEBFF]/25 bg-[#4DEBFF]/10 text-[#DDFBFF]"
        : "border-[#1E90FF]/20 bg-[#1E90FF]/10 text-[#0759A8]",
    },
    {
      label: "Valid Trainings",
      value: summary.validTrainings,
      icon: CheckCircle2,
      tone: darkMode
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Expiring Soon",
      value: summary.expiringSoon,
      icon: CalendarClock,
      tone: darkMode
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "Expired Trainings",
      value: summary.expiredTrainings,
      icon: TriangleAlert,
      tone: darkMode
        ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
        : "border-rose-200 bg-rose-50 text-rose-700",
    },
  ];

  const modalTitle =
    modal?.type === "employee"
      ? modal.mode === "new"
        ? "Add Employee"
        : "Edit Employee"
      : modal?.type === "training"
        ? modal.mode === "new"
          ? "Add Training Type"
          : "Edit Training Type"
        : modal?.mode === "new"
          ? "Add Training Record"
          : "Edit Training Record";

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
                  Training Management
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  HSE Competency Compliance Workspace
                </h1>
                <p
                  className={joinClasses(
                    "mt-2 max-w-3xl text-sm leading-6",
                    theme.muted,
                  )}
                >
                  Manage employees, training requirements, validity periods,
                  compliance records, and competency gaps across operational
                  teams.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openNewEmployee}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  Add Employee
                </button>
                <button
                  type="button"
                  onClick={() => openNewRecord()}
                  className={joinClasses(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                    theme.exportButton,
                  )}
                >
                  <ClipboardList size={16} aria-hidden />
                  Add Record
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
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabOptions.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={joinClasses(
                  "whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                  activeTab === tab
                    ? "border-[#4DEBFF]/40 bg-[#1E90FF]/15 text-[#4DEBFF]"
                    : theme.ghostButton,
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Employees" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <span className="sr-only">Search employees</span>
                  <Search
                    className={joinClasses(
                      "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
                      theme.muted,
                    )}
                    size={18}
                    aria-hidden
                  />
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search employees, IDs, departments, positions, sites..."
                    className={joinClasses(
                      "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                      theme.field,
                    )}
                  />
                </label>
                <button
                  type="button"
                  onClick={openNewEmployee}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  Add Employee
                </button>
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className={theme.tableHead}>
                    <tr>
                      {[
                        "Employee Name",
                        "Employee ID",
                        "Department",
                        "Position",
                        "Site / Location",
                        "Supervisor",
                        "Status",
                        "",
                      ].map((heading) => (
                        <th
                          key={heading || "actions"}
                          className="border-b px-4 py-3 text-xs font-bold uppercase tracking-[0.14em]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id} className={theme.row}>
                        <td className="border-b px-4 py-4 font-semibold">
                          {employee.name}
                        </td>
                        <td className="border-b px-4 py-4">
                          {employee.employeeId}
                        </td>
                        <td className="border-b px-4 py-4">
                          {employee.department}
                        </td>
                        <td className="border-b px-4 py-4">
                          {employee.position}
                        </td>
                        <td className="border-b px-4 py-4">
                          {employee.siteLocation}
                        </td>
                        <td className="border-b px-4 py-4">
                          {employee.supervisor || "Not assigned"}
                        </td>
                        <td className="border-b px-4 py-4">
                          <Badge
                            className={
                              employee.status === "Active"
                                ? statusTone("Valid", darkMode)
                                : statusTone("Missing", darkMode)
                            }
                          >
                            {employee.status}
                          </Badge>
                        </td>
                        <td className="border-b px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "employee",
                                  mode: "edit",
                                  draft: { ...employee },
                                })
                              }
                              className={joinClasses(
                                "rounded-xl border p-2 transition",
                                theme.ghostButton,
                              )}
                              aria-label={`Edit ${employee.name}`}
                            >
                              <Pencil size={15} aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEmployee(employee)}
                              className={joinClasses(
                                "rounded-xl border p-2 transition",
                                theme.dangerButton,
                              )}
                              aria-label={`Delete ${employee.name}`}
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className={joinClasses("rounded-2xl border p-4", theme.card)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                          {employee.position} / {employee.department}
                        </p>
                      </div>
                      <Badge
                        className={
                          employee.status === "Active"
                            ? statusTone("Valid", darkMode)
                            : statusTone("Missing", darkMode)
                        }
                      >
                        {employee.status}
                      </Badge>
                    </div>
                    <div
                      className={joinClasses(
                        "mt-3 grid gap-2 text-sm",
                        theme.soft,
                      )}
                    >
                      <div>ID: {employee.employeeId}</div>
                      <div>Site: {employee.siteLocation}</div>
                      <div>Supervisor: {employee.supervisor || "Not assigned"}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            type: "employee",
                            mode: "edit",
                            draft: { ...employee },
                          })
                        }
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.ghostButton,
                        )}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEmployee(employee)}
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.dangerButton,
                        )}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredEmployees.length === 0 ? (
                <div
                  className={joinClasses(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    theme.empty,
                  )}
                >
                  No employees found. Add employees to start building the
                  training matrix.
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "Training Matrix" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 xl:grid-cols-[1fr_repeat(4,minmax(0,190px))]">
                <label className="relative block">
                  <span className="sr-only">Search matrix employees</span>
                  <Search
                    className={joinClasses(
                      "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
                      theme.muted,
                    )}
                    size={18}
                    aria-hidden
                  />
                  <input
                    value={matrixSearch}
                    onChange={(event) => setMatrixSearch(event.target.value)}
                    placeholder="Search employees, departments, positions, sites..."
                    className={joinClasses(
                      "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                      theme.field,
                    )}
                  />
                </label>
                <select
                  value={matrixFilters.department}
                  onChange={(event) =>
                    setMatrixFilters((current) => ({
                      ...current,
                      department: event.target.value,
                    }))
                  }
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                  aria-label="Filter by department"
                >
                  <option value="">All departments</option>
                  {uniqueDepartments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <select
                  value={matrixFilters.siteLocation}
                  onChange={(event) =>
                    setMatrixFilters((current) => ({
                      ...current,
                      siteLocation: event.target.value,
                    }))
                  }
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                  aria-label="Filter by site"
                >
                  <option value="">All sites</option>
                  {uniqueSites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
                <select
                  value={matrixFilters.status}
                  onChange={(event) =>
                    setMatrixFilters((current) => ({
                      ...current,
                      status: event.target.value as MatrixFilters["status"],
                    }))
                  }
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                  aria-label="Filter by training status"
                >
                  <option value="All">All statuses</option>
                  {trainingStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={matrixFilters.trainingTypeId}
                  onChange={(event) =>
                    setMatrixFilters((current) => ({
                      ...current,
                      trainingTypeId: event.target.value,
                    }))
                  }
                  className={joinClasses(
                    "rounded-xl border px-4 py-3 text-sm outline-none transition",
                    theme.field,
                  )}
                  aria-label="Filter by training type"
                >
                  <option value="">All training types</option>
                  {trainingTypes.map((trainingType) => (
                    <option key={trainingType.id} value={trainingType.id}>
                      {trainingType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={joinClasses(
                  "flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm",
                  theme.card,
                )}
              >
                <span className={theme.muted}>
                  Matrix shows {matrixEmployees.length} employees across{" "}
                  {matrixTrainingTypes.length} training types.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMatrixFilters(emptyMatrixFilters);
                    setMatrixSearch("");
                  }}
                  className={joinClasses(
                    "ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                    theme.ghostButton,
                  )}
                >
                  <Filter size={15} aria-hidden />
                  Clear filters
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-[900px] border-collapse text-left text-sm">
                  <thead className={theme.tableHead}>
                    <tr>
                      <th className="sticky left-0 z-10 border-b px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] backdrop-blur-xl">
                        Employee
                      </th>
                      {matrixTrainingTypes.map((trainingType) => (
                        <th
                          key={trainingType.id}
                          className="min-w-48 border-b px-4 py-3 align-top text-xs font-bold uppercase tracking-[0.14em]"
                        >
                          <span className="block">{trainingType.name}</span>
                          <span
                            className={joinClasses(
                              "mt-1 block text-[11px] normal-case tracking-normal",
                              theme.muted,
                            )}
                          >
                            {trainingType.category}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixEmployees.map((employee) => (
                      <tr key={employee.id} className={theme.row}>
                        <td
                          className={joinClasses(
                            "sticky left-0 z-10 border-b px-4 py-4 backdrop-blur-xl",
                            darkMode ? "bg-[#071225]/94" : "bg-white/95",
                          )}
                        >
                          <div className="font-semibold">{employee.name}</div>
                          <div className={joinClasses("mt-1 text-xs", theme.muted)}>
                            {employee.position} / {employee.department}
                          </div>
                        </td>
                        {matrixTrainingTypes.map((trainingType) => {
                          const record = getLatestRecord(
                            records,
                            employee.id,
                            trainingType.id,
                          );
                          const status = getRecordStatus(record);
                          const actionAllowed =
                            status === "Expired" || status === "Missing";
                          const actionKey = getTrainingActionKey(
                            employee,
                            trainingType,
                            status,
                          );

                          return (
                            <td key={trainingType.id} className="border-b px-4 py-4">
                              <div className="space-y-2">
                                <Badge className={statusTone(status, darkMode)}>
                                  {status}
                                </Badge>
                                {record ? (
                                  <div
                                    className={joinClasses(
                                      "text-xs leading-5",
                                      theme.muted,
                                    )}
                                  >
                                    Expires {formatDisplayDate(record.expiryDate)}
                                  </div>
                                ) : (
                                  <div
                                    className={joinClasses(
                                      "text-xs leading-5",
                                      theme.muted,
                                    )}
                                  >
                                    No record found
                                  </div>
                                )}
                                {actionAllowed ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      createTrainingAction(
                                        employee,
                                        trainingType,
                                        status,
                                        record,
                                      )
                                    }
                                    className={joinClasses(
                                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                                      createdTrainingActionKeys.includes(actionKey)
                                        ? theme.notice
                                        : theme.exportButton,
                                    )}
                                  >
                                    <Plus size={13} aria-hidden />
                                    {createdTrainingActionKeys.includes(actionKey)
                                      ? "Action created"
                                      : "Create Action"}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {matrixEmployees.length === 0 || matrixTrainingTypes.length === 0 ? (
                <div
                  className={joinClasses(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    theme.empty,
                  )}
                >
                  Add active employees and training types to populate the
                  compliance matrix.
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "Training Library" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <span className="sr-only">Search training types</span>
                  <Search
                    className={joinClasses(
                      "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
                      theme.muted,
                    )}
                    size={18}
                    aria-hidden
                  />
                  <input
                    value={trainingSearch}
                    onChange={(event) => setTrainingSearch(event.target.value)}
                    placeholder="Search training names, categories, roles, descriptions..."
                    className={joinClasses(
                      "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                      theme.field,
                    )}
                  />
                </label>
                <button
                  type="button"
                  onClick={openNewTrainingType}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  Add Training Type
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTrainingTypes.map((trainingType) => (
                  <div
                    key={trainingType.id}
                    className={joinClasses(
                      "flex min-h-full flex-col rounded-2xl border p-4",
                      theme.card,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div
                          className={joinClasses(
                            "text-xs font-bold uppercase tracking-[0.14em]",
                            theme.label,
                          )}
                        >
                          {trainingType.category}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold">
                          {trainingType.name}
                        </h3>
                      </div>
                      <Badge className={riskTone(trainingType.riskLevel, darkMode)}>
                        {trainingType.riskLevel}
                      </Badge>
                    </div>
                    <p
                      className={joinClasses(
                        "mt-3 min-h-20 text-sm leading-6",
                        theme.muted,
                      )}
                    >
                      {trainingType.description || "No description provided."}
                    </p>
                    <div
                      className={joinClasses(
                        "mt-4 grid gap-2 text-sm",
                        theme.soft,
                      )}
                    >
                      <div>Validity: {trainingType.validityMonths} months</div>
                      <div>Refresher: {trainingType.refresherFrequency}</div>
                      <div>
                        Mandatory roles:{" "}
                        {trainingType.mandatoryRoles || "Not specified"}
                      </div>
                    </div>
                    <div className="mt-auto flex gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            type: "training",
                            mode: "edit",
                            draft: { ...trainingType },
                          })
                        }
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.ghostButton,
                        )}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTrainingType(trainingType)}
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.dangerButton,
                        )}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "Training Records" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <span className="sr-only">Search training records</span>
                  <Search
                    className={joinClasses(
                      "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2",
                      theme.muted,
                    )}
                    size={18}
                    aria-hidden
                  />
                  <input
                    value={recordSearch}
                    onChange={(event) => setRecordSearch(event.target.value)}
                    placeholder="Search records, employees, certificates, trainers, status..."
                    className={joinClasses(
                      "w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition",
                      theme.field,
                    )}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openNewRecord()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
                >
                  <Plus size={16} aria-hidden />
                  Add Record
                </button>
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className={theme.tableHead}>
                    <tr>
                      {[
                        "Employee",
                        "Training Type",
                        "Completed",
                        "Expiry",
                        "Trainer",
                        "Certificate",
                        "Status",
                        "",
                      ].map((heading) => (
                        <th
                          key={heading || "actions"}
                          className="border-b px-4 py-3 text-xs font-bold uppercase tracking-[0.14em]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(({ record, employee, trainingType, status }) => (
                      <tr key={record.id} className={theme.row}>
                        <td className="border-b px-4 py-4">
                          <div className="font-semibold">
                            {employee?.name ?? "Unknown employee"}
                          </div>
                          <div className={joinClasses("mt-1 text-xs", theme.muted)}>
                            {employee?.department ?? "No department"}
                          </div>
                        </td>
                        <td className="border-b px-4 py-4">
                          {trainingType?.name ?? "Unknown training"}
                        </td>
                        <td className="border-b px-4 py-4">
                          {formatDisplayDate(record.completedDate)}
                        </td>
                        <td className="border-b px-4 py-4">
                          {formatDisplayDate(record.expiryDate)}
                        </td>
                        <td className="border-b px-4 py-4">
                          {record.trainer || "Not provided"}
                        </td>
                        <td className="border-b px-4 py-4">
                          {record.certificateNumber || "Not provided"}
                        </td>
                        <td className="border-b px-4 py-4">
                          <Badge className={statusTone(status, darkMode)}>
                            {status}
                          </Badge>
                        </td>
                        <td className="border-b px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {employee &&
                            trainingType &&
                            status === "Expired" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  createTrainingAction(
                                    employee,
                                    trainingType,
                                    status,
                                    record,
                                  )
                                }
                                className={joinClasses(
                                  "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                                  theme.exportButton,
                                )}
                              >
                                Create Action
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "record",
                                  mode: "edit",
                                  draft: { ...record },
                                })
                              }
                              className={joinClasses(
                                "rounded-xl border p-2 transition",
                                theme.ghostButton,
                              )}
                              aria-label="Edit training record"
                            >
                              <Pencil size={15} aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRecord(record)}
                              className={joinClasses(
                                "rounded-xl border p-2 transition",
                                theme.dangerButton,
                              )}
                              aria-label="Delete training record"
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredRecords.map(({ record, employee, trainingType, status }) => (
                  <div
                    key={record.id}
                    className={joinClasses("rounded-2xl border p-4", theme.card)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {trainingType?.name ?? "Unknown training"}
                        </h3>
                        <p className={joinClasses("mt-1 text-sm", theme.muted)}>
                          {employee?.name ?? "Unknown employee"}
                        </p>
                      </div>
                      <Badge className={statusTone(status, darkMode)}>
                        {status}
                      </Badge>
                    </div>
                    <div
                      className={joinClasses(
                        "mt-3 grid gap-2 text-sm",
                        theme.soft,
                      )}
                    >
                      <div>Completed: {formatDisplayDate(record.completedDate)}</div>
                      <div>Expiry: {formatDisplayDate(record.expiryDate)}</div>
                      <div>Trainer: {record.trainer || "Not provided"}</div>
                      <div>
                        Certificate: {record.certificateNumber || "Not provided"}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {employee && trainingType && status === "Expired" ? (
                        <button
                          type="button"
                          onClick={() =>
                            createTrainingAction(
                              employee,
                              trainingType,
                              status,
                              record,
                            )
                          }
                          className={joinClasses(
                            "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                            theme.exportButton,
                          )}
                        >
                          Create Action
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            type: "record",
                            mode: "edit",
                            draft: { ...record },
                          })
                        }
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.ghostButton,
                        )}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecord(record)}
                        className={joinClasses(
                          "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          theme.dangerButton,
                        )}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredRecords.length === 0 ? (
                <div
                  className={joinClasses(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    theme.empty,
                  )}
                >
                  No training records found. Add records to calculate validity
                  and populate the matrix.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div
            className={joinClasses(
              "relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border p-5 shadow-[0_30px_100px_rgba(0,0,0,0.34)] sm:p-7",
              theme.modal,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Training Management
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {modalTitle}
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

            {modal.type === "employee" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  label="Employee Name"
                  value={modal.draft.name}
                  onChange={(value) => updateEmployeeDraft("name", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Employee ID"
                  value={modal.draft.employeeId}
                  onChange={(value) => updateEmployeeDraft("employeeId", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Department"
                  value={modal.draft.department}
                  onChange={(value) => updateEmployeeDraft("department", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Position"
                  value={modal.draft.position}
                  onChange={(value) => updateEmployeeDraft("position", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Site / Location"
                  value={modal.draft.siteLocation}
                  onChange={(value) => updateEmployeeDraft("siteLocation", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Supervisor"
                  value={modal.draft.supervisor}
                  onChange={(value) => updateEmployeeDraft("supervisor", value)}
                  theme={theme}
                />
                <SelectField
                  label="Status"
                  value={modal.draft.status}
                  onChange={(value) => updateEmployeeDraft("status", value)}
                  options={employeeStatusOptions}
                  theme={theme}
                />
              </div>
            ) : null}

            {modal.type === "training" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  label="Training Name"
                  value={modal.draft.name}
                  onChange={(value) => updateTrainingDraft("name", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Category"
                  value={modal.draft.category}
                  onChange={(value) => updateTrainingDraft("category", value)}
                  theme={theme}
                  required
                />
                <Field
                  label="Validity Period (months)"
                  value={String(modal.draft.validityMonths)}
                  onChange={(value) =>
                    updateTrainingDraft("validityMonths", numberOrDefault(value, 12))
                  }
                  theme={theme}
                  type="number"
                  required
                />
                <Field
                  label="Refresher Frequency"
                  value={modal.draft.refresherFrequency}
                  onChange={(value) =>
                    updateTrainingDraft("refresherFrequency", value)
                  }
                  theme={theme}
                  required
                />
                <SelectField
                  label="Risk Level"
                  value={modal.draft.riskLevel}
                  onChange={(value) => updateTrainingDraft("riskLevel", value)}
                  options={trainingRiskOptions}
                  theme={theme}
                />
                <Field
                  label="Mandatory Roles"
                  value={modal.draft.mandatoryRoles}
                  onChange={(value) =>
                    updateTrainingDraft("mandatoryRoles", value)
                  }
                  theme={theme}
                  placeholder="All employees, supervisors, operators..."
                />
                <div className="md:col-span-2">
                  <TextAreaField
                    label="Description"
                    value={modal.draft.description}
                    onChange={(value) =>
                      updateTrainingDraft("description", value)
                    }
                    theme={theme}
                    rows={4}
                  />
                </div>
              </div>
            ) : null}

            {modal.type === "record" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span
                    className={joinClasses(
                      "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                      theme.label,
                    )}
                  >
                    Employee <span className="text-rose-500">*</span>
                  </span>
                  <select
                    value={modal.draft.employeeId}
                    onChange={(event) =>
                      updateRecordDraft("employeeId", event.target.value)
                    }
                    className={joinClasses(
                      "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                      theme.field,
                    )}
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.employeeId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span
                    className={joinClasses(
                      "mb-2 block text-xs font-bold uppercase tracking-[0.14em]",
                      theme.label,
                    )}
                  >
                    Training Type <span className="text-rose-500">*</span>
                  </span>
                  <select
                    value={modal.draft.trainingTypeId}
                    onChange={(event) =>
                      updateRecordDraft("trainingTypeId", event.target.value)
                    }
                    className={joinClasses(
                      "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
                      theme.field,
                    )}
                  >
                    <option value="">Select training</option>
                    {trainingTypes.map((trainingType) => (
                      <option key={trainingType.id} value={trainingType.id}>
                        {trainingType.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Completed Date"
                  value={modal.draft.completedDate}
                  onChange={(value) => updateRecordDraft("completedDate", value)}
                  theme={theme}
                  type="date"
                  required
                />
                <Field
                  label="Expiry Date"
                  value={modal.draft.expiryDate}
                  onChange={(value) => updateRecordDraft("expiryDate", value)}
                  theme={theme}
                  type="date"
                  required
                />
                <Field
                  label="Trainer"
                  value={modal.draft.trainer}
                  onChange={(value) => updateRecordDraft("trainer", value)}
                  theme={theme}
                />
                <Field
                  label="Certificate Number"
                  value={modal.draft.certificateNumber}
                  onChange={(value) =>
                    updateRecordDraft("certificateNumber", value)
                  }
                  theme={theme}
                />
                <div className="md:col-span-2">
                  <div
                    className={joinClasses(
                      "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
                      statusTone(getRecordStatus(modal.draft), darkMode),
                    )}
                  >
                    <AlertCircle size={16} aria-hidden />
                    Current status: {getRecordStatus(modal.draft)}
                  </div>
                  <TextAreaField
                    label="Notes"
                    value={modal.draft.notes}
                    onChange={(value) => updateRecordDraft("notes", value)}
                    theme={theme}
                    rows={4}
                  />
                </div>
              </div>
            ) : null}

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
                onClick={saveModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1878d6]"
              >
                <Plus size={16} aria-hidden />
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
