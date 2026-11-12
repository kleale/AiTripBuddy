<script setup lang="ts">
import { computed } from 'vue'
import { tripMetrics, type TripMetrics } from '@/lib/compare'
import { formatHours, formatMoney } from '@/lib/format'
import type { Trip } from '@/types'

const props = defineProps<{ open: boolean; trips: Trip[] }>()
const emit = defineEmits<{ close: [] }>()

type Better = 'min' | 'max' | 'none'
type Format = 'rub' | 'own' | 'number' | 'hours' | 'stars' | 'percent' | 'text'

interface Row {
  key: string
  label: string
  hint?: string
  format: Format
  better: Better
  value: (metrics: TripMetrics) => number | string | null
  display: (metrics: TripMetrics) => string
}

const metrics = computed(() => props.trips.map((item) => tripMetrics(item)))

const rub = (value: number): string => formatMoney(value, 'RUB')

const rows: Row[] = [
  {
    key: 'total',
    label: 'Итого за поездку',
    hint: 'в валюте поездки',
    format: 'own',
    better: 'min',
    value: (m) => m.totalRub,
    display: (m) => formatMoney(m.total, m.currency),
  },
  {
    key: 'perPerson',
    label: 'На человека',
    format: 'rub',
    better: 'min',
    value: (m) => m.perPersonRub,
    display: (m) => rub(m.perPersonRub),
  },
  {
    key: 'perRideDay',
    label: 'Цена дня катания',
    format: 'rub',
    better: 'min',
    value: (m) => m.perRideDayRub,
    display: (m) => rub(m.perRideDayRub),
  },
  {
    key: 'rideDays',
    label: 'Дней катания',
    format: 'number',
    better: 'max',
    value: (m) => m.rideDays,
    display: (m) => `${m.rideDays}`,
  },
  {
    key: 'nights',
    label: 'Ночей',
    format: 'number',
    better: 'max',
    value: (m) => m.nights,
    display: (m) => `${m.nights}`,
  },
  {
    key: 'stays',
    label: 'Отелей',
    format: 'number',
    better: 'none',
    value: (m) => m.stays,
    display: (m) => `${m.stays} (${m.rooms} ном.)`,
  },
  {
    key: 'stars',
    label: 'Уровень отелей',
    format: 'stars',
    better: 'max',
    value: (m) => (m.avgStars > 0 ? m.avgStars : null),
    display: (m) => (m.avgStars > 0 ? `${'★'.repeat(Math.round(m.avgStars))} ${m.avgStars.toFixed(1)}` : '—'),
  },
  {
    key: 'hotelPrice',
    label: 'Отель за ночь',
    hint: 'за номер, в ₽',
    format: 'rub',
    better: 'min',
    value: (m) => (m.avgHotelPerNightRub > 0 ? m.avgHotelPerNightRub : null),
    display: (m) => (m.avgHotelPerNightRub > 0 ? rub(m.avgHotelPerNightRub) : '—'),
  },
  {
    key: 'food',
    label: 'Питание за день',
    hint: 'на человека, в ₽',
    format: 'rub',
    better: 'min',
    value: (m) => (m.foodPerDayRub > 0 ? m.foodPerDayRub : null),
    display: (m) => (m.foodPerDayRub > 0 ? rub(m.foodPerDayRub) : '—'),
  },
  {
    key: 'skipass',
    label: 'Скипасс за день',
    hint: 'на человека, в ₽',
    format: 'rub',
    better: 'min',
    value: (m) => (m.skipassPerDayRub > 0 ? m.skipassPerDayRub : null),
    display: (m) => (m.skipassPerDayRub > 0 ? rub(m.skipassPerDayRub) : '—'),
  },
  {
    key: 'travel',
    label: 'В дороге',
    format: 'hours',
    better: 'min',
    value: (m) => (m.travelHours > 0 ? m.travelHours : null),
    display: (m) => formatHours(m.travelHours),
  },
  {
    key: 'budget',
    label: 'Использование бюджета',
    format: 'percent',
    better: 'min',
    value: (m) => m.budgetUsage,
    display: (m) => (m.budgetUsage === null ? '—' : `${Math.round(m.budgetUsage * 100)}%`),
  },
  {
    key: 'resorts',
    label: 'Курорты',
    format: 'text',
    better: 'none',
    value: (m) => m.resorts,
    display: (m) => m.resorts || '—',
  },
]

function bestIndex(row: Row): number | null {
  if (row.better === 'none') return null
  const values = metrics.value.map((m) => row.value(m))
  let best: number | null = null
  let bestValue: number | null = null
  let allEqual = true
  let sawNumber = false

  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    sawNumber = true
    if (bestValue === null) {
      bestValue = value
      best = index
      return
    }
    if (value !== bestValue) allEqual = false
    const better = row.better === 'min' ? value < bestValue : value > bestValue
    if (better) {
      bestValue = value
      best = index
    }
  })

  // Ничья: подсвечивать победителя нечестно
  if (!sawNumber || allEqual) return null
  return best
}

const bestIndexes = computed(() => rows.map((row) => bestIndex(row)))

const summary = computed(() => {
  if (metrics.value.length < 2) return null
  const totalRow = rows[0]
  const rideRow = rows[3]
  if (!totalRow || !rideRow) return null
  const bestTotal = bestIndex(totalRow)
  const bestRide = bestIndex(rideRow)
  const cheapest = bestTotal !== null ? metrics.value[bestTotal] : null
  const mostRides = bestRide !== null ? metrics.value[bestRide] : null

  if (!cheapest && !mostRides) return 'Поездки сопоставимы по цене и дням катания'
  if (!cheapest) return `Больше катания — «${mostRides?.name ?? '—'}»`
  if (!mostRides) return `Дешевле — «${cheapest.name}»`
  if (cheapest.id === mostRides.id) return `«${cheapest.name}» выигрывает и по цене, и по дням катания`
  return `Дешевле — «${cheapest.name}», больше катания — «${mostRides.name}»`
})
</script>

<template>
  <div v-if="props.open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Сравнение</div>
          <h3 id="compare-title">Поездки бок о бок</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
      </div>

      <p v-if="summary" class="compare-summary">{{ summary }}</p>
      <p class="compare-note">Денежные показатели приведены к ₽ по внутреннему курсу приложения.</p>

      <div class="compare-scroll">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-metric">Показатель</th>
              <th v-for="item in props.trips" :key="item.id">
                <span class="compare-trip-name">{{ item.name }}</span>
                <span class="compare-trip-sub">{{ item.pax }} чел. · {{ item.currency }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in rows" :key="row.key">
              <th class="compare-metric">
                <span>{{ row.label }}</span>
                <span v-if="row.hint" class="compare-hint">{{ row.hint }}</span>
              </th>
              <td
                v-for="(item, index) in metrics"
                :key="item.id"
                :class="{ best: bestIndexes[rowIndex] === index }"
              >
                {{ row.display(item) }}
                <span v-if="bestIndexes[rowIndex] === index && row.better !== 'none'" class="best-badge">
                  {{ row.better === 'min' ? 'выгодно' : 'лучше' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button type="button" class="primary-btn" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>