<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Currency } from '@/types'
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
import { normalizeTrip, trip } from '@/stores/trip'

const form = ref(defaultOptimizerInput())
const results = ref<OptimizerVariant[]>([])
const running = ref(false)
const applied = ref<string | null>(null)

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
  } else if (list.length < 4) {
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
  try {
    results.value = optimizeTrip(form.value)
  } finally {
    running.value = false
  }
}

function applyVariant(variant: OptimizerVariant): void {
  if (!confirm(`Заменить текущую поездку вариантом «${variant.stays.map((item) => item.name).join(' → ')}»?`)) {
    return
  }
  trip.value = normalizeTrip(variant.trip)
  applied.value = variant.id
  closeOptimizer()
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
          <span>{{ results.length }} из Pareto-фронта · профиль «{{ profileLabels[form.profile] }}»</span>
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
          </div>
          <div v-if="variant.transfers.length" class="opt-transfers">
            <span v-for="transfer in variant.transfers" :key="transfer.fromId + transfer.toId">
              {{ transfer.fromName }} → {{ transfer.toName }} · {{ transfer.hours }} ч · {{ formatMoney(transfer.price, form.currency) }}
            </span>
          </div>
          <p v-if="variant.warnings.length" class="opt-warnings">{{ variant.warnings.join(' ') }}</p>
          <div class="opt-card-foot">
            <span v-if="applied === variant.id" class="audit-applied">применено</span>
            <button type="button" class="primary-btn" @click="applyVariant(variant)">Открыть как поездку</button>
          </div>
        </article>
      </div>
      <div v-else-if="!running && form.resortIds.length >= 2" class="modal-note opt-empty">
        Нажмите «Собрать варианты» — покажем несколько решений, а не один победитель.
      </div>

      <div class="audit-actions">
        <span class="modal-note">2–4 курорта · переезды оцениваются · без бронирования</span>
        <button type="button" class="primary-btn" @click="closeOptimizer">Готово</button>
      </div>
    </div>
  </div>
</template>
