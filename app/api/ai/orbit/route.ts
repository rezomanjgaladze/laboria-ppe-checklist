import OpenAI from "openai";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  orbitAiControlHierarchyOptions,
  parseOrbitAiStructuredRiskAssessment,
} from "@/app/lib/orbitAiRiskAssessment";

type OrbitAiRequest = {
  toolId?: string;
  toolTitle?: string;
  toolDescription?: string;
  sourceModule?: string;
  sourceMode?: "manual" | "existing_data" | "workspace_data";
  inputs?: Record<string, unknown>;
  sourceRecord?: {
    id?: unknown;
    type?: unknown;
    label?: unknown;
    description?: unknown;
    data?: unknown;
  };
};

const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
const REVIEW_NOTE =
  "Review and adapt this AI-generated draft to your specific workplace conditions before use.";
const allowedTools = new Set([
  "training-material",
  "training-quiz",
  "corrective-actions",
  "prioritize-actions",
  "suggest-deadlines",
  "risk-assessment-basic",
  "suggest-hazards",
  "recommend-controls",
  "risk-review-advanced",
  "inspection-analysis",
  "inspection-summary",
  "inspection-actions",
  "incident-investigation",
  "incident-root-causes",
  "incident-report",
  "workspace-analysis",
  "risk-trends",
  "executive-summary",
  "predictive-warning",
  "document-generation",
  "compliance-assistant",
  "ppe-recommendation",
]);

const orbitAiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    executiveSummary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          content: { type: "string" },
        },
        required: ["heading", "content"],
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    reviewNote: { type: "string" },
  },
  required: [
    "title",
    "executiveSummary",
    "sections",
    "recommendations",
    "nextSteps",
    "reviewNote",
  ],
};

const orbitAiRiskAssessmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    content: orbitAiSchema,
    structuredRiskAssessment: {
      type: "object",
      additionalProperties: false,
      properties: {
        header: {
          type: "object",
          additionalProperties: false,
          properties: {
            company: { type: "string" },
            site: { type: "string" },
            department: { type: "string" },
            title: { type: "string" },
            assessor: { type: "string" },
            assessmentDate: { type: "string" },
            sector: { type: "string" },
            activity: { type: "string" },
          },
          required: [
            "company",
            "site",
            "department",
            "title",
            "assessor",
            "assessmentDate",
            "sector",
            "activity",
          ],
        },
        hazards: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              workplaceActivity: { type: "string" },
              hazardDescription: { type: "string" },
              whoMayBeHarmed: { type: "string" },
              possibleConsequence: { type: "string" },
              existingMeasures: { type: "string" },
              initialProbability: { type: "integer", minimum: 1, maximum: 5 },
              initialSeverity: { type: "integer", minimum: 1, maximum: 5 },
              initialRiskScore: { type: "integer", minimum: 1, maximum: 25 },
              additionalMeasures: { type: "string" },
              controlHierarchy: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                  enum: orbitAiControlHierarchyOptions,
                },
              },
              residualProbability: { type: "integer", minimum: 1, maximum: 5 },
              residualSeverity: { type: "integer", minimum: 1, maximum: 5 },
              residualRiskScore: { type: "integer", minimum: 1, maximum: 25 },
              responsiblePerson: { type: "string" },
              completionDeadline: { type: "string" },
              status: {
                type: "string",
                enum: ["Open", "In Progress", "Closed"],
              },
              comments: { type: "string" },
            },
            required: [
              "workplaceActivity",
              "hazardDescription",
              "whoMayBeHarmed",
              "possibleConsequence",
              "existingMeasures",
              "initialProbability",
              "initialSeverity",
              "initialRiskScore",
              "additionalMeasures",
              "controlHierarchy",
              "residualProbability",
              "residualSeverity",
              "residualRiskScore",
              "responsiblePerson",
              "completionDeadline",
              "status",
              "comments",
            ],
          },
        },
      },
      required: ["header", "hazards"],
    },
  },
  required: ["content", "structuredRiskAssessment"],
};

const sanitizeText = (value: unknown, maxLength = 1200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const sanitizeInputs = (inputs: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(inputs || {})
      .slice(0, 20)
      .map(([key, value]) => [
        sanitizeText(key, 80),
        sanitizeText(value, 2400),
      ])
      .filter(([key, value]) => key && value),
  );

const getConfiguration = (rawApiKey: string | undefined) => {
  const apiKey = rawApiKey?.trim() || "";

  return {
    model: OPENAI_MODEL,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyLength: apiKey.length,
    apiKeyFingerprint: apiKey
      ? createHash("sha256").update(apiKey).digest("hex").slice(0, 12)
      : undefined,
    apiKeyFormat: apiKey.startsWith("sk-proj-")
      ? "project-key"
      : apiKey.startsWith("sk-")
        ? "api-key"
        : apiKey
          ? "unexpected-prefix"
          : "missing",
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    vercelEnvironment: process.env.VERCEL_ENV || "local",
    deploymentUrl: process.env.VERCEL_URL || "local",
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  };
};

const getErrorDetails = (error: unknown) => {
  const apiError =
    error && typeof error === "object"
      ? (error as {
          status?: unknown;
          code?: unknown;
          type?: unknown;
          requestID?: unknown;
          request_id?: unknown;
        })
      : null;

  return {
    model: OPENAI_MODEL,
    name: error instanceof Error ? error.name : "UnknownError",
    message:
      error instanceof Error
        ? error.message
        : "OpenAI request failed with a non-Error value.",
    status: typeof apiError?.status === "number" ? apiError.status : undefined,
    code: typeof apiError?.code === "string" ? apiError.code : undefined,
    type: typeof apiError?.type === "string" ? apiError.type : undefined,
    requestId:
      typeof apiError?.requestID === "string"
        ? apiError.requestID
        : typeof apiError?.request_id === "string"
          ? apiError.request_id
          : undefined,
  };
};

const buildPrompt = ({
  toolTitle,
  toolDescription,
  sourceModule,
  sourceMode,
  inputs,
  sourceRecord,
}: {
  toolTitle: string;
  toolDescription: string;
  sourceModule: string;
  sourceMode: "manual" | "existing_data" | "workspace_data";
  inputs: Record<string, string>;
  sourceRecord: {
    type: string;
    label: string;
    description: string;
    data: string;
  } | null;
}) => `
Create a professional workplace health and safety operational draft.

AI tool: ${toolTitle}
Purpose: ${toolDescription}
Orbit module: ${sourceModule}
Generation mode: ${sourceMode === "workspace_data" ? "All available Orbit workspace data" : sourceMode === "existing_data" ? "Single verified Orbit record" : "Manual operational input"}

Rules:
- Use only the supplied context.
- Do not invent incidents, measurements, legal guarantees, compliance claims, people, or site facts.
- Clearly separate verified source facts from recommendations.
- Keep recommendations practical, proportionate, and suitable for HSE manager review.
- For predictive or trend tools, describe signals and limitations; do not claim certainty.
- For risk assessments, include hazards, consequences, controls, and review priorities.
- For AI Generate Risk Assessment, return a complete editable 5x5 assessment. Calculate each risk score as probability multiplied by severity. Keep responsible person and completion deadline blank unless they are supplied in the source context.
- For incident tools, distinguish observed facts, possible contributing factors, and investigation questions.
- For training tools, provide practical learning structure and knowledge checks where appropriate.
- The reviewNote field must exactly contain: "${REVIEW_NOTE}"

Manual context:
${JSON.stringify(inputs, null, 2)}

${
  sourceRecord
    ? `Selected Orbit source:
- Type: ${sourceRecord.type}
- Label: ${sourceRecord.label}
- Description: ${sourceRecord.description}

Source data:
${sourceRecord.data}`
    : "No existing Orbit record selected."
}
`;

export async function POST(request: Request) {
  const configuration = getConfiguration(process.env.OPENAI_API_KEY);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to use Orbit AI." },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("Orbit AI configuration error", {
      configuration,
      message: "OPENAI_API_KEY is missing or empty.",
    });
    return NextResponse.json(
      { error: "OpenAI API key is not configured." },
      { status: 503 },
    );
  }

  let body: OrbitAiRequest;
  try {
    body = (await request.json()) as OrbitAiRequest;
  } catch {
    return NextResponse.json(
      { error: "Please complete the AI form and try again." },
      { status: 400 },
    );
  }

  const toolId = sanitizeText(body.toolId, 120);
  const toolTitle = sanitizeText(body.toolTitle, 180);
  const toolDescription = sanitizeText(body.toolDescription, 500);
  const sourceModule = sanitizeText(body.sourceModule, 120);
  const sourceMode =
    body.sourceMode === "existing_data" || body.sourceMode === "workspace_data"
      ? body.sourceMode
      : "manual";
  const inputs = sanitizeInputs(body.inputs);
  const sourceRecord =
    sourceMode !== "manual" && body.sourceRecord
      ? {
          type: sanitizeText(body.sourceRecord.type, 120),
          label: sanitizeText(body.sourceRecord.label, 240),
          description: sanitizeText(body.sourceRecord.description, 600),
          data: sanitizeText(body.sourceRecord.data, 30000),
        }
      : null;

  if (!allowedTools.has(toolId) || !toolTitle || !toolDescription || !sourceModule) {
    return NextResponse.json(
      { error: "This Orbit AI tool is not available." },
      { status: 400 },
    );
  }

  if (sourceMode === "manual" && Object.keys(inputs).length === 0) {
    return NextResponse.json(
      { error: "Please add operational context before generating." },
      { status: 400 },
    );
  }

  if (sourceMode !== "manual" && (!sourceRecord || !sourceRecord.data)) {
    return NextResponse.json(
      { error: "Please select an existing Orbit record before generating." },
      { status: 400 },
    );
  }

  console.info("Orbit AI request started", {
    configuration,
    userId: user.id,
    toolId,
    sourceMode,
    sourceType: sourceRecord?.type,
  });

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: buildPrompt({
        toolTitle,
        toolDescription,
        sourceModule,
        sourceMode,
        inputs,
        sourceRecord,
      }),
      text: {
        format: {
          type: "json_schema",
          name:
            toolId === "risk-assessment-basic"
              ? "laboria_orbit_ai_risk_assessment"
              : "laboria_orbit_ai_generation",
          strict: true,
          schema:
            toolId === "risk-assessment-basic"
              ? orbitAiRiskAssessmentSchema
              : orbitAiSchema,
        },
      },
      max_output_tokens: toolId === "risk-assessment-basic" ? 9000 : 5200,
    });

    if (!response.output_text) {
      throw new Error("OpenAI response did not include generated content.");
    }

    console.info("Orbit AI request succeeded", {
      configuration,
      userId: user.id,
      toolId,
      responseId: response.id,
    });

    const parsed = JSON.parse(response.output_text) as unknown;

    if (toolId === "risk-assessment-basic") {
      const structuredResponse =
        parsed && typeof parsed === "object"
          ? (parsed as {
              content?: unknown;
              structuredRiskAssessment?: unknown;
            })
          : null;
      const structuredRiskAssessment = parseOrbitAiStructuredRiskAssessment(
        structuredResponse?.structuredRiskAssessment,
      );

      if (!structuredResponse?.content || !structuredRiskAssessment) {
        console.error("Orbit AI structured risk assessment validation failed", {
          configuration,
          userId: user.id,
          toolId,
          responseId: response.id,
        });
        return NextResponse.json(
          {
            error:
              "AI returned an incomplete risk assessment structure. No AI credits were deducted. Please try again.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        content: structuredResponse.content,
        structuredRiskAssessment,
      });
    }

    return NextResponse.json({ content: parsed });
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error("Orbit AI generation failed", {
      configuration,
      userId: user.id,
      toolId,
      error: errorDetails,
    });

    if (errorDetails.status === 401 || errorDetails.code === "invalid_api_key") {
      return NextResponse.json(
        {
          error:
            "OpenAI API authentication failed. No AI credits were deducted. Please contact your workspace administrator.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Could not generate this Orbit AI draft right now. No AI credits were deducted. Please try again.",
      },
      { status: 502 },
    );
  }
}
