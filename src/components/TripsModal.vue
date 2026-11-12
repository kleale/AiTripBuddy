<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  deleteSavedTrip,
  duplicateCurrentTrip,
  loadSavedTrip,
  savedTrips,
  tripSummary,
} from '@/stores/trips'
import { trip } from '@/stores/trip'
import { formatMoney } from '@/lib/format'
import { computeCosts } from '@/lib/costs'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const hasCurrent = computed(() => trip.value !== null)
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLDivElement | null>(null)

function totalOf(id: string): string {
  const found = savedTrips.value.find((item) => item.id === id)
  if (!found) return '—'
  return formatMoney(computeCosts(found).total, found.currency)
}

function dateLabel(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function onLoad(id: string): void {
  if (loadSavedTrip(id)) emit('close')
}

function onDelete(id: string): void {
  if (window.confirm('Удалить сохранённую поездку?')) deleteSavedTrip(id)
}

function onDuplicate(): void {
  if (duplicateCurrentTrip()) emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = dialog.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    closeButton.value?.focus()
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="props.open" class="modal-backdrop" @click.self="emit('close')">
    <div
      ref="dialog"
      class="modal trips-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trips-title"
    >
      <div class="modal-head">
        <div>
          <div class="node-kicker">Библиотека</div>
          <h3 id="trips-title">Мои поездки</h3>
        </div>
        <button ref="closeButton" type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
      </div>

      <div v-if="savedTrips.length" class="trips-list">
        <div v-for="saved in savedTrips" :key="saved.id" class="trip-item" :class="{ current: saved.id === trip?.id }">
          <div class="trip-item-main">
            <div class="trip-item-head">
              <strong>{{ saved.name }}</strong>
              <span v-if="saved.id === trip?.id" class="pill tiny">текущая</span>
            </div>
            <div class="trip-item-meta">{{ tripSummary(saved) }} · {{ totalOf(saved.id) }}</div>
            <div class="trip-item-date">обновлена {{ dateLabel(saved.updatedAt ?? saved.createdAt) }}</div>
          </div>
          <div class="trip-item-actions">
            <button type="button" class="mini-btn" @click="onLoad(saved.id)">Открыть</button>
            <button type="button" class="mini-btn danger" @click="onDelete(saved.id)">Удалить</button>
          </div>
        </div>
      </div>

      <div v-else class="trips-empty">
        Сохранённых поездок пока нет. Соберите маршрут и нажмите «Сохранить».
      </div>

      <div class="modal-actions">
        <button v-if="hasCurrent" type="button" class="ghost-btn" @click="onDuplicate">Дублировать текущую</button>
        <button type="button" class="primary-btn" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>