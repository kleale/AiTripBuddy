import { computed, ref, watch } from 'vue'
import type { Trip } from '@/types'
import { shareApiUrl } from '@/lib/short-links'
import { importTrips, savedTrips } from '@/stores/trips'

const STORAGE_KEY = 'atd.account.v1'
const ADMIN_EMAIL = 'aibuddycomp@gmail.com'

export interface AccountState {
  email: string
  session: string
  signedInAt: string
  /** локальная демонстрация без сервера (только dev) */
  demo?: boolean
}

function readAccount(): AccountState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AccountState>
    if (typeof parsed.email !== 'string' || !parsed.email) return null
    return {
      email: parsed.email,
      session: typeof parsed.session === 'string' ? parsed.session : '',
      signedInAt: typeof parsed.signedInAt === 'string' ? parsed.signedInAt : new Date().toISOString(),
      demo: parsed.demo === true,
    }
  } catch {
    return null
  }
}

function writeAccount(value: AccountState | null): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const account = ref<AccountState | null>(readAccount())
export const accountOpen = ref(false)
export const authBusy = ref(false)
export const authMessage = ref('')
export const authError = ref('')
export const devLink = ref('')
export const syncStatus = ref<'idle' | 'syncing' | 'synced' | 'error'>('idle')
export const lastSync = ref<string>('')

export const signedIn = computed(() => Boolean(account.value?.email))
export const isAdmin = computed(
  () => account.value?.email.trim().toLowerCase() === ADMIN_EMAIL && account.value?.session.length > 0,
)
export const adminEmail = ADMIN_EMAIL

export function openAccount(): void {
  accountOpen.value = true
  authError.value = ''
  authMessage.value = ''
  devLink.value = ''
}

export function closeAccount(): void {
  accountOpen.value = false
}

function saveAccount(value: AccountState): void {
  account.value = value
  writeAccount(value)
}

function headers(): Record<string, string> {
  const session = account.value?.session
  return session ? { authorization: `Bearer ${session}` } : {}
}

function errorText(status: number): string {
  if (status === 429) return 'Слишком часто. Подождите минуту перед новой ссылкой.'
  if (status === 503) return 'Отправка писем ещё не настроена: нужен RESEND_API_KEY в Worker.'
  return 'Не удалось отправить ссылку. Попробуйте позже.'
}

function startDemo(normalized: string): boolean {
  const token = `demo-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  sessionStorage.setItem(`atd.demo.${token}`, normalized)
  devLink.value = `${location.origin}${location.pathname}?auth=${token}`
  authMessage.value = 'Worker недоступен; для локальной проверки используйте ссылку:'
  return true
}

/** Запрос magic link. В dev при недоступном Worker создаётся локальная ссылка. */
export async function requestMagicLink(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    authError.value = 'Введите корректный e-mail.'
    return false
  }
  authBusy.value = true
  authError.value = ''
  authMessage.value = ''
  devLink.value = ''
  try {
    const response = await fetch(`${shareApiUrl()}/api/auth/magic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    })
    const data = (await response.json().catch(() => ({}))) as { sent?: boolean; devLink?: string }
    if (!response.ok) {
      if (import.meta.env.DEV && (response.status === 404 || response.status === 503)) {
        return startDemo(normalized)
      }
      authError.value = errorText(response.status)
      return false
    }
    if (data.devLink) {
      devLink.value = data.devLink
      authMessage.value = 'Почта не настроена, но для проверки доступна ссылка входа:'
    } else {
      authMessage.value = 'Письмо отправлено. Ссылка действует 15 минут.'
    }
    return true
  } catch {
    if (import.meta.env.DEV) return startDemo(normalized)
    authError.value = 'Сеть недоступна. Попробуйте позже.'
    return false
  } finally {
    authBusy.value = false
  }
}

/** Разбирает ?auth=<session> после перехода из письма. */
export async function verifyAuthFromLocation(): Promise<boolean> {
  if (typeof location === 'undefined') return false
  const params = new URLSearchParams(location.search)
  const token = params.get('auth')
  if (!token) return false
  const clean = new URL(location.href)
  clean.searchParams.delete('auth')
  history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`)

  authBusy.value = true
  try {
    if (token.startsWith('demo-')) {
      const email = sessionStorage.getItem(`atd.demo.${token}`)
      if (!email) return false
      saveAccount({
        email,
        session: token,
        signedInAt: new Date().toISOString(),
        demo: true,
      })
      authMessage.value = 'Локальный вход выполнен. Облачная синхронизация недоступна.'
      return true
    }

    const response = await fetch(`${shareApiUrl()}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!response.ok) return false
    const data = (await response.json()) as { email?: string }
    if (!data.email) return false
    saveAccount({
      email: data.email,
      session: token,
      signedInAt: new Date().toISOString(),
    })
    await syncLibrary()
    return true
  } catch {
    return false
  } finally {
    authBusy.value = false
  }
}

/** Подтягивает облачную библиотеку и отправляет объединённый список обратно. */
export async function syncLibrary(): Promise<boolean> {
  const current = account.value
  if (!current?.session || current.demo) {
    syncStatus.value = current?.demo ? 'idle' : syncStatus.value
    return false
  }
  syncStatus.value = 'syncing'
  try {
    const response = await fetch(`${shareApiUrl()}/api/library`, { headers: headers() })
    if (response.status === 401) {
      await signOut(false)
      return false
    }
    if (!response.ok) throw new Error(`library ${response.status}`)
    const data = (await response.json()) as { trips?: Trip[] }
    if (Array.isArray(data.trips) && data.trips.length) importTrips(data.trips)
    await pushLibrary()
    syncStatus.value = 'synced'
    lastSync.value = new Date().toISOString()
    return true
  } catch {
    syncStatus.value = 'error'
    return false
  }
}

export async function pushLibrary(): Promise<boolean> {
  const current = account.value
  if (!current?.session || current.demo) return false
  try {
    const response = await fetch(`${shareApiUrl()}/api/library`, {
      method: 'PUT',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ trips: savedTrips.value.slice(0, 50) }),
    })
    if (!response.ok) throw new Error(`library ${response.status}`)
    syncStatus.value = 'synced'
    lastSync.value = new Date().toISOString()
    return true
  } catch {
    syncStatus.value = 'error'
    return false
  }
}

export async function deleteAccount(): Promise<boolean> {
  const current = account.value
  if (!current) return false
  if (!current.demo) {
    try {
      const response = await fetch(`${shareApiUrl()}/api/account`, {
        method: 'DELETE',
        headers: headers(),
      })
      if (!response.ok && response.status !== 401) return false
    } catch {
      return false
    }
  }
  account.value = null
  writeAccount(null)
  syncStatus.value = 'idle'
  lastSync.value = ''
  return true
}

export async function signOut(clearLocal = true): Promise<void> {
  const current = account.value
  if (current?.session && !current.demo) {
    try {
      await fetch(`${shareApiUrl()}/api/auth/logout`, {
        method: 'POST',
        headers: headers(),
      })
    } catch {
      // сеть не должна мешать выходу
    }
  }
  if (clearLocal) {
    account.value = null
    writeAccount(null)
    syncStatus.value = 'idle'
    lastSync.value = ''
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
watch(
  savedTrips,
  () => {
    if (!account.value?.session || account.value.demo) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      void pushLibrary()
    }, 1600)
  },
  { deep: true },
)
