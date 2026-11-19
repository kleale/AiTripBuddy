import type { Trip } from '@/types'
import { buildSchedule } from '@/lib/schedule'
import { computeCosts } from '@/lib/costs'
import { formatMoney } from '@/lib/format'
import { transportFor } from '@/lib/transport'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export interface SharePreviewData {
  title: string
  route: string
  total: string
  dates: string
  pax: string
  days: { label: string; weekday: string; color: string }[]
}

export function sharePreviewData(trip: Trip): SharePreviewData {
  const schedule = buildSchedule(trip)
  const origin = trip.stops.find((stop) => stop.kind === 'origin')
  const stay = trip.stops.find((stop) => stop.kind === 'stay')
  const from = origin?.city ?? '—'
  const to = stay?.hotel || stay?.resort || stay?.city || '—'
  const fmt = (iso?: string) => (iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) : '—')

  return {
    title: trip.name || 'Горнолыжная поездка',
    route: `${from} → ${to}`,
    total: formatMoney(computeCosts(trip).total, trip.currency),
    dates: `${fmt(schedule.start)} — ${fmt(schedule.end)}`,
    pax: `${trip.pax} чел.`,
    days: schedule.days.slice(0, 14).map((day) => {
      const active = schedule.items.filter(
        (item) => day.index >= item.start && day.index < item.start + Math.max(1, item.length),
      )
      const stayItem = active.find((item) => item.kind === 'stay')
      const linkItem = active.find((item) => item.kind === 'flight' || item.kind === 'transfer' || item.kind === 'move')
      let color = 'transparent'
      if (stayItem) {
        color = '#34d399'
      } else if (linkItem && (linkItem.kind === 'flight' || linkItem.kind === 'transfer' || linkItem.kind === 'move')) {
        color = transportFor({
          kind: linkItem.kind,
          transport: linkItem.kind === 'flight' ? 'plane' : trip.links[linkItem.linkIndex ?? 0]?.transport,
        }).color
      }
      return { label: day.label, weekday: day.weekday, color }
    }),
  }
}

/** Рисует PNG-превью 1200×630 и скачивает его. */
export function renderSharePreview(trip: Trip): string | null {
  if (typeof document === 'undefined') return null
  const data = sharePreviewData(trip)
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, 1200, 630)
  bg.addColorStop(0, '#142138')
  bg.addColorStop(0.55, '#0f1929')
  bg.addColorStop(1, '#0a1322')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1200, 630)

  const glow = ctx.createRadialGradient(1000, 40, 0, 1000, 40, 420)
  glow.addColorStop(0, 'rgba(56,189,248,0.25)')
  glow.addColorStop(1, 'rgba(56,189,248,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1200, 630)

  ctx.fillStyle = '#38bdf8'
  roundRect(ctx, 72, 62, 62, 62, 16)
  ctx.fill()
  ctx.fillStyle = '#04121f'
  ctx.font = '700 18px "Segoe UI", Arial'
  ctx.fillText('ATB', 88, 101)

  ctx.fillStyle = '#e7eefc'
  ctx.font = '700 32px "Segoe UI", Arial'
  ctx.fillText('AiTripBuddy', 154, 96)
  ctx.fillStyle = '#7dd3fc'
  ctx.font = '13px "Segoe UI", Arial'
  ctx.fillText('ПРЕДПРОСМОТР ПОЕЗДКИ', 156, 120)

  ctx.fillStyle = '#f0f7ff'
  ctx.font = '600 44px "Segoe UI", Arial'
  ctx.fillText(data.title.slice(0, 38), 72, 220)
  ctx.fillStyle = '#8aa4c8'
  ctx.font = '21px "Segoe UI", Arial'
  ctx.fillText(data.route.slice(0, 60), 72, 262)

  const stats = [
    ['ИТОГО', data.total, 330],
    ['ДАТЫ', data.dates, 720],
    ['ЛЮДИ', data.pax, 980],
  ] as const
  ctx.fillStyle = '#0d1728'
  roundRect(ctx, 72, 300, 1056, 86, 16)
  ctx.fill()
  ctx.strokeStyle = '#2a3b5a'
  ctx.lineWidth = 2
  ctx.stroke()
  for (const [label, value, x] of stats) {
    ctx.fillStyle = '#8aa4c8'
    ctx.font = '12px "Segoe UI", Arial'
    ctx.fillText(label, x, 328)
    ctx.fillStyle = '#e7eefc'
    ctx.font = '700 24px "Segoe UI", Arial'
    ctx.fillText(value, x, 360)
  }

  ctx.fillStyle = '#8aa4c8'
  ctx.font = '12px "Segoe UI", Arial'
  ctx.fillText('КАЛЕНДАРЬ ПОЕЗДКИ', 72, 430)
  data.days.forEach((day, index) => {
    const x = 72 + index * 74
    ctx.fillStyle = '#0d1728'
    roundRect(ctx, x, 448, 66, 64, 9)
    ctx.fill()
    ctx.strokeStyle = '#2a3b5a'
    ctx.stroke()
    ctx.fillStyle = '#e7eefc'
    ctx.font = '700 16px "Segoe UI", Arial'
    ctx.fillText(day.label, x + 26, 482)
    ctx.fillStyle = '#6f88ad'
    ctx.font = '10px "Segoe UI", Arial'
    ctx.fillText(day.weekday, x + 22, 498)
    ctx.fillStyle = day.color
    roundRect(ctx, x, 505, 66, 5, 2.5)
    ctx.fill()
  })

  ctx.fillStyle = '#6f88ad'
  ctx.font = '15px "Segoe UI", Arial'
  ctx.fillText('kleale.github.io/AiTripBuddy', 72, 596)

  return canvas.toDataURL('image/png')
}

/** Скачивает PNG-превью 1200×630. */
export function downloadSharePreview(trip: Trip): void {
  if (typeof document === 'undefined') return
  const dataUrl = renderSharePreview(trip)
  if (!dataUrl) return
  const title = sharePreviewData(trip).title
  const link = document.createElement('a')
  link.download = `AiTripBuddy-${title.replace(/[^\wа-яА-ЯёЁ-]+/g, '-').slice(0, 40)}.png`
  link.href = dataUrl
  link.click()
}
