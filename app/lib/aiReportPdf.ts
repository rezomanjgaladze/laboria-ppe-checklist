import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  AiReportDocument,
  AiReportTable,
  AiReportTone,
} from "@/app/lib/aiReport";

type Rgb = [number, number, number];

const navy: Rgb = [7, 18, 37];
const cyan: Rgb = [77, 235, 255];
const blue: Rgb = [30, 144, 255];
const slate: Rgb = [71, 85, 105];
const paleBlue: Rgb = [235, 247, 255];
const tones: Record<AiReportTone, { fill: Rgb; text: Rgb }> = {
  neutral: { fill: [241, 245, 249], text: [51, 65, 85] },
  info: { fill: [224, 242, 254], text: [3, 105, 161] },
  success: { fill: [220, 252, 231], text: [22, 101, 52] },
  warning: { fill: [254, 243, 199], text: [146, 64, 14] },
  critical: { fill: [254, 226, 226], text: [153, 27, 27] },
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);

const getRiskCellColor = (score: number): Rgb =>
  score >= 15 ? [254, 226, 226] : score >= 4 ? [254, 243, 199] : [220, 252, 231];

export const exportAiReportPdf = (report: AiReportDocument) => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 45;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 19) return;
    pdf.addPage();
    y = 20;
  };

  const addWrapped = (
    value: string,
    options: {
      size?: number;
      color?: Rgb;
      gap?: number;
      x?: number;
      width?: number;
      bold?: boolean;
    } = {},
  ) => {
    const size = options.size ?? 9;
    const x = options.x ?? margin;
    const width = options.width ?? contentWidth;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? slate));
    const lines = pdf.splitTextToSize(value || "Not recorded", width) as string[];
    const height = Math.max(lines.length, 1) * size * 0.4 + (options.gap ?? 2);
    ensureSpace(height);
    pdf.text(lines, x, y);
    y += height;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(13);
    pdf.setFillColor(...paleBlue);
    pdf.roundedRect(margin, y - 4, contentWidth, 9, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(7, 89, 168);
    pdf.text(title, margin + 3, y + 2);
    y += 11;
  };

  const addBulletList = (items: string[]) => {
    items.forEach((item) => addWrapped(`- ${item}`, { gap: 1 }));
    y += 2;
  };

  const addTable = (table: AiReportTable) => {
    addSectionTitle(table.title);
    autoTable(pdf, {
      startY: y,
      head: [table.headers],
      body: table.rows,
      theme: "grid",
      margin: { left: margin, right: margin, top: 18, bottom: 18 },
      styles: {
        font: "helvetica",
        fontSize: table.headers.length > 5 ? 6.2 : 7.5,
        cellPadding: 2,
        overflow: "linebreak",
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.18,
      },
      headStyles: {
        fillColor: navy,
        textColor: [245, 247, 250],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y =
      ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y) + 6;
  };

  pdf.setFillColor(...navy);
  pdf.rect(0, 0, pageWidth, 37, "F");
  pdf.setFillColor(...blue);
  pdf.rect(0, 35, pageWidth, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...cyan);
  pdf.text("LABORIA ORBIT", margin, 11);
  pdf.setFontSize(17);
  pdf.setTextColor(245, 247, 250);
  pdf.text(report.reportType.toUpperCase(), margin, 21);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("AI-generated operational HSE report", margin, 29);
  pdf.setTextColor(...cyan);
  pdf.text(`${report.creditsUsed} AI CREDITS`, pageWidth - margin, 12, {
    align: "right",
  });
  pdf.setTextColor(203, 213, 225);
  pdf.text(formatDate(report.createdAt), pageWidth - margin, 20, {
    align: "right",
  });
  pdf.text(`Report ${report.id.slice(0, 10)}`, pageWidth - margin, 28, {
    align: "right",
  });

  pdf.setTextColor(...navy);
  addWrapped(report.title, { size: 17, bold: true, color: navy, gap: 4 });
  addWrapped(report.subtitle, { size: 9, color: [7, 89, 168], gap: 4 });

  ensureSpace(20);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y - 3, contentWidth, 18, 2, 2, "F");
  const metaY = y + 2;
  pdf.setFontSize(7.5);
  pdf.setTextColor(...slate);
  pdf.setFont("helvetica", "bold");
  pdf.text("PREPARED FOR", margin + 3, metaY);
  pdf.text("SOURCE MODULE", margin + 63, metaY);
  pdf.text("SOURCE RECORD", margin + 123, metaY);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...navy);
  pdf.text(report.preparedFor, margin + 3, metaY + 5);
  pdf.text(report.sourceModule, margin + 63, metaY + 5);
  pdf.text(report.sourceLabel || "Manual operational input", margin + 123, metaY + 5, {
    maxWidth: 48,
  });
  y += 23;

  if (report.companyProfile.companyName || report.companyProfile.logoDataUrl) {
    ensureSpace(18);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y - 3, contentWidth, 15, 2, 2, "F");
    let companyTextX = margin + 3;
    if (report.companyProfile.logoDataUrl) {
      try {
        const logoFormat = report.companyProfile.logoDataUrl.startsWith("data:image/jpeg")
          ? "JPEG"
          : "PNG";
        pdf.addImage(
          report.companyProfile.logoDataUrl,
          logoFormat,
          margin + 3,
          y - 1,
          18,
          10,
        );
        companyTextX += 22;
      } catch {
        companyTextX = margin + 3;
      }
    }
    const companyDetails = [
      report.companyProfile.companyName,
      report.companyProfile.industrySector,
      report.companyProfile.mainSiteLocation,
      report.companyProfile.contactEmail,
      report.companyProfile.phone,
      report.companyProfile.address,
    ]
      .filter(Boolean)
      .join(" | ");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...slate);
    pdf.text(
      pdf.splitTextToSize(companyDetails || "Workspace company branding", pageWidth - margin - companyTextX - 3),
      companyTextX,
      y + 3,
    );
    y += 19;
  }

  if (report.kpis.length) {
    addSectionTitle("Report Snapshot");
    const columns = Math.min(report.kpis.length, 4);
    const gap = 3;
    const width = (contentWidth - gap * (columns - 1)) / columns;
    report.kpis.slice(0, 8).forEach((kpi, index) => {
      if (index > 0 && index % columns === 0) y += 17;
      ensureSpace(16);
      const x = margin + (index % columns) * (width + gap);
      const tone = tones[kpi.tone ?? "neutral"];
      pdf.setFillColor(...tone.fill);
      pdf.roundedRect(x, y - 3, width, 14, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...tone.text);
      pdf.text(kpi.value, x + 3, y + 3);
      pdf.setFontSize(7);
      pdf.text(kpi.label.toUpperCase(), x + 3, y + 8, { maxWidth: width - 6 });
    });
    y += report.kpis.length > columns ? 21 : 18;
  }

  addSectionTitle("Executive Summary");
  addWrapped(report.executiveSummary, { gap: 4 });

  if (report.keyFindings.length) {
    addSectionTitle("Key Findings");
    addBulletList(report.keyFindings);
  }

  if (report.riskMatrix) {
    addSectionTitle(report.riskMatrix.title);
    autoTable(pdf, {
      startY: y,
      head: [["Likelihood / Severity", "1", "2", "3", "4", "5"]],
      body: report.riskMatrix.counts.map((row, rowIndex) => [
        String(5 - rowIndex),
        ...row.map(String),
      ]),
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { halign: "center", fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: navy, textColor: [245, 247, 250] },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index === 0) return;
        const probability = 5 - data.row.index;
        const severity = data.column.index;
        data.cell.styles.fillColor = getRiskCellColor(probability * severity);
        data.cell.styles.textColor = navy;
        data.cell.styles.fontStyle = "bold";
      },
    });
    y =
      ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? y) + 6;
  }

  report.sections.forEach((section) => {
    addSectionTitle(section.heading);
    addWrapped(section.content, { gap: 4 });
  });

  report.tables.forEach(addTable);

  if (report.actions.length) {
    addTable({
      title: "Recommended Action Plan",
      headers: ["Action", "Priority", "Owner", "Due Date", "Status"],
      rows: report.actions.map((action) => [
        action.title,
        action.priority,
        action.owner,
        action.dueDate,
        action.status,
      ]),
    });
  }

  if (report.recommendations.length) {
    addSectionTitle("Recommendations");
    addBulletList(report.recommendations);
  }

  if (report.nextSteps.length) {
    addSectionTitle("Next Steps");
    addBulletList(report.nextSteps);
  }

  if (report.quiz.length) {
    addTable({
      title: "Knowledge Check",
      headers: ["Question", "Supervisor Answer Guide"],
      rows: report.quiz.map((item) => [item.question, item.answer]),
    });
  }

  addSectionTitle("Review Disclaimer");
  addWrapped(report.reviewNote, { size: 8.5, color: [180, 83, 9], gap: 0 });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...slate);
    pdf.text(
      "Generated by Laboria Orbit HSE Workspace | Confidential AI-assisted report",
      margin,
      pageHeight - 7,
    );
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  pdf.save(`${safeFileName(report.title) || "laboria-orbit-ai-report"}.pdf`);
};
