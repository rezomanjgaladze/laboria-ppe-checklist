import {
  orbitPaddlePurchaseCatalog,
  type OrbitPaddlePurchaseDefinition,
  type OrbitPaddlePurchaseKey,
} from "@/app/lib/orbitPlans";

export type PaddlePurchaseKey = OrbitPaddlePurchaseKey;
export type PaddlePurchaseDefinition = OrbitPaddlePurchaseDefinition;

export const paddlePurchaseCatalog = orbitPaddlePurchaseCatalog;

export const isPaddlePurchaseKey = (
  value: unknown,
): value is PaddlePurchaseKey =>
  typeof value === "string" && value in paddlePurchaseCatalog;
