<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Currency, Trip } from '@/types'
import { resortGuides } from '@/data/resort-guides'
import {
  defaultOptimizerInput,
  optimizeTrip,
  profileLabels,
  type OptimizerProfile,
  type OptimizerVariant,
} from '@/lib/optimizer'
import { closeOptimizer, optimizerOpen } from '@/lib/optimizer-store'
import { formatMoney } from '@/lib/format'
import { computeCosts } from '@/lib/costs'
import { adminSettings } from '@/lib/admin'
import { optimizerMetrics, recordOptimizerApplied, recordOptimizerRun } from '@/lib/optimizer-metrics'
import { normalizeTrip, trip } from '@/stores/trip'
import OptimizerRoute from '@/components/OptimizerRoute.vue'

const form = ref(defaultOptimizerInput())
const results = ref<OptimizerVariant[]>([])
const running = ref(false)
const applied = ref<string | null>(null)
const previousTrip = ref<Trip | null>(null)
const compareIds = ref<string[]>([])
const lastMs = ref(0)

const maxResorts = computed(() => Math.min(4, adminSettings.value.optimizerMaxResorts))
const compared = computed(() => results.value.filter((item) => compareIds.value.includes(item.id)))


const resorts = Object.values(resortGuides).map((guide) => ({
  id: guide.resortId,
  title: guide.title,
  region: guide.region,
}))

const canRun = computed(
  () => form.value.resortIds.length >= 2 && form.value.nights >= form.value.resortIds.length * form.value.minNights,
)
const profiles = Object.keys(profileLabels) as OptimizerProfile[]

watch(optimizerOpen, (open) => {
  if (!open) return
  results.value = []
  applied.value = null
  previousTrip.value = null
  compareIds.value = []
  lastMs.value = 0
  const current = trip.value
  if (current) {
    form.value = {
      ...defaultOptimizerInput(current.currency as Currency),
      pax: current.pax,
      rooms: 1,
      budget: current.budget,
      currency: current.currency as Currency,
    }
  }
})

function toggleResort(id: string): void {
  const list = form.value.resortIds
  if (list.includes(id)) {
    form.value.resortIds = list.filter((item) => item !== id)
  } else if (list.length < maxResorts.value) {
    form.value.resortIds = [...list, id]
  }
}

function setBudget(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  form.value.budget = Number.isFinite(value) && value > 0 ? value : null
}

function run(): void {
  if (!canRun.value) return
  running.value = true
  const started = performance.now()
  try {
    form.value.maxVariants = adminSettings.value.optimizerMaxVariants
    results.value = optimizeTrip(form.value)
    lastMs.value = Math.round(performance.now() - started)
    recordOptimizerRun(results.value.length, lastMs.value)
  } finally {
    running.value = false
  }
}

function toggleCompare(id: string): void {
  if (compareIds.value.includes(id)) {
    compareIds.value = compareIds.value.filter((item) => item !== id)
  } else {
    compareIds.value = [...compareIds.value.slice(-1), id]
  }
}

function applyVariant(variant: OptimizerVariant): void {
  if (!confirm(`Заменить текущую поездку вариантом «${variant.stays.map((item) => item.name).join(' → ')}»?`)) {
    return
  }
  previousTrip.value = trip.value ? (JSON.parse(JSON.stringify(trip.value)) as Trip) : null
  const before = trip.value ? computeTotal(trip.value) : 0
  trip.value = normalizeTrip(variant.trip)
  applied.value = variant.id
  recordOptimizerApplied(before > 0 ? Math.max(0, before - variant.total) : 0)
}

function undoApply(): void {
  if (!previousTrip.value) return
  trip.value = previousTrip.value
  previousTrip.value = null
  applied.value = null
}

function computeTotal(value: Trip): number {
  return computeCosts(value).total
}

function route(variant: OptimizerVariant): string {
  return variant.stays.map((item) => `${item.name} ${item.nights}н`).join(' → ')
}
</script>

<template>
  <div v-if="optimizerOpen" class="modal-backdrop" @click.self="closeOptimizer">
    <div class="modal optimizer-modal" role="dialog" aria-modal="true" aria-label="Мультикурортный оптимизатор">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Мультикурортный оптимизатор</div>
          <h3>Собрать варианты поездки</h3>
          <p class="modal-note">
            Считаем ночи, порядок курортов и переезды по справочникам. Цены — ориентиры, не офферы.
          </p>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeOptimizer">×</button>
      </div>

      <div class="opt-form">
        <div class="opt-block">
          <span class="opt-label">Курорты · выберите 2–4</span>
          <div class="opt-resorts">
            <button
              v-for="resort in resorts"
              :key="resort.id"
              type="button"
              class="opt-resort"
              :class="{ active: form.resortIds.includes(resort.id) }"
              :title="resort.region"
              @click="toggleResort(resort.id)"
            >
              {{ resort.title }}
            </button>
          </div>
        </div>

        <div class="opt-grid">
          <label class="select-field">
            <span>Старт</span>
            <input v-model="form.startDate" class="text-input" type="date" />
          </label>
          <label class="select-field">
            <span>Всего ночей</span>
            <input v-model.number="form.nights" class="text-input" type="number" min="4" max="30" />
          </label>
          <label class="select-field">
            <span>Минимум на курорт</span>
            <input v-model.number="form.minNights" class="text-input" type="number" min="1" max="7" />
          </label>
          <label class="select-field">
            <span>Гостей</span>
            <input v-model.number="form.pax" class="text-input" type="number" min="1" max="8" />
          </label>
          <label class="select-field">
            <span>Номеров</span>
            <input v-model.number="form.rooms" class="text-input" type="number" min="1" max="4" />
          </label>
          <label class="select-field">
            <span>Бюджет</span>
            <input
              class="text-input"
              type="number"
              min="0"
              placeholder="без лимита"
              :value="form.budget ?? ''"
              @input="setBudget"
            />
          </label>
          <label class="select-field">
            <span>Макс. переезд, ч</span>
            <input v-model.number="form.maxTransferHours" class="text-input" type="number" min="1" max="48" />
          </label>
        </div>

        <div class="opt-profiles">
          <span class="opt-label">Приоритет</span>
          <button
            v-for="profile in profiles"
            :key="profile"
            type="button"
            class="mini-btn"
            :class="{ active: form.profile === profile }"
            @click="form.profile = profile"
          >
            {{ profileLabels[profile] }}
          </button>
        </div>

        <button type="button" class="primary-btn opt-run" :disabled="!canRun || running" @click="run">
          {{ running ? 'Считаю…' : 'Собрать варианты' }}
        </button>
        <p v-if="!canRun" class="modal-note">Выберите минимум два курорта и достаточно ночей.</p>
      </div>

      <div v-if="results.length" class="opt-results">
        <div class="opt-results-head">
          <b>Варианты</b>
          <span>{{ results.length }} из Pareto-фронта · профиль «{{ profileLabels[form.profile] }}» · {{ lastMs }} мс</span>
          <button v-if="previousTrip" type="button" class="mini-btn" @click="undoApply">Вернуть прежнюю</button>
        </div>
        <article v-for="variant in results" :key="variant.id" class="opt-card">
          <div class="opt-card-head">
            <b>{{ route(variant) }}</b>
            <span class="opt-total">{{ formatMoney(variant.total, form.currency) }}</span>
          </div>
          <div class="opt-metrics">
            <span>{{ formatMoney(variant.perPerson, form.currency) }}/чел.</span>
            <span>{{ variant.rideDays }} дн. катания</span>
            <span>{{ variant.travelHours }} ч в дороге</span>
            <span>{{ variant.comfort }}★ комфорт</span>
            <span>{{ variant.seasonFactor }}× сезон</span>
            <span>{{ formatMoney(variant.perRideDay, form.currency) }}/день</span>
            <span class="opt-confidence">{{ variant.confidence }}</span>
          </div>
          <OptimizerRoute :variant="variant" />
          <ul class="opt-explain">
            <li v-for="line in variant.explanations" :key="line">{{ line }}</li>
          </ul>
          <div v-if="variant.transfers.length" class="opt-transfers">
            <span v-for="transfer in variant.transfers" :key="transfer.fromId + transfer.toId">
              {{ transfer.fromName }} → {{ transfer.toName }} · {{ transfer.hours }} ч · {{ formatMoney(transfer.price, form.currency) }}
            </span>
          </div>
          <p v-if="variant.warnings.length" class="opt-warnings">{{ variant.warnings.join(' ') }}</p>
          <div class="opt-card-foot">
            <span v-if="applied === variant.id" class="audit-applied">применено</span>
            <button
              type="button"
              class="mini-btn"
              :class="{ active: compareIds.includes(variant.id) }"
              @click="toggleCompare(variant.id)"
            >
              Сравнить
            </button>
            <button type="button" class="primary-btn" @click="applyVariant(variant)">Открыть как поездку</button>
          </div>
        </article>
        <div v-if="compared.length >= 2" class="opt-compare">
          <b>Сравнение</b>
          <table>
            <thead>
              <tr><th>Вариант</th><th>Итого</th><th>Чел.</th><th>Дорога</th><th>Катание</th><th>Комфорт</th></tr>
            </thead>
            <tbody>
              <tr v-for="variant in compared" :key="variant.id">
                <td>{{ route(variant) }}</td>
                <td>{{ formatMoney(variant.total, form.currency) }}</td>
                <td>{{ formatMoney(variant.perPerson, form.currency) }}</td>
                <td>{{ variant.travelHours }} ч</td>
                <td>{{ variant.rideDays }} дн.</td>
                <td>{{ variant.comfort }}★</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="!running && form.resortIds.length >= 2" class="modal-note opt-empty">
        Нажмите «Собрать варианты» — покажем несколько решений, а не один победитель.
      </div>

      <div class="audit-actions">
        <span class="modal-note">
          2–4 курорта · переезды оцениваются · запусков {{ optimizerMetrics.runs }} · применено {{ optimizerMetrics.applied }}
        </span>
        <button type="button" class="primary-btn" @click="closeOptimizer">Готово</button>
      </div>
    </div>
  </div>
</template>
