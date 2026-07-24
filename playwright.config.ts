import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "command-center-responsive.spec.ts",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PAYPAL_MODE: "sandbox",
      PAYPAL_CLIENT_ID: "audit-client-id-not-production",
      PAYPAL_CLIENT_SECRET: "audit-client-secret-not-production",
      PAYPAL_WEBHOOK_ID: "audit-webhook-id-not-production",
      PAYPAL_PLAN_ORBIT_PLUS: "P-AUDITPLUS000000000000000",
      PAYPAL_PLAN_ORBIT_PRO: "P-AUDITPRO0000000000000000",
      NEXT_PUBLIC_BILLING_PROVIDER: "paypal",
    },
  },
});
