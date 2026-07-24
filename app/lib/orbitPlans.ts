export const ORBIT_STARTER_PLAN = "Orbit Starter" as const;
export const ORBIT_PLUS_PLAN = "Orbit Plus" as const;
export const ORBIT_PRO_PLAN = "Orbit Pro" as const;

export type OrbitPlanName =
  | typeof ORBIT_STARTER_PLAN
  | typeof ORBIT_PLUS_PLAN
  | typeof ORBIT_PRO_PLAN;

export type OrbitBillingProductType =
  | "plus_subscription"
  | "pro_subscription"
  | "starter_topup"
  | "plus_pack"
  | "pro_pack";

export type OrbitOperationalLimits = {
  inspectionTemplateIds: string[] | "unlimited";
  riskAssessments: number | "unlimited";
  trainingEmployees: number | "unlimited";
  incidentInvestigationsPerMonth: number | "unlimited";
};

export type OrbitPlanDefinition = {
  name: OrbitPlanName;
  monthlyPriceUsd: number;
  includedAiCreditsMonthly: number;
  badge: string;
  buttonLabel: string;
  description: string;
  features: string[];
  limits: OrbitOperationalLimits;
  tone: string;
  popular?: boolean;
  premium?: boolean;
  billingProductType?: OrbitBillingProductType;
};

export type OrbitCreditPackDefinition = {
  key: OrbitBillingProductType;
  name: string;
  eligiblePlan: OrbitPlanName;
  credits: number;
  priceUsd: number;
  tone: string;
  badge?: string;
  variantEnvironmentVariable: string;
};

export type OrbitBillingProductDefinition = {
  key: OrbitBillingProductType;
  label: string;
  purchaseType: "subscription" | "credit_pack";
  variantEnvironmentVariable: string;
  plan?: OrbitPlanName;
  credits?: number;
  eligiblePlans?: OrbitPlanName[];
};

const unlimitedOperationalLimits: OrbitOperationalLimits = {
  inspectionTemplateIds: "unlimited",
  riskAssessments: "unlimited",
  trainingEmployees: "unlimited",
  incidentInvestigationsPerMonth: "unlimited",
};

export const orbitPlans: Record<OrbitPlanName, OrbitPlanDefinition> = {
  [ORBIT_STARTER_PLAN]: {
    name: ORBIT_STARTER_PLAN,
    monthlyPriceUsd: 0,
    includedAiCreditsMonthly: 0,
    badge: "Free",
    buttonLabel: "Current Plan",
    description:
      "Core HSE operations for small teams getting started with Laboria Orbit.",
    features: [
      "Full Action Tracker",
      "3 Inspection Templates: General, PPE, Fire",
      "1 Risk Assessment",
      "Training Management up to 5 Employees",
      "1 Incident Investigation per Month",
      "Full HS Analytics Access",
      "0 AI Credits Included",
      "Optional AI Top-Up: 50 Credits for $9",
    ],
    limits: {
      inspectionTemplateIds: ["general", "ppe", "fire"],
      riskAssessments: 1,
      trainingEmployees: 5,
      incidentInvestigationsPerMonth: 1,
    },
    tone: "from-slate-500/18 to-slate-400/6",
  },
  [ORBIT_PLUS_PLAN]: {
    name: ORBIT_PLUS_PLAN,
    monthlyPriceUsd: 19,
    includedAiCreditsMonthly: 100,
    badge: "Most Popular",
    buttonLabel: "Upgrade to Plus",
    description: "Unlimited operational workflows for active HSE teams.",
    features: [
      "Full Action Tracker",
      "Unlimited Inspections",
      "Unlimited Risk Assessments",
      "Unlimited Training Management",
      "Unlimited Incident Workflows",
      "Full HS Analytics",
      "100 AI Credits Included per Month",
      "Discounted AI Credit Pricing",
    ],
    limits: unlimitedOperationalLimits,
    tone: "from-[#1E90FF]/34 to-[#4DEBFF]/16",
    popular: true,
    billingProductType: "plus_subscription",
  },
  [ORBIT_PRO_PLAN]: {
    name: ORBIT_PRO_PLAN,
    monthlyPriceUsd: 49,
    includedAiCreditsMonthly: 300,
    badge: "AI Powered",
    buttonLabel: "Upgrade to Pro",
    description:
      "Advanced AI operations and enterprise intelligence for mature HSE programs.",
    features: [
      "Everything in Orbit Plus",
      "300 AI Credits Included per Month",
      "AI Executive Summary",
      "AI Workspace Analysis",
      "AI Risk Trends",
      "AI Predictive Warning",
      "Enterprise Intelligence Layer",
      "Priority AI Processing",
      "Best AI Credit Pricing",
    ],
    limits: unlimitedOperationalLimits,
    tone: "from-violet-500/30 via-[#1E90FF]/18 to-[#4DEBFF]/12",
    premium: true,
    billingProductType: "pro_subscription",
  },
};

export const orbitPlanOrder: OrbitPlanName[] = [
  ORBIT_STARTER_PLAN,
  ORBIT_PLUS_PLAN,
  ORBIT_PRO_PLAN,
];

export const orbitCreditPacks: Record<string, OrbitCreditPackDefinition> = {
  starter_topup: {
    key: "starter_topup",
    name: "Starter Top-Up",
    eligiblePlan: ORBIT_STARTER_PLAN,
    credits: 50,
    priceUsd: 9,
    tone: "from-slate-500/16 to-slate-400/5",
    variantEnvironmentVariable: "LEMONSQUEEZY_VARIANT_STARTER_TOPUP",
  },
  plus_pack: {
    key: "plus_pack",
    name: "Orbit Plus Discount Pack",
    eligiblePlan: ORBIT_PLUS_PLAN,
    credits: 100,
    priceUsd: 12,
    tone: "from-[#1E90FF]/24 to-[#4DEBFF]/10",
    badge: "Plus",
    variantEnvironmentVariable: "LEMONSQUEEZY_VARIANT_PLUS_PACK",
  },
  pro_pack: {
    key: "pro_pack",
    name: "Orbit Pro Best Value Pack",
    eligiblePlan: ORBIT_PRO_PLAN,
    credits: 100,
    priceUsd: 8,
    tone: "from-violet-500/26 to-[#4DEBFF]/12",
    badge: "Best Value",
    variantEnvironmentVariable: "LEMONSQUEEZY_VARIANT_PRO_PACK",
  },
};

export const orbitCreditPackOrder: OrbitBillingProductType[] = [
  "starter_topup",
  "plus_pack",
  "pro_pack",
];

export const orbitBillingProductCatalog: Record<
  OrbitBillingProductType,
  OrbitBillingProductDefinition
> = {
  plus_subscription: {
    key: "plus_subscription",
    label: ORBIT_PLUS_PLAN,
    purchaseType: "subscription",
    variantEnvironmentVariable: "LEMONSQUEEZY_VARIANT_ORBIT_PLUS",
    plan: ORBIT_PLUS_PLAN,
  },
  pro_subscription: {
    key: "pro_subscription",
    label: ORBIT_PRO_PLAN,
    purchaseType: "subscription",
    variantEnvironmentVariable: "LEMONSQUEEZY_VARIANT_ORBIT_PRO",
    plan: ORBIT_PRO_PLAN,
  },
  starter_topup: {
    ...orbitCreditPacks.starter_topup,
    label: orbitCreditPacks.starter_topup.name,
    purchaseType: "credit_pack",
    eligiblePlans: [ORBIT_STARTER_PLAN],
  },
  plus_pack: {
    ...orbitCreditPacks.plus_pack,
    label: orbitCreditPacks.plus_pack.name,
    purchaseType: "credit_pack",
    eligiblePlans: [ORBIT_PLUS_PLAN, ORBIT_PRO_PLAN],
  },
  pro_pack: {
    ...orbitCreditPacks.pro_pack,
    label: orbitCreditPacks.pro_pack.name,
    purchaseType: "credit_pack",
    eligiblePlans: [ORBIT_PRO_PLAN],
  },
};

export const isOrbitBillingProductType = (
  value: unknown,
): value is OrbitBillingProductType =>
  typeof value === "string" && value in orbitBillingProductCatalog;

export const orbitProOnlyAiToolIds = new Set([
  "executive-summary",
  "workspace-analysis",
  "risk-trends",
  "predictive-warning",
]);

export const isOrbitPlanName = (value: unknown): value is OrbitPlanName =>
  typeof value === "string" && value in orbitPlans;

export const getOrbitPlan = (plan: OrbitPlanName) => orbitPlans[plan];

export const isOrbitAiToolAvailableForPlan = (
  plan: OrbitPlanName,
  toolId: string,
) => !orbitProOnlyAiToolIds.has(toolId) || plan === ORBIT_PRO_PLAN;

export const getOrbitAiToolRequiredPlan = (toolId: string) =>
  orbitProOnlyAiToolIds.has(toolId) ? ORBIT_PRO_PLAN : null;

export const isOrbitCreditPackAvailableForPlan = (
  plan: OrbitPlanName,
  pack: OrbitCreditPackDefinition,
) =>
  orbitBillingProductCatalog[pack.key].eligiblePlans?.includes(plan) ??
  pack.eligiblePlan === plan;

export const hasOrbitLimitCapacity = (
  limit: number | "unlimited",
  currentCount: number,
) => limit === "unlimited" || currentCount < limit;

export const isOrbitInspectionTemplateAvailable = (
  plan: OrbitPlanName,
  templateId: string,
) => {
  const templates = getOrbitPlan(plan).limits.inspectionTemplateIds;

  return templates === "unlimited" || templates.includes(templateId);
};

export const getOrbitPlanPriceLabel = (plan: OrbitPlanDefinition) =>
  plan.monthlyPriceUsd === 0 ? "FREE" : `$${plan.monthlyPriceUsd}`;
