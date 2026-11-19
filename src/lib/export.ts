import type { Trip } from '@/types'
import { computeCosts } from '@/lib/costs'
import { addDays, buildSchedule, stayCheckOut, toIsoDate } from '@/lib/schedule'
import { formatMoney } from '@/lib/format'

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function fold(line: string): string {
  if (line.length <= 74) return line
  const parts = [line.slice(0, 74)]
  for (let index = 74; index < line.length; index += 73) {
    parts.push(` ${line.slice(index, index + 73)}`)
  }
  return parts.join('\r\n')
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, '')
}

function localStamp(iso: string, time?: string): string {
  return `${dateValue(iso)}T${(time || '09:00').replace(':', '')}00`
}

function addHours(iso: string, time: string | undefined, hours: number): string {
  const date = new Date(`${iso}T${time || '09:00'}:00`)
  if (Number.isNaN(date.getTime())) return localStamp(iso, time)
  date.setMinutes(date.getMinutes() + Math.max(0, hours) * 60)
  const ymd = toIsoDate(date)
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${dateValue(ymd)}T${hh}${mm}00`
}

export interface IcsEvent {
  uid: string
  start: string
  end: string
  allDay: boolean
  summary: string
  location?: string
  description?: string
}

export function tripIcsEvents(trip: Trip): IcsEvent[] {
  const events: IcsEvent[] = []

  for (const stop of trip.stops) {
    if (stop.kind !== 'stay' || !stop.checkIn) continue
    const checkout = stayCheckOut(stop) ?? addDays(stop.checkIn, Math.max(0, stop.nights))
    events.push({
      uid: `${trip.id}-${stop.id}@aitripbuddy`,
      start: dateValue(stop.checkIn),
      end: dateValue(checkout),
      allDay: true,
      summary: stop.hotel ? `Отель: ${stop.hotel}` : `Проживание: ${stop.resort || stop.city || 'курорт'}`,
      location: [stop.resort || stop.city, stop.country].filter(Boolean).join(', '),
      description: [
        `${stop.nights} ноч. · ${stop.rooms} номер(ов)`,
        stop.hotelPerNight > 0 ? `от ${stop.hotelPerNight} ${trip.currency}/ночь` : '',
        stop.activities?.length ? `Мероприятий: ${stop.activities.length}` : '',
      ].filter(Boolean).join('\n'),
    })

    for (const activity of stop.activities ?? []) {
      if (!activity.date) continue
      const start = localStamp(activity.date, activity.time)
      const end = addHours(activity.date, activity.time, activity.durationHours || 2)
      events.push({
        uid: `${trip.id}-${activity.id}@aitripbuddy`,
        start,
        end,
        allDay: false,
        summary: activity.title || activity.placeName || 'Мероприятие',
        location: [activity.placeName, activity.address].filter(Boolean).join(', '),
        description: [
          activity.price > 0 ? `${activity.price} ${trip.currency}/чел.` : '',
          activity.contact ? `Контакт: ${activity.contact}` : '',
          activity.booked ? 'Забронировано' : 'Не забронировано',
        ].filter(Boolean).join('\n'),
      })
    }
  }

  trip.links.forEach((link, index) => {
    if (!link.date) return
    const from = trip.stops[index]
    const to = trip.stops[index + 1]
    const kind = link.kind === 'flight' ? 'Перелёт' : link.kind === 'move' ? 'Переезд' : 'Трансфер'
    const route = from && to
      ? `${from.kind === 'stay' ? from.resort || from.city : from.city} → ${to.kind === 'stay' ? to.resort || to.city : to.city}`
      : ''
    events.push({
      uid: `${trip.id}-link-${index}@aitripbuddy`,
      start: localStamp(link.date, link.time),
      end: addHours(link.date, link.time, link.hours || 1),
      allDay: false,
      summary: `${kind}${route ? `: ${route}` : ''}`,
      location: route,
      description: [
        link.hours ? `${Math.round(link.hours * 10) / 10} ч в пути` : '',
        link.price > 0 ? `${formatMoney(link.price, trip.currency)}` : '',
        link.note || '',
      ].filter(Boolean).join('\n'),
    })
  })

  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

export function buildTripIcs(trip: Trip): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AiTripBuddy//Trip//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(trip.name || 'Поездка')}`,
    'X-WR-TIMEZONE:UTC',
  ]

  for (const event of tripIcsEvents(trip)) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.uid}`)
    lines.push(`DTSTAMP:${stamp()}`)
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${event.start}`)
      lines.push(`DTEND;VALUE=DATE:${event.end}`)
    } else {
      lines.push(`DTSTART:${event.start}`)
      lines.push(`DTEND:${event.end}`)
    }
    lines.push(`SUMMARY:${escapeIcs(event.summary)}`)
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** Скачивает .ics; в SSR/тестах без DOM ничего не делает. */
export function downloadTripIcs(trip: Trip): boolean {
  if (typeof document === 'undefined') return false
  const blob = new Blob([buildTripIcs(trip)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(trip.name || 'trip').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML для печати в PDF: пользователь выбирает «Сохранить как PDF». */
export function tripPrintHtml(trip: Trip): string {
  const costs = computeCosts(trip)
  const schedule = buildSchedule(trip)
  const stays = trip.stops.filter((stop) => stop.kind === 'stay')
  const rows = schedule.items.map((item) => {
    const date = item.date || (schedule.start ? addDays(schedule.start, item.start) : '')
    return `<tr><td>${date ? esc(date) : '—'}</td><td>${esc(item.time || '')}</td><td>${esc(item.label)}</td><td>${esc(item.meta || '')}</td></tr>`
  }).join('')

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(trip.name)}</title>
<style>
  @page { margin: 16mm; }
  body { font: 12px/1.45 -apple-system, Segoe UI, Roboto, sans-serif; color: #142033; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 18px 0 6px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #526a8a; }
  .meta { color: #526a8a; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #dbe5f2; text-align: left; vertical-align: top; }
  th { font-size: 10px; color: #526a8a; }
  .summary { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 8px; }
  .summary b { display: block; font-size: 16px; }
  .summary span { font-size: 10px; color: #526a8a; }
  .badge { display: inline-block; padding: 2px 7px; border: 1px solid #c7d7ea; border-radius: 999px; font-size: 10px; }
</style></head><body>
<h1>${esc(trip.name || 'Горнолыжная поездка')}</h1>
<p class="meta">${esc(schedule.start || '')} — ${esc(schedule.end || '')} · ${trip.pax} чел. · ${esc(trip.currency)}</p>
<div class="summary">
  <div><span>Итого</span><b>${esc(formatMoney(costs.total, trip.currency))}</b></div>
  <div><span>На человека</span><b>${esc(formatMoney(costs.perPerson, trip.currency))}</b></div>
  <div><span>Ночей</span><b>${costs.nights}</b></div>
  <div><span>Дней катания</span><b>${costs.rideDays}</b></div>
</div>
<h2>Маршрут</h2>
<table><thead><tr><th>Дата</th><th>Время</th><th>Событие</th><th>Детали</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Отели</h2>
<table><thead><tr><th>Курорт</th><th>Отель</th><th>Ночей</th><th>Цена</th></tr></thead><tbody>
${stays.map((stop) => `<tr><td>${esc(stop.resort || stop.city || '')}</td><td>${esc(stop.hotel || '—')}</td><td>${stop.nights}</td><td>${esc(formatMoney(stop.hotelPerNight, trip.currency))}</td></tr>`).join('')}
</tbody></table>
<p class="meta">Суммы — расчёт приложения; проверяйте цены и бронирования у поставщиков.</p>
</body></html>`
}

/** Печать в PDF через скрытый iframe — без popup-блокировки. */
export function printTripPdf(trip: Trip): boolean {
  if (typeof document === 'undefined') return false
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) {
    frame.remove()
    return false
  }
  doc.open()
  doc.write(tripPrintHtml(trip))
  doc.close()
  const print = (): void => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1000)
  }
  if (doc.readyState === 'complete') setTimeout(print, 100)
  else frame.onload = () => setTimeout(print, 100)
  return true
}
