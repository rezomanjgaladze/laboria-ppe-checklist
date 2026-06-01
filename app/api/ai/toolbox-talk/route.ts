import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ToolboxTalkContent,
  ToolboxTalkInputs,
  ToolboxTalkRiskAssessmentSource,
  ToolboxTalkSourceType,
  ToolboxTalkVariant,
} from "@/app/lib/toolboxTalks";

type GenerateToolboxTalkRequest = {
  variant?: ToolboxTalkVariant;
  inputs?: Partial<ToolboxTalkInputs>;
  sourceType?: ToolboxTalkSourceType;
  riskAssessment?: Partial<ToolboxTalkRiskAssessmentSource>;
};

const REVIEW_NOTE =
  "Review and adapt this toolbox talk to your specific workplace conditions before use.";
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 6;
const generationRequests = new Map<string, number[]>();

const toolboxTalkSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    targetAudience: { type: "string" },
    duration: { type: "string" },
    keyHazards: {
      type: "array",
      items: { type: "string" },
    },
    mainDiscussionScript: { type: "string" },
    safeWorkPractices: {
      type: "array",
      items: { type: "string" },
    },
    workerQuestions: {
      type: "array",
      items: { type: "string" },
    },
    supervisorNotes: { type: "string" },
    attendanceSignatureSection: { type: "string" },
    closingReminder: { type: "string" },
    quiz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
    reviewNote: { type: "string" },
  },
  required: [
    "title",
    "objective",
    "targetAudience",
    "duration",
    "keyHazards",
    "mainDiscussionScript",
    "safeWorkPractices",
    "workerQuestions",
    "supervisorNotes",
    "attendanceSignatureSection",
    "closingReminder",
    "quiz",
    "reviewNote",
  ],
};

const sanitizeText = (value: unknown, maxLength = 1200) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeInputs = (
  inputs: Partial<ToolboxTalkInputs> | undefined,
): ToolboxTalkInputs => ({
  topic: sanitizeText(inputs?.topic, 180),
  industrySector: sanitizeText(inputs?.industrySector, 120),
  department: sanitizeText(inputs?.department, 120),
  targetAudience: sanitizeText(inputs?.targetAudience, 180),
  duration: sanitizeText(inputs?.duration, 80),
  language: sanitizeText(inputs?.language, 80),
  riskLevel: sanitizeText(inputs?.riskLevel, 40),
  keyHazardsNotes: sanitizeText(inputs?.keyHazardsNotes, 1800),
});

const hasRequiredInputs = (inputs: ToolboxTalkInputs) =>
  Object.values(inputs).every(Boolean);

const clampRiskValue = (value: unknown) =>
  Math.min(Math.max(Math.round(Number(value) || 1), 1), 5);

const getRiskLevel = (score: number) => {
  if (score >= 15) return "High";
  if (score >= 4) return "Medium";
  return "Low";
};

const normalizeRiskAssessment = (
  source: Partial<ToolboxTalkRiskAssessmentSource> | undefined,
): ToolboxTalkRiskAssessmentSource | null => {
  if (!source?.id || !Array.isArray(source.hazards)) {
    return null;
  }

  const hazards = source.hazards.slice(0, 100).map((hazard, index) => {
    const residualProbability = clampRiskValue(hazard.residualProbability);
    const residualSeverity = clampRiskValue(hazard.residualSeverity);
    const residualScore = residualProbability * residualSeverity;

    return {
      id: sanitizeText(hazard.id, 120) || `hazard-${index + 1}`,
      workplaceActivity: sanitizeText(hazard.workplaceActivity, 240),
      hazardDescription: sanitizeText(hazard.hazardDescription, 600),
      possibleConsequence: sanitizeText(hazard.possibleConsequence, 480),
      existingMeasures: sanitizeText(hazard.existingMeasures, 900),
      additionalMeasures: sanitizeText(hazard.additionalMeasures, 900),
      controlHierarchy: Array.isArray(hazard.controlHierarchy)
        ? hazard.controlHierarchy
            .map((control) => sanitizeText(control, 120))
            .filter(Boolean)
        : [],
      residualProbability,
      residualSeverity,
      residualScore,
      residualRiskLevel: getRiskLevel(residualScore),
      comments: sanitizeText(hazard.comments, 500),
    };
  });
  const highestScore = hazards.reduce(
    (highest, hazard) => Math.max(highest, hazard.residualScore),
    0,
  );

  return {
    id: sanitizeText(source.id, 120),
    title: sanitizeText(source.title, 240),
    siteLocation: sanitizeText(source.siteLocation, 180),
    department: sanitizeText(source.department, 180),
    sector: sanitizeText(source.sector, 180),
    activity: sanitizeText(source.activity, 240),
    savedAt: sanitizeText(source.savedAt, 80),
    highestResidualRiskLevel: getRiskLevel(highestScore),
    hazards: hazards.sort((a, b) => b.residualScore - a.residualScore),
  };
};

const buildPrompt = (
  inputs: ToolboxTalkInputs,
  variant: ToolboxTalkVariant,
  sourceType: ToolboxTalkSourceType,
  riskAssessment: ToolboxTalkRiskAssessmentSource | null,
) => `
Create a professional, practical workplace health and safety toolbox talk.

Use only the operational context supplied below. Do not invent site-specific facts,
legal guarantees, compliance claims, or incident details. Write in ${inputs.language}.
Keep the discussion suitable for a supervisor to deliver in ${inputs.duration}.
Use clear workplace language and concrete safe-work guidance.
${variant === "quiz" ? "Include 3 to 5 short knowledge-check quiz questions with answers." : "Return an empty quiz array."}
The reviewNote field must exactly contain:
"${REVIEW_NOTE}"

Operational context:
- Topic: ${inputs.topic}
- Industry / sector: ${inputs.industrySector}
- Department: ${inputs.department}
- Target audience: ${inputs.targetAudience}
- Duration: ${inputs.duration}
- Risk level: ${inputs.riskLevel}
- Key hazards / notes: ${inputs.keyHazardsNotes}

${sourceType === "risk_assessment" && riskAssessment ? `This toolbox talk is based on the following saved risk assessment. Cover every relevant hazard in a concise, worker-friendly way. Prioritize high residual risks first. Turn the verified preventive measures, additional controls, hierarchy controls, PPE requirements, emergency controls, supervision requirements, and training needs into practical talking points. Do not invent controls that are not supported by the assessment unless clearly presented as a supervisor consideration.\n\nSaved risk assessment JSON:\n${JSON.stringify(riskAssessment)}` : ""}

The attendanceSignatureSection should provide a concise printable attendance
instruction and signature-table heading, not fabricated attendee names.
`;

const isRateLimited = (userId: string) => {
  const now = Date.now();
  const recentRequests = (generationRequests.get(userId) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentRequests.length >= RATE_LIMIT_REQUESTS) {
    generationRequests.set(userId, recentRequests);
    return true;
  }

  generationRequests.set(userId, [...recentRequests, now]);
  return false;
};

const getOpenAiErrorDetails = (error: unknown) => {
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
    stack: error instanceof Error ? error.stack : undefined,
  };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to generate a toolbox talk." },
      { status: 401 },
    );
  }

  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!openAiApiKey) {
    console.error("AI Toolbox Talk Generator configuration error", {
      model: OPENAI_MODEL,
      message: "OPENAI_API_KEY is missing or empty.",
    });
    return NextResponse.json(
      { error: "OpenAI API key is not configured." },
      { status: 503 },
    );
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      {
        error:
          "Toolbox talk generation is temporarily limited. Please wait a few minutes and try again.",
      },
      { status: 429 },
    );
  }

  let body: GenerateToolboxTalkRequest;

  try {
    body = (await request.json()) as GenerateToolboxTalkRequest;
  } catch {
    return NextResponse.json(
      { error: "Please complete the toolbox talk form and try again." },
      { status: 400 },
    );
  }

  const variant: ToolboxTalkVariant =
    body.variant === "quiz" ? "quiz" : "basic";
  const sourceType: ToolboxTalkSourceType =
    body.sourceType === "risk_assessment" ? "risk_assessment" : "manual_topic";
  const inputs = normalizeInputs(body.inputs);
  const riskAssessment =
    sourceType === "risk_assessment"
      ? normalizeRiskAssessment(body.riskAssessment)
      : null;

  if (sourceType === "risk_assessment" && !riskAssessment) {
    return NextResponse.json(
      { error: "Please select a saved risk assessment before generating." },
      { status: 400 },
    );
  }

  if (!hasRequiredInputs(inputs)) {
    return NextResponse.json(
      { error: "Please complete all toolbox talk inputs before generating." },
      { status: 400 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey: openAiApiKey });
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: buildPrompt(inputs, variant, sourceType, riskAssessment),
      text: {
        format: {
          type: "json_schema",
          name: "laboria_toolbox_talk",
          strict: true,
          schema: toolboxTalkSchema,
        },
      },
      max_output_tokens: 4200,
    });

    if (!response.output_text) {
      throw new Error("OpenAI response did not include generated content.");
    }

    const content = JSON.parse(response.output_text) as ToolboxTalkContent;

    return NextResponse.json({ content });
  } catch (error) {
    const errorDetails = getOpenAiErrorDetails(error);

    console.error("AI Toolbox Talk generation failed", errorDetails);

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
          "Could not generate the toolbox talk right now. No AI credits were deducted. Please try again.",
      },
      { status: 502 },
    );
  }
}
