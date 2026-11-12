<script setup lang="ts">
import { computed } from 'vue'
import {
  alignTripDates,
  buildSchedule,
  fillLinkDates,
  stayCheckOut,
  toIsoDate,
  type ScheduleItem,
} from '@/lib/schedule'
import { trip } from '@/stores/trip'
import { formatHours } from '@/lib/format'

const CELL = 30
const LABEL_WIDTH = 196

const schedule = computed(() => (trip.value ? buildSchedule(trip.value) : null))

function formatDate(iso?: string): string {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

const rangeLabel = computed(() => {
  const value = schedule.value
  const from = value?.start
  const lastDay = value?.days[value.days.length - 1]?.date
  if (!from || !lastDay) return 'даты не заданы'
  return `${formatDate(from)} — ${formatDate(lastDay)}`
})

const eventsWithoutDate = computed(
  () => schedule.value?.items.filter((item) => item.linkIndex !== undefined && !item.date).length ?? 0,
)

const trackWidth = computed(() => `${(schedule.value?.days.length ?? 0) * CELL}px`)

function isEvent(item: ScheduleItem): boolean {
  return item.linkIndex !== undefined
}

function barStyle(item: ScheduleItem): Record<string, string> {
  if (item.kind === 'stay') {
    return {
      left: `${item.start * CELL}px`,
      width: `${Math.max(1, item.length) * CELL - 4}px`,
    }
  }
  return {
    left: `${item.start * CELL + 9}px`,
    width: '12px',
  }
}

function itemTitle(item: ScheduleItem): string {
  const start = item.date ? formatDate(item.date) : `Д${item.start + 1}`
  if (item.kind === 'stay') {
    const checkOut = item.date ? stayCheckOutDate(item) : undefined
    return `${item.label}: ${start} → ${formatDate(checkOut)}, ${item.nights} ноч.`
  }
  const time = item.time ? `, ${item.time}` : ''
  const meta = item.meta ? `, ${formatHours(durationOf(item))}` : ''
  const note = noteOf(item)
  return `${note ? note + ': ' : ''}${item.label.toLowerCase()} ${start}${time}${meta}`
}

function noteOf(item: ScheduleItem): string {
  const index = item.linkIndex
  if (index === undefined) return ''
  return trip.value?.links[index]?.note ?? ''
}

function stayCheckOutDate(item: ScheduleItem): string | undefined {
  const stop = trip.value?.stops.find((entry) => entry.id === item.stopId)
  return stop && stop.kind === 'stay' ? stayCheckOut(stop) : undefined
}

function durationOf(item: ScheduleItem): number {
  const index = item.linkIndex
  if (index === undefined) return 0
  return trip.value?.links[index]?.hours ?? 0
}

function timeOf(item: ScheduleItem): string {
  return item.time ?? ''
}

function align(): void {
  const current = trip.value
  if (!current) return
  alignTripDates(current)
  for (const link of current.links) link.date = undefined
  fillLinkDates(current)
}

function fillDates(): void {
  if (!trip.value) return
  fillLinkDates(trip.value)
}

const todayIso = toIsoDate(new Date())
const hasToday = computed(() => schedule.value?.days.some((day) => day.date === todayIso) ?? false)

/** Даты событий уехали далеко от отелей — подсказываем выровнять. */
const inconsistent = computed(() => {
  const value = schedule.value
  if (!value?.anchored) return false
  const nights = value.scheduledNights
  return nights > 0 && value.days.length > nights + 30
})
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
        <span v-else-if="inconsistent" class="timeline-warn">даты событий не совпадают с отелями</span>
        <span v-else-if="hasToday" class="timeline-today">сегодня в поездке</span>
        <button
          v-if="eventsWithoutDate"
          type="button"
          class="mini-btn"
          title="Подставить даты вылетов и трансферов из отелей"
          @click="fillDates"
        >
          Даты событиям
        </button>
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

        <div v-for="item in schedule.items" :key="item.id" class="tl-row" :class="{ event: isEvent(item) }">
          <div class="tl-label" :title="itemTitle(item)">
            <i class="tl-dot" :class="item.kind" />
            <span class="tl-name" :title="noteOf(item) || item.label">{{ item.label }}</span>
            <span v-if="isEvent(item) && timeOf(item)" class="tl-time">{{ timeOf(item) }}</span>
          </div>
          <div class="tl-track" :style="{ width: trackWidth }">
            <div class="tl-grid-lines">
              <span v-for="day in schedule.days" :key="day.index" :class="{ weekend: day.weekend }" />
            </div>
            <div
              class="tl-bar"
              :class="[item.kind, { single: item.kind !== 'stay' }]"
              :style="barStyle(item)"
              :title="itemTitle(item)"
            >
              <span v-if="item.kind === 'stay'">{{ item.nights }} н</span>
            </div>
            <span
              v-if="item.kind === 'stay' && stayCheckOutDate(item)"
              class="tl-checkout"
              :style="{ left: `${(item.start + item.length) * CELL}px` }"
            />
            <span v-if="isEvent(item)" class="tl-event-mark" :style="{ left: `${item.start * CELL}px` }" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>