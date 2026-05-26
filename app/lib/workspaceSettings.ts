export type WorkspaceLanguage = "EN" | "KA";

export type WorkspaceModulePreference =
  | "command-center"
  | "action-tracker"
  | "inspections"
  | "risk-assessments"
  | "training-management"
  | "incident-management"
  | "hse-analytics"
  | "settings";

export type ThemeModePreference = "light" | "dark";

export type CompanyProfileSettings = {
  companyName: string;
  logoDataUrl: string;
  industrySector: string;
  mainSiteLocation: string;
  contactEmail: string;
  phone: string;
  address: string;
};

export type WorkspacePreferenceSettings = {
  themeMode: ThemeModePreference;
  language: WorkspaceLanguage;
  dateFormat: string;
  timeFormat: string;
  defaultDashboardPage: WorkspaceModulePreference;
  sidebarCollapsedByDefault: boolean;
};

export type RiskSettings = {
  matrixType: "5x5";
  defaultReviewPeriodDays: number;
  highRiskThreshold: number;
  residualRiskWarningThreshold: number;
};

export type ActionTrackerSettings = {
  defaultDueDays: number;
  criticalEscalationThresholdDays: number;
  overdueWarningThresholdDays: number;
  autoCloseCompletedActions: boolean;
};

export type TrainingSettings = {
  expiringSoonThresholdDays: number;
  defaultValidityMonths: number;
  refresherReminderThresholdDays: number;
  mandatoryTrainingLogicEnabled: boolean;
};

export type IncidentSettings = {
  defaultIncidentStatus: string;
  highSeverityEscalationEnabled: boolean;
  mandatoryCorrectiveActionEnabled: boolean;
  closureVerificationRequired: boolean;
};

export type WorkspaceSettings = {
  companyProfile: CompanyProfileSettings;
  preferences: WorkspacePreferenceSettings;
  riskSettings: RiskSettings;
  actionTrackerSettings: ActionTrackerSettings;
  trainingSettings: TrainingSettings;
  incidentSettings: IncidentSettings;
  updatedAt: string;
};

export const workspaceSettingsUpdatedEvent =
  "laboria-workspace-settings-updated";

export const workspaceModulePreferenceOptions: Array<{
  value: WorkspaceModulePreference;
  label: string;
}> = [
  { value: "command-center", label: "Command Center" },
  { value: "action-tracker", label: "Action Tracker" },
  { value: "inspections", label: "Inspections" },
  { value: "risk-assessments", label: "Risk Assessments" },
  { value: "training-management", label: "Training Management" },
  { value: "incident-management", label: "Incident Management" },
  { value: "hse-analytics", label: "HSE Analytics" },
  { value: "settings", label: "Settings" },
];

export const defaultWorkspaceSettings: WorkspaceSettings = {
  companyProfile: {
    companyName: "",
    logoDataUrl: "",
    industrySector: "",
    mainSiteLocation: "",
    contactEmail: "",
    phone: "",
    address: "",
  },
  preferences: {
    themeMode: "light",
    language: "EN",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24-hour",
    defaultDashboardPage: "command-center",
    sidebarCollapsedByDefault: false,
  },
  riskSettings: {
    matrixType: "5x5",
    defaultReviewPeriodDays: 365,
    highRiskThreshold: 15,
    residualRiskWarningThreshold: 15,
  },
  actionTrackerSettings: {
    defaultDueDays: 7,
    criticalEscalationThresholdDays: 1,
    overdueWarningThresholdDays: 1,
    autoCloseCompletedActions: false,
  },
  trainingSettings: {
    expiringSoonThresholdDays: 30,
    defaultValidityMonths: 12,
    refresherReminderThresholdDays: 30,
    mandatoryTrainingLogicEnabled: false,
  },
  incidentSettings: {
    defaultIncidentStatus: "Reported",
    highSeverityEscalationEnabled: true,
    mandatoryCorrectiveActionEnabled: true,
    closureVerificationRequired: true,
  },
  updatedAt: "",
};

const legacyStorageKey = "laboria_workspace_settings";

export const getWorkspaceSettingsStorageKey = (userId: string | null) =>
  userId
    ? `laboria_${encodeURIComponent(userId)}_workspace_settings`
    : legacyStorageKey;

const toStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

const toBooleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const toNumberValue = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
};

const normalizeThemeMode = (value: unknown): ThemeModePreference =>
  value === "dark" ? "dark" : "light";

const normalizeLanguage = (value: unknown): WorkspaceLanguage =>
  value === "KA" ? "KA" : "EN";

const normalizeDashboardPage = (value: unknown): WorkspaceModulePreference => {
  const option = workspaceModulePreferenceOptions.find(
    (item) => item.value === value,
  );

  return option?.value ?? "command-center";
};

export const normalizeWorkspaceSettings = (
  value: Partial<WorkspaceSettings> | null | undefined,
): WorkspaceSettings => ({
  companyProfile: {
    companyName: toStringValue(value?.companyProfile?.companyName),
    logoDataUrl: toStringValue(value?.companyProfile?.logoDataUrl),
    industrySector: toStringValue(value?.companyProfile?.industrySector),
    mainSiteLocation: toStringValue(value?.companyProfile?.mainSiteLocation),
    contactEmail: toStringValue(value?.companyProfile?.contactEmail),
    phone: toStringValue(value?.companyProfile?.phone),
    address: toStringValue(value?.companyProfile?.address),
  },
  preferences: {
    themeMode: normalizeThemeMode(value?.preferences?.themeMode),
    language: normalizeLanguage(value?.preferences?.language),
    dateFormat:
      toStringValue(value?.preferences?.dateFormat) ||
      defaultWorkspaceSettings.preferences.dateFormat,
    timeFormat:
      toStringValue(value?.preferences?.timeFormat) ||
      defaultWorkspaceSettings.preferences.timeFormat,
    defaultDashboardPage: normalizeDashboardPage(
      value?.preferences?.defaultDashboardPage,
    ),
    sidebarCollapsedByDefault: toBooleanValue(
      value?.preferences?.sidebarCollapsedByDefault,
      defaultWorkspaceSettings.preferences.sidebarCollapsedByDefault,
    ),
  },
  riskSettings: {
    matrixType: "5x5",
    defaultReviewPeriodDays: toNumberValue(
      value?.riskSettings?.defaultReviewPeriodDays,
      defaultWorkspaceSettings.riskSettings.defaultReviewPeriodDays,
    ),
    highRiskThreshold: toNumberValue(
      value?.riskSettings?.highRiskThreshold,
      defaultWorkspaceSettings.riskSettings.highRiskThreshold,
    ),
    residualRiskWarningThreshold: toNumberValue(
      value?.riskSettings?.residualRiskWarningThreshold,
      defaultWorkspaceSettings.riskSettings.residualRiskWarningThreshold,
    ),
  },
  actionTrackerSettings: {
    defaultDueDays: toNumberValue(
      value?.actionTrackerSettings?.defaultDueDays,
      defaultWorkspaceSettings.actionTrackerSettings.defaultDueDays,
    ),
    criticalEscalationThresholdDays: toNumberValue(
      value?.actionTrackerSettings?.criticalEscalationThresholdDays,
      defaultWorkspaceSettings.actionTrackerSettings
        .criticalEscalationThresholdDays,
    ),
    overdueWarningThresholdDays: toNumberValue(
      value?.actionTrackerSettings?.overdueWarningThresholdDays,
      defaultWorkspaceSettings.actionTrackerSettings.overdueWarningThresholdDays,
    ),
    autoCloseCompletedActions: toBooleanValue(
      value?.actionTrackerSettings?.autoCloseCompletedActions,
      defaultWorkspaceSettings.actionTrackerSettings.autoCloseCompletedActions,
    ),
  },
  trainingSettings: {
    expiringSoonThresholdDays: toNumberValue(
      value?.trainingSettings?.expiringSoonThresholdDays,
      defaultWorkspaceSettings.trainingSettings.expiringSoonThresholdDays,
    ),
    defaultValidityMonths: toNumberValue(
      value?.trainingSettings?.defaultValidityMonths,
      defaultWorkspaceSettings.trainingSettings.defaultValidityMonths,
    ),
    refresherReminderThresholdDays: toNumberValue(
      value?.trainingSettings?.refresherReminderThresholdDays,
      defaultWorkspaceSettings.trainingSettings.refresherReminderThresholdDays,
    ),
    mandatoryTrainingLogicEnabled: toBooleanValue(
      value?.trainingSettings?.mandatoryTrainingLogicEnabled,
      defaultWorkspaceSettings.trainingSettings.mandatoryTrainingLogicEnabled,
    ),
  },
  incidentSettings: {
    defaultIncidentStatus:
      toStringValue(value?.incidentSettings?.defaultIncidentStatus) ||
      defaultWorkspaceSettings.incidentSettings.defaultIncidentStatus,
    highSeverityEscalationEnabled: toBooleanValue(
      value?.incidentSettings?.highSeverityEscalationEnabled,
      defaultWorkspaceSettings.incidentSettings.highSeverityEscalationEnabled,
    ),
    mandatoryCorrectiveActionEnabled: toBooleanValue(
      value?.incidentSettings?.mandatoryCorrectiveActionEnabled,
      defaultWorkspaceSettings.incidentSettings.mandatoryCorrectiveActionEnabled,
    ),
    closureVerificationRequired: toBooleanValue(
      value?.incidentSettings?.closureVerificationRequired,
      defaultWorkspaceSettings.incidentSettings.closureVerificationRequired,
    ),
  },
  updatedAt: toStringValue(value?.updatedAt),
});

const parseSettingsValue = (value: string | null): WorkspaceSettings | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return normalizeWorkspaceSettings(parsed as Partial<WorkspaceSettings>);
  } catch {
    return null;
  }
};

export const readWorkspaceSettings = (userId: string | null) => {
  if (typeof window === "undefined") {
    return defaultWorkspaceSettings;
  }

  const userSettings = parseSettingsValue(
    window.localStorage.getItem(getWorkspaceSettingsStorageKey(userId)),
  );

  if (userSettings) {
    return userSettings;
  }

  if (userId) {
    const legacySettings = parseSettingsValue(
      window.localStorage.getItem(legacyStorageKey),
    );

    if (legacySettings) {
      return legacySettings;
    }
  }

  return defaultWorkspaceSettings;
};

export const writeWorkspaceSettings = (
  userId: string | null,
  settings: WorkspaceSettings,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSettings = normalizeWorkspaceSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  window.localStorage.setItem(
    getWorkspaceSettingsStorageKey(userId),
    JSON.stringify(normalizedSettings),
  );

  if (userId) {
    window.localStorage.removeItem(legacyStorageKey);
  }

  window.dispatchEvent(
    new CustomEvent<WorkspaceSettings>(workspaceSettingsUpdatedEvent, {
      detail: normalizedSettings,
    }),
  );
};

export const hasCompanyBranding = (settings: WorkspaceSettings) => {
  const profile = settings.companyProfile;

  return Boolean(
    profile.companyName.trim() ||
      profile.logoDataUrl ||
      profile.industrySector.trim() ||
      profile.mainSiteLocation.trim() ||
      profile.contactEmail.trim() ||
      profile.phone.trim() ||
      profile.address.trim(),
  );
};
