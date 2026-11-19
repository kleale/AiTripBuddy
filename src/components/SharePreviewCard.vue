<script setup lang="ts">
import { computed } from 'vue'
import type { Trip } from '@/types'
import { buildSchedule } from '@/lib/schedule'
import { computeCosts } from '@/lib/costs'
import { formatMoney } from '@/lib/format'
import { transportFor } from '@/lib/transport'

const props = defineProps<{ trip: Trip }>()

const schedule = computed(() => buildSchedule(props.trip))
const total = computed(() => computeCosts(props.trip).total)

const origin = computed(() => props.trip.stops.find((stop) => stop.kind === 'origin'))
const stays = computed(() => props.trip.stops.filter((stop) => stop.kind === 'stay'))
const firstStay = computed(() => stays.value[0])
const route = computed(() => {
  const from = origin.value?.city ?? '—'
  const stay = firstStay.value
  const to = stay?.hotel || stay?.resort || stay?.city || '—'
  return `${from} → ${to}`
})

const dateRange = computed(() => {
  const start = schedule.value.start
  const end = schedule.value.end
  if (!start || !end) return 'Даты не заданы'
  const fmt = (iso: string) => iso.slice(8, 10) + '.' + iso.slice(5, 7)
  return `${fmt(start)} — ${fmt(end)}`
})

const days = computed(() => schedule.value.days.slice(0, 14))
const overflow = computed(() => Math.max(0, schedule.value.days.length - 14))

function dayColor(index: number): string {
  const active = schedule.value.items.filter((item) => index >= item.start && index < item.start + Math.max(1, item.length))
  const stay = active.find((item) => item.kind === 'stay')
  if (stay) return '#34d399'
  const link = active.find((item) => item.kind === 'flight' || item.kind === 'transfer' || item.kind === 'move')
  if (link && (link.kind === 'flight' || link.kind === 'transfer' || link.kind === 'move')) {
    return transportFor({
      kind: link.kind,
      transport: link.kind === 'flight' ? 'plane' : props.trip.links[link.linkIndex ?? 0]?.transport,
    }).color
  }
  return 'transparent'
}
</script>

<template>
  <div class="share-card">
    <div class="share-card-glow" />
    <div class="share-card-head">
      <div class="share-logo">ATB</div>
      <div>
        <span class="share-kicker">AiTripBuddy · поездка</span>
        <h3>{{ trip.name || 'Горнолыжная поездка' }}</h3>
      </div>
    </div>

    <div class="share-route">{{ route }}</div>

    <div class="share-stats">
      <div>
        <span>Итого</span>
        <b>{{ formatMoney(total, trip.currency) }}</b>
      </div>
      <div>
        <span>Даты</span>
        <b>{{ dateRange }}</b>
      </div>
      <div>
        <span>Люди</span>
        <b>{{ trip.pax }} чел.</b>
      </div>
    </div>

    <div class="share-calendar">
      <div class="share-calendar-title">
        <span>Календарь</span>
        <span v-if="overflow">+{{ overflow }} дн.</span>
      </div>
      <div class="share-days">
        <div v-for="day in days" :key="day.index" class="share-day">
          <span>{{ day.weekday }}</span>
          <b>{{ day.label }}</b>
          <i :style="{ background: dayColor(day.index) }" />
        </div>
      </div>
    </div>

    <div class="share-legend">
      <span><i class="stay" /> проживание</span>
      <span><i class="flight" /> перелёт</span>
      <span><i class="transfer" /> трансфер</span>
    </div>
  </div>
</template>
