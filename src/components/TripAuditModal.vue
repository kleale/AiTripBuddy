<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Trip } from '@/types'
import { patchStay, trip } from '@/stores/trip'
import { shiftTripDates } from '@/lib/schedule'
import { closeTripAudit, tripAuditOpen } from '@/lib/audit-store'
import { llmTripAudit, type AuditApply, type TripAudit } from '@/lib/ai/audit'
import { deepseekAvailable } from '@/lib/ai/settings'
import { formatMoney } from '@/lib/format'

const audit = ref<TripAudit | null>(null)
const loading = ref(false)
const error = ref('')
const applied = ref<string | null>(null)
const undoSnapshot = ref<Trip | null>(null)

const currency = computed(() => trip.value?.currency ?? 'RUB')
const totalSavings = computed(
  () => audit.value?.suggestions.reduce((sum, item) => sum + item.savings, 0) ?? 0,
)
const hasSuggestions = computed(() => Boolean(audit.value?.suggestions.length))
const providerLabel = computed(() =>
  audit.value?.provider === 'deepseek' ? 'DeepSeek' : 'локальный расчёт',
)

async function run(): Promise<void> {
  if (!trip.value) return
  loading.value = true
  error.value = ''
  try {
    audit.value = await llmTripAudit(trip.value)
  } catch {
    error.value = 'Не удалось получить аудит — попробуйте ещё раз.'
  } finally {
    loading.value = false
  }
}

watch(tripAuditOpen, (open) => {
  if (!open) return
  audit.value = null
  void run()
})

function todayIso(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function apply(action: AuditApply | null, id: string): void {
  if (!action || !trip.value) return
  undoSnapshot.value = JSON.parse(JSON.stringify(trip.value)) as Trip
  if (action.type === 'shift-dates') {
    shiftTripDates(trip.value, action.days)
  } else if (action.type === 'hotel') {
    patchStay(action.stopId, {
      hotel: action.hotel,
      hotelStars: action.stars,
      hotelPerNight: action.price,
      hotelLat: action.lat,
      hotelLng: action.lng,
      hotelSource: null,
      hotelPriceAt: todayIso(),
    })
  } else if (action.type === 'skipass') {
    patchStay(action.stopId, { skipassPerDay: action.pricePerDay })
  }
  applied.value = id
  void run()
}

function undo(): void {
  if (!undoSnapshot.value) return
  trip.value = JSON.parse(JSON.stringify(undoSnapshot.value)) as Trip
  undoSnapshot.value = null
  applied.value = null
  void run()
}

function kindLabel(kind: string): string {
  if (kind === 'dates') return 'даты'
  if (kind === 'hotel') return 'отель'
  if (kind === 'skipass') return 'скипасс'
  return 'бюджет'
}
</script>

<template>
  <div v-if="tripAuditOpen" class="modal-backdrop" @click.self="closeTripAudit">
    <div class="modal audit-modal" role="dialog" aria-modal="true" aria-label="AI-аудит поездки">
      <div class="modal-head">
        <div>
          <div class="node-kicker">AI-аудит поездки</div>
          <h3>Где сэкономить и что улучшить</h3>
          <p class="modal-note">
            Все суммы — из сметы, сезонности и справочников. AI только ранжирует варианты и поясняет.
          </p>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeTripAudit">×</button>
      </div>

      <div class="audit-top">
        <span class="audit-provider">{{ providerLabel }}</span>
        <span v-if="hasSuggestions" class="audit-savings">
          потенциал экономии · {{ formatMoney(totalSavings, currency) }}
        </span>
        <button type="button" class="mini-btn" :disabled="loading" @click="run">
          {{ loading ? 'Считаю…' : 'Пересчитать' }}
        </button>
      </div>

      <div v-if="loading" class="audit-loading">Сравниваю даты, отели и скипассы…</div>
      <p v-else-if="error" class="node-warn">{{ error }}</p>

      <template v-else-if="audit">
        <p class="audit-summary">{{ audit.summary }}</p>
        <div v-if="audit.notes.length" class="audit-notes">
          <p v-for="note in audit.notes" :key="note">{{ note }}</p>
        </div>

        <div v-if="audit.suggestions.length" class="audit-list">
          <article v-for="item in audit.suggestions" :key="item.id" class="audit-item">
            <div class="audit-item-head">
              <span class="audit-kind">{{ kindLabel(item.kind) }}</span>
              <b>{{ item.title }}</b>
              <span v-if="item.savings > 0" class="audit-item-saving">
                −{{ formatMoney(item.savings, currency) }}
              </span>
            </div>
            <p>{{ item.detail }}</p>
            <div class="audit-item-foot">
              <span v-if="applied === item.id" class="audit-applied">применено</span>
              <button
                v-if="item.apply"
                type="button"
                class="mini-btn"
                :disabled="applied === item.id"
                @click="apply(item.apply, item.id)"
              >
                Применить
              </button>
              <span v-else class="modal-note">только рекомендация</span>
            </div>
          </article>
        </div>
        <div v-else class="audit-empty">
          <b>Явной экономии не нашлось</b>
          <p class="modal-note">
            Даты, отель и скипасс близки к справочнику. Проверьте расстояния и сезон в карточках отелей.
          </p>
        </div>
      </template>

      <div class="audit-actions">
        <button v-if="undoSnapshot" type="button" class="mini-btn" @click="undo">Отменить изменение</button>
        <span v-if="!deepseekAvailable" class="modal-note">DeepSeek не подключён · локальный расчёт</span>
        <span v-else class="modal-note">Ключ DeepSeek подключён</span>
        <button type="button" class="primary-btn" @click="closeTripAudit">Готово</button>
      </div>
    </div>
  </div>
</template>
