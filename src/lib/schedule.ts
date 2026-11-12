import type { LinkKind, StayStop, Stop, Trip } from '@/types'

export type ScheduleItemKind = 'origin' | 'airport' | 'stay' | LinkKind

export interface ScheduleItem {
  id: string
  kind: ScheduleItemKind
  label: string
  /** индекс первого дня на шкале */
  start: number
  /** длина в днях: отель — ночи, точка или событие — 1 день */
  length: number
  date?: string
  time?: string
  nights: number
  /** подпись справа: время в пути, цена участка и т.п. */
  meta?: string
  stopId?: string
  linkIndex?: number
}

export interface ScheduleDay {
  index: number
  date?: string
  label: string
  weekday: string
  weekend: boolean
  weekStart: boolean
  today: boolean
}

export interface Schedule {
  days: ScheduleDay[]
  items: ScheduleItem[]
  anchored: boolean
  start?: string
  end?: string
  scheduledNights: number
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const DAY_MS = 86_400_000

export const linkLabels: Record<LinkKind, string> = {
  flight: 'Перелёт',
  transfer: 'Трансфер',
  move: 'Переезд',
}

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

export function placeName(stop: StayStop): string {
  if (stop.placeKind === 'city') return stop.city || 'Город'
  return stop.resort || stop.city || 'Курорт'
}

function stopLabel(stop: Stop, index: number, stops: Stop[]): string {
  if (stop.kind === 'stay') return stop.hotel || placeName(stop)
  const city = stop.city || 'Точка'
  if (stop.kind !== 'airport') return city
  const hasStayAfter = stops.slice(index + 1).some((item) => item.kind === 'stay')
  return hasStayAfter ? `${city} · прилёт` : `${city} · вылет`
}

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return ''
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} мин`
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

/** Самая ранняя известная дата поездки: заезд отеля или дата участка. */
function earliestDate(trip: Trip): string | undefined {
  const dates: string[] = []
  for (const stop of trip.stops) {
    if (stop.kind === 'stay' && stop.checkIn) dates.push(stop.checkIn)
  }
  for (const link of trip.links) {
    if (link.date) dates.push(link.date)
  }
  if (dates.length === 0) return undefined
  return dates.sort()[0]
}

/**
 * Расписание поездки для ганта.
 * Включает отели, точки маршрута и события перелётов/трансферов:
 * событие ставится на свою дату (если задана), иначе — на день ближайшего отеля.
 * Без дат шкала нумеруется условно: Д1, Д2, …
 */
export function buildSchedule(trip: Trip): Schedule {
  const stops = trip.stops
  const todayIso = toIsoDate(new Date())
  const anchor = earliestDate(trip)

  const items: ScheduleItem[] = []

  stops.forEach((stop, index) => {
    const link = trip.links[index]

    if (stop.kind === 'stay') {
      const nights = Math.max(1, Math.round(stop.nights))
      items.push({
        id: stop.id,
        kind: 'stay',
        label: stopLabel(stop, index, stops),
        start: anchor && stop.checkIn ? Math.max(0, diffDays(anchor, stop.checkIn)) : 0,
        length: nights,
        date: stop.checkIn,
        nights: Math.round(stop.nights),
        stopId: stop.id,
      })
    } else {
      items.push({
        id: stop.id,
        kind: stop.kind,
        label: stopLabel(stop, index, stops),
        start: 0,
        length: 1,
        nights: 0,
        stopId: stop.id,
      })
    }

    if (!link) return
    items.push({
      id: `link-${index}`,
      kind: link.kind,
      label: linkLabels[link.kind],
      start: 0,
      length: 1,
      date: link.date,
      time: link.time,
      nights: 0,
      meta: formatDuration(link.hours),
      linkIndex: index,
    })
  })

  // Датированные элементы задают шкалу, остальные прижимаются к ближайшему датированному
  const dated = items.filter((item) => item.date)

  if (anchor) {
    for (const item of dated) {
      if (item.date) item.start = Math.max(0, diffDays(anchor, item.date))
    }

    items.forEach((item, position) => {
      if (item.date) return
      const next = items.slice(position + 1).find((candidate) => candidate.date)
      const previous = [...items.slice(0, position)].reverse().find((candidate) => candidate.date)
      item.start = next?.start ?? previous?.start ?? 0
    })
  } else {
    // Без дат отели занимают ночи подряд, события встают на день ближайшего отеля,
    // а не добавляют лишние дни в шкалу.
    let cursor = 0
    for (const item of items) {
      if (item.kind !== 'stay') continue
      item.start = cursor
      cursor += item.length
    }

    items.forEach((item, position) => {
      if (item.kind === 'stay') return
      const next = items.slice(position + 1).find((candidate) => candidate.kind === 'stay')
      if (next) {
        item.start = next.start
        return
      }
      const previous = [...items.slice(0, position)].reverse().find((candidate) => candidate.kind === 'stay')
      // событие после последнего отеля — на его последний день
      item.start = previous ? previous.start + previous.length - 1 : 0
    })
  }

  const total = Math.max(
    1,
    items.reduce((max, item) => Math.max(max, item.start + item.length), 0),
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
    items,
    anchored: Boolean(anchor),
    start: anchor,
    end: anchor ? addDays(anchor, total) : undefined,
    scheduledNights: stops.reduce(
      (sum, stop) => (stop.kind === 'stay' ? sum + Math.max(0, Math.round(stop.nights)) : sum),
      0,
    ),
  }
}

/**
 * Выравнивает даты: первый отель от сегодня (или своей даты), следующие — от выезда предыдущего.
 * Даты событий, привязанные к соседнему отелю (±1 день от заезда или выезда),
 * сдвигаются вместе с ним. Явно сдвинутые пользователем даты остаются как есть.
 */
export function alignTripDates(trip: Trip): boolean {
  const stays = trip.stops.filter((stop): stop is StayStop => stop.kind === 'stay')
  if (stays.length === 0) return false

  const oldStays = new Map(stays.map((stay) => [stay.id, { checkIn: stay.checkIn, nights: stay.nights }]))

  let cursor = stays[0]?.checkIn ?? toIsoDate(new Date())
  let changed = false

  for (const stay of stays) {
    if (stay.checkIn !== cursor) {
      stay.checkIn = cursor
      changed = true
    }
    cursor = addDays(cursor, Math.max(0, Math.round(stay.nights)))
  }

  if (!changed) return false

  trip.links.forEach((link, index) => {
    if (!link.date) return
    const anchor = linkAnchor(trip, index)
    if (!anchor?.stay.checkIn) return

    const old = oldStays.get(anchor.stay.id)
    if (!old?.checkIn) return

    const nights = Math.max(0, Math.round(old.nights))
    const oldAnchor =
      anchor.mode === 'checkIn' ? old.checkIn : addDays(old.checkIn, nights)
    const offset = diffDays(oldAnchor, link.date)
    // больше суток от отеля — это осознанная дата, её не трогаем
    if (Math.abs(offset) > 1) return

    const newAnchor =
      anchor.mode === 'checkIn'
        ? anchor.stay.checkIn
        : addDays(anchor.stay.checkIn, nights)
    link.date = addDays(newAnchor, offset)
  })

  return true
}

/** Дата события по соседним отелям: заезд ближайшего следующего или выезд предыдущего. */
function linkDateFromStays(trip: Trip, linkIndex: number): string | undefined {
  const nextStay = trip.stops
    .slice(linkIndex + 1)
    .find((stop): stop is StayStop => stop.kind === 'stay' && Boolean(stop.checkIn))
  if (nextStay?.checkIn) return nextStay.checkIn

  const prevStay = [...trip.stops.slice(0, linkIndex + 1)]
    .reverse()
    .find((stop): stop is StayStop => stop.kind === 'stay' && Boolean(stop.checkIn))
  if (prevStay?.checkIn) return addDays(prevStay.checkIn, Math.max(0, Math.round(prevStay.nights)))

  return undefined
}

/**
 * Раскладывает даты событий: вылет и трансфер получают даты из расписания отелей,
 * но только если дату не задали вручную. Ручные даты никогда не перезаписываются.
 */
export function fillLinkDates(trip: Trip): boolean {
  if (!earliestDate(trip)) return false

  let changed = false
  trip.links.forEach((link, index) => {
    if (link.date) return
    const date = linkDateFromStays(trip, index)
    if (!date) return
    link.date = date
    changed = true
  })
  return changed
}

/**
 * Отель, к которому привязано событие: ближайший следующий (по заезду)
 * или, если следующего нет, предыдущий (по выезду).
 */
function linkAnchor(
  trip: Trip,
  linkIndex: number,
): { stay: StayStop; mode: 'checkIn' | 'checkOut' } | undefined {
  const next = trip.stops
    .slice(linkIndex + 1)
    .find((stop): stop is StayStop => stop.kind === 'stay')
  if (next) return { stay: next, mode: 'checkIn' }

  const prev = [...trip.stops.slice(0, linkIndex + 1)]
    .reverse()
    .find((stop): stop is StayStop => stop.kind === 'stay')
  return prev ? { stay: prev, mode: 'checkOut' } : undefined
}

export interface ScheduleRange {
  from: string
  to: string
}

export function scheduleRange(schedule: Schedule): ScheduleRange | null {
  if (!schedule.start || !schedule.end) return null
  const lastDay = schedule.days[schedule.days.length - 1]
  return { from: schedule.start, to: lastDay?.date ?? schedule.end }
}