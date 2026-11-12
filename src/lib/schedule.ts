import type { StayStop, Stop, Trip } from '@/types'

export interface ScheduleSegment {
  stopId: string
  label: string
  kind: Stop['kind']
  /** индекс первого дня на шкале */
  start: number
  /** длина в днях: отель — число ночей, точка — 1 день */
  length: number
  /** дата начала (только для привязанного расписания) */
  date?: string
  nights: number
}

export interface ScheduleDay {
  index: number
  /** дата ISO, если расписание привязано к календарю */
  date?: string
  /** число месяца или номер дня */
  label: string
  /** короткий день недели: Пн, Вт, … */
  weekday: string
  weekend: boolean
  weekStart: boolean
  today: boolean
}

export interface Schedule {
  days: ScheduleDay[]
  segments: ScheduleSegment[]
  /** привязано ли расписание к реальным датам */
  anchored: boolean
  start?: string
  end?: string
  scheduledNights: number
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const DAY_MS = 86_400_000

export function parseIsoDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value)
  if (!date) return value
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function diffDays(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function stayCheckOut(stay: StayStop): string | undefined {
  if (!stay.checkIn) return undefined
  return addDays(stay.checkIn, Math.max(0, Math.round(stay.nights)))
}

function stopLabel(stop: Stop): string {
  if (stop.kind === 'stay') return stop.hotel || stop.resort || 'Отель'
  return stop.city || 'Точка'
}

/**
 * Расписание поездки для ганта.
 * Если хотя бы у одного отеля задана дата заезда, шкала привязана к календарю:
 * первый отель задаёт начало, следующие выстраиваются по своим датам заезда,
 * точки маршрута (город вылета и аэропорты) попадают на день ближайшего отеля.
 * Без дат шкала нумеруется условно: Д1, Д2, …
 */
export function buildSchedule(trip: Trip): Schedule {
  const stops = trip.stops
  const todayIso = toIsoDate(new Date())

  const stays = stops.filter((stop): stop is StayStop => stop.kind === 'stay')
  const firstDated = stays.find((stay) => Boolean(stay.checkIn))
  const anchor = firstDated?.checkIn

  const segments: ScheduleSegment[] = []
  const stayStart = new Map<string, number>()

  if (anchor) {
    let previousCheckout = anchor
    for (const stay of stays) {
      const checkIn = stay.checkIn ?? previousCheckout
      const nights = Math.max(1, Math.round(stay.nights))
      const start = Math.max(0, diffDays(anchor, checkIn))
      stayStart.set(stay.id, start)
      segments.push({
        stopId: stay.id,
        label: stopLabel(stay),
        kind: 'stay',
        start,
        length: nights,
        date: checkIn,
        nights: Math.round(stay.nights),
      })
      previousCheckout = addDays(checkIn, Math.max(0, Math.round(stay.nights)))
    }
  } else {
    let cursor = 0
    for (const stay of stays) {
      const nights = Math.max(1, Math.round(stay.nights))
      stayStart.set(stay.id, cursor)
      segments.push({
        stopId: stay.id,
        label: stopLabel(stay),
        kind: 'stay',
        start: cursor,
        length: nights,
        nights: Math.round(stay.nights),
      })
      cursor += nights
    }
  }

  const maxStayEnd = segments.reduce((max, segment) => Math.max(max, segment.start + segment.length), 0)

  // Точки маршрута ставим на день ближайшего следующего отеля (или на последний день поездки)
  const stopIndex = new Map(stops.map((stop, index) => [stop.id, index]))
  const datedStayPositions = stays
    .map((stay) => ({ index: stopIndex.get(stay.id) ?? 0, start: stayStart.get(stay.id) ?? 0 }))
    .sort((a, b) => a.index - b.index)

  let unanchoredCursor = 0
  stops.forEach((stop, index) => {
    if (stop.kind === 'stay') return

    if (anchor) {
      const nextStay = datedStayPositions.find((item) => item.index > index)
      const lastStay = [...datedStayPositions].reverse().find((item) => item.index < index)
      const start = nextStay?.start ?? (lastStay ? Math.max(0, maxStayEnd - 1) : 0)
      segments.push({
        stopId: stop.id,
        label: stopLabel(stop),
        kind: stop.kind,
        start,
        length: 1,
        date: addDays(anchor, start),
        nights: 0,
      })
      return
    }

    segments.push({
      stopId: stop.id,
      label: stopLabel(stop),
      kind: stop.kind,
      start: unanchoredCursor,
      length: 1,
      nights: 0,
    })
    unanchoredCursor += 1
  })

  // Порядок сегментов — как в маршруте
  const order = new Map(stops.map((stop, index) => [stop.id, index]))
  segments.sort((a, b) => (order.get(a.stopId) ?? 0) - (order.get(b.stopId) ?? 0))

  const total = Math.max(
    1,
    segments.reduce((max, segment) => Math.max(max, segment.start + segment.length), 0),
  )

  const days: ScheduleDay[] = []
  for (let index = 0; index < total; index += 1) {
    const date = anchor ? addDays(anchor, index) : undefined
    const parsed = parseIsoDate(date)
    const weekdayIndex = parsed ? parsed.getDay() : 0
    days.push({
      index,
      date,
      label: parsed ? `${parsed.getDate()}`.padStart(2, '0') : `Д${index + 1}`,
      weekday: parsed ? WEEKDAYS[weekdayIndex] : '',
      weekend: parsed ? weekdayIndex === 0 || weekdayIndex === 6 : false,
      weekStart: parsed ? weekdayIndex === 1 : index % 7 === 0,
      today: date === todayIso,
    })
  }

  return {
    days,
    segments,
    anchored: Boolean(anchor),
    start: anchor,
    end: anchor ? addDays(anchor, total) : undefined,
    scheduledNights: stays.reduce((sum, stay) => sum + Math.max(0, Math.round(stay.nights)), 0),
  }
}

/** Выравнивает даты: первый отель от сегодня (или своей даты), следующие — от выезда предыдущего. */
export function alignTripDates(trip: Trip): boolean {
  const stays = trip.stops.filter((stop): stop is StayStop => stop.kind === 'stay')
  if (stays.length === 0) return false

  let cursor = stays[0]?.checkIn ?? toIsoDate(new Date())
  let changed = false

  for (const stay of stays) {
    if (stay.checkIn !== cursor) {
      stay.checkIn = cursor
      changed = true
    }
    cursor = addDays(cursor, Math.max(0, Math.round(stay.nights)))
  }
  return changed
}

/** Минимальная и максимальная дата поездки для подписи. */
export function scheduleRange(schedule: Schedule): { from: string; to: string } | null {
  if (!schedule.start || !schedule.end) return null
  return { from: schedule.start, to: schedule.end }
}