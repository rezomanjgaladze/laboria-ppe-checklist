import { describe, expect, it } from "vitest";
import { AI_REPORT_REVIEW_NOTE, type AiReportDocument } from "@/app/lib/aiReport";
import { buildAiReportPdf } from "@/app/lib/aiReportPdf";
import { defaultWorkspaceSettings } from "@/app/lib/workspaceSettings";

const report: AiReportDocument = {
  id: "audit-report-001",
  reportType: "Inspection Intelligence",
  title: "Electrical Safety / Inspection: 2026",
  subtitle: "Long-form audit export with punctuation & accented text: café",
  sourceModule: "Inspections",
  sourceLabel: "Audit inspection",
  createdAt: "2026-07-11T12:00:00.000Z",
  creditsUsed: 4,
  preparedFor: "Laboria Audit Workspace",
  companyProfile: defaultWorkspaceSettings.companyProfile,
  executiveSummary: "A practical summary. ".repeat(80),
  keyFindings: Array.from({ length: 18 }, (_, index) => `Finding ${index + 1}`),
  kpis: [
    { label: "Compliance", value: "82%", tone: "warning" },
    { label: "Actions", value: "12", tone: "critical" },
  ],
  sections: Array.from({ length: 8 }, (_, index) => ({
    heading: `Section ${index + 1}`,
    content: "Detailed operational content for review. ".repeat(45),
  })),
  tables: [
    {
      title: "Findings",
      headers: ["Finding", "Priority", "Owner"],
      rows: Array.from({ length: 35 }, (_, index) => [
        `Finding ${index + 1}`,
        index % 2 ? "High" : "Medium",
        "HSE Team",
      ]),
    },
  ],
  recommendations: ["Verify controls", "Close overdue actions"],
  nextSteps: ["Management review"],
  actions: [],
  quiz: [],
  tags: ["Inspection"],
  reviewNote: AI_REPORT_REVIEW_NOTE,
};

describe("AI report PDF renderer", () => {
  it("creates a non-empty multi-page PDF for long structured content", () => {
    const pdf = buildAiReportPdf(report);
    const bytes = pdf.output("arraybuffer");

    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(new Uint8Array(bytes).slice(0, 4)).toEqual(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );
  });
});
