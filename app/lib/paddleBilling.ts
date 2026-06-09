import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  paddlePurchaseCatalog,
  type PaddlePurchaseKey,
} from "@/app/lib/paddleCatalog";

const paddlePriceEnvironmentVariables = Array.from(
  new Set(
    Object.values(paddlePurchaseCatalog).map(
      (purchase) => purchase.priceEnvironmentVariable,
    ),
  ),
);

export const paddleRequiredEnvironmentVariables = [
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_ENVIRONMENT",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  ...paddlePriceEnvironmentVariables,
] as const;

export const paddleInfrastructureEnvironmentVariables = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";
const isEnvironmentValuePresent = (name: string) =>
  Boolean(readEnvironmentValue(name));

export type SupabaseAdminValidationStep =
  | "none"
  | "SUPABASE_SERVICE_ROLE_KEY_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_UNSUPPORTED_SB_SECRET"
  | "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT"
  | "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED"
  | "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE"
  | "SUPABASE_SERVICE_ROLE_KEY_EXPIRED"
  | "NEXT_PUBLIC_SUPABASE_URL_MISSING"
  | "NEXT_PUBLIC_SUPABASE_URL_INVALID"
  | "SUPABASE_URL_PROJECT_REF_MISMATCH"
  | "SUPABASE_ADMIN_CLIENT_CREATE_FAILED"
  | "SUPABASE_DATABASE_AUTHORIZATION_FAILED";

export type SupabaseAdminDiagnostics = {
  serviceRoleKeyPresent: boolean;
  serviceRoleKeyStartsWithEyJ: boolean;
  serviceRoleJwtRole: "service_role" | "anon" | "missing" | "unreadable";
  serviceRoleJwtProjectRef: string;
  supabaseUrlPresent: boolean;
  supabaseProjectRef: string;
  supabaseAdminClientCreated: boolean;
  validationStepFailed: SupabaseAdminValidationStep;
};

const normalizeJwtRole = (
  role: unknown,
): SupabaseAdminDiagnostics["serviceRoleJwtRole"] => {
  if (role === "service_role" || role === "anon") {
    return role;
  }

  return "unreadable";
};

const emptySupabaseAdminDiagnostics = (): SupabaseAdminDiagnostics => {
  const serviceRoleKey = readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = readEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseProjectRef = supabaseUrl
    ? getSupabaseProjectRefFromUrl(supabaseUrl) || "invalid"
    : "missing";

  return {
    serviceRoleKeyPresent: Boolean(serviceRoleKey),
    serviceRoleKeyStartsWithEyJ: serviceRoleKey.startsWith("eyJ"),
    serviceRoleJwtRole: serviceRoleKey ? "unreadable" : "missing",
    serviceRoleJwtProjectRef: "missing",
    supabaseUrlPresent: Boolean(supabaseUrl),
    supabaseProjectRef,
    supabaseAdminClientCreated: false,
    validationStepFailed: "none",
  };
};

const withJwtPayloadDiagnostics = (
  diagnostics: SupabaseAdminDiagnostics,
  jwtPayload: { ref?: unknown; role?: unknown } | null,
): SupabaseAdminDiagnostics => ({
  ...diagnostics,
  serviceRoleJwtRole: jwtPayload
    ? normalizeJwtRole(jwtPayload.role)
    : diagnostics.serviceRoleKeyPresent
      ? "unreadable"
      : "missing",
  serviceRoleJwtProjectRef:
    typeof jwtPayload?.ref === "string" && jwtPayload.ref
      ? jwtPayload.ref
      : "missing",
});

const withFailedStep = (
  diagnostics: SupabaseAdminDiagnostics,
  validationStepFailed: SupabaseAdminValidationStep,
): SupabaseAdminDiagnostics => ({
  ...diagnostics,
  supabaseAdminClientCreated: false,
  validationStepFailed,
});

const decodeJwtPayload = (token: string) => {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64")
        .toString("utf8"),
    ) as { exp?: unknown; ref?: unknown; role?: unknown };
  } catch {
    return null;
  }
};

const getSupabaseProjectRefFromUrl = (supabaseUrl: string) => {
  try {
    const hostname = new URL(supabaseUrl).hostname;

    if (!hostname.endsWith(".supabase.co")) {
      return "custom";
    }

    const [projectRef] = hostname.split(".");

    return projectRef || null;
  } catch {
    return null;
  }
};

export const getSupabaseAdminValidationMessage = (
  diagnostics: SupabaseAdminDiagnostics,
) => {
  switch (diagnostics.validationStepFailed) {
    case "SUPABASE_SERVICE_ROLE_KEY_MISSING":
      return "Paddle checkout is not configured: missing SUPABASE_SERVICE_ROLE_KEY.";
    case "SUPABASE_SERVICE_ROLE_KEY_UNSUPPORTED_SB_SECRET":
      return "Supabase service role key format is not supported here: use the legacy service_role JWT key that starts with eyJ, not an sb_secret key.";
    case "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT":
    case "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED":
      return "Supabase service role key format is invalid: use the legacy service_role JWT key that starts with eyJ.";
    case "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE":
      return "Supabase service role key is invalid: expected a legacy service_role JWT key.";
    case "SUPABASE_SERVICE_ROLE_KEY_EXPIRED":
      return "Supabase service role key is expired: create a fresh legacy service_role JWT key for the same Supabase project.";
    case "NEXT_PUBLIC_SUPABASE_URL_MISSING":
      return "Paddle checkout is not configured: missing NEXT_PUBLIC_SUPABASE_URL.";
    case "NEXT_PUBLIC_SUPABASE_URL_INVALID":
      return "NEXT_PUBLIC_SUPABASE_URL is invalid.";
    case "SUPABASE_URL_PROJECT_REF_MISMATCH":
      return "Supabase URL mismatch or wrong project.";
    case "SUPABASE_ADMIN_CLIENT_CREATE_FAILED":
      return "Supabase admin client could not be created.";
    case "SUPABASE_DATABASE_AUTHORIZATION_FAILED":
      return "Supabase database authorization failed after admin client validation. Check that SUPABASE_SERVICE_ROLE_KEY belongs to NEXT_PUBLIC_SUPABASE_URL and is active for this Supabase project.";
    default:
      return "Billing database authorization failed: Supabase service role key is missing, invalid, or not active in this Vercel environment.";
  }
};

export const getPaddleEnvironment = () =>
  readEnvironmentValue("PADDLE_ENVIRONMENT") === "production"
    ? "production"
    : "sandbox";

export const getPaddlePurchase = (purchaseKey: PaddlePurchaseKey) => {
  const definition = paddlePurchaseCatalog[purchaseKey];

  return {
    ...definition,
    priceId: readEnvironmentValue(definition.priceEnvironmentVariable),
  };
};

export const getPaddleSetupStatus = () => {
  const missingPaddleVariables = paddleRequiredEnvironmentVariables.filter(
    (name) => !readEnvironmentValue(name),
  );
  const missingInfrastructureVariables =
    paddleInfrastructureEnvironmentVariables.filter(
      (name) => !readEnvironmentValue(name),
    );
  const invalidVariables: string[] = [];
  const environmentValue = readEnvironmentValue("PADDLE_ENVIRONMENT");
  const clientToken = readEnvironmentValue("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");

  if (
    environmentValue &&
    environmentValue !== "sandbox" &&
    environmentValue !== "production"
  ) {
    invalidVariables.push("PADDLE_ENVIRONMENT");
  }

  if (
    clientToken &&
    ((getPaddleEnvironment() === "sandbox" && !clientToken.startsWith("test_")) ||
      (getPaddleEnvironment() === "production" &&
        !clientToken.startsWith("live_")))
  ) {
    invalidVariables.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  }

  Object.values(paddlePurchaseCatalog).forEach((definition) => {
    const priceId = readEnvironmentValue(definition.priceEnvironmentVariable);

    if (priceId && !priceId.startsWith("pri_")) {
      invalidVariables.push(definition.priceEnvironmentVariable);
    }
  });

  const missingVariables = [
    ...missingPaddleVariables,
    ...missingInfrastructureVariables,
  ];

  return {
    checkoutEnabled:
      missingVariables.length === 0 && invalidVariables.length === 0,
    environment: getPaddleEnvironment(),
    missingVariables,
    missingPaddleVariables,
    missingInfrastructureVariables,
    invalidVariables,
    diagnostics: {
      checkoutEnabled:
        missingVariables.length === 0 && invalidVariables.length === 0,
      clientTokenPresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
      ),
      plusPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PLUS",
      ),
      proPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PRO",
      ),
      starterTopupPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_STARTER_TOPUP",
      ),
      plusPackPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_PLUS_PACK",
      ),
      proPackPricePresent: isEnvironmentValuePresent(
        "NEXT_PUBLIC_PADDLE_PRICE_PRO_PACK",
      ),
    },
  };
};

export const formatPaddleSetupDiagnosticMessage = (status: {
  missingVariables: string[];
  invalidVariables: string[];
}) => {
  const details = [
    status.missingVariables.length
      ? `missing ${status.missingVariables.join(", ")}`
      : "",
    status.invalidVariables.length
      ? `invalid ${status.invalidVariables.join(", ")}`
      : "",
  ].filter(Boolean);

  return details.length
    ? `Paddle checkout is not configured: ${details.join("; ")}.`
    : "Paddle checkout is not configured.";
};

export const getPaddleClientToken = () =>
  readEnvironmentValue("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");

export const createPaddleSupabaseAdminClientWithDiagnostics = () => {
  const serviceRoleKey = readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = readEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
  const diagnostics = emptySupabaseAdminDiagnostics();

  if (!serviceRoleKey) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_MISSING",
      ),
    };
  }

  if (serviceRoleKey.startsWith("sb_secret")) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_UNSUPPORTED_SB_SECRET",
      ),
    };
  }

  if (!serviceRoleKey.startsWith("eyJ")) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT",
      ),
    };
  }

  const jwtPayload = decodeJwtPayload(serviceRoleKey);
  const diagnosticsWithJwtPayload = withJwtPayloadDiagnostics(
    diagnostics,
    jwtPayload,
  );

  if (!jwtPayload) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnosticsWithJwtPayload,
        "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED",
      ),
    };
  }

  if (jwtPayload.role !== "service_role") {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnosticsWithJwtPayload,
        "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE",
      ),
    };
  }

  if (
    typeof jwtPayload.exp === "number" &&
    Number.isFinite(jwtPayload.exp) &&
    jwtPayload.exp * 1000 <= Date.now()
  ) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnosticsWithJwtPayload,
        "SUPABASE_SERVICE_ROLE_KEY_EXPIRED",
      ),
    };
  }

  if (!supabaseUrl) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(diagnostics, "NEXT_PUBLIC_SUPABASE_URL_MISSING"),
    };
  }

  const projectRefFromUrl = getSupabaseProjectRefFromUrl(supabaseUrl);

  if (!projectRefFromUrl) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(diagnostics, "NEXT_PUBLIC_SUPABASE_URL_INVALID"),
    };
  }

  if (
    typeof jwtPayload.ref === "string" &&
    jwtPayload.ref &&
    projectRefFromUrl !== "custom" &&
    jwtPayload.ref !== projectRefFromUrl
  ) {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnostics,
        "SUPABASE_URL_PROJECT_REF_MISMATCH",
      ),
    };
  }

  try {
    return {
      adminClient: createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }),
      diagnostics: {
        ...diagnosticsWithJwtPayload,
        supabaseAdminClientCreated: true,
        validationStepFailed: "none" as const,
      },
    };
  } catch {
    return {
      adminClient: null,
      diagnostics: withFailedStep(
        diagnostics,
        "SUPABASE_ADMIN_CLIENT_CREATE_FAILED",
      ),
    };
  }
};

export const createPaddleSupabaseAdminClient = () => {
  const { adminClient } = createPaddleSupabaseAdminClientWithDiagnostics();

  return adminClient;
};
