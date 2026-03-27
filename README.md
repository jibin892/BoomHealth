# BoomHealth

BoomHealth is a mobile-first collector dashboard for lab-test booking operations. The app is built with Next.js, Clerk, shadcn/ui, and Playwright. It focuses on booking management, patient document capture, OpenAI-powered ID extraction, and sample-collection workflow execution.

## Product Scope

- View live collector bookings
- Open booking details in a responsive sheet / bottom sheet
- Review patient details from API data
- Upload or capture Passport / EID front images per patient
- Process document images through OpenAI extraction
- Submit patient details and complete sample collection
- Handle offline sample queue states
- Support responsive usage across mobile, tablet, and desktop

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui + Radix UI
- Clerk authentication
- Playwright end-to-end testing
- Vercel deployment
- Capacitor mobile bridge support

## Project Structure

```text
app/
  api/document/process        OpenAI-backed document processing route
  dashboard/bookings         Main collector bookings screen
  sign-in / sign-up          Clerk auth screens
components/
  dashboard/                 Booking sheet, tables, pagination, overview cards
  ui/                        Shared shadcn-style primitives
lib/
  api/                       Collector API client and request mappers
  bookings/                  UI model mapping for booking data
  document-processing/       Document extraction types
  offline/                   Offline sample submission queue
tests/e2e/                   Playwright coverage
```

## Key Flows

### 1. Booking Management

- Load current collector bookings from the collector API
- Filter and search bookings
- Open Booking Details in a sheet

### 2. Patient Document Workflow

- If a patient already has an ID in API data, upload is hidden
- If a patient is missing an ID, the patient card shows document upload
- User uploads or captures Passport front or EID front
- Image is auto-cropped in the browser when possible
- Frontend sends the image to `/api/document/process`
- OpenAI extracts document fields
- Extracted preview stays visible on the patient card
- User submits patient details from the patient card

### 3. Sample Collection

- Sample Collection becomes actionable after patient details are ready
- Collector API is called only when the user confirms sample collection
- Completed states are shown in the sheet UI

## API Integration

The dashboard is wired to the collector API contract.

Main collector endpoints:

- `GET /collectors/:collector_party_id/bookings/current`
- `GET /collectors/:collector_party_id/bookings/past`
- `PATCH /collectors/:collector_party_id/bookings/:booking_id/patients`
- `PATCH /collectors/:collector_party_id/bookings/:booking_id/sample-collected`
- `PATCH /collectors/:collector_party_id/bookings/:booking_id/sample-delivered`

Important implementation details:

- Uses `booking_id` for update actions
- Uses `booking_status` as the source of booking lifecycle state
- Uses `national_id` for Emirates ID / patient ID payloads

## Document Processing

Document processing is handled in two stages:

1. Client-side preprocessing
   - optional auto-crop
   - image validation
   - preview generation

2. Server-side extraction
   - route: `app/api/document/process/route.ts`
   - calls OpenAI for document detection and extraction
   - supports Passport front and EID front

Collector booking APIs are not called during raw scan processing. They are called later when the user submits patient details or confirms sample collection.

## Environment Variables

Create `.env.local` and configure at least the following:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_API_BASE_URL=
COLLECTOR_PARTY_ID=BOOM_HEALTH

OPENAI_API_KEY=
```

Notes:

- Clerk is required for sign-in / sign-up flow
- `NEXT_PUBLIC_API_BASE_URL` should point to the collector backend
- If using an ngrok base URL, browser requests may require special handling
- OpenAI is required for document extraction

## Local Development

Install dependencies:

```bash
npm install
```

Start local development:

```bash
PORT=5017 npm run dev
```

Open:

- [http://localhost:5017](http://localhost:5017)

Useful commands:

```bash
npm run lint
npm run typecheck
npm run test:e2e
```

## Authentication

Clerk is used for:

- sign in
- sign up
- session management
- route protection

Configured auth routes:

- `/sign-in`
- `/sign-up`

Default post-auth destination:

- `/dashboard/bookings`

## Deployment

Production is deployed on Vercel.

Production URL:

- [https://boomhealth.vercel.app](https://boomhealth.vercel.app)

Manual production deploy:

```bash
npx vercel@latest deploy --prod -y
```

Current Vercel project:

- project: `boomhealth`

## Testing

End-to-end tests use Playwright and cover booking flows.

Run:

```bash
npm run test:e2e
```

Recommended areas to verify:

- booking list load
- booking details sheet
- patient document upload
- document extraction states
- patient detail submission
- sample collection completion
- responsive behavior on mobile and desktop

## Mobile Notes

The UI is designed mobile-first.

- booking details open as bottom sheet on small screens
- large screens use a side sheet
- upload/capture actions are touch-friendly
- offline queue support exists for sample submission states
- Capacitor scripts are included for native app packaging

Useful Capacitor commands:

```bash
npm run cap:sync
npm run cap:add:android
npm run cap:add:ios
npm run cap:open:android
npm run cap:open:ios
```

## Repository

GitHub:

- [https://github.com/unitedadi/BoomHealth](https://github.com/unitedadi/BoomHealth)
