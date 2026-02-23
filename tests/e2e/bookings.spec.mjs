import { expect, test } from "@playwright/test"

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAF6M9sUAAAAASUVORK5CYII="

function buildBookingsPayload() {
  return {
    collector: {
      party_id: "BOOM_HEALTH",
      display_name: "BoomHealth Collector",
    },
    bucket: "current",
    items: [
      {
        booking_id: 700001,
        order_id: "BH-700001",
        booking_status: "ACTIVE",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-1",
        location_label: "Dubai Home Visit",
        location_address: "Jumeirah, Dubai, UAE",
        location_latitude: 25.2048,
        location_longitude: 55.2708,
        start_at: "2026-02-22T08:00:00.000Z",
        end_at: "2026-02-22T09:00:00.000Z",
        created_at: "2026-02-22T06:00:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 10000,
        amount_captured_aed_fils: 0,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: null,
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700001",
            name: "Amina Hassan",
            age: 30,
            gender: "female",
            national_id: "784-1987-1234567-1",
            tests_count: 1,
          },
        ],
      },
    ],
    next_before_start_at: null,
  }
}

async function mockBookingsApi(page) {
  await page.route("**/collectors/BOOM_HEALTH/bookings/current**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildBookingsPayload()),
    })
  })

  await page.route("**/collectors/BOOM_HEALTH/bookings/past**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        collector: { party_id: "BOOM_HEALTH", display_name: "BoomHealth Collector" },
        bucket: "past",
        items: [],
        next_before_start_at: null,
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockBookingsApi(page)
})

test("login route loads", async ({ page }) => {
  await page.goto("/sign-in")
  await expect(page).toHaveURL(/\/sign-in/)
})

test("bookings page loads with API data", async ({ page }) => {
  await page.goto("/dashboard/bookings")
  await expect(page.getByRole("button", { name: /BH-700001/ }).first()).toBeVisible()
})

test("sample collection upload submit success", async ({ page }) => {
  await page.route("**/api/document/process", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentType: "PASSPORT",
        extractedData: {
          fullName: "Amina Hassan",
          gender: "female",
          documentNumber: "A12345678",
          nationality: "UAE",
        },
        validation: {
          isValidEID: false,
          startsWith784: false,
        },
        croppedDocumentImageBase64: tinyPngBase64,
        confidenceScore: 0.91,
      }),
    })
  })

  await page.route(
    "**/collectors/BOOM_HEALTH/bookings/700001/sample-collected",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "started",
          booking_id: 700001,
          collector: { party_id: "BOOM_HEALTH", display_name: "BoomHealth Collector" },
        }),
      })
    }
  )

  await page.goto("/dashboard/bookings")
  await page.getByRole("button", { name: /BH-700001/ }).first().click()
  await page.getByRole("button", { name: "Sample Collection" }).first().click()
  await page.getByRole("button", { name: "Mark as Sample Collected" }).click()

  const uploadButton = page.getByRole("button", {
    name: /Upload Passport Front|Re-upload Passport Front/,
  })

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadButton.click(),
  ])

  await fileChooser.setFiles({
    name: "passport-front.png",
    mimeType: "image/png",
    buffer: Buffer.from(tinyPngBase64, "base64"),
  })

  await expect(page.getByText("Passport front preview")).toBeVisible()
  await page.getByRole("button", { name: "Submit Sample Collection" }).click()
  await expect(
    page.getByText(/Sample collection submitted successfully|saved offline/i)
  ).toBeVisible()
})

test("sample collection submit failure surfaces clear error", async ({ page }) => {
  await page.route("**/api/document/process", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentType: "PASSPORT",
        extractedData: {
          fullName: "Amina Hassan",
          gender: "female",
          documentNumber: "A12345678",
          nationality: "UAE",
        },
        validation: {
          isValidEID: false,
          startsWith784: false,
        },
        croppedDocumentImageBase64: tinyPngBase64,
        confidenceScore: 0.91,
      }),
    })
  })

  await page.route(
    "**/collectors/BOOM_HEALTH/bookings/700001/sample-collected",
    async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "validation_error",
          message: "Sample submission validation failed.",
          error_id: "ERR-E2E-001",
        }),
      })
    }
  )

  await page.goto("/dashboard/bookings")
  await page.getByRole("button", { name: /BH-700001/ }).first().click()
  await page.getByRole("button", { name: "Sample Collection" }).first().click()
  await page.getByRole("button", { name: "Mark as Sample Collected" }).click()

  const uploadButton = page.getByRole("button", {
    name: /Upload Passport Front|Re-upload Passport Front/,
  })

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadButton.click(),
  ])

  await fileChooser.setFiles({
    name: "passport-front.png",
    mimeType: "image/png",
    buffer: Buffer.from(tinyPngBase64, "base64"),
  })

  await page.getByRole("button", { name: "Submit Sample Collection" }).click()
  await expect(
    page.getByText(
      /Sample submission validation failed.|Provided booking details failed validation./
    )
  ).toBeVisible()
})

test("sample collection capture flow works on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only capture flow")

  await page.route("**/api/document/process", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentType: "PASSPORT",
        extractedData: {
          fullName: "Amina Hassan",
          gender: "female",
          documentNumber: "A12345678",
          nationality: "UAE",
        },
        validation: {
          isValidEID: false,
          startsWith784: false,
        },
        croppedDocumentImageBase64: tinyPngBase64,
        confidenceScore: 0.9,
      }),
    })
  })

  await page.goto("/dashboard/bookings")
  await page.getByRole("button", { name: /BH-700001/ }).first().click()
  await page.getByRole("button", { name: "Sample Collection" }).first().click()
  await page.getByRole("button", { name: "Mark as Sample Collected" }).click()

  const captureButton = page.getByRole("button", {
    name: /Capture Passport Front|Recapture Passport Front/,
  })
  await expect(captureButton).toBeVisible()

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    captureButton.click(),
  ])

  await fileChooser.setFiles({
    name: "passport-capture.png",
    mimeType: "image/png",
    buffer: Buffer.from(tinyPngBase64, "base64"),
  })

  await expect(page.getByText("Passport front preview")).toBeVisible()
})
