import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

test.describe("public login and protected boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders Laboria Orbit without horizontal overflow", async ({ page }, testInfo) => {
    await expect(page).toHaveTitle(/Laboria Orbit/);
    await expect(page.getByRole("heading", { name: "Laboria Orbit" })).toBeVisible();
    const googleButton = page.getByRole("button", { name: "Continue with Google" });
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled({ timeout: 10_000 });

    const overflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await fs.mkdir("test-results/evidence", { recursive: true });
    await page.screenshot({
      path: `test-results/evidence/login-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("has no critical or serious automated accessibility violations", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((item) =>
      item.impact === "critical" || item.impact === "serious",
    );
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });

  test("records a bounded public-page performance baseline", async ({ page }, testInfo) => {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return {
        durationMs: Math.round(navigation?.duration || 0),
        domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
        resourceCount: resources.length,
        transferredBytes: resources.reduce(
          (total, resource) => total + (resource.transferSize || 0),
          0,
        ),
      };
    });

    await fs.mkdir("test-results/evidence", { recursive: true });
    await fs.writeFile(
      `test-results/evidence/performance-${testInfo.project.name}.json`,
      JSON.stringify(metrics, null, 2),
    );
    expect(metrics.domContentLoadedMs).toBeLessThan(10_000);
  });

  test("redirects logged-out users away from the workspace", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F|\/login\?next=\//);
  });
});

test("unauthenticated API routes reject access", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "API matrix runs once.");

  const cases: Array<[string, "get" | "post", number, unknown?]> = [
    ["/api/ai/orbit", "post", 401, {}],
    ["/api/ai/toolbox-talk", "post", 401, {}],
    ["/api/billing/orbit-account", "get", 401],
    ["/api/billing/ai-credits/spend", "post", 401, { credits: 1 }],
    [
      "/api/billing/paypal/checkout",
      "post",
      401,
      { product_type: "plus_subscription" },
    ],
    ["/api/workspace/company-logo", "get", 401],
    ["/api/admin/test-ai-credits", "post", 403, {}],
  ];

  for (const [url, method, expectedStatus, data] of cases) {
    const response =
      method === "get" ? await request.get(url) : await request.post(url, { data });
    expect(response.status(), `${method.toUpperCase()} ${url}`).toBe(expectedStatus);
  }
});

test("public billing diagnostics expose presence flags but no credential values", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "API diagnostics run once.");
  const response = await request.get("/api/billing/paypal/config");
  expect([200, 503]).toContain(response.status());
  const text = await response.text();
  expect(text).not.toContain("audit-client-id-not-production");
  expect(text).not.toContain("audit-client-secret-not-production");
  expect(text).not.toContain("audit-webhook-id-not-production");
  expect(text).not.toContain("sk_");
  expect(text).not.toContain("eyJ");
  const payload = JSON.parse(text);
  expect(typeof payload.checkoutEnabled).toBe("boolean");
  expect(typeof payload.diagnostics.paypalClientConfigured).toBe("boolean");
  expect(typeof payload.diagnostics.paypalWebhookConfigured).toBe("boolean");
});

test("security headers and proxy protection remain active", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Header checks run once.");

  const login = await request.get("/login");
  expect(login.headers()["x-content-type-options"]).toBe("nosniff");
  expect(login.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(login.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(login.headers()["permissions-policy"]).toContain("camera=()");

  const bypassAttempt = await request.get("/", {
    headers: {
      "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy",
    },
    maxRedirects: 0,
  });
  expect([307, 308]).toContain(bypassAttempt.status());
  expect(bypassAttempt.headers().location).toContain("/login");
});
