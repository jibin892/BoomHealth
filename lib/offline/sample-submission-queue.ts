export type QueuedPatientUpdate = {
  currentPatientId: string
  newPatientId?: string
  name?: string
  age?: number
  gender?: string
  nationalId?: string
}

export type SampleSubmissionSyncState =
  | "PENDING"
  | "SYNCING"
  | "FAILED"
  | "SYNCED"

export type QueuedSampleSubmission = {
  id: string
  bookingId: string
  apiBookingId: number
  updates: QueuedPatientUpdate[]
  croppedDocumentImageBase64List?: string[]
  eventId: string
  collectedAt: string
  createdAt: string
  retryCount: number
  state: SampleSubmissionSyncState
  lastErrorMessage?: string
}

const STORAGE_KEY = "dardoc.sample-submission-queue.v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function parseStoredQueue(value: string | null) {
  if (!value) return [] as QueuedSampleSubmission[]

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item) => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Partial<QueuedSampleSubmission>
      const hasValidCroppedImages =
        !candidate.croppedDocumentImageBase64List ||
        (Array.isArray(candidate.croppedDocumentImageBase64List) &&
          candidate.croppedDocumentImageBase64List.every(
            (entry) => typeof entry === "string"
          ))
      return (
        typeof candidate.id === "string" &&
        typeof candidate.bookingId === "string" &&
        typeof candidate.apiBookingId === "number" &&
        typeof candidate.eventId === "string" &&
        typeof candidate.collectedAt === "string" &&
        typeof candidate.createdAt === "string" &&
        Array.isArray(candidate.updates) &&
        hasValidCroppedImages &&
        typeof candidate.retryCount === "number" &&
        typeof candidate.state === "string"
      )
    }) as QueuedSampleSubmission[]
  } catch {
    return []
  }
}

export function readSampleSubmissionQueue() {
  if (!canUseStorage()) return [] as QueuedSampleSubmission[]
  return parseStoredQueue(window.localStorage.getItem(STORAGE_KEY))
}

export function writeSampleSubmissionQueue(items: QueuedSampleSubmission[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function pushSampleSubmissionQueueItem(
  item: Omit<QueuedSampleSubmission, "id" | "createdAt" | "retryCount" | "state">
) {
  const nextItem: QueuedSampleSubmission = {
    ...item,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sample_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    state: "PENDING",
  }

  const current = readSampleSubmissionQueue()
  const updated = [nextItem, ...current]
  writeSampleSubmissionQueue(updated)
  return nextItem
}

export function updateSampleSubmissionQueueItem(
  id: string,
  updater: (item: QueuedSampleSubmission) => QueuedSampleSubmission
) {
  const current = readSampleSubmissionQueue()
  const updated = current.map((item) => (item.id === id ? updater(item) : item))
  writeSampleSubmissionQueue(updated)
  return updated
}

export function removeSyncedSampleSubmissionQueueItems() {
  const current = readSampleSubmissionQueue()
  const updated = current.filter((item) => item.state !== "SYNCED")
  writeSampleSubmissionQueue(updated)
  return updated
}

export function getSampleSubmissionSyncSummary(items: QueuedSampleSubmission[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1
      if (item.state === "PENDING") acc.pending += 1
      if (item.state === "SYNCING") acc.syncing += 1
      if (item.state === "FAILED") acc.failed += 1
      if (item.state === "SYNCED") acc.synced += 1
      return acc
    },
    {
      total: 0,
      pending: 0,
      syncing: 0,
      failed: 0,
      synced: 0,
    }
  )
}
