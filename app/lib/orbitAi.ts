import {
  ORBIT_STARTER_PLAN,
  getOrbitPlan,
  isOrbitAiToolAvailableForPlan,
  isOrbitPlanName,
  type OrbitPlanName,
} from "@/app/lib/orbitPlans";

export type OrbitAiSourceModule =
  | "Command Center"
  | "Action Tracker"
  | "Inspections"
  | "Risk Assessments"
  | "Training Management"
  | "Incident Management"
  | "HSE Analytics"
  | "AI Intelligence";

export type OrbitAiInput = {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
};

export type OrbitAiContext = {
  hazardCount?: number;
  inspectionItemCount?: number;
  departmentCount?: number;
  sourceRecordId?: string;
};

export type OrbitAiTool = {
  id: OrbitAiToolId;
  title: string;
  description: string;
  sourceModule: OrbitAiSourceModule;
  creditLabel: string;
  getCredits: (context?: OrbitAiContext) => number;
  inputs: OrbitAiInput[];
};

export type OrbitAiAccount = {
  plan: OrbitPlanName;
  credits: number;
  subscriptionStatus?: string;
  renewalDate?: string | null;
  accessEndsAt?: string | null;
  updatePaymentMethodUrl?: string | null;
  customerPortalUrl?: string | null;
};

export type OrbitAiCreditTopUp = {
  id: string;
  creditsAdded: number;
  createdAt: string;
  reason: "testing";
};

export const orbitAiNavigationEvent = "laboria-orbit-ai-navigation";
export const orbitAiAccountUpdatedEvent = "laboria-orbit-ai-account-updated";

export const orbitAiPricingMap = {
  "Toolbox Talk": 3,
  "Toolbox Talk + Quiz": 5,
  "Corrective Action Recommendations": 4,
  "Compliance Assistant Basic": 2,
  "Compliance Assistant Advanced": 3,
  "Hazard Explanation": 2,
  "PPE Recommendation": 2,
  "Inspection Analysis Small": 4,
  "Inspection Analysis Medium": 6,
  "Inspection Analysis Large": 8,
  "Incident Investigation Basic": 8,
  "Incident Investigation Advanced RCA": 12,
  "Risk Assessment Basic 1-5": 8,
  "Risk Assessment Basic 6-10": 12,
  "Risk Assessment Basic 11-20": 18,
  "Risk Assessment Basic 21-30": 24,
  "Risk Assessment Advanced 1-5": 12,
  "Risk Assessment Advanced 6-10": 18,
  "Risk Assessment Advanced 11-20": 25,
  "Risk Assessment Advanced 21-30": 35,
  "Enterprise Risk Assessment 1-10": 25,
  "Enterprise Risk Assessment 11-25": 40,
  "Enterprise Risk Assessment 26-50": 60,
  "Enterprise Risk Assessment 51-100": 100,
  "Small Procedure": 8,
  "Medium Procedure": 15,
  "Large Procedure": 25,
  "Small Method Statement": 10,
  "Medium Method Statement": 18,
  "Large Method Statement": 30,
  "Small RAMS": 15,
  "Medium RAMS": 25,
  "Large RAMS": 40,
  "Basic Incident Report": 10,
  "Advanced Incident Report": 18,
  "Small Compliance Report": 12,
  "Large Compliance Report": 25,
  "Trend Detection Small": 12,
  "Trend Detection Large": 15,
  "Predictive Warning Single Department": 15,
  "Predictive Warning Multi-Site": 25,
  "Operational Summary Monthly": 20,
  "Operational Summary Enterprise": 35,
  "Cross-Module Analytics Standard": 18,
  "Cross-Module Analytics Advanced": 30,
} as const;

const fixedCredits = (credits: number) => () => credits;

const getBasicRiskCredits = (context?: OrbitAiContext) => {
  const count = Math.max(context?.hazardCount || 5, 1);
  if (count <= 5) return 8;
  if (count <= 10) return 12;
  if (count <= 20) return 18;
  return 24;
};

const getAdvancedRiskCredits = (context?: OrbitAiContext) => {
  const count = Math.max(context?.hazardCount || 5, 1);
  if (count <= 5) return 12;
  if (count <= 10) return 18;
  if (count <= 20) return 25;
  return 35;
};

const getInspectionCredits = (context?: OrbitAiContext) => {
  const count = Math.max(context?.inspectionItemCount || 20, 1);
  if (count <= 20) return 4;
  if (count <= 50) return 6;
  return 8;
};

const commonContextInputs: OrbitAiInput[] = [
  {
    id: "focus",
    label: "Operational focus",
    placeholder: "Describe the task, site, department, or issue to analyze...",
    type: "textarea",
  },
  {
    id: "audience",
    label: "Target audience",
    placeholder: "Safety managers, supervisors, contractors...",
  },
];

const toolCatalog = {
  "toolbox-talk": {
    id: "toolbox-talk",
    title: "AI Generate Toolbox Talk",
    description: "Prepare a focused toolbox talk draft for the selected operational context.",
    sourceModule: "Training Management",
    creditLabel: "3 Credits",
    getCredits: fixedCredits(3),
    inputs: commonContextInputs,
  },
  "toolbox-talk-quiz": {
    id: "toolbox-talk-quiz",
    title: "AI Generate Quiz",
    description: "Prepare a toolbox talk knowledge-check quiz for a selected topic.",
    sourceModule: "Training Management",
    creditLabel: "5 Credits",
    getCredits: fixedCredits(5),
    inputs: commonContextInputs,
  },
  "training-material": {
    id: "training-material",
    title: "AI Generate Training Material",
    description: "Draft a concise training handout using the selected HSE topic and audience.",
    sourceModule: "Training Management",
    creditLabel: "8 Credits",
    getCredits: fixedCredits(8),
    inputs: commonContextInputs,
  },
  "training-quiz": {
    id: "training-quiz",
    title: "AI Generate Quiz",
    description: "Prepare a practical HSE knowledge-check quiz from a topic or verified Orbit record.",
    sourceModule: "Training Management",
    creditLabel: "5 Credits",
    getCredits: fixedCredits(5),
    inputs: commonContextInputs,
  },
  "corrective-actions": {
    id: "corrective-actions",
    title: "AI Recommend Corrective Actions",
    description: "Suggest practical corrective and preventive actions for the selected workflow context.",
    sourceModule: "Action Tracker",
    creditLabel: "4 Credits",
    getCredits: fixedCredits(4),
    inputs: commonContextInputs,
  },
  "prioritize-actions": {
    id: "prioritize-actions",
    title: "AI Prioritize Actions",
    description: "Review open actions and propose a risk-informed operational priority order.",
    sourceModule: "Action Tracker",
    creditLabel: "3 Credits",
    getCredits: fixedCredits(3),
    inputs: commonContextInputs,
  },
  "suggest-deadlines": {
    id: "suggest-deadlines",
    title: "AI Suggest Deadlines",
    description: "Recommend proportionate completion dates based on action criticality and context.",
    sourceModule: "Action Tracker",
    creditLabel: "2 Credits",
    getCredits: fixedCredits(2),
    inputs: commonContextInputs,
  },
  "risk-assessment-basic": {
    id: "risk-assessment-basic",
    title: "AI Generate Risk Assessment",
    description: "Draft an editable workplace risk assessment from activity and site context.",
    sourceModule: "Risk Assessments",
    creditLabel: "8-24 Credits",
    getCredits: getBasicRiskCredits,
    inputs: [
      {
        id: "activity",
        label: "Activity / task",
        placeholder: "Describe the activity to assess...",
      },
      {
        id: "scope",
        label: "Assessment scope",
        placeholder: "Site conditions, work area, workforce, and boundaries...",
        type: "textarea",
      },
    ],
  },
  "suggest-hazards": {
    id: "suggest-hazards",
    title: "AI Suggest Hazards",
    description: "Surface potential hazards for the current risk assessment activity.",
    sourceModule: "Risk Assessments",
    creditLabel: "2 Credits",
    getCredits: fixedCredits(2),
    inputs: commonContextInputs,
  },
  "recommend-controls": {
    id: "recommend-controls",
    title: "AI Recommend Controls",
    description: "Suggest controls aligned with the hierarchy of controls.",
    sourceModule: "Risk Assessments",
    creditLabel: "4 Credits",
    getCredits: fixedCredits(4),
    inputs: commonContextInputs,
  },
  "risk-review-advanced": {
    id: "risk-review-advanced",
    title: "AI Review Existing Assessment",
    description: "Review the current assessment for gaps, weak controls, and residual risk concerns.",
    sourceModule: "Risk Assessments",
    creditLabel: "12-35 Credits",
    getCredits: getAdvancedRiskCredits,
    inputs: commonContextInputs,
  },
  "inspection-analysis": {
    id: "inspection-analysis",
    title: "AI Analyze Inspection",
    description: "Analyze checklist findings and surface the most important compliance signals.",
    sourceModule: "Inspections",
    creditLabel: "4-8 Credits",
    getCredits: getInspectionCredits,
    inputs: commonContextInputs,
  },
  "inspection-summary": {
    id: "inspection-summary",
    title: "AI Summarize Findings",
    description: "Prepare a concise management-level summary of inspection findings.",
    sourceModule: "Inspections",
    creditLabel: "2 Credits",
    getCredits: fixedCredits(2),
    inputs: commonContextInputs,
  },
  "inspection-actions": {
    id: "inspection-actions",
    title: "AI Recommend Actions",
    description: "Suggest corrective actions for non-compliant inspection findings.",
    sourceModule: "Inspections",
    creditLabel: "4 Credits",
    getCredits: fixedCredits(4),
    inputs: commonContextInputs,
  },
  "incident-investigation": {
    id: "incident-investigation",
    title: "AI Investigate Incident",
    description: "Structure an incident investigation review from the available event context.",
    sourceModule: "Incident Management",
    creditLabel: "8 Credits",
    getCredits: fixedCredits(8),
    inputs: commonContextInputs,
  },
  "incident-root-causes": {
    id: "incident-root-causes",
    title: "AI Find Root Causes",
    description: "Suggest root cause categories and investigation questions for an incident.",
    sourceModule: "Incident Management",
    creditLabel: "12 Credits",
    getCredits: fixedCredits(12),
    inputs: commonContextInputs,
  },
  "incident-report": {
    id: "incident-report",
    title: "AI Generate Incident Report",
    description: "Draft a professional incident report from verified investigation information.",
    sourceModule: "Incident Management",
    creditLabel: "10 Credits",
    getCredits: fixedCredits(10),
    inputs: commonContextInputs,
  },
  "workspace-analysis": {
    id: "workspace-analysis",
    title: "AI Workspace Analysis",
    description: "Review cross-module workspace signals and prepare an operational intelligence brief.",
    sourceModule: "Command Center",
    creditLabel: "18 Credits",
    getCredits: fixedCredits(18),
    inputs: commonContextInputs,
  },
  "risk-trends": {
    id: "risk-trends",
    title: "AI Risk Trends",
    description: "Detect emerging risk movements and recurring operational signals.",
    sourceModule: "HSE Analytics",
    creditLabel: "12 Credits",
    getCredits: fixedCredits(12),
    inputs: commonContextInputs,
  },
  "executive-summary": {
    id: "executive-summary",
    title: "AI Executive Summary",
    description: "Prepare a management-ready monthly operational HSE summary.",
    sourceModule: "Command Center",
    creditLabel: "20 Credits",
    getCredits: fixedCredits(20),
    inputs: commonContextInputs,
  },
  "predictive-warning": {
    id: "predictive-warning",
    title: "AI Predictive Warning",
    description: "Preview predictive risk warning analysis for a selected department.",
    sourceModule: "HSE Analytics",
    creditLabel: "15 Credits",
    getCredits: fixedCredits(15),
    inputs: commonContextInputs,
  },
  "document-generation": {
    id: "document-generation",
    title: "AI Document Generation",
    description: "Draft controlled HSE procedures, method statements, RAMS, and reports.",
    sourceModule: "AI Intelligence",
    creditLabel: "8-40 Credits",
    getCredits: fixedCredits(8),
    inputs: [
      {
        id: "document-type",
        label: "Document type",
        placeholder: "Select document type",
        type: "select",
        options: ["Procedure", "Method Statement", "RAMS", "Compliance Report"],
      },
      {
        id: "scope",
        label: "Document scope",
        placeholder: "Describe the operational scope and intended audience...",
        type: "textarea",
      },
    ],
  },
  "compliance-assistant": {
    id: "compliance-assistant",
    title: "AI Compliance Assistant",
    description: "Preview compliance support for policy, evidence, and control review workflows.",
    sourceModule: "AI Intelligence",
    creditLabel: "2-3 Credits",
    getCredits: fixedCredits(2),
    inputs: commonContextInputs,
  },
  "ppe-recommendation": {
    id: "ppe-recommendation",
    title: "AI PPE Recommendation",
    description: "Suggest PPE considerations for a selected hazard or activity.",
    sourceModule: "AI Intelligence",
    creditLabel: "2 Credits",
    getCredits: fixedCredits(2),
    inputs: commonContextInputs,
  },
} satisfies Record<string, Omit<OrbitAiTool, "id"> & { id: string }>;

export type OrbitAiToolId = keyof typeof toolCatalog;

export const orbitAiTools = toolCatalog as Record<OrbitAiToolId, OrbitAiTool>;

export const getOrbitAiTool = (toolId: OrbitAiToolId) => orbitAiTools[toolId];

export const canUseOrbitAiTool = (
  account: OrbitAiAccount,
  toolId: OrbitAiToolId,
) => isOrbitAiToolAvailableForPlan(account.plan, toolId);

const getDefaultOrbitAiCredits = () => {
  return getOrbitPlan(ORBIT_STARTER_PLAN).includedAiCreditsMonthly;
};

const defaultOrbitAiAccount = (): OrbitAiAccount => ({
  plan: ORBIT_STARTER_PLAN,
  credits: getDefaultOrbitAiCredits(),
});

const normalizeOrbitAiAccount = (value: unknown): OrbitAiAccount => {
  if (!value || typeof value !== "object") {
    return defaultOrbitAiAccount();
  }

  const candidate = value as Partial<OrbitAiAccount>;
  const plan = isOrbitPlanName(candidate.plan)
    ? candidate.plan
    : ORBIT_STARTER_PLAN;
  const credits =
    typeof candidate.credits === "number" &&
    Number.isFinite(candidate.credits) &&
    candidate.credits >= 0
      ? Math.floor(candidate.credits)
      : getDefaultOrbitAiCredits();

  return {
    plan,
    credits,
    subscriptionStatus:
      typeof candidate.subscriptionStatus === "string"
        ? candidate.subscriptionStatus
        : undefined,
    renewalDate:
      typeof candidate.renewalDate === "string" ? candidate.renewalDate : null,
    accessEndsAt:
      typeof candidate.accessEndsAt === "string" ? candidate.accessEndsAt : null,
    updatePaymentMethodUrl:
      typeof candidate.updatePaymentMethodUrl === "string"
        ? candidate.updatePaymentMethodUrl
        : null,
    customerPortalUrl:
      typeof candidate.customerPortalUrl === "string"
        ? candidate.customerPortalUrl
        : null,
  };
};

const orbitAiAccountCache = new Map<string, OrbitAiAccount>();

const getOrbitAiAccountCacheKey = (userId: string | null = null) =>
  userId || "anonymous";

export const getOrbitAiAccount = (
  userId: string | null = null,
): OrbitAiAccount => {
  return (
    orbitAiAccountCache.get(getOrbitAiAccountCacheKey(userId)) ||
    defaultOrbitAiAccount()
  );
};

export const writeOrbitAiAccount = (
  userId: string | null,
  account: OrbitAiAccount,
) => {
  const normalized = normalizeOrbitAiAccount(account);
  orbitAiAccountCache.set(getOrbitAiAccountCacheKey(userId), normalized);

  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(orbitAiAccountUpdatedEvent, { detail: normalized }),
  );
};

export const refreshOrbitAiAccount = async (userId: string | null) => {
  if (!userId || typeof window === "undefined") {
    const account = defaultOrbitAiAccount();
    writeOrbitAiAccount(userId, account);
    return account;
  }

  const response = await fetch("/api/billing/orbit-account", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    account?: OrbitAiAccount;
    error?: string;
  } | null;

  if (!response.ok || !payload?.account) {
    throw new Error(payload?.error || "Could not load Orbit billing account.");
  }

  writeOrbitAiAccount(userId, payload.account);
  return payload.account;
};

export const spendOrbitAiCredits = async (
  userId: string | null,
  credits: number,
) => {
  if (!userId || typeof window === "undefined") {
    return null;
  }

  const normalizedCredits = Math.floor(credits);
  if (!Number.isFinite(normalizedCredits) || normalizedCredits <= 0) {
    return null;
  }

  const response = await fetch("/api/billing/ai-credits/spend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credits: normalizedCredits,
      reason: "Orbit AI generation",
      entryKey: `ai-spend:${crypto.randomUUID()}`,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    account?: OrbitAiAccount;
    error?: string;
  } | null;

  if (!response.ok || !payload?.account) {
    return null;
  }

  writeOrbitAiAccount(userId, payload.account);
  return payload.account;
};

export const readOrbitAiCreditTopUps = (
  userId: string | null,
): OrbitAiCreditTopUp[] => {
  void userId;
  return [];
};

export const applyAuthorizedOrbitAiTestCreditTopUp = (
  userId: string | null,
  topUp: OrbitAiCreditTopUp,
  account?: OrbitAiAccount,
) => {
  if (
    typeof window === "undefined" ||
    !userId ||
    !topUp.id ||
    topUp.creditsAdded !== 50 ||
    topUp.reason !== "testing"
  ) {
    return null;
  }

  if (!account) {
    return null;
  }

  const normalized = normalizeOrbitAiAccount(account);
  writeOrbitAiAccount(userId, normalized);

  return { account: normalized, topUp };
};

export const requestOrbitAiNavigation = (
  destination: "billing" | "ai-intelligence",
) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(orbitAiNavigationEvent, { detail: destination }),
  );
};
