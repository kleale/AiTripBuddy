<script setup lang="ts">
import { computed } from 'vue'
import { costs, patchMeta, trip } from '@/stores/trip'
import { currencySymbols, formatHours, formatMoney } from '@/lib/format'
import NumberField from '@/components/NumberField.vue'
import TripAuditModal from '@/components/TripAuditModal.vue'
import OptimizerModal from '@/components/OptimizerModal.vue'
import { openTripAudit } from '@/lib/audit-store'
import { openOptimizer } from '@/lib/optimizer-store'
import { adminSettings } from '@/lib/admin'

const currency = computed(() => trip.value?.currency ?? 'RUB')
const symbol = computed(() => currencySymbols[currency.value])
const data = computed(() => costs.value)

const budget = computed(() => trip.value?.budget ?? 0)
const total = computed(() => data.value?.total ?? 0)
const overBudget = computed(() => budget.value > 0 && total.value > budget.value)
const budgetShare = computed(() =>
  budget.value > 0 ? Math.min(100, Math.round((total.value / budget.value) * 100)) : 0,
)
const budgetLeft = computed(() => budget.value - total.value)

/** Обратный перелёт уже есть отдельным участком маршрута — ручное поле не нужно. */
const hasReturnLeg = computed(() => {
  const stops = trip.value?.stops ?? []
  const lastStayIndex = stops.map((stop) => stop.kind).lastIndexOf('stay')
  if (lastStayIndex < 0) return false
  const links = trip.value?.links ?? []
  return links.slice(lastStayIndex).some((link) => link.kind === 'flight')
})

const rows = computed(() => {
  const value = data.value
  if (!value) return []
  return [
    {
      key: 'flights',
      label: 'Перелёты',
      detail: value.flightCount ? `${value.flightCount} уч.` : '—',
      amount: value.flights,
    },
    {
      key: 'transfers',
      label: 'Трансферы и переезды',
      detail: value.transferCount ? `${value.transferCount} уч.` : '—',
      amount: value.transfers,
    },
    {
      key: 'stays',
      label: 'Проживание',
      detail: value.nights ? `${value.nights} ноч. × ${value.rooms} ном.` : '—',
      amount: value.stays,
    },
    {
      key: 'skipass',
      label: 'Скипасс',
      detail: value.rideDays ? `${value.rideDays} дн. × ${trip.value?.pax ?? 1} чел.` : '—',
      amount: value.skipass,
    },
    {
      key: 'food',
      label: 'Питание',
      detail: value.nights ? `${value.nights} ноч. × ${trip.value?.pax ?? 1} чел.` : '—',
      amount: value.food,
    },
    {
      key: 'activities',
      label: 'Развлечения',
      detail: value.activities > 0 ? `на ${trip.value?.pax ?? 1} чел.` : '—',
      amount: value.activities,
    },
  ]
})

function onReturnFlight(value: number): void {
  patchMeta({ returnFlight: value })
}

function onReturnHours(value: number): void {
  patchMeta({ returnHours: value })
}
</script>

<template>
  <div class="summary">
    <div class="summary-head">
      <h2>Смета поездки</h2>
      <div class="summary-head-actions">
        <button type="button" class="mini-btn" title="2–4 курорта, переезды и варианты" @click="openOptimizer">
          Варианты
        </button>
        <button
          v-if="adminSettings.auditEnabled"
          type="button"
          class="mini-btn"
          title="Сезонность, отель и скипасс"
          @click="openTripAudit"
        >
          Оценить через AI
        </button>
        <span class="pill">{{ trip?.pax ?? 1 }} чел.</span>
      </div>
    </div>

    <div class="summary-total">
      <span class="total-label">Итого</span>
      <strong>{{ formatMoney(total, currency) }}</strong>
      <span class="total-per">{{ formatMoney(data?.perPerson ?? 0, currency) }} на человека</span>
    </div>

    <div v-if="budget > 0" class="budget">
      <div class="budget-bar">
        <div class="budget-fill" :class="{ over: overBudget }" :style="{ width: `${budgetShare}%` }" />
      </div>
      <div class="budget-row">
        <span>Бюджет {{ formatMoney(budget, currency) }}</span>
        <span :class="{ 'text-bad': overBudget }">
          {{ overBudget ? `перебор ${formatMoney(-budgetLeft, currency)}` : `запас ${formatMoney(budgetLeft, currency)}` }}
        </span>
      </div>
    </div>

    <div class="summary-table">
      <div v-for="row in rows" :key="row.key" class="sum-row">
        <div class="sum-row-label">
          <span>{{ row.label }}</span>
          <span class="sum-row-detail">{{ row.detail }}</span>
        </div>
        <span class="sum-row-value">{{ formatMoney(row.amount, currency) }}</span>
      </div>

      <div v-if="hasReturnLeg" class="sum-row">
        <div class="sum-row-label">
          <span>Обратный перелёт</span>
          <span class="sum-row-detail">учтён в маршруте</span>
        </div>
        <span class="sum-row-value">в участке</span>
      </div>

      <div v-else class="sum-row editable">
        <div class="sum-row-label">
          <span>Обратный перелёт</span>
          <span class="sum-row-detail">цена и время вручную</span>
        </div>
        <div class="sum-row-pair">
          <NumberField
            :model-value="trip?.returnFlight ?? 0"
            :suffix="symbol"
            @update:model-value="onReturnFlight"
          />
          <NumberField
            :model-value="trip?.returnHours ?? 0"
            :step="0.25"
            suffix="ч"
            @update:model-value="onReturnHours"
          />
        </div>
      </div>

      <div class="sum-row total">
        <span>Итого за поездку</span>
        <span class="sum-row-value">{{ formatMoney(total, currency) }}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span>Ночей</span>
        <strong>{{ data?.nights ?? 0 }}</strong>
      </div>
      <div class="stat">
        <span>Дней катания</span>
        <strong>{{ data?.rideDays ?? 0 }}</strong>
      </div>
      <div class="stat">
        <span>В дороге</span>
        <strong>{{ formatHours(data?.travelHours ?? 0) }}</strong>
      </div>
      <div class="stat highlight">
        <span>Цена дня катания</span>
        <strong>{{ formatMoney(data?.perRideDay ?? 0, currency) }}</strong>
      </div>
    </div>

    <p v-if="total === 0" class="summary-hint">
      Введите цены в узлах маршрута и в блоке обратного перелёта — смета пересчитается сама.
    </p>

    <TripAuditModal />
    <OptimizerModal />
  </div>
</template>