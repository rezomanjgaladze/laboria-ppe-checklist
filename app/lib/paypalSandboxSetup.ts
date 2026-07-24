import "server-only";

import { randomUUID } from "node:crypto";
import {
  getPayPalMode,
  getSafePayPalApiError,
  requestPayPalApi,
} from "@/app/lib/paypalBilling";

const PAYPAL_PRODUCT = {
  name: "Laboria Orbit",
  description: "AI-powered Health & Safety operations workspace",
  type: "SERVICE",
  category: "SOFTWARE",
} as const;

const PAYPAL_PLANS = [
  {
    key: "PAYPAL_PLAN_ORBIT_PLUS",
    name: "Laboria Orbit Plus",
    description: "Laboria Orbit Plus monthly subscription",
    amount: "19.00",
  },
  {
    key: "PAYPAL_PLAN_ORBIT_PRO",
    name: "Laboria Orbit Pro",
    description: "Laboria Orbit Pro monthly subscription",
    amount: "49.00",
  },
] as const;

type PayPalProduct = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  category?: unknown;
};

type PayPalPlan = {
  id?: unknown;
  product_id?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  billing_cycles?: unknown;
  payment_preferences?: unknown;
};

type PayPalCollection<TItem> = {
  products?: TItem[];
  plans?: TItem[];
  total_pages?: unknown;
};

type RequiredPlan = (typeof PAYPAL_PLANS)[number];

export type PayPalSandboxSetupResult = {
  PAYPAL_PRODUCT_ID: string;
  PAYPAL_PLAN_ORBIT_PLUS: string;
  PAYPAL_PLAN_ORBIT_PRO: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const requireId = (value: unknown, resource: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`PayPal did not return a ${resource} ID.`);
  }

  return value.trim();
};

const requestSetupApi = async <T>(
  path: string,
  init: RequestInit,
  requestId?: string,
) => {
  const { response, payload } = await requestPayPalApi<T>(
    path,
    init,
    requestId,
  );

  if (!response.ok) {
    throw new Error(
      getSafePayPalApiError(
        payload,
        `PayPal Sandbox setup request failed (${response.status}).`,
      ),
    );
  }

  return payload;
};

const listAll = async <TItem>(
  pathForPage: (page: number) => string,
  collectionKey: "products" | "plans",
) => {
  const items: TItem[] = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const payload = await requestSetupApi<PayPalCollection<TItem>>(
      pathForPage(page),
      {
        method: "GET",
        headers: { Prefer: "return=representation" },
      },
    );
    const pageItems =
      collectionKey === "products" ? payload?.products : payload?.plans;

    if (Array.isArray(pageItems)) items.push(...pageItems);

    const reportedTotalPages = Number(payload?.total_pages);
    totalPages =
      Number.isInteger(reportedTotalPages) && reportedTotalPages > 0
        ? Math.min(reportedTotalPages, 100)
        : 1;
  }

  return items;
};

const productMatches = (product: PayPalProduct) =>
  product.name === PAYPAL_PRODUCT.name &&
  product.description === PAYPAL_PRODUCT.description &&
  product.type === PAYPAL_PRODUCT.type &&
  product.category === PAYPAL_PRODUCT.category;

const getOrCreateProduct = async () => {
  const listedProducts = await listAll<PayPalProduct>(
    (page) =>
      `/v1/catalogs/products?page_size=20&page=${page}&total_required=true`,
    "products",
  );
  const namedProducts = listedProducts.filter(
    (product) => product.name === PAYPAL_PRODUCT.name,
  );

  for (const product of namedProducts) {
    const productId = requireId(product.id, "product");
    const details = await requestSetupApi<PayPalProduct>(
      `/v1/catalogs/products/${encodeURIComponent(productId)}`,
      { method: "GET" },
    );

    if (details && productMatches(details)) return productId;
  }

  if (namedProducts.length > 0) {
    throw new Error(
      "A PayPal Sandbox product named Laboria Orbit already exists with different configuration.",
    );
  }

  const created = await requestSetupApi<PayPalProduct>(
    "/v1/catalogs/products",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(PAYPAL_PRODUCT),
    },
    `laboria-orbit-product-${randomUUID()}`,
  );

  return requireId(created?.id, "product");
};

const planMatches = (
  plan: PayPalPlan,
  productId: string,
  requiredPlan: RequiredPlan,
) => {
  if (
    plan.product_id !== productId ||
    plan.name !== requiredPlan.name ||
    plan.description !== requiredPlan.description
  ) {
    return false;
  }

  const billingCycles = Array.isArray(plan.billing_cycles)
    ? plan.billing_cycles
    : [];
  const regularCycle = billingCycles.find(
    (cycle) => isRecord(cycle) && cycle.tenure_type === "REGULAR",
  );
  const frequency =
    isRecord(regularCycle) && isRecord(regularCycle.frequency)
      ? regularCycle.frequency
      : null;
  const pricingScheme =
    isRecord(regularCycle) && isRecord(regularCycle.pricing_scheme)
      ? regularCycle.pricing_scheme
      : null;
  const fixedPrice =
    pricingScheme && isRecord(pricingScheme.fixed_price)
      ? pricingScheme.fixed_price
      : null;
  const preferences = isRecord(plan.payment_preferences)
    ? plan.payment_preferences
    : null;

  return (
    frequency?.interval_unit === "MONTH" &&
    Number(frequency.interval_count) === 1 &&
    Number(regularCycle && regularCycle.total_cycles) === 0 &&
    fixedPrice?.currency_code === "USD" &&
    Number(fixedPrice?.value) === Number(requiredPlan.amount) &&
    preferences?.auto_bill_outstanding === true &&
    Number(preferences?.payment_failure_threshold) === 3
  );
};

const activatePlan = async (planId: string) => {
  await requestSetupApi<null>(
    `/v1/billing/plans/${encodeURIComponent(planId)}/activate`,
    { method: "POST", body: "{}" },
    `laboria-orbit-plan-activate-${planId}`,
  );
};

const getOrCreatePlan = async (
  productId: string,
  requiredPlan: RequiredPlan,
) => {
  const listedPlans = await listAll<PayPalPlan>(
    (page) =>
      `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=${page}&total_required=true`,
    "plans",
  );
  const namedPlans = listedPlans.filter(
    (plan) => plan.name === requiredPlan.name,
  );
  const matchingPlans: PayPalPlan[] = [];

  for (const plan of namedPlans) {
    const planId = requireId(plan.id, "plan");
    const details = await requestSetupApi<PayPalPlan>(
      `/v1/billing/plans/${encodeURIComponent(planId)}`,
      { method: "GET" },
    );

    if (details && planMatches(details, productId, requiredPlan)) {
      matchingPlans.push(details);
    }
  }

  const activePlan = matchingPlans.find((plan) => plan.status === "ACTIVE");
  if (activePlan) return requireId(activePlan.id, "plan");

  const inactivePlan = matchingPlans[0];
  if (inactivePlan) {
    const planId = requireId(inactivePlan.id, "plan");
    await activatePlan(planId);
    return planId;
  }

  if (namedPlans.length > 0) {
    throw new Error(
      `A PayPal Sandbox plan named ${requiredPlan.name} already exists with different configuration.`,
    );
  }

  const created = await requestSetupApi<PayPalPlan>(
    "/v1/billing/plans",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        product_id: productId,
        name: requiredPlan.name,
        description: requiredPlan.description,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: requiredPlan.amount,
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    },
    `laboria-orbit-${requiredPlan.key.toLowerCase()}-${randomUUID()}`,
  );

  return requireId(created?.id, "plan");
};

export const setupPayPalSandboxCatalog =
  async (): Promise<PayPalSandboxSetupResult> => {
    if (getPayPalMode() !== "sandbox") {
      throw new Error(
        "PayPal catalog setup is disabled unless PAYPAL_MODE=sandbox.",
      );
    }

    const productId = await getOrCreateProduct();
    const plusPlanId = await getOrCreatePlan(productId, PAYPAL_PLANS[0]);
    const proPlanId = await getOrCreatePlan(productId, PAYPAL_PLANS[1]);

    return {
      PAYPAL_PRODUCT_ID: productId,
      PAYPAL_PLAN_ORBIT_PLUS: plusPlanId,
      PAYPAL_PLAN_ORBIT_PRO: proPlanId,
    };
  };
