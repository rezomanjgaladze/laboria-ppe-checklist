import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const readEnvironmentValue = (name: string) => process.env[name]?.trim() || "";

export type SupabaseAdminValidationStep =
  | "none"
  | "SUPABASE_SERVICE_ROLE_KEY_MISSING"
  | "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT"
  | "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED"
  | "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE"
  | "SUPABASE_SERVICE_ROLE_KEY_EXPIRED"
  | "NEXT_PUBLIC_SUPABASE_URL_MISSING"
  | "NEXT_PUBLIC_SUPABASE_URL_INVALID"
  | "SUPABASE_URL_PROJECT_REF_MISMATCH"
  | "SUPABASE_ADMIN_CLIENT_CREATE_FAILED";

export type SupabaseAdminDiagnostics = {
  serviceRoleKeyPresent: boolean;
  serviceRoleKeyFormat: "legacy_jwt" | "secret" | "missing" | "unrecognized";
  serviceRoleJwtRole: "service_role" | "anon" | "missing" | "unreadable";
  serviceRoleJwtProjectRef: string;
  supabaseUrlPresent: boolean;
  supabaseProjectRef: string;
  supabaseAdminClientCreated: boolean;
  validationStepFailed: SupabaseAdminValidationStep;
};

const getSupabaseProjectRefFromUrl = (supabaseUrl: string) => {
  try {
    const hostname = new URL(supabaseUrl).hostname;

    if (!hostname.endsWith(".supabase.co")) {
      return "custom";
    }

    return hostname.split(".")[0] || null;
  } catch {
    return null;
  }
};

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

const getServiceRoleKeyFormat = (
  key: string,
): SupabaseAdminDiagnostics["serviceRoleKeyFormat"] => {
  if (!key) return "missing";
  if (key.startsWith("eyJ")) return "legacy_jwt";
  if (key.startsWith("sb_secret_")) return "secret";
  return "unrecognized";
};

const getBaseDiagnostics = (): SupabaseAdminDiagnostics => {
  const serviceRoleKey = readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = readEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");

  return {
    serviceRoleKeyPresent: Boolean(serviceRoleKey),
    serviceRoleKeyFormat: getServiceRoleKeyFormat(serviceRoleKey),
    serviceRoleJwtRole: serviceRoleKey ? "unreadable" : "missing",
    serviceRoleJwtProjectRef: "missing",
    supabaseUrlPresent: Boolean(supabaseUrl),
    supabaseProjectRef: supabaseUrl
      ? getSupabaseProjectRefFromUrl(supabaseUrl) || "invalid"
      : "missing",
    supabaseAdminClientCreated: false,
    validationStepFailed: "none",
  };
};

const failDiagnostics = (
  diagnostics: SupabaseAdminDiagnostics,
  validationStepFailed: SupabaseAdminValidationStep,
) => ({
  adminClient: null,
  diagnostics: {
    ...diagnostics,
    supabaseAdminClientCreated: false,
    validationStepFailed,
  },
});

export const getSupabaseAdminValidationMessage = (
  diagnostics: SupabaseAdminDiagnostics,
) => {
  switch (diagnostics.validationStepFailed) {
    case "SUPABASE_SERVICE_ROLE_KEY_MISSING":
      return "Billing is not configured: missing SUPABASE_SERVICE_ROLE_KEY.";
    case "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT":
    case "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED":
      return "SUPABASE_SERVICE_ROLE_KEY has an unsupported format.";
    case "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE":
      return "SUPABASE_SERVICE_ROLE_KEY is not a service_role key.";
    case "SUPABASE_SERVICE_ROLE_KEY_EXPIRED":
      return "SUPABASE_SERVICE_ROLE_KEY is expired.";
    case "NEXT_PUBLIC_SUPABASE_URL_MISSING":
      return "Billing is not configured: missing NEXT_PUBLIC_SUPABASE_URL.";
    case "NEXT_PUBLIC_SUPABASE_URL_INVALID":
      return "NEXT_PUBLIC_SUPABASE_URL is invalid.";
    case "SUPABASE_URL_PROJECT_REF_MISMATCH":
      return "Supabase URL mismatch or wrong project.";
    case "SUPABASE_ADMIN_CLIENT_CREATE_FAILED":
      return "Supabase billing client could not be created.";
    default:
      return "Billing database authorization failed.";
  }
};

export const createBillingSupabaseAdminClientWithDiagnostics = () => {
  const serviceRoleKey = readEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = readEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
  let diagnostics = getBaseDiagnostics();

  if (!serviceRoleKey) {
    return failDiagnostics(
      diagnostics,
      "SUPABASE_SERVICE_ROLE_KEY_MISSING",
    );
  }

  if (!["legacy_jwt", "secret"].includes(diagnostics.serviceRoleKeyFormat)) {
    return failDiagnostics(
      diagnostics,
      "SUPABASE_SERVICE_ROLE_KEY_INVALID_FORMAT",
    );
  }

  if (diagnostics.serviceRoleKeyFormat === "legacy_jwt") {
    const payload = decodeJwtPayload(serviceRoleKey);

    if (!payload) {
      return failDiagnostics(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_JWT_DECODE_FAILED",
      );
    }

    diagnostics = {
      ...diagnostics,
      serviceRoleJwtRole:
        payload.role === "service_role" || payload.role === "anon"
          ? payload.role
          : "unreadable",
      serviceRoleJwtProjectRef:
        typeof payload.ref === "string" && payload.ref
          ? payload.ref
          : "missing",
    };

    if (payload.role !== "service_role") {
      return failDiagnostics(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_NOT_SERVICE_ROLE",
      );
    }

    if (
      typeof payload.exp === "number" &&
      Number.isFinite(payload.exp) &&
      payload.exp * 1000 <= Date.now()
    ) {
      return failDiagnostics(
        diagnostics,
        "SUPABASE_SERVICE_ROLE_KEY_EXPIRED",
      );
    }
  }

  if (!supabaseUrl) {
    return failDiagnostics(diagnostics, "NEXT_PUBLIC_SUPABASE_URL_MISSING");
  }

  const projectRef = getSupabaseProjectRefFromUrl(supabaseUrl);

  if (!projectRef) {
    return failDiagnostics(diagnostics, "NEXT_PUBLIC_SUPABASE_URL_INVALID");
  }

  if (
    diagnostics.serviceRoleJwtProjectRef !== "missing" &&
    projectRef !== "custom" &&
    diagnostics.serviceRoleJwtProjectRef !== projectRef
  ) {
    return failDiagnostics(
      diagnostics,
      "SUPABASE_URL_PROJECT_REF_MISMATCH",
    );
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
        ...diagnostics,
        supabaseAdminClientCreated: true,
        validationStepFailed: "none" as const,
      },
    };
  } catch {
    return failDiagnostics(
      diagnostics,
      "SUPABASE_ADMIN_CLIENT_CREATE_FAILED",
    );
  }
};

export const createBillingSupabaseAdminClient = () =>
  createBillingSupabaseAdminClientWithDiagnostics().adminClient;
