export type PaddlePurchaseKey =
  | "orbit-plus"
  | "orbit-pro"
  | "starter-topup"
  | "plus-pack"
  | "pro-pack";

export type PaddlePurchaseDefinition = {
  key: PaddlePurchaseKey;
  label: string;
  purchaseType: "subscription" | "credit_pack";
  priceEnvironmentVariable: string;
  plan?: "Orbit Plus" | "Orbit Pro";
  credits?: number;
};

export const paddlePurchaseCatalog: Record<
  PaddlePurchaseKey,
  PaddlePurchaseDefinition
> = {
  "orbit-plus": {
    key: "orbit-plus",
    label: "Orbit Plus",
    purchaseType: "subscription",
    priceEnvironmentVariable: "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PLUS",
    plan: "Orbit Plus",
  },
  "orbit-pro": {
    key: "orbit-pro",
    label: "Orbit Pro",
    purchaseType: "subscription",
    priceEnvironmentVariable: "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PRO",
    plan: "Orbit Pro",
  },
  "starter-topup": {
    key: "starter-topup",
    label: "Starter Top-Up",
    purchaseType: "credit_pack",
    priceEnvironmentVariable: "NEXT_PUBLIC_PADDLE_PRICE_STARTER_TOPUP",
    credits: 50,
  },
  "plus-pack": {
    key: "plus-pack",
    label: "Orbit Plus Discount Pack",
    purchaseType: "credit_pack",
    priceEnvironmentVariable: "NEXT_PUBLIC_PADDLE_PRICE_PLUS_PACK",
    credits: 100,
  },
  "pro-pack": {
    key: "pro-pack",
    label: "Orbit Pro Best Value Pack",
    purchaseType: "credit_pack",
    priceEnvironmentVariable: "NEXT_PUBLIC_PADDLE_PRICE_PRO_PACK",
    credits: 100,
  },
};

export const isPaddlePurchaseKey = (
  value: unknown,
): value is PaddlePurchaseKey =>
  typeof value === "string" && value in paddlePurchaseCatalog;
