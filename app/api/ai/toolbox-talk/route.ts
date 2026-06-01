import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ToolboxTalkContent,
  ToolboxTalkInputs,
  ToolboxTalkVariant,
} from "@/app/lib/toolboxTalks";

type GenerateToolboxTalkRequest = {
  variant?: ToolboxTalkVariant;
  inputs?: Partial<ToolboxTalkInputs>;
};

const REVIEW_NOTE =
  "Review and adapt this toolbox talk to your specific workplace conditions before use.";
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

const buildPrompt = (inputs: ToolboxTalkInputs, variant: ToolboxTalkVariant) => `
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI Toolbox Talk Generator is not configured yet." },
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
  const inputs = normalizeInputs(body.inputs);

  if (!hasRequiredInputs(inputs)) {
    return NextResponse.json(
      { error: "Please complete all toolbox talk inputs before generating." },
      { status: 400 },
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      input: buildPrompt(inputs, variant),
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
    console.error("AI Toolbox Talk generation failed", error);
    return NextResponse.json(
      {
        error:
          "Could not generate the toolbox talk right now. No AI credits were deducted. Please try again.",
      },
      { status: 502 },
    );
  }
}
