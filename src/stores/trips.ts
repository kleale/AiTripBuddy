import { ref, watch } from 'vue'
import type { Trip } from '@/types'
import { normalizeTrip, trip } from './trip'

const SAVED_KEY = 'atd.trips.v1'

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeSaved(list: unknown): Trip[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((item): item is Trip => Boolean(item) && Array.isArray((item as Trip).stops))
    .map((item) => normalizeTrip(item))
}

function loadSaved(): Trip[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return []
    return normalizeSaved(JSON.parse(raw))
  } catch {
    return []
  }
}

export const savedTrips = ref<Trip[]>(loadSaved())

watch(
  savedTrips,
  (value) => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(value))
    } catch {
      // ignore storage errors
    }
  },
  { deep: true },
)

function sortSaved(): void {
  savedTrips.value = [...savedTrips.value].sort(
    (a, b) =>
      new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
  )
}

/** Сохраняет текущую поездку: обновляет существующую запись или добавляет новую. */
export function saveCurrentTrip(): boolean {
  const current = trip.value
  if (!current) return false

  const snapshot = normalizeTrip({
    ...copy(current),
    updatedAt: new Date().toISOString(),
  })

  const index = savedTrips.value.findIndex((item) => item.id === current.id)
  if (index >= 0) savedTrips.value[index] = snapshot
  else savedTrips.value = [snapshot, ...savedTrips.value]

  sortSaved()
  current.updatedAt = snapshot.updatedAt
  return true
}

/** Сохраняет текущую поездку как новую копию и делает её активной. */
export function duplicateCurrentTrip(): boolean {
  const current = trip.value
  if (!current) return false

  const now = new Date().toISOString()
  const duplicated = normalizeTrip({
    ...copy(current),
    id: crypto.randomUUID?.() ?? `trip-${Date.now()}`,
    name: `${current.name} (копия)`,
    createdAt: now,
    updatedAt: now,
  })

  savedTrips.value = [duplicated, ...savedTrips.value]
  trip.value = copy(duplicated)
  return true
}

export function loadSavedTrip(id: string): boolean {
  const found = savedTrips.value.find((item) => item.id === id)
  if (!found) return false
  trip.value = normalizeTrip(copy(found))
  return true
}

export function deleteSavedTrip(id: string): void {
  savedTrips.value = savedTrips.value.filter((item) => item.id !== id)
}

/** Добавляет поездки из ссылки, не перетирая более новые локальные версии. */
export function importTrips(trips: Trip[]): number {
  const existing = new Map(savedTrips.value.map((item) => [item.id, item]))
  let added = 0
  for (const incoming of trips) {
    const current = existing.get(incoming.id)
    if (!current) {
      existing.set(incoming.id, incoming)
      added += 1
      continue
    }
    const currentDate = new Date(current.updatedAt ?? current.createdAt).getTime()
    const incomingDate = new Date(incoming.updatedAt ?? incoming.createdAt).getTime()
    if (incomingDate > currentDate) existing.set(incoming.id, incoming)
  }
  if (added > 0 || existing.size !== savedTrips.value.length) {
    savedTrips.value = [...existing.values()]
    sortSaved()
  }
  return added
}

export function tripSummary(saved: Trip): string {
  const stays = saved.stops.filter((stop) => stop.kind === 'stay').length
  const nights = saved.stops.reduce((sum, stop) => (stop.kind === 'stay' ? sum + stop.nights : sum), 0)
  return `${stays} отел. · ${nights} ноч.`
}