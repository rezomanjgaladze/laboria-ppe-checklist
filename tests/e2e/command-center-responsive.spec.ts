import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const longDepartment =
      "International-Operational-Health-Safety-Environment-Compliance-Department";
    const longSite =
      "North-East-Regional-Distribution-Manufacturing-and-Logistics-Campus";

    localStorage.setItem(
      "laboria_workspace_settings",
      JSON.stringify({
        companyProfile: {
          companyName: "Laboria Orbit International Operations Workspace",
          logoDataUrl: "",
          logoPath: "",
          industrySector: "Industrial Health, Safety and Operational Intelligence",
          mainSiteLocation: "Global Operations and Distribution Center",
          contactEmail: "",
          phone: "",
          address: "",
        },
        preferences: {
          themeMode: "dark",
          language: "EN",
          dateFormat: "YYYY-MM-DD",
          timeFormat: "24-hour",
          defaultDashboardPage: "command-center",
          sidebarCollapsedByDefault: false,
        },
      }),
    );
    localStorage.setItem(
      "laboria_action_tracker_actions",
      JSON.stringify([
        {
          id: "responsive-action",
          title:
            "Replace damaged edge protection before elevated maintenance work resumes",
          description: "Responsive test action",
          sourceModule: "Risk Assessment",
          priority: "Critical",
          responsiblePerson: "Regional Operations Safety Coordinator",
          department: longDepartment,
          siteLocation: longSite,
          dueDate: "2025-01-01",
          status: "Open",
          progress: 0,
          notes: "",
          createdDate: now,
          lastUpdated: now,
          createdBy: "Responsive test",
        },
      ]),
    );
    localStorage.setItem(
      "laboria_risk_assessments",
      JSON.stringify([
        {
          id: 987654,
          header: {
            site: longSite,
            department: longDepartment,
            title: "Elevated maintenance risk assessment",
            sector: "Manufacturing",
            activity: "Working at height around production equipment",
            assessmentDate: "2026-07-12",
          },
          hazards: [
            {
              workplaceActivity: "Elevated maintenance platform access",
              hazardDescription:
                "Fall from an unprotected edge during maintenance activity",
              possibleConsequence: "Serious injury or fatality",
              existingMeasures: "Temporary guardrail and permit-to-work",
              additionalMeasures: "Install permanent engineered edge protection",
              initialProbability: 4,
              initialSeverity: 5,
              residualProbability: 3,
              residualSeverity: 5,
              responsiblePerson: "Regional Operations Safety Coordinator",
              status: "Open",
              comments: "",
            },
          ],
          savedAt: now,
        },
      ]),
    );
    localStorage.setItem(
      "laboria_incident_management",
      JSON.stringify([
        {
          id: "responsive-incident",
          title: "Mobile equipment near miss at loading interface",
          eventType: "Near Miss",
          dateTime: now,
          siteLocation: longSite,
          department: longDepartment,
          severity: "High",
          status: "Investigation Open",
          description: "Responsive test incident",
          reportedBy: "Responsive test",
          rootCauses: ["Communication Failure", "Work Environment"],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    localStorage.setItem(
      "laboria_training_management",
      JSON.stringify({
        employees: [
          {
            id: "responsive-employee",
            name: "Responsive Test Employee",
            department: longDepartment,
            position: "Maintenance Technician",
            siteLocation: longSite,
            status: "Active",
          },
        ],
        trainingTypes: [
          {
            id: "responsive-training",
            name: "Working at Height and Fall Protection",
            category: "High Risk",
            riskLevel: "High",
          },
        ],
        records: [],
      }),
    );
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Laboria Orbit Command Center" }),
  ).toBeVisible();
});

test("keeps the Command Center inside the viewport", async ({ page }, testInfo) => {
  const measurements = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h1")).find((node) =>
      node.textContent?.includes("Laboria Orbit Command Center"),
    );
    const commandCenter = heading?.closest("section");
    const shell = commandCenter?.parentElement;
    const commandRect = commandCenter?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(commandCenter?.querySelectorAll("*") ?? [])
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          text: (element.textContent || "").trim().slice(0, 80),
          position: style.position,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(
        (item) =>
          item.width > 0 &&
          item.position !== "absolute" &&
          item.position !== "fixed" &&
          (item.right > viewportWidth + 1 || item.left < -1),
      )
      .slice(0, 20);

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      commandCenter: commandRect
        ? {
            left: Math.round(commandRect.left),
            right: Math.round(commandRect.right),
            width: Math.round(commandRect.width),
          }
        : null,
      shell: shellRect
        ? {
            left: Math.round(shellRect.left),
            right: Math.round(shellRect.right),
            width: Math.round(shellRect.width),
          }
        : null,
      offenders,
    };
  });

  await fs.mkdir("test-results/evidence", { recursive: true });
  await fs.writeFile(
    `test-results/evidence/command-center-${testInfo.project.name}.json`,
    JSON.stringify(measurements, null, 2),
  );
  await page.screenshot({
    path: `test-results/evidence/command-center-${testInfo.project.name}.png`,
    fullPage: true,
  });

  expect(measurements.documentWidth).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
  expect(measurements.bodyWidth).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(measurements.commandCenter?.width).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
  expect(measurements.commandCenter?.right).toBeLessThanOrEqual(
    measurements.viewportWidth,
  );
  expect(measurements.offenders).toEqual([]);
});
