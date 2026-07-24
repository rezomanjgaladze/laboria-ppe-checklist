import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";

const companyLogoBucket = "company-logos";
const companyLogoMetadataKey = "laboria_company_logo_path";
const maxCompanyLogoBytes = 2 * 1024 * 1024;
const allowedLogoTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export const isAllowedCompanyLogoSignature = (
  bytes: Uint8Array,
  contentType: string,
) => {
  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }

  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
};

const getAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return null;
  }

  const { supabaseUrl } = getSupabaseConfig();

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

const getLogoPath = (user: User) => {
  const value = user.user_metadata?.[companyLogoMetadataKey];

  return typeof value === "string" && value.startsWith(`${user.id}/`)
    ? value
    : "";
};

const createLogoPath = (userId: string, extension: string) =>
  `${userId}/company-logo.${extension}`;

const ensureCompanyLogoBucket = async (adminClient: SupabaseClient | null) => {
  if (!adminClient) {
    return;
  }

  const { data, error } = await adminClient.storage.getBucket(companyLogoBucket);

  if (data && !error) {
    return;
  }

  const { error: createError } = await adminClient.storage.createBucket(
    companyLogoBucket,
    {
      public: false,
      fileSizeLimit: maxCompanyLogoBytes,
      allowedMimeTypes: [...allowedLogoTypes.keys()],
    },
  );

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw createError;
  }
};

const getStorageClient = async (authenticatedClient: SupabaseClient) => {
  const adminClient = getAdminClient();
  await ensureCompanyLogoBucket(adminClient);
  return adminClient ?? authenticatedClient;
};

const toDataUrl = async (file: Blob) => {
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/png";
  return `data:${contentType};base64,${bytes.toString("base64")}`;
};

const getAuthenticatedUser = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
};

const storageSetupMessage =
  "Company logo storage is not configured. Apply the company-logos Supabase storage migration or configure SUPABASE_SERVICE_ROLE_KEY.";

const isStorageSetupError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("bucket") ||
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("policy") ||
    normalizedMessage.includes("not found")
  );
};

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const logoPath = getLogoPath(user);

  if (!logoPath) {
    return NextResponse.json({ logoDataUrl: "", logoPath: "" });
  }

  try {
    const storageClient = await getStorageClient(supabase);
    const { data, error } = await storageClient.storage
      .from(companyLogoBucket)
      .download(logoPath);

    if (error || !data) {
      console.error("[company-logo] download failed", {
        userId: user.id,
        logoPath,
        error,
      });
      return NextResponse.json(
        { error: "Could not load the saved company logo." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      logoDataUrl: await toDataUrl(data),
      logoPath,
    });
  } catch (error) {
    console.error("[company-logo] download setup failed", {
      userId: user.id,
      logoPath,
      error,
    });
    return NextResponse.json({ error: storageSetupMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const formData = await request.formData();
  const logo = formData.get("logo");

  if (!(logo instanceof File)) {
    return NextResponse.json(
      { error: "Choose a company logo image to upload." },
      { status: 400 },
    );
  }

  const extension = allowedLogoTypes.get(logo.type);

  if (!extension) {
    return NextResponse.json(
      { error: "Use a PNG, JPG, JPEG, or WEBP image." },
      { status: 400 },
    );
  }

  if (logo.size > maxCompanyLogoBytes) {
    return NextResponse.json(
      { error: "Company logo must be 2 MB or smaller." },
      { status: 400 },
    );
  }

  const logoBytes = new Uint8Array(await logo.arrayBuffer());

  if (!isAllowedCompanyLogoSignature(logoBytes, logo.type)) {
    return NextResponse.json(
      { error: "The selected file content does not match its image format." },
      { status: 400 },
    );
  }

  const previousLogoPath = getLogoPath(user);
  const logoPath = createLogoPath(user.id, extension);

  console.info("[company-logo] upload started", {
    userId: user.id,
    logoPath,
    size: logo.size,
    type: logo.type,
  });

  try {
    const storageClient = await getStorageClient(supabase);
    const { error: uploadError } = await storageClient.storage
      .from(companyLogoBucket)
      .upload(logoPath, logo, {
        cacheControl: "3600",
        contentType: logo.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[company-logo] upload failed", {
        userId: user.id,
        logoPath,
        error: uploadError,
      });
      return NextResponse.json(
        {
          error: isStorageSetupError(uploadError.message)
            ? storageSetupMessage
            : "Could not upload the company logo. Please try again.",
        },
        { status: 500 },
      );
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { [companyLogoMetadataKey]: logoPath },
    });

    if (metadataError) {
      console.error("[company-logo] metadata update failed", {
        userId: user.id,
        logoPath,
        error: metadataError,
      });
      await storageClient.storage.from(companyLogoBucket).remove([logoPath]);
      return NextResponse.json(
        { error: "Logo uploaded, but the workspace profile could not be updated." },
        { status: 500 },
      );
    }

    if (previousLogoPath && previousLogoPath !== logoPath) {
      const { error: removeError } = await storageClient.storage
        .from(companyLogoBucket)
        .remove([previousLogoPath]);

      if (removeError) {
        console.error("[company-logo] old logo cleanup failed", {
          userId: user.id,
          previousLogoPath,
          error: removeError,
        });
      }
    }

    console.info("[company-logo] upload succeeded", {
      userId: user.id,
      logoPath,
    });

    return NextResponse.json({
      logoDataUrl: await toDataUrl(logo),
      logoPath,
    });
  } catch (error) {
    console.error("[company-logo] upload setup failed", {
      userId: user.id,
      logoPath,
      error,
    });
    return NextResponse.json({ error: storageSetupMessage }, { status: 500 });
  }
}

export async function DELETE() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const logoPath = getLogoPath(user);

  try {
    const storageClient = await getStorageClient(supabase);

    if (logoPath) {
      const { error: removeError } = await storageClient.storage
        .from(companyLogoBucket)
        .remove([logoPath]);

      if (removeError) {
        console.error("[company-logo] removal failed", {
          userId: user.id,
          logoPath,
          error: removeError,
        });
        return NextResponse.json(
          { error: "Could not remove the company logo. Please try again." },
          { status: 500 },
        );
      }
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { [companyLogoMetadataKey]: null },
    });

    if (metadataError) {
      console.error("[company-logo] metadata clear failed", {
        userId: user.id,
        logoPath,
        error: metadataError,
      });
      return NextResponse.json(
        { error: "Could not update the workspace profile." },
        { status: 500 },
      );
    }

    return NextResponse.json({ logoDataUrl: "", logoPath: "" });
  } catch (error) {
    console.error("[company-logo] removal setup failed", {
      userId: user.id,
      logoPath,
      error,
    });
    return NextResponse.json({ error: storageSetupMessage }, { status: 500 });
  }
}
