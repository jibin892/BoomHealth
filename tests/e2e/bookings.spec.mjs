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

function buildMultiBookingsPayload() {
  return {
    collector: {
      party_id: "BOOM_HEALTH",
      display_name: "BoomHealth Collector",
    },
    bucket: "current",
    items: [
      {
        booking_id: 700006,
        order_id: "BH-700006",
        booking_status: "ACTIVE",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-6",
        location_label: "Dubai Home Visit",
        location_address: "Al Quoz, Dubai, UAE",
        location_latitude: 25.126,
        location_longitude: 55.231,
        start_at: "2026-02-23T11:00:00.000Z",
        end_at: "2026-02-23T11:45:00.000Z",
        created_at: "2026-02-23T09:10:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 13000,
        amount_captured_aed_fils: 0,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: null,
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700006",
            name: "Nora Salem",
            age: 28,
            gender: "female",
            national_id: null,
            tests_count: 1,
          },
        ],
      },
      {
        booking_id: 700005,
        order_id: "BH-700005",
        booking_status: "ACTIVE",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-5",
        location_label: "Dubai Home Visit",
        location_address: "JVC, Dubai, UAE",
        location_latitude: 25.062,
        location_longitude: 55.216,
        start_at: "2026-02-23T10:00:00.000Z",
        end_at: "2026-02-23T10:45:00.000Z",
        created_at: "2026-02-23T08:10:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 11500,
        amount_captured_aed_fils: 0,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: null,
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700005",
            name: "Amina Karim",
            age: 32,
            gender: "female",
            national_id: "784-1988-1234567-1",
            tests_count: 1,
          },
        ],
      },
      {
        booking_id: 700004,
        order_id: "BH-700004",
        booking_status: "FULFILLED",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-4",
        location_label: "Dubai Home Visit",
        location_address: "Barsha, Dubai, UAE",
        location_latitude: 25.095,
        location_longitude: 55.188,
        start_at: "2026-02-23T09:00:00.000Z",
        end_at: "2026-02-23T09:45:00.000Z",
        created_at: "2026-02-23T07:00:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 10200,
        amount_captured_aed_fils: 10200,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: "2026-02-23T09:50:00.000Z",
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700004",
            name: "Mariam Ali",
            age: 39,
            gender: "female",
            national_id: "784-1984-1234567-1",
            tests_count: 1,
          },
        ],
      },
      {
        booking_id: 700003,
        order_id: "BH-700003",
        booking_status: "ACTIVE",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-3",
        location_label: "Dubai Home Visit",
        location_address: "Mirdif, Dubai, UAE",
        location_latitude: 25.219,
        location_longitude: 55.411,
        start_at: "2026-02-23T08:00:00.000Z",
        end_at: "2026-02-23T08:45:00.000Z",
        created_at: "2026-02-23T06:10:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 9500,
        amount_captured_aed_fils: 0,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: null,
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700003",
            name: "Yousef Saeed",
            age: 34,
            gender: "male",
            national_id: "784-1989-1234567-1",
            tests_count: 1,
          },
        ],
      },
      {
        booking_id: 700002,
        order_id: "BH-700002",
        booking_status: "ACTIVE",
        resource_type: "HOME_VISIT",
        resource_id: "collector-slot-2",
        location_label: "Dubai Home Visit",
        location_address: "Jumeirah, Dubai, UAE",
        location_latitude: 25.2048,
        location_longitude: 55.2708,
        start_at: "2026-02-23T07:00:00.000Z",
        end_at: "2026-02-23T07:45:00.000Z",
        created_at: "2026-02-23T05:00:00.000Z",
        order_status: "ACTIVE",
        amount_expected_aed_fils: 10000,
        amount_captured_aed_fils: 0,
        currency_expected: "AED",
        currency_captured: "AED",
        paid_at: null,
        patient_count: 1,
        patients: [
          {
            patient_id: "PT-700002",
            name: "Omar Khalid",
            age: 30,
            gender: "male",
            national_id: null,
            tests_count: 1,
          },
        ],
      },
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

async function mockCurrentBookings(page, payload = buildBookingsPayload()) {
  await page.route("**/collectors/BOOM_HEALTH/bookings/current**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  })
}

async function mockBookingsApi(page) {
  await mockCurrentBookings(page, buildBookingsPayload())

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

async function openFirstBookingDetails(page) {
  await page
    .getByRole("button", { name: /BH-700001|View Details/ })
    .first()
    .click()
}

async function openSampleCollectionSection(page) {
  const goToSampleButton = page.getByRole("button", { name: "Go to Sample" })
  if ((await goToSampleButton.count()) > 0) {
    await goToSampleButton.first().click()
    return
  }

  const sampleTab = page.getByRole("tab", { name: "Sample Collection" })
  if ((await sampleTab.count()) > 0) {
    await sampleTab.first().click()
    return
  }

  await page.getByRole("button", { name: "Sample Collection" }).first().click()
}

async function startSampleFlow(page) {
  const startFlowButton = page.getByRole("button", { name: "Start Sample Flow" })
  if ((await startFlowButton.count()) > 0) {
    await startFlowButton.first().click()
    return
  }

  const markButton = page.getByRole("button", { name: "Mark as Sample Collected" })
  if ((await markButton.count()) > 0) {
    await markButton.first().click()
  }
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
  await expect(
    page.getByRole("button", { name: /BH-700001|View Details/ }).first()
  ).toBeVisible()
})

test("booking search empty state and clear filters", async ({ page }) => {
  await page.goto("/dashboard/bookings")
  await page.locator('input[placeholder*="Search"]:visible').first().fill("missing-123")
  await expect(page.getByText("No matching bookings")).toBeVisible()
  await page.getByRole("button", { name: "Clear Filters" }).first().click()
  await expect(
    page.getByRole("button", { name: /BH-700001|View Details/ }).first()
  ).toBeVisible()
})

test("desktop sample-status filter narrows booking list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "Desktop-only filter test")
  await page.unroute("**/collectors/BOOM_HEALTH/bookings/current**")
  await mockCurrentBookings(page, buildMultiBookingsPayload())

  await page.goto("/dashboard/bookings")

  await page.getByRole("combobox").nth(2).click()
  await page.getByRole("option", { name: "Document required" }).click()

  const bookingsTable = page.locator("table")
  await expect(bookingsTable.getByText("Document required").first()).toBeVisible()
  await expect(bookingsTable.getByText("Document complete")).toHaveCount(0)
})

test("mobile booking details flow supports sample-step progression", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only UX flow")

  await page.goto("/dashboard/bookings")
  await openFirstBookingDetails(page)

  await expect(page.getByRole("tab", { name: "Sample Collection" })).toBeVisible()
  await page.getByRole("button", { name: "Go to Sample" }).click()
  await expect(page.getByRole("button", { name: "Start Sample Flow" })).toBeVisible()
})

test("sample collection upload submit success", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "Desktop upload flow")

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
  await openFirstBookingDetails(page)
  await openSampleCollectionSection(page)
  await startSampleFlow(page)

  const uploadButton = page.getByRole("button", {
    name:
      /Upload Passport Front|Re-upload Passport Front|Capture Passport Front|Recapture Passport Front/,
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

test("sample collection submit failure surfaces clear error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "Desktop upload flow")

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
  await openFirstBookingDetails(page)
  await openSampleCollectionSection(page)
  await startSampleFlow(page)

  const uploadButton = page.getByRole("button", {
    name:
      /Upload Passport Front|Re-upload Passport Front|Capture Passport Front|Recapture Passport Front/,
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

  await page.addInitScript(() => {
    const mockStream = {
      getTracks() {
        return [
          {
            stop() {},
          },
        ]
      },
    }

    if (!navigator.mediaDevices) {
      // @ts-expect-error test-only shim
      navigator.mediaDevices = {}
    }

    navigator.mediaDevices.getUserMedia = async () => mockStream
  })

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
  await openFirstBookingDetails(page)
  await openSampleCollectionSection(page)
  await startSampleFlow(page)

  const allowCameraButton = page.getByRole("button", {
    name: "Allow Camera Permission",
  })
  if ((await allowCameraButton.count()) > 0) {
    await allowCameraButton.first().click()
  }

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
