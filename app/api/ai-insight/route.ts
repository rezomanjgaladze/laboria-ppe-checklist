import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type FailedInspectionItem = {
  section: string;
  item: string;
  answer: string;
  risk: string;
  comments?: string;
};

type RiskCounts = {
  high: number;
  medium: number;
  low: number;
};

type AiSafetyInsightRequest = {
  checklistType: string;
  reportType: string;
  companyName: string;
  siteLocation: string;
  inspector: string;
  inspectionDate: string;
  complianceScore: number;
  complianceStatus: string;
  riskCounts: RiskCounts;
  failedItems: FailedInspectionItem[];
  comments: string[];
  answeredItems: number;
  totalItems: number;
};

const NOT_CONFIGURED_MESSAGE = "AI Safety Insights are not configured yet.";
const EMPTY_CHECKLIST_MESSAGE =
  "Complete at least one checklist item before generating AI Safety Insights.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanNumber(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function cleanRiskCounts(value: unknown): RiskCounts {
  if (!isRecord(value)) {
    return { high: 0, medium: 0, low: 0 };
  }

  return {
    high: Math.max(0, Math.round(cleanNumber(value.high))),
    medium: Math.max(0, Math.round(cleanNumber(value.medium))),
    low: Math.max(0, Math.round(cleanNumber(value.low))),
  };
}

function cleanFailedItems(value: unknown): FailedInspectionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .slice(0, 80)
    .map((item) => ({
      section: cleanString(item.section, 160) || "Unspecified section",
      item: cleanString(item.item, 500) || "Unspecified checklist item",
      answer: cleanString(item.answer, 80) || "Non-compliant",
      risk: cleanString(item.risk, 80) || "Not rated",
      comments: cleanString(item.comments, 500),
    }));
}

function cleanComments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((comment) => cleanString(comment, 500)).filter(Boolean);
}

function sanitizeInspectionData(body: unknown): AiSafetyInsightRequest {
  const data = isRecord(body) ? body : {};
  const complianceScore = Math.min(
    100,
    Math.max(0, Math.round(cleanNumber(data.complianceScore))),
  );

  return {
    checklistType: cleanString(data.checklistType, 160) || "Not provided",
    reportType: cleanString(data.reportType, 160) || "Not provided",
    companyName: cleanString(data.companyName, 160) || "Not provided",
    siteLocation: cleanString(data.siteLocation, 160) || "Not provided",
    inspector: cleanString(data.inspector, 160) || "Not provided",
    inspectionDate: cleanString(data.inspectionDate, 80) || "Not provided",
    complianceScore,
    complianceStatus: cleanString(data.complianceStatus, 120) || "Not provided",
    riskCounts: cleanRiskCounts(data.riskCounts),
    failedItems: cleanFailedItems(data.failedItems),
    comments: cleanComments(data.comments),
    answeredItems: Math.max(0, Math.round(cleanNumber(data.answeredItems))),
    totalItems: Math.max(0, Math.round(cleanNumber(data.totalItems))),
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: NOT_CONFIGURED_MESSAGE, code: "not_configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const inspectionData = sanitizeInspectionData(body);

    if (inspectionData.answeredItems === 0) {
      return NextResponse.json(
        { error: EMPTY_CHECKLIST_MESSAGE, code: "empty_checklist" },
        { status: 400 },
      );
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: [
            "You are a senior occupational health and safety auditor for Laboria Safety Checklists.",
            "Generate concise, professional AI Safety Insights for management and inspection teams.",
            "Use only the inspection data provided by the user. Do not invent company details, hazards, failed items, comments, dates, names, or legal findings.",
            "If a field is missing or marked Not provided, say it is not provided or omit it where appropriate.",
            "Return plain text with these exact section headings:",
            "Professional Inspection Summary",
            "Key Risk Interpretation",
            "Corrective Actions",
            "Priority Recommendations",
            "Management-Level Conclusion",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(inspectionData, null, 2),
        },
      ],
    });

    const result = completion.choices[0]?.message.content?.trim();

    if (!result) {
      throw new Error("Empty AI response");
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI Safety Insights request failed:", error);

    return NextResponse.json(
      {
        error:
          "AI Safety Insights could not be generated right now. Please try again later.",
      },
      { status: 500 },
    );
  }
}
