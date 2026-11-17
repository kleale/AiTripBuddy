export type StatsRange = 'all' | 'week' | 'month' | 'year'

export interface StatsDay {
  date: string
  unique: number
  returning: number
  total: number
}

export interface StatsPoint {
  label: string
  unique: number
  returning: number
  total: number
}

const PROJECT_START = '2026-11-12'
const VISITOR_KEY = 'atd.stats.visitor.v1'
const VISITS_KEY = 'atd.stats.visits.v1'
const URL_KEY = 'atd.stats.url.v1'

interface Visitor {
  id: string
  firstSeen: string
  visits: Record<string, true>
}

function todayIso(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): string[] {
  const result: string[] = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard < 2000) {
    result.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return result
}

function readVisitor(): Visitor | null {
  try {
    const raw = localStorage.getItem(VISITOR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Visitor>
    if (!parsed.id || !parsed.firstSeen) return null
    return { id: parsed.id, firstSeen: parsed.firstSeen, visits: (parsed.visits ?? {}) as Record<string, true> }
  } catch {
    return null
  }
}

function writeVisitor(visitor: Visitor): void {
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify(visitor))
  } catch {
    // ignore
  }
}

function readVisits(): Record<string, true> {
  try {
    const raw = localStorage.getItem(VISITS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, true>
  } catch {
    return {}
  }
}

function writeVisits(visits: Record<string, true>): void {
  try {
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits))
  } catch {
    // ignore
  }
}

export function getStatsUrl(): string | null {
  try {
    const saved = localStorage.getItem(URL_KEY)
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '')
  } catch {
    // ignore
  }
  const url = (import.meta as { env?: Record<string, string> }).env?.VITE_STATS_URL
  return typeof url === 'string' && url.trim() ? url.replace(/\/$/, '') : null
}

export function setStatsUrl(value: string | null): void {
  try {
    if (value && value.trim()) localStorage.setItem(URL_KEY, value.trim())
    else localStorage.removeItem(URL_KEY)
  } catch {
    // ignore
  }
}

function statsUrl(): string | null {
  return getStatsUrl()
}

/** Один визит в день на браузер; возвращает true, если это возврат. */
export function recordVisit(): boolean {
  const today = todayIso()
  const visitor = readVisitor() ?? {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    firstSeen: today,
    visits: {},
  }
  const visits = readVisits()
  if (visits[today]) return false

  const returning = Object.keys(visits).some((date) => date < today) || visitor.firstSeen < today
  visits[today] = true
  visitor.visits = visits
  writeVisitor(visitor)
  writeVisits(visits)

  const url = statsUrl()
  if (url) {
    void fetch(`${url}/visit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorId: visitor.id, date: today, returning }),
      keepalive: true,
    }).catch(() => undefined)
  }
  return returning
}

function localSeries(): StatsDay[] {
  const visitor = readVisitor()
  if (!visitor) return []
  const visits = readVisits()
  const start = visitor.firstSeen < PROJECT_START ? visitor.firstSeen : PROJECT_START
  const today = todayIso()
  let total = 0

  return daysBetween(start, today).map((date) => {
    const visited = Boolean(visits[date])
    const unique = visited ? 1 : 0
    const returning = visited && date > visitor.firstSeen ? 1 : 0
    if (unique) total += unique
    return { date, unique, returning, total }
  })
}

/** Данные с сервера или локального браузера. */
export async function loadStats(): Promise<{ days: StatsDay[]; remote: boolean }> {
  const url = statsUrl()
  if (!url) return { days: localSeries(), remote: false }

  const from = readVisitor()?.firstSeen ?? PROJECT_START
  try {
    const response = await fetch(`${url}/series?from=${from}&to=${todayIso()}`)
    if (!response.ok) throw new Error('stats http')
    const data = (await response.json()) as { days?: StatsDay[] }
    if (!Array.isArray(data.days)) throw new Error('stats shape')
    return { days: data.days, remote: true }
  } catch {
    return { days: localSeries(), remote: false }
  }
}

/** Превращает дни в точки для выбранного диапазона. */
export function aggregateStats(days: StatsDay[], range: StatsRange): StatsPoint[] {
  if (!days.length) return []
  const today = days[days.length - 1]?.date ?? todayIso()
  const daily = range === 'week' ? 7 : range === 'month' ? 30 : 0

  const selected =
    range === 'all'
      ? days
      : daily > 0
        ? days.filter((day) => day.date >= addDays(today, -(daily - 1)))
        : days.filter((day) => day.date >= addDays(today, -365))

  if (range !== 'year') {
    return selected.map((day) => ({
      label: day.date.slice(8, 10) + '.' + day.date.slice(5, 7),
      unique: day.unique,
      returning: day.returning,
      total: day.total,
    }))
  }

  const months = new Map<string, { unique: number; returning: number; total: number }>()
  for (const day of selected) {
    const key = day.date.slice(0, 7)
    const entry = months.get(key) ?? { unique: 0, returning: 0, total: 0 }
    entry.unique = Math.max(entry.unique, day.unique)
    entry.returning += day.returning
    entry.total = Math.max(entry.total, day.total)
    months.set(key, entry)
  }
  return [...months.entries()].map(([key, value]) => ({
    label: key.slice(5, 7) + '.' + key.slice(2, 4),
    ...value,
  }))
}

export function statsSummary(days: StatsDay[]): { unique: number; returning: number; visits: number } {
  const last = days[days.length - 1]
  return {
    unique: last?.total ?? 0,
    returning: days.reduce((sum, day) => sum + day.returning, 0),
    visits: days.reduce((sum, day) => sum + day.unique + day.returning, 0),
  }
}
