"use client";

import {
  ShieldCheck,
  HeartPulse,
  Cpu,
  Wind,
  Volume2,
  FlaskConical,
  HardHat,
  Flame,
  Zap,
  Building2,
  Menu,
  X,
  ClipboardCheck,
  TriangleAlert,
  CheckCircle2,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Bell,
  BellRing,
  Activity,
  Download,
  Gauge,
  History,
  ListChecks,
  Moon,
  Save,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ALL_CHECKLISTS } from "./data/checklists";
import NotificationCenterDrawer from "./components/NotificationCenterDrawer";
import OrbitAiToolStrip from "./components/OrbitAiToolStrip";
import { createClient } from "@/lib/supabase/client";
import {
  appendActionTrackerAction,
  createActionFromInput,
  findActionByLinkedSource,
  getDateInputDaysFromNow,
  type ActionPriority,
} from "@/app/lib/actionTracker";
import {
  defaultWorkspaceSettings,
  hasCompanyBranding,
  loadWorkspaceCompanyLogo,
  readWorkspaceSettings,
  workspaceSettingsUpdatedEvent,
  writeWorkspaceSettings,
  type WorkspaceSettings,
} from "@/app/lib/workspaceSettings";
import {
  createWorkspaceNavigationIntent,
  type WorkspaceModuleId,
  type WorkspaceNavigationIntent,
} from "@/app/lib/workspaceNavigation";
import {
  deleteAllReadOrbitNotifications,
  deleteOrbitNotification,
  markAllOrbitNotificationsRead,
  markOrbitNotificationRead,
  notificationCenterUpdatedEvent,
  syncOrbitNotifications,
  type OrbitNotification,
} from "@/app/lib/notificationCenter";
import {
  getOrbitAiAccount,
  orbitAiAccountUpdatedEvent,
  orbitAiNavigationEvent,
  refreshOrbitAiAccount,
} from "@/app/lib/orbitAi";
import {
  ORBIT_PLUS_PLAN,
  ORBIT_PRO_PLAN,
  isOrbitInspectionTemplateAvailable,
} from "@/app/lib/orbitPlans";
import { orbitAiGenerationsUpdatedEvent } from "@/app/lib/orbitAiGenerations";
import { toolboxTalksUpdatedEvent } from "@/app/lib/toolboxTalks";
import type { User } from "@supabase/supabase-js";

const ActionTrackerModule = dynamic(
  () => import("./components/ActionTrackerModule"),
);
const OrbitCommandCenterModule = dynamic(
  () => import("./components/OrbitCommandCenterModule"),
  { ssr: false },
);
const RiskAssessmentsModule = dynamic(
  () => import("./components/RiskAssessmentsModule"),
);
const TrainingManagementModule = dynamic(
  () => import("./components/TrainingManagementModule"),
);
const IncidentManagementModule = dynamic(
  () => import("./components/IncidentManagementModule"),
);
const HseAnalyticsModule = dynamic(
  () => import("./components/HseAnalyticsModule"),
);
const SettingsModule = dynamic(() => import("./components/SettingsModule"));

type InspectionResult = {
  percent: number;
  status: string;
};

type SavedInspection = {
  id: number;
  company: string;
  site: string;
  inspector: string;
  inspectionDate: string;
  answers: Record<string, string>;
  risk: Record<string, string>;
  comments?: Record<string, string>;
  result: InspectionResult;
  savedAt: string;
};

type HistoryNotice = {
  type: "success" | "error";
  message: string;
};

type WorkflowWarning = {
  action: "save" | "export";
  unansweredCount: number;
};

type AutosaveStatus = "dirty" | "saving" | "saved";

type WorkspaceModule = {
  id: WorkspaceModuleId;
  label: string;
  description: string;
  status: "Active" | "Coming Soon";
  icon: LucideIcon;
};

type InspectionDraft = {
  company: string;
  site: string;
  inspector: string;
  inspectionDate: string;
  answers: Record<string, string>;
  risk: Record<string, string>;
  comments: Record<string, string>;
  updatedAt: string;
};

type AuthProfile = {
  email: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
};

const getAnswerBadgePalette = (answer: string) => {
  if (answer === "yes") {
    return { label: "YES", bg: "#DCFCE7", color: "#166534", border: "#86EFAC" };
  }

  if (answer === "no") {
    return { label: "NO", bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" };
  }

  return { label: "N/A", bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
};

const getRiskBadgePalette = (riskLevel: string) => {
  if (riskLevel === "H") {
    return { label: "High", bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" };
  }

  if (riskLevel === "M") {
    return { label: "Medium", bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" };
  }

  if (riskLevel === "L") {
    return { label: "Low", bg: "#DCFCE7", color: "#166534", border: "#86EFAC" };
  }

  return {
    label: "Not rated",
    bg: "#F8FAFC",
    color: "#64748B",
    border: "#CBD5E1",
  };
};

const riskGuidance = [
  {
    level: "Low",
    color: "text-emerald-500",
    guidance: [
      "Minor issue.",
      "Unlikely to cause injury.",
      "No immediate danger.",
    ],
  },
  {
    level: "Medium",
    color: "text-amber-500",
    guidance: [
      "Could cause injury or health issue if not corrected.",
      "Control exists but is weak/incomplete.",
    ],
  },
  {
    level: "High",
    color: "text-rose-500",
    guidance: [
      "Serious injury, fatality, or severe health risk possible.",
      "Immediate action needed.",
    ],
  },
];

const getInitials = (value: string) => {
  const parts = value
    .trim()
    .split(/\s+|@/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "U";
};

const buildAuthProfile = (user: User | null): AuthProfile | null => {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata;
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email || "Signed-in user";
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const email = user.email || "No email available";

  return {
    email,
    name,
    avatarUrl,
    initials: getInitials(name || email),
  };
};

const ICON_MAP: Record<string, LucideIcon> = {
  ppe: ShieldCheck,
  emergency: HeartPulse,
  ergonomics: Cpu,
  dust: Wind,
  noise: Volume2,
  chemical: FlaskConical,
  machinery: HardHat,
  fire: Flame,
  electrical: Zap,
  general: Building2,
};

const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: "command-center",
    label: "Command Center",
    description:
      "Laboria Orbit's master operational intelligence dashboard for actions, inspections, risks, incidents, training, analytics, AI credits, and workspace signals.",
    status: "Active",
    icon: Cpu,
  },
  {
    id: "action-tracker",
    label: "Action Tracker",
    description:
      "Central operational workspace for managing HSE actions, deadlines, responsibilities, and corrective measures across inspections, risk assessments, incidents, and training activities.",
    status: "Active",
    icon: CheckCircle2,
  },
  {
    id: "inspections",
    label: "Inspections",
    description:
      "Create, complete, save, and export Laboria safety inspection checklists.",
    status: "Active",
    icon: ClipboardCheck,
  },
  {
    id: "risk-assessments",
    label: "Risk Assessments",
    description:
      "Create manual 5x5 workplace risk assessments with controls and PDF export.",
    status: "Active",
    icon: TriangleAlert,
  },
  {
    id: "training-management",
    label: "Training Management",
    description:
      "Manage HSE training requirements, employee competency records, expirations, and compliance gaps.",
    status: "Active",
    icon: GraduationCap,
  },
  {
    id: "incident-management",
    label: "Incident Management",
    description:
      "Record events, classify root causes, generate follow-up actions, and track investigation workflows.",
    status: "Active",
    icon: HeartPulse,
  },
  {
    id: "hse-analytics",
    label: "HSE Analytics",
    description:
      "Monitor operational risks, incidents, actions, training compliance, and inspection performance.",
    status: "Active",
    icon: BarChart3,
  },
  {
    id: "settings",
    label: "Settings",
    description:
      "Configure company branding, preferences, workflow settings, exports, subscription, and AI readiness.",
    status: "Active",
    icon: Settings,
  },
];

const getLegacyHistoryStorageKey = (checklistId: string) =>
  `laboria_${checklistId}_history`;

const getHistoryStorageKey = (checklistId: string, userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_${checklistId}_history`
    : getLegacyHistoryStorageKey(checklistId);

const getLegacyDraftStorageKey = (checklistId: string) =>
  `laboria_${checklistId}_draft`;

const getDraftStorageKey = (checklistId: string, userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_${checklistId}_draft`
    : getLegacyDraftStorageKey(checklistId);

const parseDraftValue = (value: string | null): InspectionDraft | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidate = parsed as Partial<InspectionDraft>;

    return {
      company: typeof candidate.company === "string" ? candidate.company : "",
      site: typeof candidate.site === "string" ? candidate.site : "",
      inspector:
        typeof candidate.inspector === "string" ? candidate.inspector : "",
      inspectionDate:
        typeof candidate.inspectionDate === "string"
          ? candidate.inspectionDate
          : new Date().toISOString().split("T")[0],
      answers:
        candidate.answers && typeof candidate.answers === "object"
          ? (candidate.answers as Record<string, string>)
          : {},
      risk:
        candidate.risk && typeof candidate.risk === "object"
          ? (candidate.risk as Record<string, string>)
          : {},
      comments:
        candidate.comments && typeof candidate.comments === "object"
          ? (candidate.comments as Record<string, string>)
          : {},
      updatedAt:
        typeof candidate.updatedAt === "string"
          ? candidate.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const readDraftForChecklist = (
  checklistId: string,
  userId: string | null,
): InspectionDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const draft = parseDraftValue(
    window.localStorage.getItem(getDraftStorageKey(checklistId, userId)),
  );

  if (draft || !userId) {
    return draft;
  }

  return parseDraftValue(
    window.localStorage.getItem(getLegacyDraftStorageKey(checklistId)),
  );
};

const writeDraftForChecklist = (
  checklistId: string,
  userId: string | null,
  draft: InspectionDraft,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getDraftStorageKey(checklistId, userId),
    JSON.stringify(draft),
  );

  if (userId) {
    window.localStorage.removeItem(getLegacyDraftStorageKey(checklistId));
  }
};

const parseHistoryValue = (value: string | null): SavedInspection[] => {
  if (!value) {
    return [];
  }

  const parsed: unknown = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is SavedInspection => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Partial<SavedInspection>;
    return typeof candidate.id === "number";
  });
};

const mergeHistory = (items: SavedInspection[]) => {
  const seen = new Set<number>();

  return items
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime();
      const bTime = new Date(b.savedAt).getTime();

      return (
        (Number.isFinite(bTime) ? bTime : b.id) -
        (Number.isFinite(aTime) ? aTime : a.id)
      );
    });
};

const readHistoryForChecklist = (
  checklistId: string,
  userId: string | null,
): SavedInspection[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const keys = [getHistoryStorageKey(checklistId, userId)];
  const legacyKey = getLegacyHistoryStorageKey(checklistId);

  if (userId && !keys.includes(legacyKey)) {
    keys.push(legacyKey);
  }

  return mergeHistory(
    keys.flatMap((key) => parseHistoryValue(window.localStorage.getItem(key))),
  );
};

const writeHistoryForChecklist = (
  checklistId: string,
  userId: string | null,
  inspections: SavedInspection[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getHistoryStorageKey(checklistId, userId),
    JSON.stringify(inspections),
  );

  if (userId) {
    window.localStorage.removeItem(getLegacyHistoryStorageKey(checklistId));
  }
};

const loadHistoryForChecklist = (
  checklistId: string,
  userId: string | null,
) => {
  const inspections = readHistoryForChecklist(checklistId, userId);

  if (userId) {
    writeHistoryForChecklist(checklistId, userId, inspections);
  }

  return inspections;
};

/* =========================
   LANGUAGE & TEXTS
========================= */

type Lang = "EN" | "KA";

const getInspectionPresentationLanguage = (): Lang => "EN";

const TEXT = {
  EN: {
    headerTitle: "PPE COMPLIANCE REPORT",
    headerSubtitle: "Personal Protective Equipment Inspection",
    systemName: "Laboria HSE Workspace",
    title: "PERSONAL PROTECTIVE EQUIPMENT (PPE) COMPLIANCE CHECKLIST",
    item: "Item",
    risk: "Risk",
    corrective: "Corrective action",
    responsible: "Responsible",
    deadline: "Deadline",
    comments: "Comments",
    company: "Company name",
    site: "Site / Location",
    inspector: "Inspector",
    date: "Inspection date",
    result: "Result",
    export: "Export inspection report (PDF)",
    compliant: "Compliant",
    partially: "Partially compliant",
    nonCompliant: "Non-compliant",
    noData: "No data",
    overallStatus: "OVERALL COMPLIANCE STATUS",
    riskSummaryTitle: "Risk Summary",
    high: "High",
    medium: "Medium",
    low: "Low",
    generatedBy:
      "Generated by Laboria HSE Workspace • Confidential Document",
    riskLabel: "Risk",
  },
  KA: {
    headerTitle: "ინდივიდუალური დაცვის საშუალებების ჩექლისტი",
    headerSubtitle: "ინსპექტირების შესაბამისობის ჩექლისტი",
    systemName: "LABORIA უსაფრთხოების სისტემა",
    title: "ინდივიდუალური დაცვის საშუალებების შესაბამისობის ჩექლისტი",
    item: "შეკითხვა",
    risk: "რისკი",
    corrective: "გასატარებელი ღონისძიება",
    responsible: "პასუხისმგებელი",
    deadline: "ვადა",
    comments: "კომენტარი",
    company: "კომპანიის დასახელება",
    site: "ობიექტი / ლოკაცია",
    inspector: "ინსპექტორი",
    date: "ინსპექტირების თარიღი",
    result: "შედეგი",
    export: "ინსპექტირების ანგარიშის ექსპორტი (PDF)",
    compliant: "შესაბამისობა",
    partially: "ნაწილობრივი შესაბამისობა",
    nonCompliant: "შეუსაბამობა",
    noData: "მონაცემები არ არის",
    overallStatus: "საერთო შესაბამისობის სტატუსი",
    riskSummaryTitle: "რისკების შეჯამება",
    high: "მაღალი",
    medium: "საშუალო",
    low: "დაბალი",
    generatedBy:
      "გენერირებულია LABORIA უსაფრთხოების სისტემის მიერ • კონფიდენციალური დოკუმენტი",
    riskLabel: "რისკი",
  },
};
/* =========================
   COMPONENT
========================= */

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [activeChecklistId, setActiveChecklistId] = useState("ppe");
  const [activeWorkspaceModule, setActiveWorkspaceModule] =
    useState<WorkspaceModuleId>("command-center");
  const [workspaceNavigationIntent, setWorkspaceNavigationIntent] =
    useState<WorkspaceNavigationIntent | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [notifications, setNotifications] = useState<OrbitNotification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  const activeChecklist =
    ALL_CHECKLISTS.find((c) => c.id === activeChecklistId) ?? ALL_CHECKLISTS[0];

  const [lang, setLang] = useState<Lang>("EN");
  const inspectionLang = getInspectionPresentationLanguage();
  const t = TEXT[inspectionLang];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [risk, setRisk] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [createdInspectionActionLinks, setCreatedInspectionActionLinks] =
    useState<string[]>([]);

  const [company, setCompany] = useState("");
  const [site, setSite] = useState("");
  const [inspector, setInspector] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [openSection, setOpenSection] = useState<number | null>(0);
  const [showFab, setShowFab] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null);
  const [orbitAiAccount, setOrbitAiAccount] = useState(() =>
    getOrbitAiAccount(null),
  );
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettings>(defaultWorkspaceSettings);
  const [history, setHistory] = useState<SavedInspection[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyNotice, setHistoryNotice] = useState<HistoryNotice | null>(
    null,
  );
  const [workflowWarning, setWorkflowWarning] =
    useState<WorkflowWarning | null>(null);
  const [autosaveStatus, setAutosaveStatus] =
    useState<AutosaveStatus>("saved");
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sectionScrollFrameRef = useRef<number | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const isDraftLoadedRef = useRef(false);
  const skipNextAutosaveRef = useRef(true);
  const lastAutosavedSnapshotRef = useRef("");

  /* =========================
     SCROLL DETECTION
  ========================= */

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setHistoryNotice({
          type: "error",
          message: "Could not verify the signed-in user.",
        });
        return;
      }

      setAuthUserId(data.user?.id ?? null);
      setAuthProfile(buildAuthProfile(data.user ?? null));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? null);
      setAuthProfile(buildAuthProfile(session?.user ?? null));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isActive = true;

    const loadWorkspaceSettings = (applyDefaultModule = false) => {
      const storedSettings = readWorkspaceSettings(authUserId);
      setWorkspaceSettings(storedSettings);
      setDarkMode(storedSettings.preferences.themeMode === "dark");
      setLang(storedSettings.preferences.language);

      if (applyDefaultModule) {
        const commandCenterMigrationKey = authUserId
          ? `laboria_${encodeURIComponent(authUserId)}_command_center_default_migrated`
          : "laboria_command_center_default_migrated";

        if (
          storedSettings.preferences.defaultDashboardPage === "action-tracker" &&
          window.localStorage.getItem(commandCenterMigrationKey) !== "true"
        ) {
          const migratedSettings: WorkspaceSettings = {
            ...storedSettings,
            preferences: {
              ...storedSettings.preferences,
              defaultDashboardPage: "command-center",
            },
            updatedAt: new Date().toISOString(),
          };

          window.localStorage.setItem(commandCenterMigrationKey, "true");
          writeWorkspaceSettings(authUserId, migratedSettings);
          setWorkspaceSettings(migratedSettings);
          setActiveWorkspaceModule("command-center");
          return;
        }

        setActiveWorkspaceModule(storedSettings.preferences.defaultDashboardPage);
      }
    };

    loadWorkspaceSettings(true);

    if (authUserId) {
      void loadWorkspaceCompanyLogo(authUserId).then((syncedSettings) => {
        if (isActive) {
          setWorkspaceSettings(syncedSettings);
        }
      });
    }

    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<WorkspaceSettings>;

      if (customEvent.detail) {
        setWorkspaceSettings(customEvent.detail);
        setDarkMode(customEvent.detail.preferences.themeMode === "dark");
        setLang(customEvent.detail.preferences.language);
        return;
      }

      loadWorkspaceSettings();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("workspace_settings")) {
        loadWorkspaceSettings();
      }
    };

    window.addEventListener(
      workspaceSettingsUpdatedEvent,
      handleSettingsUpdate,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      isActive = false;
      window.removeEventListener(
        workspaceSettingsUpdatedEvent,
        handleSettingsUpdate,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [authUserId]);

  useEffect(() => {
    const handleAiNavigation = (event: Event) => {
      const customEvent = event as CustomEvent<"billing" | "ai-intelligence">;
      const intent = createWorkspaceNavigationIntent({
        moduleId: "settings",
        action: customEvent.detail === "ai-intelligence" ? "ai-intelligence" : "billing",
      });

      setWorkspaceNavigationIntent(intent);
      setActiveWorkspaceModule("settings");
      setShowWorkspaceMenu(false);
      setShowHistory(false);
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    };

    window.addEventListener(orbitAiNavigationEvent, handleAiNavigation);
    return () => window.removeEventListener(orbitAiNavigationEvent, handleAiNavigation);
  }, []);

  useEffect(() => {
    const billingResult = new URLSearchParams(window.location.search).get(
      "billing",
    );
    if (!billingResult) return;

    setWorkspaceNavigationIntent(
      createWorkspaceNavigationIntent({
        moduleId: "settings",
        action: "billing",
      }),
    );
    setActiveWorkspaceModule("settings");
    setShowWorkspaceMenu(false);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      setNotifications(syncOrbitNotifications(authUserId, workspaceSettings));
    };
    const timeoutId = window.setTimeout(refreshNotifications, 0);
    const intervalId = window.setInterval(refreshNotifications, 30_000);

    const handleNotificationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<OrbitNotification[]>;

      if (customEvent.detail) {
        setNotifications(customEvent.detail);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("notification_center")) {
        refreshNotifications();
      }
    };

    window.addEventListener(notificationCenterUpdatedEvent, handleNotificationUpdate);
    window.addEventListener(orbitAiAccountUpdatedEvent, refreshNotifications);
    window.addEventListener(orbitAiGenerationsUpdatedEvent, refreshNotifications);
    window.addEventListener(toolboxTalksUpdatedEvent, refreshNotifications);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshNotifications);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener(
        notificationCenterUpdatedEvent,
        handleNotificationUpdate,
      );
      window.removeEventListener(orbitAiAccountUpdatedEvent, refreshNotifications);
      window.removeEventListener(orbitAiGenerationsUpdatedEvent, refreshNotifications);
      window.removeEventListener(toolboxTalksUpdatedEvent, refreshNotifications);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshNotifications);
    };
  }, [activeWorkspaceModule, authUserId, workspaceSettings]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        setHistory(loadHistoryForChecklist(activeChecklistId, authUserId));
      } catch {
        setHistory([]);
        setHistoryNotice({
          type: "error",
          message: "Could not load inspection history.",
        });
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeChecklistId, authUserId]);

  useEffect(() => {
    const syncAccount = () => setOrbitAiAccount(getOrbitAiAccount(authUserId));
    const loadBillingAccount = () => {
      void refreshOrbitAiAccount(authUserId).catch(() => {
        setOrbitAiAccount(getOrbitAiAccount(authUserId));
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
  }, [authUserId]);

  useEffect(() => {
    isDraftLoadedRef.current = false;
    skipNextAutosaveRef.current = true;

    const draft = readDraftForChecklist(activeChecklistId, authUserId);
    const profileDefaults = readWorkspaceSettings(authUserId).companyProfile;
    const nextCompany = draft?.company ?? profileDefaults.companyName ?? "";
    const nextSite = draft?.site ?? profileDefaults.mainSiteLocation ?? "";
    const nextInspector = draft?.inspector ?? "";
    const nextInspectionDate =
      draft?.inspectionDate || new Date().toISOString().split("T")[0];
    const nextAnswers = draft?.answers ?? {};
    const nextRisk = draft?.risk ?? {};
    const nextComments = draft?.comments ?? {};

    setAnswers(nextAnswers);
    setRisk(nextRisk);
    setComments(nextComments);
    setCompany(nextCompany);
    setSite(nextSite);
    setInspector(nextInspector);
    setInspectionDate(nextInspectionDate);
    setWorkflowWarning(null);
    setAutosaveStatus("saved");
    lastAutosavedSnapshotRef.current = JSON.stringify({
      company: nextCompany,
      site: nextSite,
      inspector: nextInspector,
      inspectionDate: nextInspectionDate,
      answers: nextAnswers,
      risk: nextRisk,
      comments: nextComments,
    });

    isDraftLoadedRef.current = true;
  }, [activeChecklistId, authUserId]);

  useEffect(() => {
    if (!isDraftLoadedRef.current) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      setAutosaveStatus("saved");
      return;
    }

    const draftSnapshot = JSON.stringify({
      company,
      site,
      inspector,
      inspectionDate,
      answers,
      risk,
      comments,
    });

    if (draftSnapshot === lastAutosavedSnapshotRef.current) {
      setAutosaveStatus("saved");
      return;
    }

    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    setAutosaveStatus("dirty");

    autosaveTimeoutRef.current = window.setTimeout(() => {
      setAutosaveStatus("saving");

      try {
        writeDraftForChecklist(activeChecklistId, authUserId, {
          company,
          site,
          inspector,
          inspectionDate,
          answers,
          risk,
          comments,
          updatedAt: new Date().toISOString(),
        });
        lastAutosavedSnapshotRef.current = draftSnapshot;
        setAutosaveStatus("saved");
      } catch {
        setAutosaveStatus("dirty");
      } finally {
        autosaveTimeoutRef.current = null;
      }
    }, 700);

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    activeChecklistId,
    answers,
    authUserId,
    comments,
    company,
    inspectionDate,
    inspector,
    risk,
    site,
  ]);

  useEffect(() => {
    if (!historyNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHistoryNotice(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [historyNotice]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const current = window.scrollY;

      if (current > lastScrollY) {
        setShowFab(false);
      } else {
        setShowFab(true);
      }

      lastScrollY = current;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (sectionScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(sectionScrollFrameRef.current);
      }
    };
  }, []);

  const scrollToSectionHeader = (sectionIndex: number) => {
    if (sectionScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(sectionScrollFrameRef.current);
    }

    sectionScrollFrameRef.current = window.requestAnimationFrame(() => {
      sectionScrollFrameRef.current = window.requestAnimationFrame(() => {
        const section = sectionRefs.current[sectionIndex];

        if (!section) {
          sectionScrollFrameRef.current = null;
          return;
        }

        const topPadding = 16;
        const sectionTop =
          section.getBoundingClientRect().top + window.scrollY - topPadding;

        window.scrollTo({
          top: Math.max(sectionTop, 0),
          behavior: "smooth",
        });

        sectionScrollFrameRef.current = null;
      });
    });
  };

  const handleSectionToggle = (sectionIndex: number) => {
    const nextSection = openSection === sectionIndex ? null : sectionIndex;

    setOpenSection(nextSection);

    if (nextSection !== null) {
      scrollToSectionHeader(sectionIndex);
    }
  };

  /* =========================
     CALCULATIONS
  ========================= */

  const calculateResult = () => {
    const values = Object.values(answers);
    const applicable = values.filter((v: string) => v !== "na");
    const yesCount = applicable.filter((v: string) => v === "yes").length;

    if (applicable.length === 0) {
      return { percent: 0, status: t.noData };
    }

    const percent = Math.round((yesCount / applicable.length) * 100);

    if (percent >= 90) return { percent, status: t.compliant };
    if (percent >= 70) return { percent, status: t.partially };

    return { percent, status: t.nonCompliant };
  };
  const result = calculateResult();
  const calculateRiskSummary = () => {
    const values = Object.entries(risk)
      .filter(([id]) => answers[id] === "yes" || answers[id] === "no")
      .map(([, value]) => value);

    const high = values.filter((v) => v === "H").length;
    const medium = values.filter((v) => v === "M").length;
    const low = values.filter((v) => v === "L").length;

    return { high, medium, low };
  };

  const riskSummary = calculateRiskSummary();

  const totalQuestions = useMemo(
    () =>
      activeChecklist.sections.reduce(
        (total, section) => total + section.items.length,
        0,
      ),
    [activeChecklist],
  );

  const completedQuestions = useMemo(
    () =>
      activeChecklist.sections.reduce(
        (total, section, sectionIndex) =>
          total +
          section.items.filter((_, questionIndex) => {
            const id = `${sectionIndex}-${questionIndex}`;
            return Boolean(answers[id]);
          }).length,
        0,
      ),
    [activeChecklist, answers],
  );

  const unansweredQuestions = totalQuestions - completedQuestions;
  const checklistProgressPercent =
    totalQuestions > 0
      ? Math.round((completedQuestions / totalQuestions) * 100)
      : 0;
  const autosaveStatusText =
    autosaveStatus === "saving"
      ? "Saving..."
      : autosaveStatus === "dirty"
        ? "Unsaved changes"
        : "All changes saved";

  useEffect(() => {
    if (workflowWarning && unansweredQuestions <= 0) {
      setWorkflowWarning(null);
    }
  }, [unansweredQuestions, workflowWarning]);

  const handleAnswerChange = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));

    if (value === "na") {
      setRisk((current) => {
        const updated = { ...current };
        delete updated[id];
        return updated;
      });
      setComments((current) => {
        const updated = { ...current };
        delete updated[id];
        return updated;
      });
    }
  };

  const getInspectionActionLinkId = (questionId: string) =>
    `inspection:${activeChecklistId}:${questionId}`;

  const getInspectionActionPriority = (
    answer: string | undefined,
    riskLevel: string | undefined,
  ): ActionPriority => {
    if (riskLevel === "H") {
      return "Critical";
    }

    if (riskLevel === "M") {
      return "High";
    }

    if (riskLevel === "L") {
      return "Medium";
    }

    if (answer === "no") {
      return "Medium";
    }

    return "Low";
  };

  const getInspectionRiskLabel = (riskLevel: string | undefined) => {
    if (riskLevel === "H") {
      return "High";
    }

    if (riskLevel === "M") {
      return "Medium";
    }

    if (riskLevel === "L") {
      return "Low";
    }

    return "Not rated";
  };

  const createActionFromInspectionFinding = (
    questionId: string,
    sectionTitle: string,
    questionText: string,
  ) => {
    const linkedInspectionId = getInspectionActionLinkId(questionId);
    const existingAction = findActionByLinkedSource({
      userId: authUserId,
      linkedInspectionId,
    });

    if (existingAction) {
      const shouldCreateAnother = window.confirm(
        "An action may already exist for this item. Create another?",
      );

      if (!shouldCreateAnother) {
        return;
      }
    }

    const answer = answers[questionId] || "Not selected";
    const findingRisk = risk[questionId];
    const observation = comments[questionId]?.trim() || "Not provided";
    const action = createActionFromInput({
      title: `Corrective action: ${questionText}`,
      description: [
        `Checklist/report name: ${activeChecklist.headerTitleEN}`,
        `Section/subsection: ${sectionTitle || "Not provided"}`,
        `Question text: ${questionText}`,
        `Answer selected: ${answer.toUpperCase()}`,
        `Finding risk level: ${getInspectionRiskLabel(findingRisk)}`,
        `Comment/Observation: ${observation}`,
        `Company name: ${company || "Not provided"}`,
        `Site/location: ${site || "Not provided"}`,
        `Inspection date: ${inspectionDate || "Not provided"}`,
        `Inspector: ${inspector || "Not provided"}`,
      ].join("\n"),
      sourceModule: "Inspection",
      priority: getInspectionActionPriority(answer, findingRisk),
      siteLocation: site,
      dueDate: getDateInputDaysFromNow(7),
      createdBy: authProfile?.email ?? authProfile?.name ?? "Signed-in user",
      linkedInspectionId,
    });

    appendActionTrackerAction(authUserId, action);
    setCreatedInspectionActionLinks((current) =>
      current.includes(linkedInspectionId)
        ? current
        : [...current, linkedInspectionId],
    );
    setHistoryNotice({
      type: "success",
      message: "Action created from inspection finding.",
    });
  };

  const getSelectedFindingRisks = () =>
    Object.fromEntries(
      Object.entries(risk).filter(
        ([id]) => answers[id] === "yes" || answers[id] === "no",
      ),
    );

  const getSelectedFindingComments = () =>
    Object.fromEntries(
      Object.entries(comments)
        .filter(
          ([id, value]) =>
            (answers[id] === "yes" || answers[id] === "no") &&
            value.trim().length > 0,
        )
        .map(([id, value]) => [id, value.trim()]),
    );

  const calculateSectionResult = (sectionIndex: number) => {
    const section = activeChecklist.sections[sectionIndex];
    if (!section) return { percent: 0 };

    const ids = section.items.map((_, qi) => `${sectionIndex}-${qi}`);
    const values = ids
      .map((id: string) => answers[id])
      .filter((v: string) => v && v !== "na");

    if (values.length === 0) {
      return { percent: 0 };
    }

    const yesCount = values.filter((v) => v === "yes").length;
    const percent = Math.round((yesCount / values.length) * 100);

    return { percent };
  };

  const calculateSectionProgress = (sectionIndex: number) => {
    const section = activeChecklist.sections[sectionIndex];

    if (!section) {
      return { completed: 0, total: 0, isComplete: false };
    }

    const completed = section.items.filter((_, questionIndex) => {
      const id = `${sectionIndex}-${questionIndex}`;
      return Boolean(answers[id]);
    }).length;

    return {
      completed,
      total: section.items.length,
      isComplete: section.items.length > 0 && completed === section.items.length,
    };
  };

  /* =========================
     PDF EXPORT
  ========================= */

  const requestWorkflowConfirmation = (action: WorkflowWarning["action"]) => {
    if (unansweredQuestions <= 0) {
      return false;
    }

    setWorkflowWarning({
      action,
      unansweredCount: unansweredQuestions,
    });

    window.requestAnimationFrame(() => {
      document
        .getElementById("inspection-report")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return true;
  };

  const exportInspectionPDF = async () => {
    const element = document.getElementById("clean-export");
    if (!element) return;

    const pdf = new jsPDF("p", "mm", "a4");

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sideMargin = 10;
    const topMargin = 10;
    const footerTop = pageHeight - 22;
    const contentHeight = footerTop - topMargin;
    const imgWidth = pageWidth - sideMargin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let pageIndex = 0;

    pdf.addImage(imgData, "PNG", sideMargin, topMargin, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      pageIndex += 1;
      pdf.addPage();
      pdf.addImage(
        imgData,
        "PNG",
        sideMargin,
        topMargin - pageIndex * contentHeight,
        imgWidth,
        imgHeight,
      );
      heightLeft -= contentHeight;
    }

    const totalPages = pdf.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      pdf.setPage(pageNumber);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, footerTop, pageWidth, pageHeight - footerTop, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.line(sideMargin, footerTop + 2, pageWidth - sideMargin, footerTop + 2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        "Generated by Laboria HSE Workspace",
        sideMargin,
        footerTop + 8,
      );
      pdf.text("Confidential inspection report", sideMargin, footerTop + 13);
      pdf.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - sideMargin,
        footerTop + 11,
        { align: "right" },
      );
    }

    pdf.save(`LABORIA_${activeChecklistId}_Checklist.pdf`);
  };

  const handleExportPDF = () => {
    if (requestWorkflowConfirmation("export")) {
      return;
    }

    void exportInspectionPDF();
  };

  const loadFromHistory = (item: SavedInspection) => {
    try {
      setAnswers(item.answers || {});
      setRisk(item.risk || {});
      setComments(item.comments || {});
      setCompany(item.company || "");
      setSite(item.site || "");
      setInspector(item.inspector || "");
      setInspectionDate(item.inspectionDate || "");
      setHistoryNotice({
        type: "success",
        message: "Inspection loaded.",
      });
    } catch {
      setHistoryNotice({
        type: "error",
        message: "Could not load this inspection.",
      });
    }
  };

  const openHistory = () => {
    try {
      setHistory(loadHistoryForChecklist(activeChecklistId, authUserId));
    } catch {
      setHistoryNotice({
        type: "error",
        message: "Could not load inspection history.",
      });
    }

    setShowHistory(true);
  };

  const deleteInspection = (id: number) => {
    try {
      const storedHistory = loadHistoryForChecklist(
        activeChecklistId,
        authUserId,
      );
      const updated = storedHistory.filter((item) => item.id !== id);

      writeHistoryForChecklist(activeChecklistId, authUserId, updated);
      setHistory(updated);
      setHistoryNotice({
        type: "success",
        message: "Inspection deleted.",
      });
    } catch {
      setHistoryNotice({
        type: "error",
        message: "Could not delete inspection.",
      });
    }
  };

  const persistInspection = () => {
    try {
      const inspectionData: SavedInspection = {
        id: Date.now(),
        company,
        site,
        inspector,
        inspectionDate,
        answers,
        risk: getSelectedFindingRisks(),
        comments: getSelectedFindingComments(),
        result,
        savedAt: new Date().toISOString(),
      };

      const storedHistory = loadHistoryForChecklist(
        activeChecklistId,
        authUserId,
      );
      const updated = [inspectionData, ...storedHistory];

      writeHistoryForChecklist(activeChecklistId, authUserId, updated);
      writeDraftForChecklist(activeChecklistId, authUserId, {
        company,
        site,
        inspector,
        inspectionDate,
        answers,
        risk,
        comments,
        updatedAt: new Date().toISOString(),
      });
      lastAutosavedSnapshotRef.current = JSON.stringify({
        company,
        site,
        inspector,
        inspectionDate,
        answers,
        risk,
        comments,
      });
      setHistory(updated);
      setHistoryNotice({
        type: "success",
        message: "Inspection saved.",
      });
      setAutosaveStatus("saved");
    } catch {
      setHistoryNotice({
        type: "error",
        message: "Could not save inspection.",
      });
    }
  };

  const saveInspection = () => {
    if (requestWorkflowConfirmation("save")) {
      return;
    }

    persistInspection();
  };

  const continueWorkflowAction = () => {
    const action = workflowWarning?.action;

    setWorkflowWarning(null);

    if (action === "save") {
      persistInspection();
      return;
    }

    if (action === "export") {
      void exportInspectionPDF();
    }
  };

  const persistWorkspaceSettings = (nextSettings: WorkspaceSettings) => {
    setWorkspaceSettings(nextSettings);
    writeWorkspaceSettings(authUserId, nextSettings);
  };

  const toggleWorkspaceTheme = () => {
    const nextDarkMode = !darkMode;
    const nextSettings: WorkspaceSettings = {
      ...workspaceSettings,
      preferences: {
        ...workspaceSettings.preferences,
        themeMode: nextDarkMode ? "dark" : "light",
      },
    };

    setDarkMode(nextDarkMode);
    persistWorkspaceSettings(nextSettings);
  };

  const updateWorkspaceLanguage = (nextLanguage: Lang) => {
    const nextSettings: WorkspaceSettings = {
      ...workspaceSettings,
      preferences: {
        ...workspaceSettings.preferences,
        language: nextLanguage,
      },
    };

    setLang(nextLanguage);
    persistWorkspaceSettings(nextSettings);
  };

  const handleLogout = async () => {
    setShowWorkspaceMenu(false);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const activeWorkspaceModuleConfig =
    WORKSPACE_MODULES.find((module) => module.id === activeWorkspaceModule) ??
    WORKSPACE_MODULES[0];
  const workspaceCompanyProfile = workspaceSettings.companyProfile;
  const workspaceCompanyName = workspaceCompanyProfile.companyName.trim();
  const workspaceCompanyDetails = [
    workspaceCompanyProfile.industrySector,
    workspaceCompanyProfile.mainSiteLocation,
    workspaceCompanyProfile.contactEmail,
    workspaceCompanyProfile.phone,
    workspaceCompanyProfile.address,
  ].filter((value) => value.trim().length > 0);
  const hasWorkspaceCompanyBranding = hasCompanyBranding(workspaceSettings);

  const selectWorkspaceModule = (moduleId: WorkspaceModuleId) => {
    setWorkspaceNavigationIntent(null);
    setActiveWorkspaceModule(moduleId);
    setShowWorkspaceMenu(false);

    if (moduleId !== "inspections") {
      setShowHistory(false);
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const handleWorkspaceNavigationIntent = (
    intent: WorkspaceNavigationIntent,
  ) => {
    setWorkspaceNavigationIntent(intent);
    setActiveWorkspaceModule(intent.moduleId);
    setShowWorkspaceMenu(false);

    if (intent.moduleId === "inspections" && intent.action === "history") {
      openHistory();
      setWorkspaceNavigationIntent(null);
    } else if (intent.moduleId === "inspections" && intent.action === "new") {
      setShowHistory(false);
      setAnswers({});
      setRisk({});
      setComments({});
      setCompany(workspaceCompanyName);
      setSite(workspaceCompanyProfile.mainSiteLocation);
      setInspector(authProfile?.name ?? "");
      setInspectionDate(new Date().toISOString().split("T")[0]);
      setOpenSection(0);
      setHistoryNotice({
        type: "success",
        message: "New inspection draft ready.",
      });
      setWorkspaceNavigationIntent(null);
    } else if (intent.moduleId !== "inspections") {
      setShowHistory(false);
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const clearWorkspaceNavigationIntent = () => {
    setWorkspaceNavigationIntent(null);
  };

  const activeUnreadNotifications = notifications.filter(
    (notification) => notification.active && !notification.read,
  );
  const hasCriticalUnreadNotification = activeUnreadNotifications.some(
    (notification) => notification.severity === "Critical",
  );

  const openNotificationCenter = () => {
    setNotifications(syncOrbitNotifications(authUserId, workspaceSettings));
    setShowNotificationCenter(true);
  };

  const markAllNotificationsRead = () => {
    setNotifications(markAllOrbitNotificationsRead(authUserId));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(deleteOrbitNotification(authUserId, notificationId));
  };

  const deleteAllReadNotifications = () => {
    setNotifications(deleteAllReadOrbitNotifications(authUserId));
  };

  const openNotification = (notification: OrbitNotification) => {
    setNotifications(markOrbitNotificationRead(authUserId, notification.id));
    setShowNotificationCenter(false);
    handleWorkspaceNavigationIntent(
      createWorkspaceNavigationIntent(notification.relatedAction),
    );
  };

  const renderNotificationBell = (compact = false) => {
    const BellIcon = hasCriticalUnreadNotification ? BellRing : Bell;

    return (
      <button
        type="button"
        aria-label={`Open Notification Center. ${activeUnreadNotifications.length} unread notifications.`}
        className={`group relative flex items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-200 transition hover:border-[#4DEBFF]/35 hover:bg-[#1E90FF]/10 hover:text-[#4DEBFF] ${
          compact
            ? "h-10 w-10 shrink-0 justify-center"
            : "mb-3 w-full gap-3 px-3 py-2.5 text-left"
        }`}
        onClick={openNotificationCenter}
      >
        <span
          className={`grid shrink-0 place-items-center rounded-lg ${
            compact
              ? "h-8 w-8"
              : "h-9 w-9 bg-[#1E90FF]/10 text-[#4DEBFF]"
          }`}
        >
          <BellIcon
            size={compact ? 18 : 17}
            className={hasCriticalUnreadNotification ? "text-rose-300" : undefined}
            aria-hidden
          />
        </span>
        {compact ? null : (
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Notifications</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">
              {activeUnreadNotifications.length > 0
                ? `${activeUnreadNotifications.length} unread operational alert${
                    activeUnreadNotifications.length === 1 ? "" : "s"
                  }`
                : "All operational alerts reviewed"}
            </span>
          </span>
        )}
        {activeUnreadNotifications.length > 0 ? (
          <span
            className={`grid shrink-0 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(244,63,94,0.5)] ${
              compact
                ? "absolute -right-1 -top-1 h-5 min-w-5 px-1"
                : "h-6 min-w-6 px-1.5"
            }`}
          >
            {activeUnreadNotifications.length > 99
              ? "99+"
              : activeUnreadNotifications.length}
          </span>
        ) : null}
      </button>
    );
  };

  const renderWorkspaceNavigation = (isMobile = false) => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#071225]/95 text-[#F5F7FA] shadow-[20px_0_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="shrink-0 flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => selectWorkspaceModule("command-center")}
            className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-transparent px-1 py-2 text-left transition duration-300 hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-[#4DEBFF]/35"
            title="Go to Command Center"
            aria-label="Go to Command Center"
          >
            <span className="pointer-events-none absolute inset-x-6 top-3 h-16 rounded-full bg-[#1E90FF]/10 blur-2xl transition duration-300 group-hover:bg-[#4DEBFF]/15" />
            <span className="pointer-events-none absolute -right-3 -top-5 h-16 w-16 rounded-full border border-[#4DEBFF]/10 transition duration-300 group-hover:border-[#4DEBFF]/20" />

            <span className="relative flex min-h-[4.5rem] items-center justify-center">
              <Image
                src="/laboria-logo.png"
                alt="Laboria"
                width={240}
                height={80}
                className="max-h-[4.5rem] w-full max-w-[15rem] scale-[2] object-contain brightness-110 contrast-110 drop-shadow-[0_0_10px_rgba(77,235,255,0.28)] [filter:brightness(1.1)_contrast(1.1)_drop-shadow(0_0_10px_rgba(77,235,255,0.28))_drop-shadow(0_0_22px_rgba(30,144,255,0.18))] transition duration-300 group-hover:scale-[2.04] group-hover:[filter:brightness(1.14)_contrast(1.12)_drop-shadow(0_0_12px_rgba(77,235,255,0.34))_drop-shadow(0_0_24px_rgba(30,144,255,0.22))]"
              />
            </span>

            <span className="relative mt-1 block text-center">
              <span className="block text-sm font-semibold text-[#F5F7FA] transition group-hover:text-white">
                Laboria Orbit
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#4DEBFF]">
                HSE Operations Workspace
              </span>
            </span>
          </button>
          {hasWorkspaceCompanyBranding ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-3">
                {workspaceCompanyProfile.logoDataUrl ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                    <Image
                      src={workspaceCompanyProfile.logoDataUrl}
                      alt={`${workspaceCompanyName || "Company"} logo`}
                      width={64}
                      height={40}
                      unoptimized
                      className="max-h-8 w-auto object-contain"
                    />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E90FF]/15 text-xs font-bold text-[#4DEBFF] ring-1 ring-[#4DEBFF]/25">
                    {workspaceCompanyName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part.charAt(0).toUpperCase())
                      .join("") || "CO"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {workspaceCompanyName || "Company workspace"}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {workspaceCompanyProfile.industrySector ||
                      workspaceCompanyProfile.mainSiteLocation ||
                      "Client configuration"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu(false)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
            aria-label="Close workspace menu"
          >
            <X size={18} aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {WORKSPACE_MODULES.map((module) => {
          const Icon = module.icon;
          const isActive = activeWorkspaceModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => selectWorkspaceModule(module.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 ease-out ${
                isActive
                  ? "border-[#4DEBFF]/40 bg-[#1E90FF]/15 text-white shadow-[0_12px_34px_rgba(30,144,255,0.18)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isActive
                    ? "bg-[#1E90FF] text-white"
                    : "bg-white/5 text-[#4DEBFF]"
                }`}
              >
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {module.label}
                </span>
                <span
                  className={`mt-0.5 block text-[11px] font-medium ${
                    module.status === "Active"
                      ? "text-emerald-300"
                      : "text-slate-500"
                  }`}
                >
                  {module.status}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-4">
        {renderNotificationBell()}
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E90FF] bg-cover bg-center text-sm font-bold text-white"
            style={{
              backgroundImage: authProfile?.avatarUrl
                ? `url("${authProfile.avatarUrl.replaceAll('"', '\\"')}")`
                : undefined,
            }}
          >
            <span className={authProfile?.avatarUrl ? "sr-only" : undefined}>
              {authProfile?.initials ?? "U"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {authProfile?.name ?? "Signed-in user"}
            </div>
            <div className="truncate text-xs text-slate-400">
              {authProfile?.email ?? "unknown"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} aria-hidden />
          Logout
        </button>
      </div>
    </div>
  );

  const renderComingSoonModule = () => {
    const Icon = activeWorkspaceModuleConfig.icon;

    return (
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-6 py-24">
        <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#071225]/82 text-[#F5F7FA] shadow-[0_30px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="border-b border-white/10 bg-white/[0.035] px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E90FF]/15 text-[#4DEBFF] ring-1 ring-[#4DEBFF]/25">
                <Icon size={22} aria-hidden />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Coming Soon
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {activeWorkspaceModuleConfig.label}
                </h1>
              </div>
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8">
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              {activeWorkspaceModuleConfig.description}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              This module is reserved for a future Laboria HSE workflow. For now,
              Command Center is the primary workspace entry point.
            </p>
            <button
              type="button"
              onClick={() => selectWorkspaceModule("command-center")}
              className="mt-7 rounded-xl bg-[#1E90FF] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.25)] transition hover:bg-[#1878d6]"
            >
              Open Command Center
            </button>
          </div>
        </div>
      </div>
    );
  };

  const reportTitle =
    inspectionLang === "EN"
      ? activeChecklist.headerTitleEN
      : activeChecklist.headerTitleKA;
  const reportSubtitle =
    inspectionLang === "EN"
      ? activeChecklist.headerSubtitleEN
      : activeChecklist.headerSubtitleKA;
  const compliancePalette =
    result.percent >= 90
      ? {
          accent: "#16A34A",
          bg: "#DCFCE7",
          text: "#166534",
          soft: "#ECFDF5",
          label: result.status,
        }
      : result.percent >= 70
        ? {
            accent: "#F59E0B",
            bg: "#FEF3C7",
            text: "#92400E",
            soft: "#FFFBEB",
            label: result.status,
          }
        : {
            accent: "#E11D48",
            bg: "#FEE2E2",
            text: "#991B1B",
            soft: "#FFF1F2",
            label: result.status,
          };

  return (
    <div className="relative flex min-h-screen w-full max-w-full min-w-0 justify-center overflow-x-hidden bg-[#050816] lg:pl-72">
      {/* SPACE GLOW BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.15),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(99,102,241,0.15),transparent_40%)]" />

      {/* DEEP GRADIENT LAYER */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 via-transparent to-indigo-900/40" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">
        {renderWorkspaceNavigation()}
      </aside>

      <div className="fixed left-0 right-0 top-0 z-50 w-full max-w-full border-b border-white/10 bg-[#071225]/92 px-3 py-3 text-[#F5F7FA] shadow-[0_18px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-4 lg:hidden">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu(true)}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-100 transition hover:bg-white/10"
            aria-label="Open workspace menu"
          >
            <Menu size={20} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#4DEBFF]">
              Laboria HSE Workspace
            </div>
            <div className="truncate text-xs text-slate-400">
              {workspaceCompanyName
                ? `${workspaceCompanyName} - ${activeWorkspaceModuleConfig.label}`
                : activeWorkspaceModuleConfig.label}
            </div>
          </div>
          {renderNotificationBell(true)}
          <Image
            src="/laboria-logo.png"
            alt="Laboria"
            width={86}
            height={30}
            className="h-auto w-14 shrink-0 rounded-lg bg-white px-1.5 py-1 sm:w-20 sm:px-2"
          />
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[70] transition-opacity duration-300 ease-out lg:hidden ${
          showWorkspaceMenu
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
          <button
            type="button"
            aria-label="Close workspace menu"
            onClick={() => setShowWorkspaceMenu(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <div
            className={`relative h-full w-[min(22rem,88vw)] transform transition-transform duration-300 ease-out ${
              showWorkspaceMenu ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {renderWorkspaceNavigation(true)}
          </div>
      </div>

      <NotificationCenterDrawer
        darkMode={darkMode}
        notifications={notifications}
        open={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        onMarkAllRead={markAllNotificationsRead}
        onDeleteNotification={deleteNotification}
        onDeleteAllRead={deleteAllReadNotifications}
        onOpenNotification={openNotification}
      />

      {/* CONTENT WRAPPER */}
      {activeWorkspaceModule === "inspections" ? (
      <div className="relative z-10 min-h-screen w-full min-w-0 px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-10 lg:py-10">
        <div
          id="inspection-report"
          className={`mx-auto w-full max-w-7xl space-y-6 transition-colors duration-300 ${
            darkMode ? "text-[#F5F7FA]" : "text-slate-900"
          }`}
        >
          <section
            className={`relative overflow-hidden rounded-3xl border backdrop-blur-2xl ${
              darkMode
                ? "border-white/10 bg-[#071225]/88 shadow-[0_30px_100px_rgba(0,0,0,0.34)]"
                : "border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
            }`}
          >
            <div
              className={`pointer-events-none absolute inset-0 opacity-40 ${
                darkMode
                  ? "bg-[linear-gradient(rgba(77,235,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(77,235,255,0.06)_1px,transparent_1px)]"
                  : "bg-[linear-gradient(rgba(30,144,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(30,144,255,0.05)_1px,transparent_1px)]"
              } bg-[size:34px_34px]`}
            />

            <div className="relative z-10 p-5 sm:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div
                    className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                      darkMode ? "text-[#4DEBFF]" : "text-[#0759A8]"
                    }`}
                  >
                    Inspections Operations
                  </div>
                  <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                    {inspectionLang === "EN"
                      ? activeChecklist.headerTitleEN
                      : activeChecklist.headerTitleKA}
                  </h1>
                  <p
                    className={`mt-3 max-w-2xl text-sm leading-6 ${
                      darkMode ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    Run structured inspections, record findings, assign risk
                    levels, and prepare client-ready reports from one
                    operational workspace.
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 xl:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveInspection}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        darkMode
                          ? "border-white/10 bg-white/[0.055] text-slate-200 hover:border-[#4DEBFF]/45 hover:bg-[#4DEBFF]/10 hover:text-[#4DEBFF]"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#1E90FF]/45 hover:text-[#1E90FF]"
                      }`}
                      title={inspectionLang === "KA" ? "შენახვა" : "Save"}
                      aria-label="Save inspection"
                    >
                      <Save size={17} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={openHistory}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        darkMode
                          ? "border-white/10 bg-white/[0.055] text-slate-200 hover:border-[#4DEBFF]/45 hover:bg-[#4DEBFF]/10 hover:text-[#4DEBFF]"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#1E90FF]/45 hover:text-[#1E90FF]"
                      }`}
                      title={inspectionLang === "KA" ? "ისტორია" : "History"}
                      aria-label="Open inspection history"
                    >
                      <History size={17} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={toggleWorkspaceTheme}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        darkMode
                          ? "border-white/10 bg-white/[0.055] text-slate-200 hover:border-[#4DEBFF]/45 hover:bg-[#4DEBFF]/10 hover:text-[#4DEBFF]"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#1E90FF]/45 hover:text-[#1E90FF]"
                      }`}
                      title="Toggle theme"
                      aria-label="Toggle theme"
                    >
                      {darkMode ? (
                        <Sun size={17} aria-hidden />
                      ) : (
                        <Moon size={17} aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        darkMode
                          ? "border-white/10 bg-white/[0.055] text-slate-200 hover:border-[#4DEBFF]/45 hover:bg-[#4DEBFF]/10 hover:text-[#4DEBFF]"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#1E90FF]/45 hover:text-[#1E90FF]"
                      }`}
                      title={t.export}
                      aria-label={t.export}
                    >
                      <Download size={17} aria-hidden />
                    </button>
                  </div>

                  <div
                    className={`text-xs font-semibold ${
                      autosaveStatus === "dirty"
                        ? darkMode
                          ? "text-amber-200"
                          : "text-amber-700"
                        : autosaveStatus === "saving"
                          ? darkMode
                            ? "text-cyan-200"
                            : "text-[#1E90FF]"
                          : darkMode
                            ? "text-slate-400"
                            : "text-slate-500"
                    }`}
                    aria-live="polite"
                  >
                    {autosaveStatusText}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <OrbitAiToolStrip
                  darkMode={darkMode}
                  userId={authUserId}
                  compact
                  title="Inspection AI"
                  sourceModule="Inspections"
                  context={{
                    inspectionItemCount: Object.keys(answers).length,
                  }}
                  toolIds={[
                    "inspection-analysis",
                    "inspection-summary",
                    "inspection-actions",
                  ]}
                />
              </div>

              {workflowWarning ? (
                <div
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                    darkMode
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                  role="alert"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold">
                      There are {workflowWarning.unansweredCount} unanswered
                      questions.
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWorkflowWarning(null)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          darkMode
                            ? "bg-white/10 text-white hover:bg-white/15"
                            : "bg-white text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        Review first
                      </button>
                      <button
                        type="button"
                        onClick={continueWorkflowAction}
                        className="rounded-lg bg-[#1E90FF] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1878d6]"
                      >
                        {workflowWarning.action === "save"
                          ? "Continue save"
                          : "Continue export"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {historyNotice ? (
                <div
                  className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                    historyNotice.type === "success"
                      ? darkMode
                        ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : darkMode
                        ? "border border-rose-400/30 bg-rose-400/10 text-rose-200"
                        : "border border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role={historyNotice.type === "error" ? "alert" : "status"}
                >
                  {historyNotice.message}
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Completed Questions",
                    value: `${completedQuestions}/${totalQuestions}`,
                    caption: "Answered in active template",
                    icon: ListChecks,
                    tone: "text-[#4DEBFF]",
                  },
                  {
                    label: "Checklist Progress",
                    value: `${checklistProgressPercent}%`,
                    caption:
                      unansweredQuestions > 0
                        ? `${unansweredQuestions} remaining`
                        : "All questions complete",
                    icon: Activity,
                    tone: "text-[#1E90FF]",
                  },
                  {
                    label: "Compliance Score",
                    value: `${result.percent}%`,
                    caption: result.status,
                    icon: Gauge,
                    tone:
                      result.percent >= 90
                        ? "text-emerald-400"
                        : result.percent >= 70
                          ? "text-amber-400"
                          : "text-rose-400",
                  },
                  {
                    label: "High Risk Findings",
                    value: `${riskSummary.high}`,
                    caption:
                      riskSummary.high > 0
                        ? "Immediate review required"
                        : "No high risk findings",
                    icon: TriangleAlert,
                    tone:
                      riskSummary.high > 0
                        ? "text-rose-400"
                        : "text-emerald-400",
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className={`rounded-2xl border p-4 transition ${
                        darkMode
                          ? "border-white/10 bg-white/[0.045]"
                          : "border-slate-200 bg-white/90 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                            darkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {card.label}
                        </span>
                        <Icon size={17} className={card.tone} aria-hidden />
                      </div>
                      <div className={`mt-3 text-3xl font-semibold ${card.tone}`}>
                        {card.value}
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {card.caption}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className={`rounded-2xl border p-4 sm:p-5 ${
              darkMode
                ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
            }`}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">Inspection templates</h2>
              <p
                className={`text-xs ${
                  darkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Select the operational checklist required for this inspection.
              </p>
            </div>
            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {ALL_CHECKLISTS.map((checklist) => (
                  <button
                    key={checklist.id}
                    onClick={() => {
                      if (
                        !isOrbitInspectionTemplateAvailable(
                          orbitAiAccount.plan,
                          checklist.id,
                        )
                      ) {
                        setHistoryNotice({
                          type: "error",
                          message: `This inspection template is available on ${ORBIT_PLUS_PLAN} and ${ORBIT_PRO_PLAN}.`,
                        });
                        return;
                      }

                      setActiveChecklistId(checklist.id);
                      setAnswers({});
                      setRisk({});
                      setComments({});
                      setOpenSection(0);
                      try {
                        setHistory(
                          loadHistoryForChecklist(checklist.id, authUserId),
                        );
                      } catch {
                        setHistoryNotice({
                          type: "error",
                          message: "Could not load inspection history.",
                        });
                      }
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      activeChecklistId === checklist.id
                        ? "border-[#1E90FF] bg-[#1E90FF] text-white shadow-[0_8px_20px_rgba(30,144,255,0.24)]"
                        : darkMode
                          ? "border-white/10 bg-white/[0.04] text-slate-300 hover:border-[#4DEBFF]/35 hover:text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#1E90FF]/35 hover:text-slate-900"
                    }`}
                    title={
                      isOrbitInspectionTemplateAvailable(
                        orbitAiAccount.plan,
                        checklist.id,
                        )
                        ? undefined
                        : `Available on ${ORBIT_PLUS_PLAN} and ${ORBIT_PRO_PLAN}`
                    }
                  >
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {(() => {
                        const Icon = ICON_MAP[checklist.id];
                        return Icon ? <Icon size={15} /> : null;
                      })()}
                      {inspectionLang === "EN"
                        ? checklist.headerTitleEN
                        : checklist.headerTitleKA}
                      {!isOrbitInspectionTemplateAvailable(
                        orbitAiAccount.plan,
                        checklist.id,
                      ) ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] uppercase text-amber-400">
                          Plus
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <section
                className={`rounded-2xl border p-5 sm:p-6 ${
                  darkMode
                    ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                    : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      Inspection details
                    </h2>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Record the site context that will appear in saved history
                      and exported reports.
                    </p>
                  </div>
                  <ClipboardCheck
                    size={20}
                    className={darkMode ? "text-[#4DEBFF]" : "text-[#1E90FF]"}
                    aria-hidden
                  />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      label: t.company,
                      value: company,
                      onChange: setCompany,
                      type: "text",
                    },
                    {
                      label: t.site,
                      value: site,
                      onChange: setSite,
                      type: "text",
                    },
                    {
                      label: t.inspector,
                      value: inspector,
                      onChange: setInspector,
                      type: "text",
                    },
                    {
                      label: t.date,
                      value: inspectionDate,
                      onChange: setInspectionDate,
                      type: "date",
                    },
                  ].map((field) => (
                    <label
                      key={field.label}
                      className={`text-xs font-semibold ${
                        darkMode ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {field.label}
                      <input
                        type={field.type}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
                          darkMode
                            ? "border-white/10 bg-white/[0.055] text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/45"
                            : "border-slate-200 bg-white text-slate-900 focus:border-[#1E90FF]/50"
                        }`}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section
                className={`rounded-2xl border p-5 sm:p-6 ${
                  darkMode
                    ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                    : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      Checklist completion
                    </h2>
                    <p
                      className={`mt-1 text-xs ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Live progress across the active inspection template.
                    </p>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      darkMode ? "text-cyan-200" : "text-[#0759A8]"
                    }`}
                  >
                    {completedQuestions} / {totalQuestions} completed
                  </div>
                </div>
                <div
                  className={`mt-4 h-2.5 w-full overflow-hidden rounded-full ${
                    darkMode ? "bg-white/10" : "bg-slate-100"
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-[#1E90FF] transition-all duration-500"
                    style={{ width: `${checklistProgressPercent}%` }}
                  />
                </div>
                <div
                  className={`mt-3 text-xs ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {unansweredQuestions > 0
                    ? `${unansweredQuestions} unanswered questions remaining`
                    : "All questions completed"}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section
                className={`relative overflow-hidden rounded-2xl border p-5 ${
                  darkMode
                    ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                    : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1 ${
                    result.percent >= 90
                      ? "bg-emerald-500"
                      : result.percent >= 70
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                />
                <div className="pl-2">
                  <div
                    className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {t.result}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <span className="text-4xl font-semibold">
                      {result.percent}%
                    </span>
                    <span
                      className={`text-right text-xs font-semibold ${
                        darkMode ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {result.status}
                    </span>
                  </div>
                  <div
                    className={`mt-4 h-2 w-full overflow-hidden rounded-full ${
                      darkMode ? "bg-white/10" : "bg-slate-100"
                    }`}
                  >
                    <div
                      className={`h-full transition-all duration-700 ease-out ${
                        result.percent >= 90
                          ? "bg-emerald-500"
                          : result.percent >= 70
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${result.percent}%` }}
                    />
                  </div>
                </div>
              </section>

              <section
                className={`rounded-2xl border p-5 ${
                  darkMode
                    ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                    : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
                }`}
              >
                <h2 className="text-sm font-semibold">
                  {inspectionLang === "KA" ? "რისკების შეჯამება" : "Risk Summary"}
                </h2>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    {
                      label: inspectionLang === "KA" ? "მაღალი" : "High",
                      value: riskSummary.high,
                      className: "bg-rose-500/10 text-rose-500",
                    },
                    {
                      label: inspectionLang === "KA" ? "საშუალო" : "Medium",
                      value: riskSummary.medium,
                      className: "bg-amber-500/10 text-amber-500",
                    },
                    {
                      label: inspectionLang === "KA" ? "დაბალი" : "Low",
                      value: riskSummary.low,
                      className: "bg-emerald-500/10 text-emerald-500",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-xl px-2 py-3 ${item.className}`}
                    >
                      <div className="text-xl font-bold">{item.value}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
          {/* SMART RISK WARNING BANNER */}
          {(riskSummary.high > 0 ||
            riskSummary.medium > 0 ||
            riskSummary.low > 0) && (
            <div
              className={`rounded-2xl border px-5 py-4 transition-all duration-300 ${
                riskSummary.high > 0
                  ? "bg-rose-500/10 border-rose-500 text-rose-500"
                  : riskSummary.medium > 0
                    ? "bg-amber-500/10 border-amber-500 text-amber-500"
                    : "bg-emerald-500/10 border-emerald-500 text-emerald-500"
              }`}
            >
              <div className="font-semibold text-sm">
                {riskSummary.high > 0
                  ? inspectionLang === "KA"
                    ? "მაღალი რისკები დაფიქსირდა — დაუყოვნებლივი მოქმედება აუცილებელია."
                    : "High risks detected — Immediate action required."
                  : riskSummary.medium > 0
                    ? inspectionLang === "KA"
                      ? "საშუალო რისკები გამოვლენილია — რეკომენდებულია კონტროლის ზომები."
                      : "Medium risks identified — Control improvement recommended."
                    : inspectionLang === "KA"
                      ? "დაბალი რისკები — მდგომარეობა სტაბილურია."
                      : "Low risks only — Situation under control."}
              </div>
            </div>
          )}

          {/* SIMPLE CHECKLIST RENDER */}
          <section
            className={`rounded-2xl border p-4 sm:p-6 ${
              darkMode
                ? "border-white/10 bg-[#071225]/72 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                : "border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Inspection checklist</h2>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Expand each section to record answers, finding risk levels,
                  observations, and corrective actions.
                </p>
              </div>
              <ShieldCheck
                size={20}
                className={darkMode ? "text-[#4DEBFF]" : "text-[#1E90FF]"}
                aria-hidden
              />
            </div>

          <div className="mt-5 space-y-4">
            {activeChecklist.sections.map((sec, si) => (
              <div
                key={si}
                ref={(element) => {
                  sectionRefs.current[si] = element;
                }}
                className={`scroll-mt-4 overflow-hidden rounded-2xl border [overflow-anchor:none] ${
                  darkMode
                    ? "border-white/10 bg-white/[0.025]"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div
                  onClick={() => handleSectionToggle(si)}
                  className={`cursor-pointer px-4 py-4 transition-all duration-300 sm:px-5 ${
                    darkMode
                      ? "hover:bg-white/[0.055]"
                      : "hover:bg-white"
                  }`}
                >
                  <div className="relative pr-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wide">
                        {inspectionLang === "EN" ? sec.sectionEN : sec.sectionKA}
                      </span>
                      {calculateSectionProgress(si).isComplete ? (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            darkMode
                              ? "bg-emerald-400/10 text-emerald-200"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          Complete
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <span>
                        {calculateSectionResult(si).percent}%{" "}
                        {inspectionLang === "EN" ? "Compliant" : "შესაბამისობა"}
                      </span>
                      <span>
                        {calculateSectionProgress(si).completed} /{" "}
                        {calculateSectionProgress(si).total} answered
                      </span>
                    </div>
                    <div
                      className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${
                        darkMode ? "bg-white/10" : "bg-slate-200"
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          calculateSectionResult(si).percent >= 90
                            ? "bg-emerald-500"
                            : calculateSectionResult(si).percent >= 70
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{
                          width: `${calculateSectionResult(si).percent}%`,
                        }}
                      />
                    </div>

                    <span
                      className={`absolute right-1 top-1 text-xl font-light ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {openSection === si ? "−" : "+"}
                    </span>
                  </div>
                </div>

                {openSection === si && (
                  <div
                    className={`space-y-4 border-t px-4 py-4 sm:px-5 sm:py-5 ${
                      darkMode ? "border-white/10" : "border-slate-200"
                    }`}
                  >
                    {sec.items.map((q, qi) => {
                      const id = `${si}-${qi}`;
                      const questionText =
                        inspectionLang === "EN" ? q.EN : q.KA;
                      const sectionTitle =
                        inspectionLang === "EN" ? sec.sectionEN : sec.sectionKA;
                      const linkedInspectionId = getInspectionActionLinkId(id);
                      const shouldShowCreateAction =
                        answers[id] === "no" ||
                        risk[id] === "M" ||
                        risk[id] === "H" ||
                        Boolean(comments[id]?.trim());
                      const isHighRiskFinding =
                        (answers[id] === "yes" || answers[id] === "no") &&
                        risk[id] === "H";
                      return (
                        <div
                          key={id}
                          className={`rounded-2xl border p-4 transition-all duration-300 sm:p-5 ${
                            isHighRiskFinding
                              ? darkMode
                                ? "border-rose-400/70 bg-rose-500/[0.06] shadow-[inset_4px_0_0_rgba(244,63,94,0.65)]"
                                : "border-rose-300 bg-white shadow-[inset_4px_0_0_rgba(225,29,72,0.28)]"
                              : darkMode
                                ? "border-white/10 bg-white/[0.035]"
                                : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="text-sm leading-6">
                              <span
                                className={`mr-2 text-xs font-bold ${
                                  darkMode ? "text-[#4DEBFF]" : "text-[#1E90FF]"
                                }`}
                              >
                                {String(qi + 1).padStart(2, "0")}
                              </span>
                              {questionText}
                            </div>
                            {isHighRiskFinding ? (
                              <span className="shrink-0 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500">
                                High risk
                              </span>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {["yes", "no", "na"].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => handleAnswerChange(id, v)}
                                className={`min-h-10 rounded-xl px-3 py-2 text-xs font-bold uppercase transition-all ${
                                  answers[id] === v
                                    ? v === "yes"
                                      ? "bg-emerald-600 text-white"
                                      : v === "no"
                                        ? "bg-red-600 text-white"
                                        : "bg-gray-600 text-white"
                                    : darkMode
                                      ? "border border-white/10 bg-white/[0.055] text-slate-300 hover:bg-white/[0.09]"
                                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {v.toUpperCase()}
                              </button>
                            ))}
                          </div>

                          {answers[id] === "yes" || answers[id] === "no" ? (
                            <div
                              className={`mt-5 rounded-2xl border p-4 ${
                                darkMode
                                  ? "border-white/10 bg-black/15"
                                  : "border-slate-200 bg-slate-50/80"
                              }`}
                            >
                              <label
                                htmlFor={`risk-${id}`}
                                className={`mb-2 block text-sm font-semibold ${
                                  darkMode ? "text-slate-100" : "text-gray-800"
                                }`}
                              >
                                Finding Risk Level
                              </label>

                              <select
                                id={`risk-${id}`}
                                value={risk[id] || ""}
                                onChange={(e) =>
                                  setRisk((current) => ({
                                    ...current,
                                    [id]: e.target.value,
                                  }))
                                }
                                className={`w-full px-4 py-3 rounded-xl border transition-all ${
                                  darkMode
                                    ? "border-white/10 bg-[#071225] text-slate-100 focus:border-[#4DEBFF]/45"
                                    : "border-slate-200 bg-white text-slate-800 focus:border-[#1E90FF]/50"
                                }`}
                              >
                                <option value="" disabled>
                                  Choose risk level
                                </option>
                                <option value="L">Low</option>
                                <option value="M">Medium</option>
                                <option value="H">High</option>
                              </select>

                              <details
                                className={`mt-3 rounded-xl border px-4 py-3 text-xs ${
                                  darkMode
                                    ? "border-white/10 bg-white/[0.03] text-slate-300"
                                    : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                <summary className="cursor-pointer font-semibold text-[#1E90FF]">
                                  How to choose risk level?
                                </summary>

                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                  {riskGuidance.map((item) => (
                                    <div key={item.level}>
                                      <div
                                        className={`font-bold uppercase ${item.color}`}
                                      >
                                        {item.level}
                                      </div>
                                      <ul className="mt-1 space-y-1 leading-5">
                                        {item.guidance.map((line) => (
                                          <li key={line}>{line}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </details>

                              <div className="mt-4">
                                <label
                                  htmlFor={`comment-${id}`}
                                  className={`mb-2 block text-sm font-semibold ${
                                    darkMode
                                      ? "text-slate-100"
                                      : "text-gray-800"
                                  }`}
                                >
                                  Comment / Observation
                                </label>

                                <textarea
                                  id={`comment-${id}`}
                                  value={comments[id] || ""}
                                  onChange={(e) =>
                                    setComments((current) => ({
                                      ...current,
                                      [id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Add observation, evidence, location detail, or corrective note..."
                                  rows={3}
                                  className={`w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 transition-all ${
                                    darkMode
                                      ? "border-white/10 bg-[#071225] text-slate-100 placeholder:text-slate-500 focus:border-[#4DEBFF]/45"
                                      : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#1E90FF]/50"
                                  }`}
                                />
                              </div>
                            </div>
                          ) : null}

                          {shouldShowCreateAction ? (
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  createActionFromInspectionFinding(
                                    id,
                                    sectionTitle,
                                    questionText,
                                  )
                                }
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                  createdInspectionActionLinks.includes(
                                    linkedInspectionId,
                                  )
                                    ? darkMode
                                      ? "border-[#4DEBFF]/40 bg-[#4DEBFF]/10 text-[#DDFBFF]"
                                      : "border-[#1E90FF]/35 bg-[#1E90FF]/10 text-[#0759A8]"
                                    : darkMode
                                      ? "border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#DDFBFF] hover:bg-[#4DEBFF]/15"
                                      : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8] hover:bg-[#1E90FF]/15"
                                }`}
                              >
                                <Plus size={14} aria-hidden />
                                {createdInspectionActionLinks.includes(
                                  linkedInspectionId,
                                )
                                  ? "Action created"
                                  : "Create Action"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          </section>
        </div>
      </div>
      ) : (
        activeWorkspaceModule === "command-center" ? (
          <div className="relative z-10 min-h-screen w-full max-w-full min-w-0 box-border pt-[4.75rem] lg:pt-0">
            <OrbitCommandCenterModule
              userId={authUserId}
              darkMode={darkMode}
              workspaceSettings={workspaceSettings}
              notifications={notifications}
              onToggleTheme={toggleWorkspaceTheme}
              onNavigate={handleWorkspaceNavigationIntent}
              onOpenNotification={openNotification}
              onOpenNotificationCenter={openNotificationCenter}
            />
          </div>
        ) : activeWorkspaceModule === "action-tracker" ? (
          <ActionTrackerModule
            userId={authUserId}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
            createdBy={authProfile?.email ?? authProfile?.name ?? "Signed-in user"}
            navigationIntent={workspaceNavigationIntent}
            onNavigationIntentHandled={clearWorkspaceNavigationIntent}
          />
        ) : activeWorkspaceModule === "risk-assessments" ? (
          <RiskAssessmentsModule
            userId={authUserId}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
            createdBy={authProfile?.email ?? authProfile?.name ?? "Signed-in user"}
            navigationIntent={workspaceNavigationIntent}
            onNavigationIntentHandled={clearWorkspaceNavigationIntent}
          />
        ) : activeWorkspaceModule === "training-management" ? (
          <TrainingManagementModule
            userId={authUserId}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
            createdBy={authProfile?.email ?? authProfile?.name ?? "Signed-in user"}
            navigationIntent={workspaceNavigationIntent}
            onNavigationIntentHandled={clearWorkspaceNavigationIntent}
          />
        ) : activeWorkspaceModule === "incident-management" ? (
          <IncidentManagementModule
            userId={authUserId}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
            createdBy={authProfile?.email ?? authProfile?.name ?? "Signed-in user"}
            navigationIntent={workspaceNavigationIntent}
            onNavigationIntentHandled={clearWorkspaceNavigationIntent}
          />
        ) : activeWorkspaceModule === "hse-analytics" ? (
          <HseAnalyticsModule
            userId={authUserId}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
          />
        ) : activeWorkspaceModule === "settings" ? (
          <SettingsModule
            userId={authUserId}
            userEmail={authProfile?.email}
            darkMode={darkMode}
            onToggleTheme={toggleWorkspaceTheme}
            language={lang}
            onLanguageChange={updateWorkspaceLanguage}
            onSettingsChange={setWorkspaceSettings}
            navigationIntent={workspaceNavigationIntent}
            onNavigationIntentHandled={clearWorkspaceNavigationIntent}
          />
        ) : (
          renderComingSoonModule()
        )
      )}
      {/* CLEAN EXPORT VERSION (PREMIUM LABORIA PDF) */}
      {activeWorkspaceModule === "inspections" ? (
      <>
      <div
        id="clean-export"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "794px",
          background: "#F8FAFC",
          color: "#0F172A",
          padding: "34px",
          fontFamily: "NotoSansGeorgian, Arial, sans-serif",
        }}
      >
        <div
          style={{
            overflow: "hidden",
            borderRadius: "22px",
            border: "1px solid #D8E7F7",
            background: "#071225",
            color: "#ffffff",
            boxShadow: "0 24px 60px rgba(7,18,37,0.18)",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              padding: "24px 26px 26px",
              background:
                "radial-gradient(circle at 85% 18%, rgba(77,235,255,0.22), transparent 28%), linear-gradient(135deg, #071225 0%, #0B1A33 62%, #102B4E 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "22px",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "12px 16px",
                  width: "190px",
                  minHeight: "58px",
                  display: "flex",
                  alignItems: "center",
                  boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
                }}
              >
                <Image
                  src="/laboria-logo.png"
                  alt="Laboria"
                  width={168}
                  height={54}
                  style={{ width: "160px", height: "auto", objectFit: "contain" }}
                  priority
                />
              </div>

              <div
                style={{
                  textAlign: "right",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "#BEEFFF",
                }}
              >
                <div style={{ fontWeight: 800, letterSpacing: "0.08em" }}>
                  INSPECTION REPORT
                </div>
                <div>{t.date}</div>
                <div style={{ color: "#FFFFFF", fontWeight: 700 }}>
                  {inspectionDate || "Not provided"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "26px" }}>
              <div
                style={{
                  color: "#4DEBFF",
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Laboria HSE Workspace
              </div>

              <div
                style={{
                  marginTop: "8px",
                  maxWidth: "640px",
                  fontSize: "29px",
                  lineHeight: 1.16,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}
              >
                {reportTitle}
              </div>

              <div
                style={{
                  marginTop: "10px",
                  maxWidth: "560px",
                  color: "#D6E7F7",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                {reportSubtitle}
              </div>
            </div>
          </div>
        </div>

        {hasWorkspaceCompanyBranding ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              background: "#FFFFFF",
              border: "1px solid #D8E7F7",
              borderRadius: "18px",
              padding: "16px 18px",
              marginBottom: "22px",
              boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Client workspace
              </div>
              <div
                style={{
                  color: "#071225",
                  fontSize: "18px",
                  fontWeight: 900,
                  lineHeight: 1.25,
                }}
              >
                {workspaceCompanyName || company || "Company not provided"}
              </div>
              {workspaceCompanyDetails.length > 0 ? (
                <div
                  style={{
                    marginTop: "6px",
                    color: "#475569",
                    fontSize: "11px",
                    lineHeight: 1.55,
                  }}
                >
                  {workspaceCompanyDetails.join(" | ")}
                </div>
              ) : null}
            </div>
            {workspaceCompanyProfile.logoDataUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "132px",
                  minHeight: "62px",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  padding: "10px",
                }}
              >
                <Image
                  src={workspaceCompanyProfile.logoDataUrl}
                  alt={`${workspaceCompanyName || "Company"} logo`}
                  width={120}
                  height={58}
                  unoptimized
                  style={{
                    maxWidth: "112px",
                    maxHeight: "50px",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "22px",
          }}
        >
          {[
            { label: t.company, value: company || "Not provided" },
            { label: t.site, value: site || "Not provided" },
            { label: t.inspector, value: inspector || "Not provided" },
            { label: t.date, value: inspectionDate || "Not provided" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "16px",
                padding: "15px 16px",
                boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  color: "#64748B",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  color: "#0F172A",
                  fontSize: "14px",
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "14px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "18px",
              padding: "20px",
              boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
            }}
          >
            <div
              style={{
                color: "#64748B",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              {t.overallStatus}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div
                style={{
                  color: "#071225",
                  fontSize: "54px",
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                }}
              >
                {result.percent}%
              </div>

              <div
                style={{
                  padding: "9px 14px",
                  borderRadius: "999px",
                  background: compliancePalette.bg,
                  color: compliancePalette.text,
                  border: `1px solid ${compliancePalette.accent}`,
                  fontSize: "12px",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {compliancePalette.label}
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                height: "10px",
                borderRadius: "999px",
                background: "#E2E8F0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "10px",
                  borderRadius: "999px",
                  background: compliancePalette.accent,
                  width: `${result.percent}%`,
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: compliancePalette.soft,
              border: `1px solid ${compliancePalette.bg}`,
              borderRadius: "18px",
              padding: "20px",
            }}
          >
            <div
              style={{
                color: "#64748B",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "14px",
              }}
            >
              {t.riskSummaryTitle}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
              {[
                {
                  label: t.high,
                  value: riskSummary.high,
                  color: "#E11D48",
                  bg: "#FFF1F2",
                },
                {
                  label: t.medium,
                  value: riskSummary.medium,
                  color: "#F59E0B",
                  bg: "#FFFBEB",
                },
                {
                  label: t.low,
                  value: riskSummary.low,
                  color: "#16A34A",
                  bg: "#ECFDF5",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: "14px",
                    background: item.bg,
                    border: "1px solid rgba(148,163,184,0.22)",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: item.color,
                      fontSize: "24px",
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {activeChecklist.sections.map((sec, si) => (
          <div
            key={si}
            style={{
              marginBottom: "22px",
              pageBreakInside: "avoid",
              breakInside: "avoid",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                textTransform: inspectionLang === "EN" ? "uppercase" : "none",
                letterSpacing: inspectionLang === "EN" ? "0.07em" : "0",
                marginBottom: "10px",
                borderRadius: "14px",
                padding: "12px 14px",
                color: "#FFFFFF",
                background: "#0B1A33",
                boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
              }}
            >
              {inspectionLang === "EN" ? sec.sectionEN : sec.sectionKA}
            </div>

            {sec.items.map((q, qi) => {
              const id = `${si}-${qi}`;
              const status = answers[id] || "N/A";
              const answerBadge = getAnswerBadgePalette(status);
              const riskBadge = getRiskBadgePalette(
                status === "yes" || status === "no" ? risk[id] || "" : "",
              );
              const findingComment =
                status === "yes" || status === "no"
                  ? comments[id]?.trim()
                  : "";

              return (
                <div
                  key={id}
                  style={{
                    pageBreakInside: "avoid",
                    breakInside: "avoid",
                    marginBottom: "10px",
                    fontSize: "12px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "13px 14px",
                    boxShadow: "0 8px 20px rgba(15,23,42,0.035)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "18px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        color: "#0F172A",
                        fontSize: "12.5px",
                        lineHeight: 1.5,
                        fontWeight: 650,
                      }}
                    >
                      {inspectionLang === "EN" ? q.EN : q.KA}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "7px",
                        minWidth: "190px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background: answerBadge.bg,
                          border: `1px solid ${answerBadge.border}`,
                          color: answerBadge.color,
                          fontSize: "10px",
                          fontWeight: 900,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {answerBadge.label}
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background: riskBadge.bg,
                          border: `1px solid ${riskBadge.border}`,
                          color: riskBadge.color,
                          fontSize: "10px",
                          fontWeight: 900,
                        }}
                      >
                        {riskBadge.label}
                      </span>
                    </div>
                  </div>

                  {findingComment ? (
                    <div
                      style={{
                        marginTop: "10px",
                        color: "#475569",
                        fontSize: "12px",
                        lineHeight: 1.5,
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "9px 11px",
                      }}
                    >
                      <strong>{t.comments}:</strong> {findingComment}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className={`
    fixed bottom-8 right-8 z-50
    transition-all duration-500
    ${showFab ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"}
  `}
      >
        <button
          onClick={handleExportPDF}
          className={`
    fixed bottom-6 right-6
    w-12 h-12
    rounded-full
    flex items-center justify-center
    shadow-lg
    transition-all duration-300
    ${
      result.percent >= 90
        ? "bg-emerald-600 hover:bg-emerald-500"
        : result.percent >= 70
          ? "bg-amber-500 hover:bg-amber-400"
          : "bg-rose-600 hover:bg-rose-500"
    }
  `}
        >
          <span className="text-white text-lg">↓</span>
        </button>
      </div>

      {/* HISTORY SLIDE PANEL */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[320px]
          bg-[#0F172A] text-white
          shadow-2xl border-l border-white/10
          transform transition-transform duration-300 z-50
          ${showHistory ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="p-6 flex justify-between items-center border-b border-white/10">
          <h2 className="text-lg font-semibold">
            {inspectionLang === "KA"
              ? "ინსპექტირების ისტორია"
              : "Inspection History"}
          </h2>
          <button
            onClick={() => setShowHistory(false)}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto h-full">
          {historyNotice ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                historyNotice.type === "success"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-200"
              }`}
              role={historyNotice.type === "error" ? "alert" : "status"}
            >
              {historyNotice.message}
            </div>
          ) : null}

          {history.length === 0 && (
            <div className="text-sm opacity-60">
              {inspectionLang === "KA"
                ? "ისტორია ცარიელია"
                : "No saved inspections"}
            </div>
          )}

          {history.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="font-medium">{item.company || "Unnamed"}</div>

              <div className="text-xs opacity-60 mb-3">
                {item.inspectionDate}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadFromHistory(item)}
                  className="px-3 py-1 text-xs bg-blue-600 rounded-md"
                >
                  {inspectionLang === "KA" ? "ჩატვირთვა" : "Load"}
                </button>

                <button
                  onClick={() => deleteInspection(item.id)}
                  className="px-3 py-1 text-xs bg-red-600 rounded-md"
                >
                  {inspectionLang === "KA" ? "წაშლა" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
