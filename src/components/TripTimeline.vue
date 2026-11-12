<script setup lang="ts">
import { computed } from 'vue'
import { alignTripDates, buildSchedule, stayCheckOut, toIsoDate } from '@/lib/schedule'
import { trip } from '@/stores/trip'
import type { ScheduleSegment } from '@/lib/schedule'

const CELL = 30
const LABEL_WIDTH = 132

const schedule = computed(() => (trip.value ? buildSchedule(trip.value) : null))

const rangeLabel = computed(() => {
  const value = schedule.value
  const from = value?.start
  const lastDay = value?.days[value.days.length - 1]?.date
  if (!from || !lastDay) return 'даты не заданы'
  return `${formatDate(from)} — ${formatDate(lastDay)}`
})

function formatDate(iso?: string): string {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

const trackWidth = computed(() => `${(schedule.value?.days.length ?? 0) * CELL}px`)

function barStyle(segment: ScheduleSegment): Record<string, string> {
  if (segment.kind === 'stay') {
    return {
      left: `${segment.start * CELL}px`,
      width: `${Math.max(1, segment.length) * CELL - 4}px`,
    }
  }
  return {
    left: `${segment.start * CELL + 9}px`,
    width: '12px',
  }
}

function segmentTitle(segment: ScheduleSegment): string {
  const start = segment.date ? formatDate(segment.date) : `Д${segment.start + 1}`
  if (segment.kind === 'stay') {
    const checkIn = segment.date
    const checkOut = checkIn
      ? new Date(new Date(`${checkIn}T00:00:00`).getTime() + segment.length * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : undefined
    return `${segment.label}: ${start} → ${formatDate(checkOut)}`
  }
  return `${segment.label}: ${start}`
}

function align(): void {
  if (!trip.value) return
  alignTripDates(trip.value)
}

const todayIso = toIsoDate(new Date())
const hasToday = computed(() => schedule.value?.days.some((day) => day.date === todayIso) ?? false)

function checkoutFor(stopId: string): string | undefined {
  const stay = trip.value?.stops.find((stop) => stop.id === stopId)
  return stay && stay.kind === 'stay' ? stayCheckOut(stay) : undefined
}
</script>

<template>
  <section v-if="schedule && trip" class="timeline">
    <div class="timeline-head">
      <div class="timeline-title">
        <span class="node-kicker">Календарь поездки</span>
        <span class="timeline-range">{{ rangeLabel }}</span>
      </div>
      <div class="timeline-actions">
        <span v-if="!schedule.anchored" class="timeline-hint">укажите дату заезда у отеля</span>
        <span v-else-if="hasToday" class="timeline-today">сегодня в поездке</span>
        <button type="button" class="mini-btn" title="Выстроить даты отелей подряд" @click="align">
          Выровнять даты
        </button>
      </div>
    </div>

    <div class="timeline-scroll">
      <div class="timeline-grid" :style="{ '--label-width': `${LABEL_WIDTH}px`, '--cell': `${CELL}px` }">
        <div class="tl-head">
          <div class="tl-corner" />
          <div class="tl-days" :style="{ width: trackWidth }">
            <div
              v-for="day in schedule.days"
              :key="day.index"
              class="tl-day"
              :class="{ weekend: day.weekend, 'week-start': day.weekStart, today: day.today }"
              :title="day.date ?? `День ${day.index + 1}`"
            >
              <span class="tl-weekday">{{ day.weekday }}</span>
              <b>{{ day.label }}</b>
            </div>
          </div>
        </div>

        <div v-for="segment in schedule.segments" :key="segment.stopId" class="tl-row">
          <div class="tl-label" :title="segment.label">
            <i class="tl-dot" :class="segment.kind" />
            <span>{{ segment.label }}</span>
          </div>
          <div class="tl-track" :style="{ width: trackWidth }">
            <div class="tl-grid-lines">
              <span
                v-for="day in schedule.days"
                :key="day.index"
                :class="{ weekend: day.weekend }"
              />
            </div>
            <div
              class="tl-bar"
              :class="[segment.kind, { single: segment.kind !== 'stay' }]"
              :style="barStyle(segment)"
              :title="segmentTitle(segment)"
            >
              <span v-if="segment.kind === 'stay'">{{ segment.nights }} н</span>
            </div>
            <span
              v-if="segment.kind === 'stay' && checkoutFor(segment.stopId)"
              class="tl-checkout"
              :style="{ left: `${(segment.start + segment.length) * CELL}px` }"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>