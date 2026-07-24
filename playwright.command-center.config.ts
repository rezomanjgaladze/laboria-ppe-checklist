import { defineConfig, devices } from "@playwright/test";

const port = 3101;
const baseURL = `http://127.0.0.1:${port}`;

const viewports = [
  { name: "mobile-320", width: 320, height: 900 },
  { name: "mobile-360", width: 360, height: 900 },
  { name: "mobile-390", width: 390, height: 900 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 1000 },
];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "command-center-responsive.spec.ts",
  outputDir: "./test-results/command-center",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    extraHTTPHeaders: { "x-orbit-e2e-auth-bypass": "1" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: viewports.map((viewport) => ({
    name: viewport.name,
    use: { viewport: { width: viewport.width, height: viewport.height } },
  })),
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ORBIT_E2E_AUTH_BYPASS: "1",
    },
  },
});
