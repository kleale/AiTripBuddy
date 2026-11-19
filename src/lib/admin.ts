import { ref, watch } from 'vue'

const STORAGE_KEY = 'atd.admin.settings.v1'
export const adminOpen = ref(false)

export interface AdminSettings {
  auditEnabled: boolean
  hotelPickerEnabled: boolean
  activitiesEnabled: boolean
  partnerBadges: boolean
  announcement: string
  maintenance: boolean
  hiddenIdeaIds: string[]
}

const defaults: AdminSettings = {
  auditEnabled: true,
  hotelPickerEnabled: true,
  activitiesEnabled: true,
  partnerBadges: true,
  announcement: '',
  maintenance: false,
  hiddenIdeaIds: [],
}

function readSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<AdminSettings>
    return {
      ...defaults,
      ...parsed,
      announcement: typeof parsed.announcement === 'string' ? parsed.announcement.slice(0, 180) : '',
      hiddenIdeaIds: Array.isArray(parsed.hiddenIdeaIds)
        ? parsed.hiddenIdeaIds.filter((item): item is string => typeof item === 'string').slice(0, 200)
        : [],
    }
  } catch {
    return { ...defaults }
  }
}

export const adminSettings = ref<AdminSettings>(readSettings())

watch(
  adminSettings,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // ignore
    }
  },
  { deep: true },
)

export function updateAdminSettings(patch: Partial<AdminSettings>): void {
  adminSettings.value = { ...adminSettings.value, ...patch }
}

export function openAdmin(): void {
  adminOpen.value = true
}

export function closeAdmin(): void {
  adminOpen.value = false
}

const LOG_KEY = 'atd.admin.log.v1'

export interface AdminLogEntry {
  at: string
  action: string
}

function readLog(): AdminLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is AdminLogEntry => Boolean(item) && typeof item === 'object' && typeof (item as AdminLogEntry).action === 'string')
      .slice(0, 80)
  } catch {
    return []
  }
}

export const adminLog = ref<AdminLogEntry[]>(readLog())

/** Журнал действий админа хранится локально; серверный аудит появится с общим бэкендом. */
export function logAdminAction(action: string): void {
  adminLog.value = [{ at: new Date().toISOString(), action }, ...adminLog.value].slice(0, 80)
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(adminLog.value))
  } catch {
    // ignore
  }
}
