"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  CreditCard,
  Database,
  Download,
  FileText,
  GraduationCap,
  Moon,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  defaultWorkspaceSettings,
  hasCompanyBranding,
  readWorkspaceSettings,
  workspaceModulePreferenceOptions,
  writeWorkspaceSettings,
  type CompanyProfileSettings,
  type ThemeModePreference,
  type WorkspaceLanguage,
  type WorkspaceModulePreference,
  type WorkspaceSettings,
} from "@/app/lib/workspaceSettings";
import type { WorkspaceNavigationIntent } from "@/app/lib/workspaceNavigation";
import OrbitAiModal from "@/app/components/OrbitAiModal";
import {
  getOrbitAiAccount,
  getOrbitAiTool,
  orbitAiAccountUpdatedEvent,
  type OrbitAiToolId,
} from "@/app/lib/orbitAi";

type SettingsSectionId =
  | "company-profile"
  | "workspace-preferences"
  | "risk-settings"
  | "action-tracker-settings"
  | "training-settings"
  | "incident-settings"
  | "data-export"
  | "billing-subscription"
  | "ai-intelligence";

type SettingsModuleProps = {
  userId: string | null;
  darkMode: boolean;
  onToggleTheme: () => void;
  language: WorkspaceLanguage;
  onLanguageChange: (language: WorkspaceLanguage) => void;
  onSettingsChange?: (settings: WorkspaceSettings) => void;
  navigationIntent?: WorkspaceNavigationIntent | null;
  onNavigationIntentHandled?: () => void;
};

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
};

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
};

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  disabled?: boolean;
};

type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

const settingsSections: SettingsSection[] = [
  {
    id: "company-profile",
    label: "Company Profile",
    description: "Organization identity and report branding.",
    icon: Building2,
  },
  {
    id: "workspace-preferences",
    label: "Workspace Preferences",
    description: "Theme, language, date formats, and defaults.",
    icon: Settings,
  },
  {
    id: "risk-settings",
    label: "Risk Settings",
    description: "5x5 matrix thresholds and review periods.",
    icon: ShieldCheck,
  },
  {
    id: "action-tracker-settings",
    label: "Action Tracker Settings",
    description: "Due dates, escalation, and overdue behavior.",
    icon: CheckCircle2,
  },
  {
    id: "training-settings",
    label: "Training Settings",
    description: "Validity, refreshers, and compliance thresholds.",
    icon: GraduationCap,
  },
  {
    id: "incident-settings",
    label: "Incident Settings",
    description: "Default status, escalation, and closure controls.",
    icon: TriangleAlert,
  },
  {
    id: "data-export",
    label: "Data & Export",
    description: "Workspace backup, export, and maintenance.",
    icon: Database,
  },
  {
    id: "billing-subscription",
    label: "Billing & Subscription",
    description: "Orbit plans and AI credit options.",
    icon: CreditCard,
  },
  {
    id: "ai-intelligence",
    label: "AI Intelligence",
    description: "Use Orbit AI tools and review credit requirements.",
    icon: Sparkles,
  },
];

const industryOptions = [
  { value: "", label: "Select industry / sector" },
  { value: "Construction", label: "Construction" },
  { value: "Warehouse & Logistics", label: "Warehouse & Logistics" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Healthcare & Medical Facilities", label: "Healthcare & Medical Facilities" },
  { value: "Oil & Gas", label: "Oil & Gas" },
  { value: "Energy & Utilities", label: "Energy & Utilities" },
  { value: "Chemical Industry", label: "Chemical Industry" },
  { value: "Other", label: "Other" },
];

const dateFormatOptions = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY" },
];

const timeFormatOptions = [
  { value: "24-hour", label: "24-hour" },
  { value: "12-hour", label: "12-hour" },
];

const incidentStatusOptions = [
  { value: "Reported", label: "Reported" },
  { value: "Investigation Open", label: "Investigation Open" },
  { value: "Actions Assigned", label: "Actions Assigned" },
  { value: "Pending Verification", label: "Pending Verification" },
];

const planCards = [
  {
    name: "Orbit Starter",
    price: "FREE",
    badge: "Current Plan",
    tone: "from-slate-500/18 to-slate-400/6",
    description: "Core HSE operations for small teams getting started with Laboria Orbit.",
    features: [
      "Full Action Tracker",
      "3 Inspection Templates: General, PPE, Fire",
      "1 Risk Assessment",
      "Training Management up to 5 Employees",
      "1 Incident Investigation per Month",
      "Full HSE Analytics Access",
      "0 AI Credits Included",
      "AI Top-Up available: 50 Credits for $7",
    ],
    buttonLabel: "Current Plan",
    current: true,
  },
  {
    name: "Orbit Plus",
    price: "$19",
    period: "/ month",
    badge: "Most Popular",
    tone: "from-[#1E90FF]/34 to-[#4DEBFF]/16",
    description: "Unlimited operational workflows for active HSE teams.",
    features: [
      "Full Action Tracker",
      "Unlimited Inspections",
      "Unlimited Risk Assessments",
      "Unlimited Training Management",
      "Unlimited Incident Workflows",
      "Full HSE Analytics",
      "100 AI Credits / Month Included",
      "Discounted AI Top-Ups: 100 Credits for $8",
    ],
    buttonLabel: "Upgrade to Plus",
    popular: true,
  },
  {
    name: "Orbit Pro",
    price: "$49",
    period: "/ month",
    badge: "AI Powered",
    tone: "from-violet-500/30 via-[#1E90FF]/18 to-[#4DEBFF]/12",
    description: "Advanced AI operations and enterprise intelligence for mature HSE programs.",
    features: [
      "Everything in Orbit Plus",
      "300 AI Credits / Month Included",
      "Advanced AI Operations",
      "Predictive AI Features",
      "Enterprise Intelligence",
      "Priority AI Processing",
      "Best AI Credit Pricing: 100 Credits for $5",
    ],
    buttonLabel: "Upgrade to Pro",
    premium: true,
  },
];

const aiCreditPacks = [
  {
    name: "Starter Top-Up",
    credits: "50 AI Credits",
    price: "$7",
    tone: "from-slate-500/16 to-slate-400/5",
  },
  {
    name: "Orbit Plus Discount Pack",
    credits: "100 AI Credits",
    price: "$8",
    tone: "from-[#1E90FF]/24 to-[#4DEBFF]/10",
    badge: "Plus",
  },
  {
    name: "Orbit Pro Best Value Pack",
    credits: "100 AI Credits",
    price: "$5",
    tone: "from-violet-500/26 to-[#4DEBFF]/12",
    badge: "Best Value",
  },
];

const aiCards = [
  {
    toolId: "toolbox-talk" as const,
    title: "AI Toolbox Talks",
    description: "Generate targeted toolbox talk drafts from operational risks.",
    icon: FileText,
  },
  {
    toolId: "incident-investigation" as const,
    title: "AI Incident Investigation Assistant",
    description: "Guide investigation notes, cause analysis, and follow-up quality.",
    icon: TriangleAlert,
  },
  {
    toolId: "corrective-actions" as const,
    title: "AI Corrective Action Recommendations",
    description: "Suggest practical corrective and preventive action structures.",
    icon: CheckCircle2,
  },
  {
    toolId: "risk-assessment-basic" as const,
    title: "AI Risk Assessment Helper",
    description: "Support hazard identification and control hierarchy selection.",
    icon: ShieldCheck,
  },
  {
    toolId: "inspection-analysis" as const,
    title: "AI Inspection Analysis",
    description: "Summarize recurring checklist findings and weak controls.",
    icon: BarChart3,
  },
  {
    toolId: "risk-trends" as const,
    title: "AI Trend Detection",
    description: "Identify emerging risk patterns across modules.",
    icon: Cpu,
  },
  {
    toolId: "predictive-warning" as const,
    title: "AI Predictive Risk Warnings",
    description: "Surface early warning indicators before escalation.",
    icon: Sparkles,
  },
  {
    toolId: "document-generation" as const,
    title: "AI Document Generation",
    description: "Prepare professional HSE documents from verified workspace data.",
    icon: FileText,
  },
  {
    toolId: "compliance-assistant" as const,
    title: "AI Compliance Assistant",
    description: "Future compliance support for policy and evidence workflows.",
    icon: Bot,
  },
];

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const getTheme = (darkMode: boolean) => ({
  page: darkMode ? "text-[#F5F7FA]" : "text-slate-950",
  shell: darkMode
    ? "border-white/10 bg-[#071225]/88 shadow-[0_30px_110px_rgba(0,0,0,0.34)]"
    : "border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)]",
  panel: darkMode
    ? "border-white/10 bg-white/[0.045]"
    : "border-slate-200 bg-white",
  panelSoft: darkMode
    ? "border-white/10 bg-white/[0.03]"
    : "border-slate-200 bg-slate-50",
  nav: darkMode
    ? "border-white/10 bg-[#061124]/80"
    : "border-slate-200 bg-slate-50",
  navButton: (active: boolean) =>
    active
      ? darkMode
        ? "border-[#4DEBFF]/35 bg-[#1E90FF]/16 text-white shadow-[0_14px_40px_rgba(30,144,255,0.16)]"
        : "border-[#1E90FF]/30 bg-[#1E90FF]/10 text-[#071225] shadow-[0_14px_34px_rgba(30,144,255,0.12)]"
      : darkMode
        ? "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950",
  heading: darkMode ? "text-white" : "text-slate-950",
  muted: darkMode ? "text-slate-400" : "text-slate-600",
  soft: darkMode ? "text-slate-300" : "text-slate-700",
  label: darkMode ? "text-slate-400" : "text-slate-500",
  input: darkMode
    ? "border-white/10 bg-[#071225]/72 text-white placeholder:text-slate-500 focus:border-[#4DEBFF]/55 focus:ring-[#4DEBFF]/20"
    : "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-[#1E90FF]/55 focus:ring-[#1E90FF]/15",
  buttonGhost: darkMode
    ? "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
    : "border-slate-200 bg-white text-slate-800 hover:border-[#1E90FF]/30 hover:bg-[#1E90FF]/5",
  destructive: darkMode
    ? "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  badge: darkMode
    ? "border-[#4DEBFF]/30 bg-[#4DEBFF]/10 text-[#DDFBFF]"
    : "border-[#1E90FF]/25 bg-[#1E90FF]/10 text-[#0759A8]",
});

const cloneSettings = (settings: WorkspaceSettings): WorkspaceSettings =>
  JSON.parse(JSON.stringify(settings)) as WorkspaceSettings;

const readBrowserWorkspaceData = (): Record<string, unknown> => {
  if (typeof window === "undefined") {
    return {};
  }

  return Object.fromEntries(
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("laboria_"))
      .map((key) => {
        const value = window.localStorage.getItem(key);

        try {
          return [key, value ? JSON.parse(value) : null];
        } catch {
          return [key, value];
        }
      }),
  );
};

export default function SettingsModule({
  userId,
  darkMode,
  onToggleTheme,
  language,
  onLanguageChange,
  onSettingsChange,
  navigationIntent,
  onNavigationIntentHandled,
}: SettingsModuleProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("company-profile");
  const [settings, setSettings] = useState<WorkspaceSettings>(
    defaultWorkspaceSettings,
  );
  const [notice, setNotice] = useState("Settings are ready.");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeAiToolId, setActiveAiToolId] = useState<OrbitAiToolId | null>(null);
  const [aiAccount, setAiAccount] = useState(() => getOrbitAiAccount(userId));
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const theme = getTheme(darkMode);

  useEffect(() => {
    const storedSettings = readWorkspaceSettings(userId);
    const alignedSettings: WorkspaceSettings = {
      ...storedSettings,
      preferences: {
        ...storedSettings.preferences,
        language,
        themeMode: darkMode ? "dark" : "light",
      },
    };

    setSettings(alignedSettings);
  }, [darkMode, language, userId]);

  useEffect(() => {
    const syncAiAccount = () => setAiAccount(getOrbitAiAccount(userId));

    syncAiAccount();
    window.addEventListener(orbitAiAccountUpdatedEvent, syncAiAccount);

    return () => {
      window.removeEventListener(orbitAiAccountUpdatedEvent, syncAiAccount);
    };
  }, [userId]);

  useEffect(() => {
    if (!navigationIntent || navigationIntent.moduleId !== "settings") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveSection(
        navigationIntent.action === "billing"
          ? "billing-subscription"
          : "ai-intelligence",
      );
      onNavigationIntentHandled?.();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [navigationIntent, onNavigationIntentHandled]);

  const persistSettings = (nextSettings: WorkspaceSettings, message?: string) => {
    writeWorkspaceSettings(userId, nextSettings);
    setSettings(nextSettings);
    onSettingsChange?.(nextSettings);

    if (message) {
      setNotice(message);
    }
  };

  const updateSettings = (
    updater: (current: WorkspaceSettings) => WorkspaceSettings,
    message = "Settings saved.",
  ) => {
    const nextSettings = updater(cloneSettings(settings));
    persistSettings(nextSettings, message);
  };

  const updateCompanyProfile = (
    key: keyof CompanyProfileSettings,
    value: string,
  ) => {
    updateSettings((current) => ({
      ...current,
      companyProfile: {
        ...current.companyProfile,
        [key]: value,
      },
    }));
  };

  const updatePreference = <T extends keyof WorkspaceSettings["preferences"]>(
    key: T,
    value: WorkspaceSettings["preferences"][T],
  ) => {
    updateSettings((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
      },
    }));
  };

  const updateThemePreference = (value: ThemeModePreference) => {
    if ((value === "dark") !== darkMode) {
      onToggleTheme();
    }

    updatePreference("themeMode", value);
  };

  const updateLanguagePreference = (value: WorkspaceLanguage) => {
    onLanguageChange(value);
    updatePreference("language", value);
  };

  const handleLogoUpload = (fileList: FileList | null) => {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file for the company logo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        setNotice("Could not read the selected logo file.");
        return;
      }

      updateCompanyProfile("logoDataUrl", result);
      setNotice("Company logo saved.");
    };
    reader.readAsDataURL(file);
  };

  const workspaceData = readBrowserWorkspaceData();
  const dataKeyCount = Object.keys(workspaceData).length;

  const downloadWorkspaceData = (filePrefix: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      product: "Laboria HSE Workspace",
      userScoped: Boolean(userId),
      settings,
      localStorage: workspaceData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Workspace export prepared.");
  };

  const clearDemoData = () => {
    if (typeof window === "undefined") {
      return;
    }

    const demoKeys = Object.keys(window.localStorage).filter((key) => {
      const normalizedKey = key.toLowerCase();
      return normalizedKey.includes("demo") || normalizedKey.includes("test");
    });

    demoKeys.forEach((key) => window.localStorage.removeItem(key));
    setShowClearConfirm(false);
    setNotice(
      demoKeys.length > 0
        ? `Cleared ${demoKeys.length} demo/test data item${demoKeys.length === 1 ? "" : "s"}.`
        : "No demo/test data was found.",
    );
  };

  const renderCompanyProfile = () => (
    <SettingsCard
      title="Company Profile"
      description="Brand the workspace and future exports with your organization identity."
      icon={Building2}
      theme={theme}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Company Name"
            value={settings.companyProfile.companyName}
            onChange={(value) => updateCompanyProfile("companyName", value)}
            placeholder="Enter company name"
          />
          <SelectInput
            label="Industry/Sector"
            value={settings.companyProfile.industrySector}
            onChange={(value) => updateCompanyProfile("industrySector", value)}
            options={industryOptions}
          />
          <Field
            label="Main Site/Location"
            value={settings.companyProfile.mainSiteLocation}
            onChange={(value) => updateCompanyProfile("mainSiteLocation", value)}
            placeholder="Head office, plant, project, or site"
          />
          <Field
            label="Contact Email"
            value={settings.companyProfile.contactEmail}
            onChange={(value) => updateCompanyProfile("contactEmail", value)}
            placeholder="hse@example.com"
            type="email"
          />
          <Field
            label="Phone"
            value={settings.companyProfile.phone}
            onChange={(value) => updateCompanyProfile("phone", value)}
            placeholder="+995 ..."
          />
          <Field
            label="Address"
            value={settings.companyProfile.address}
            onChange={(value) => updateCompanyProfile("address", value)}
            placeholder="Company address"
            multiline
          />
        </div>

        <div className={joinClasses("rounded-3xl border p-5", theme.panelSoft)}>
          <div
            className={joinClasses(
              "flex min-h-36 items-center justify-center rounded-2xl border border-dashed p-5",
              darkMode
                ? "border-white/10 bg-[#071225]/70"
                : "border-slate-200 bg-white",
            )}
          >
            {settings.companyProfile.logoDataUrl ? (
              <Image
                src={settings.companyProfile.logoDataUrl}
                alt="Company logo"
                width={220}
                height={96}
                unoptimized
                className="max-h-24 w-auto object-contain"
              />
            ) : (
              <div className="text-center">
                <Building2
                  size={34}
                  className="mx-auto text-[#1E90FF]"
                  aria-hidden
                />
                <div className={joinClasses("mt-3 text-sm font-semibold", theme.soft)}>
                  Company logo
                </div>
                <div className={joinClasses("mt-1 text-xs", theme.muted)}>
                  Used in workspace branding and future exports.
                </div>
              </div>
            )}
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleLogoUpload(event.target.files)}
          />

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className={joinClasses(
                "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                theme.buttonGhost,
              )}
            >
              <Upload size={16} aria-hidden />
              Upload Company Logo
            </button>
            {settings.companyProfile.logoDataUrl ? (
              <button
                type="button"
                onClick={() => updateCompanyProfile("logoDataUrl", "")}
                className={joinClasses(
                  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  theme.destructive,
                )}
              >
                <Trash2 size={16} aria-hidden />
                Remove Logo
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </SettingsCard>
  );

  const renderWorkspacePreferences = () => (
    <SettingsCard
      title="Workspace Preferences"
      description="Control global workspace behavior and operator preferences."
      icon={Settings}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={joinClasses("rounded-2xl border p-4", theme.panelSoft)}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={joinClasses("text-sm font-semibold", theme.heading)}>
                Light / Dark Mode
              </div>
              <div className={joinClasses("mt-1 text-xs leading-5", theme.muted)}>
                Switch the complete workspace theme.
              </div>
            </div>
            <div className="flex rounded-xl border border-[#1E90FF]/25 bg-[#1E90FF]/10 p-1">
              {(["light", "dark"] as const).map((mode) => {
                const isActive = settings.preferences.themeMode === mode;
                const Icon = mode === "dark" ? Moon : Sun;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateThemePreference(mode)}
                    className={joinClasses(
                      "inline-flex h-10 w-10 items-center justify-center rounded-lg transition",
                      isActive
                        ? "bg-[#1E90FF] text-white"
                        : darkMode
                          ? "text-slate-300 hover:bg-white/10"
                          : "text-slate-600 hover:bg-white",
                    )}
                    aria-label={`Switch to ${mode} mode`}
                  >
                    <Icon size={17} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <SelectInput
          label="Language selector"
          value={settings.preferences.language}
          onChange={(value) =>
            updateLanguagePreference(value === "KA" ? "KA" : "EN")
          }
          options={[
            { value: "EN", label: "English" },
            { value: "KA", label: "Georgian" },
          ]}
        />
        <SelectInput
          label="Date format"
          value={settings.preferences.dateFormat}
          onChange={(value) => updatePreference("dateFormat", value)}
          options={dateFormatOptions}
        />
        <SelectInput
          label="Time format"
          value={settings.preferences.timeFormat}
          onChange={(value) => updatePreference("timeFormat", value)}
          options={timeFormatOptions}
        />
        <SelectInput
          label="Default dashboard page"
          value={settings.preferences.defaultDashboardPage}
          onChange={(value) =>
            updatePreference(
              "defaultDashboardPage",
              value as WorkspaceModulePreference,
            )
          }
          options={workspaceModulePreferenceOptions}
        />
        <ToggleInput
          label="Sidebar collapsed by default"
          description="Future-ready preference for compact desktop workspaces."
          checked={settings.preferences.sidebarCollapsedByDefault}
          onChange={(checked) =>
            updatePreference("sidebarCollapsedByDefault", checked)
          }
        />
      </div>
    </SettingsCard>
  );

  const renderRiskSettings = () => (
    <SettingsCard
      title="Risk Settings"
      description="Keep the current 5x5 matrix locked while preparing enterprise thresholds."
      icon={ShieldCheck}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Risk Matrix Type" value="5x5 Matrix" onChange={() => undefined} disabled />
        <NumberField
          label="Default risk review period"
          value={settings.riskSettings.defaultReviewPeriodDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              riskSettings: {
                ...current.riskSettings,
                defaultReviewPeriodDays: value,
              },
            }))
          }
          suffix="days"
          min={1}
        />
        <NumberField
          label="High risk threshold"
          value={settings.riskSettings.highRiskThreshold}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              riskSettings: { ...current.riskSettings, highRiskThreshold: value },
            }))
          }
          suffix="score"
          min={1}
        />
        <NumberField
          label="Residual risk warning threshold"
          value={settings.riskSettings.residualRiskWarningThreshold}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              riskSettings: {
                ...current.riskSettings,
                residualRiskWarningThreshold: value,
              },
            }))
          }
          suffix="score"
          min={1}
        />
      </div>
      <InfoStrip theme={theme}>
        Risk score remains Probability x Severity. Scores 1-3 are Low, 4-12 are
        Medium, and 15-25 are High.
      </InfoStrip>
    </SettingsCard>
  );

  const renderActionTrackerSettings = () => (
    <SettingsCard
      title="Action Tracker Settings"
      description="Standardize operational due dates, escalation windows, and closure behavior."
      icon={CheckCircle2}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <NumberField
          label="Default action due days"
          value={settings.actionTrackerSettings.defaultDueDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              actionTrackerSettings: {
                ...current.actionTrackerSettings,
                defaultDueDays: value,
              },
            }))
          }
          suffix="days"
          min={1}
        />
        <NumberField
          label="Critical action escalation threshold"
          value={settings.actionTrackerSettings.criticalEscalationThresholdDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              actionTrackerSettings: {
                ...current.actionTrackerSettings,
                criticalEscalationThresholdDays: value,
              },
            }))
          }
          suffix="days"
          min={0}
        />
        <NumberField
          label="Overdue warning threshold"
          value={settings.actionTrackerSettings.overdueWarningThresholdDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              actionTrackerSettings: {
                ...current.actionTrackerSettings,
                overdueWarningThresholdDays: value,
              },
            }))
          }
          suffix="days"
          min={0}
        />
        <ToggleInput
          label="Auto-close completed actions"
          description="Keep OFF by default so HSE managers can verify closure quality."
          checked={settings.actionTrackerSettings.autoCloseCompletedActions}
          onChange={(checked) =>
            updateSettings((current) => ({
              ...current,
              actionTrackerSettings: {
                ...current.actionTrackerSettings,
                autoCloseCompletedActions: checked,
              },
            }))
          }
        />
      </div>
    </SettingsCard>
  );

  const renderTrainingSettings = () => (
    <SettingsCard
      title="Training Settings"
      description="Control compliance windows and default validity assumptions."
      icon={GraduationCap}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <NumberField
          label="Expiring Soon threshold"
          value={settings.trainingSettings.expiringSoonThresholdDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              trainingSettings: {
                ...current.trainingSettings,
                expiringSoonThresholdDays: value,
              },
            }))
          }
          suffix="days"
          min={1}
        />
        <NumberField
          label="Default training validity period"
          value={settings.trainingSettings.defaultValidityMonths}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              trainingSettings: {
                ...current.trainingSettings,
                defaultValidityMonths: value,
              },
            }))
          }
          suffix="months"
          min={1}
        />
        <NumberField
          label="Refresher reminder threshold"
          value={settings.trainingSettings.refresherReminderThresholdDays}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              trainingSettings: {
                ...current.trainingSettings,
                refresherReminderThresholdDays: value,
              },
            }))
          }
          suffix="days"
          min={1}
        />
        <ToggleInput
          label="Mandatory training logic"
          description="Placeholder for role-based training rule enforcement."
          checked={settings.trainingSettings.mandatoryTrainingLogicEnabled}
          onChange={(checked) =>
            updateSettings((current) => ({
              ...current,
              trainingSettings: {
                ...current.trainingSettings,
                mandatoryTrainingLogicEnabled: checked,
              },
            }))
          }
        />
      </div>
    </SettingsCard>
  );

  const renderIncidentSettings = () => (
    <SettingsCard
      title="Incident Settings"
      description="Tune investigation defaults, escalation expectations, and closure control."
      icon={TriangleAlert}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SelectInput
          label="Default incident status"
          value={settings.incidentSettings.defaultIncidentStatus}
          onChange={(value) =>
            updateSettings((current) => ({
              ...current,
              incidentSettings: {
                ...current.incidentSettings,
                defaultIncidentStatus: value,
              },
            }))
          }
          options={incidentStatusOptions}
        />
        <ToggleInput
          label="High severity escalation"
          description="Flag high and critical incidents for management attention."
          checked={settings.incidentSettings.highSeverityEscalationEnabled}
          onChange={(checked) =>
            updateSettings((current) => ({
              ...current,
              incidentSettings: {
                ...current.incidentSettings,
                highSeverityEscalationEnabled: checked,
              },
            }))
          }
        />
        <ToggleInput
          label="Mandatory corrective action"
          description="Future-ready control for requiring action creation before closure."
          checked={settings.incidentSettings.mandatoryCorrectiveActionEnabled}
          onChange={(checked) =>
            updateSettings((current) => ({
              ...current,
              incidentSettings: {
                ...current.incidentSettings,
                mandatoryCorrectiveActionEnabled: checked,
              },
            }))
          }
        />
        <ToggleInput
          label="Closure verification required"
          description="Keep verification gates visible for investigation closeout quality."
          checked={settings.incidentSettings.closureVerificationRequired}
          onChange={(checked) =>
            updateSettings((current) => ({
              ...current,
              incidentSettings: {
                ...current.incidentSettings,
                closureVerificationRequired: checked,
              },
            }))
          }
        />
      </div>
    </SettingsCard>
  );

  const renderDataExport = () => (
    <SettingsCard
      title="Data & Export"
      description="Export workspace data and keep operational backups without changing live workflows."
      icon={Database}
      theme={theme}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionTile
          title="Export all workspace data"
          description={`${dataKeyCount} Laboria data set${dataKeyCount === 1 ? "" : "s"} detected in this browser.`}
          icon={Download}
          onClick={() => downloadWorkspaceData("laboria_workspace_export")}
          theme={theme}
        />
        <ActionTile
          title="Backup workspace"
          description="Download a dated JSON backup for safekeeping."
          icon={Database}
          onClick={() => downloadWorkspaceData("laboria_workspace_backup")}
          theme={theme}
        />
        <ActionTile
          title="Clear demo/test data"
          description="Remove only local keys that are clearly marked demo or test."
          icon={Trash2}
          onClick={() => setShowClearConfirm(true)}
          theme={theme}
          destructive
        />
        <ActionTile
          title="Import data"
          description="Future-safe import workflow placeholder."
          icon={Upload}
          onClick={() => setNotice("Import data will be available in a future release.")}
          theme={theme}
          disabled
        />
      </div>
    </SettingsCard>
  );

  const renderBilling = () => (
    <SettingsCard
      title="Billing & Subscription"
      description="Choose the Orbit plan that fits your health and safety operations, AI usage, and team size."
      icon={CreditCard}
      theme={theme}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div
          className={joinClasses(
            "relative overflow-hidden rounded-3xl border p-5",
            darkMode
              ? "border-[#4DEBFF]/20 bg-[#061124]/84 shadow-[0_18px_60px_rgba(77,235,255,0.08)]"
              : "border-[#1E90FF]/20 bg-white shadow-[0_18px_50px_rgba(30,144,255,0.09)]",
          )}
        >
          <div className="absolute right-[-3rem] top-[-3rem] h-36 w-36 rounded-full bg-[#4DEBFF]/14 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={joinClasses(
                    "text-xs font-bold uppercase tracking-[0.18em]",
                    theme.label,
                  )}
                >
                  Current AI Credits
                </div>
                <div className={joinClasses("mt-3 text-4xl font-bold", theme.heading)}>
                  {aiAccount.credits}
                </div>
                <div className={joinClasses("mt-1 text-sm font-semibold", theme.soft)}>
                  Credits Available
                </div>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/25 bg-[#1E90FF]/15 text-[#4DEBFF]">
                <Sparkles size={22} aria-hidden />
              </span>
            </div>
            <div className={joinClasses("mt-5 rounded-2xl border p-4", theme.panelSoft)}>
              <div className={joinClasses("text-xs font-bold uppercase tracking-[0.16em]", theme.label)}>
                Current Plan
              </div>
              <div className={joinClasses("mt-2 text-lg font-bold", theme.heading)}>
                {aiAccount.plan}
              </div>
              <p className={joinClasses("mt-2 text-sm leading-6", theme.muted)}>
                Billing actions are UI-only for now. Payment processing and
                live credit accounting will be connected later.
              </p>
            </div>
          </div>
        </div>

        <div className={joinClasses("rounded-3xl border p-5", theme.panelSoft)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className={joinClasses("text-lg font-bold", theme.heading)}>
                Laboria Orbit SaaS Plans
              </div>
              <p className={joinClasses("mt-2 max-w-2xl text-sm leading-6", theme.muted)}>
                Start with operational HSE tools, then scale into monthly AI
                credits and advanced intelligence features as usage grows.
              </p>
            </div>
            <span
              className={joinClasses(
                "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]",
                theme.badge,
              )}
            >
              Payments not connected
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {planCards.map((plan) => (
          <div
            key={plan.name}
            className={joinClasses(
              "relative overflow-hidden rounded-3xl border p-5 transition hover:-translate-y-0.5",
              theme.panel,
              plan.popular &&
                (darkMode
                  ? "border-[#4DEBFF]/40 shadow-[0_22px_80px_rgba(77,235,255,0.12)]"
                  : "border-[#1E90FF]/35 shadow-[0_22px_70px_rgba(30,144,255,0.14)]"),
              plan.premium &&
                (darkMode
                  ? "border-violet-300/30 shadow-[0_22px_80px_rgba(139,92,246,0.12)]"
                  : "border-violet-300/45 shadow-[0_22px_70px_rgba(139,92,246,0.12)]"),
            )}
          >
            <div
              className={`absolute inset-x-0 top-0 h-36 bg-gradient-to-br ${plan.tone}`}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={joinClasses("text-xl font-bold", theme.heading)}>
                    {plan.name}
                  </div>
                  <div
                    className={joinClasses(
                      "mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                      theme.badge,
                    )}
                  >
                    {plan.badge}
                  </div>
                </div>
                {plan.premium ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/12 text-violet-300">
                    <Cpu size={19} aria-hidden />
                  </span>
                ) : plan.popular ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/28 bg-[#1E90FF]/16 text-[#4DEBFF]">
                    <Sparkles size={19} aria-hidden />
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className={joinClasses("text-4xl font-bold tracking-tight", theme.heading)}>
                  {plan.price}
                </span>
                {plan.period ? (
                  <span className={joinClasses("pb-1 text-sm font-semibold", theme.muted)}>
                    {plan.period}
                  </span>
                ) : null}
              </div>
              {plan.premium ? (
                <div className="mt-3 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
                  Best for advanced operations
                </div>
              ) : null}
              <p className={joinClasses("mt-4 min-h-12 text-sm leading-6", theme.muted)}>
                {plan.description}
              </p>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    className={joinClasses("flex items-start gap-2 text-sm", theme.soft)}
                  >
                    <CheckCircle2
                      size={15}
                      className="mt-0.5 shrink-0 text-emerald-400"
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotice(
                    plan.current
                      ? "Orbit Starter is the current plan."
                      : "Plan upgrades are UI-only for now. Payments are not connected yet.",
                  )
                }
                className={joinClasses(
                  "mt-6 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  plan.popular
                    ? "border-[#1E90FF] bg-[#1E90FF] text-white hover:bg-[#1878d6]"
                    : plan.premium
                      ? "border-violet-400/45 bg-violet-500/18 text-violet-100 hover:bg-violet-500/24"
                    : theme.buttonGhost,
                )}
              >
                {plan.buttonLabel}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className={joinClasses("text-xl font-bold", theme.heading)}>
              AI Credit Packs
            </h3>
            <p className={joinClasses("mt-2 max-w-3xl text-sm leading-6", theme.muted)}>
              AI credits are used for AI toolbox talks, risk assessment
              generation, incident assistance, corrective action recommendations,
              inspection analysis, and document generation.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {aiCreditPacks.map((pack) => (
          <div
            key={pack.name}
            className={joinClasses("relative overflow-hidden rounded-3xl border p-5", theme.panel)}
          >
            <div
              className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${pack.tone}`}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={joinClasses("text-base font-bold", theme.heading)}>
                    {pack.name}
                  </div>
                  {pack.badge ? (
                    <div
                      className={joinClasses(
                        "mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                        theme.badge,
                      )}
                    >
                      {pack.badge}
                    </div>
                  ) : null}
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/25 bg-[#1E90FF]/12 text-[#4DEBFF]">
                  <CreditCard size={18} aria-hidden />
                </span>
              </div>
              <div className={joinClasses("mt-5 text-2xl font-bold", theme.heading)}>
                {pack.credits}
              </div>
              <div className={joinClasses("mt-1 text-lg font-semibold", theme.soft)}>
                {pack.price}
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotice("AI credit purchases are UI-only for now. Payments are not connected yet.")
                }
                className={joinClasses(
                  "mt-5 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  theme.buttonGhost,
                )}
              >
                Buy Credits
              </button>
            </div>
          </div>
          ))}
        </div>
      </div>
    </SettingsCard>
  );

  const renderAiIntelligence = () => (
    <SettingsCard
      title="AI Intelligence"
      description="Explore Orbit AI workflows and credit requirements. AI Toolbox Talks are now available; the remaining tools stay in preview mode."
      icon={Sparkles}
      theme={theme}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {aiCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              type="button"
              key={card.title}
              onClick={() => setActiveAiToolId(card.toolId)}
              className={joinClasses(
                "group relative overflow-hidden rounded-3xl border p-5 text-left transition hover:-translate-y-0.5",
                darkMode
                  ? "border-[#4DEBFF]/18 bg-[#061124]/82 shadow-[0_18px_60px_rgba(77,235,255,0.06)]"
                  : "border-[#1E90FF]/20 bg-white shadow-[0_18px_50px_rgba(30,144,255,0.09)]",
              )}
            >
              <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#4DEBFF]/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#4DEBFF]/25 bg-[#1E90FF]/15 text-[#4DEBFF]">
                    <Icon size={21} aria-hidden />
                  </span>
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                    Enterprise AI
                  </span>
                </div>
                <h3 className={joinClasses("mt-4 text-base font-bold", theme.heading)}>
                  {card.title}
                </h3>
                <p className={joinClasses("mt-2 text-sm leading-6", theme.muted)}>
                  {card.description}
                </p>
                <div
                  className={joinClasses(
                    "mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                    theme.badge,
                  )}
                >
                  {getOrbitAiTool(card.toolId).creditLabel} /{" "}
                  Live
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "company-profile":
        return renderCompanyProfile();
      case "workspace-preferences":
        return renderWorkspacePreferences();
      case "risk-settings":
        return renderRiskSettings();
      case "action-tracker-settings":
        return renderActionTrackerSettings();
      case "training-settings":
        return renderTrainingSettings();
      case "incident-settings":
        return renderIncidentSettings();
      case "data-export":
        return renderDataExport();
      case "billing-subscription":
        return renderBilling();
      case "ai-intelligence":
        return renderAiIntelligence();
      default:
        return null;
    }
  };

  return (
    <div
      className={joinClasses(
        "relative z-10 min-h-screen w-full min-w-0 px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-10 lg:py-10",
        theme.page,
      )}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className={joinClasses("overflow-hidden rounded-3xl border backdrop-blur-2xl", theme.shell)}>
          <div className="border-b border-inherit px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DEBFF]">
                  Enterprise configuration center
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Settings
                </h1>
                <p className={joinClasses("mt-2 max-w-3xl text-sm leading-6", theme.muted)}>
                  Configure company branding, workspace preferences, operational
                  thresholds, export controls, subscription architecture, and
                  future AI intelligence for Laboria HSE Workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={joinClasses("rounded-full border px-3 py-1.5 text-xs font-bold", theme.badge)}>
                  {hasCompanyBranding(settings)
                    ? "Company branding active"
                    : "Laboria branding active"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    persistSettings(settings, "Settings saved successfully.")
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E90FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(30,144,255,0.24)] transition hover:bg-[#1878d6]"
                >
                  <Save size={16} aria-hidden />
                  Save Settings
                </button>
              </div>
            </div>

            <div className={joinClasses("mt-4 rounded-xl border px-4 py-3 text-sm font-semibold", theme.panelSoft)}>
              {notice}
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[20rem_1fr]">
            <aside
              className={joinClasses(
                "border-b p-4 xl:border-b-0 xl:border-r",
                darkMode ? "border-white/10" : "border-slate-200",
                theme.nav,
              )}
            >
              <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={joinClasses(
                        "flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                        theme.navButton(isActive),
                      )}
                    >
                      <span
                        className={joinClasses(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          isActive
                            ? "bg-[#1E90FF] text-white"
                            : "bg-[#1E90FF]/10 text-[#4DEBFF]",
                        )}
                      >
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {section.label}
                        </span>
                        <span className={joinClasses("mt-1 block text-xs leading-5", theme.muted)}>
                          {section.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <main className="min-w-0 p-5 sm:p-7">{renderActiveSection()}</main>
          </div>
        </div>
      </div>

      {showClearConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className={joinClasses("w-full max-w-md rounded-3xl border p-6 shadow-2xl", theme.shell)}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-400 ring-1 ring-rose-400/25">
                <Trash2 size={20} aria-hidden />
              </span>
              <div>
                <h2 className={joinClasses("text-lg font-bold", theme.heading)}>
                  Clear demo/test data?
                </h2>
                <p className={joinClasses("mt-2 text-sm leading-6", theme.muted)}>
                  This only removes local storage keys clearly marked demo or
                  test. Live workspace records are left untouched.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className={joinClasses(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  theme.buttonGhost,
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearDemoData}
                className={joinClasses(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition",
                  theme.destructive,
                )}
              >
                Clear demo/test data
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <OrbitAiModal
        darkMode={darkMode}
        userId={userId}
        toolId={activeAiToolId}
        sourceModule="AI Intelligence"
        onClose={() => setActiveAiToolId(null)}
      />
    </div>
  );

  function Field({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    multiline = false,
    disabled = false,
  }: FieldProps) {
    const baseClass = joinClasses(
      "w-full rounded-xl border px-4 py-3 text-sm outline-none ring-2 ring-transparent transition disabled:cursor-not-allowed disabled:opacity-70",
      theme.input,
    );

    return (
      <label className="block">
        <span className={joinClasses("mb-2 block text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
          {label}
        </span>
        {multiline ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className={joinClasses(baseClass, "resize-y leading-6")}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={baseClass}
          />
        )}
      </label>
    );
  }

  function SelectInput({
    label,
    value,
    onChange,
    options,
    disabled = false,
  }: SelectProps) {
    return (
      <label className="block">
        <span className={joinClasses("mb-2 block text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
          {label}
        </span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={joinClasses(
            "w-full rounded-xl border px-4 py-3 text-sm outline-none ring-2 ring-transparent transition disabled:cursor-not-allowed disabled:opacity-70",
            theme.input,
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function NumberField({
    label,
    value,
    onChange,
    suffix,
    min = 0,
    disabled = false,
  }: NumberFieldProps) {
    return (
      <label className="block">
        <span className={joinClasses("mb-2 block text-xs font-bold uppercase tracking-[0.14em]", theme.label)}>
          {label}
        </span>
        <div className="relative">
          <input
            type="number"
            min={min}
            value={value}
            onChange={(event) =>
              onChange(Math.max(min, Number(event.target.value) || min))
            }
            disabled={disabled}
            className={joinClasses(
              "w-full rounded-xl border px-4 py-3 text-sm outline-none ring-2 ring-transparent transition disabled:cursor-not-allowed disabled:opacity-70",
              suffix ? "pr-20" : "",
              theme.input,
            )}
          />
          {suffix ? (
            <span className={joinClasses("pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold", theme.muted)}>
              {suffix}
            </span>
          ) : null}
        </div>
      </label>
    );
  }

  function ToggleInput({
    label,
    description,
    checked,
    onChange,
    disabled = false,
  }: ToggleProps) {
    return (
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={joinClasses(
          "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70",
          theme.panelSoft,
        )}
      >
        <span>
          <span className={joinClasses("block text-sm font-semibold", theme.heading)}>
            {label}
          </span>
          <span className={joinClasses("mt-1 block text-xs leading-5", theme.muted)}>
            {description}
          </span>
        </span>
        <span
          className={joinClasses(
            "relative h-7 w-12 shrink-0 rounded-full border transition",
            checked
              ? "border-[#1E90FF] bg-[#1E90FF]"
              : darkMode
                ? "border-white/10 bg-white/10"
                : "border-slate-200 bg-slate-200",
          )}
        >
          <span
            className={joinClasses(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
              checked ? "left-6" : "left-1",
            )}
          />
        </span>
      </button>
    );
  }

  function SettingsCard({
    title,
    description,
    icon: Icon,
    children,
    theme: cardTheme,
  }: {
    title: string;
    description: string;
    icon: LucideIcon;
    children: ReactNode;
    theme: ReturnType<typeof getTheme>;
  }) {
    return (
      <section className={joinClasses("rounded-3xl border p-5 backdrop-blur-2xl sm:p-7", cardTheme.panel)}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#4DEBFF]/25 bg-[#1E90FF]/15 text-[#4DEBFF]">
              <Icon size={22} aria-hidden />
            </span>
            <div>
              <h2 className={joinClasses("text-xl font-bold tracking-tight", cardTheme.heading)}>
                {title}
              </h2>
              <p className={joinClasses("mt-2 max-w-3xl text-sm leading-6", cardTheme.muted)}>
                {description}
              </p>
            </div>
          </div>
        </div>
        {children}
      </section>
    );
  }

  function InfoStrip({
    children,
    theme: stripTheme,
  }: {
    children: ReactNode;
    theme: ReturnType<typeof getTheme>;
  }) {
    return (
      <div
        className={joinClasses(
          "mt-5 rounded-2xl border px-4 py-3 text-sm leading-6",
          stripTheme.panelSoft,
          stripTheme.soft,
        )}
      >
        {children}
      </div>
    );
  }

  function ActionTile({
    title,
    description,
    icon: Icon,
    onClick,
    theme: tileTheme,
    destructive = false,
    disabled = false,
  }: {
    title: string;
    description: string;
    icon: LucideIcon;
    onClick: () => void;
    theme: ReturnType<typeof getTheme>;
    destructive?: boolean;
    disabled?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={joinClasses(
          "group rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
          destructive ? tileTheme.destructive : tileTheme.panelSoft,
        )}
      >
        <span
          className={joinClasses(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            destructive
              ? "bg-rose-500/15 text-rose-400"
              : "bg-[#1E90FF]/15 text-[#4DEBFF]",
          )}
        >
          <Icon size={20} aria-hidden />
        </span>
        <span className={joinClasses("mt-4 block text-sm font-bold", tileTheme.heading)}>
          {title}
        </span>
        <span className={joinClasses("mt-2 block text-xs leading-5", tileTheme.muted)}>
          {description}
        </span>
      </button>
    );
  }
}
