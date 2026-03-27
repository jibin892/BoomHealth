import { defineConfig, devices } from "@playwright/test"

const e2ePort = Number(process.env.E2E_PORT || 3000)
const baseUrl = `http://127.0.0.1:${e2ePort}`
const reuseExistingServer =
  process.env.E2E_USE_EXISTING_SERVER === "true" || !process.env.CI

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: baseUrl,
    timeout: 180_000,
    reuseExistingServer,
    env: {
      E2E_BYPASS_AUTH: "true",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
      NEXT_PUBLIC_API_BASE_URL: "https://api-staging.dardoc.com",
      NEXT_PUBLIC_COLLECTOR_PARTY_ID: "BOOM_HEALTH",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
})
