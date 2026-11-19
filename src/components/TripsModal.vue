<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  deleteSavedTrip,
  duplicateCurrentTrip,
  loadSavedTrip,
  savedTrips,
  tripSummary,
} from '@/stores/trips'
import { loadPreset, trip } from '@/stores/trip'
import { presetList } from '@/data/presets'
import { formatMoney } from '@/lib/format'
import { computeCosts } from '@/lib/costs'
import { buildShareUrl, encodeTrips } from '@/lib/share'
import type { Trip } from '@/types'
import SharePreviewCard from '@/components/SharePreviewCard.vue'
import { downloadSharePreview } from '@/lib/share-preview'
import { createShortLink } from '@/lib/short-links'

const props = defineProps<{ open: boolean; initialSelection?: string[] }>()
const emit = defineEmits<{ close: []; compare: [trips: Trip[]] }>()

const selected = ref<string[]>([])
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLDivElement | null>(null)
const shareState = ref<'idle' | 'copying' | 'copied' | 'error'>('idle')
const shareMessage = ref('')
const shortState = ref<'idle' | 'copying' | 'copied' | 'error'>('idle')
const shortMessage = ref('')
const showPreview = ref(false)

const hasCurrent = computed(() => trip.value !== null)
const selectedTrips = computed(() =>
  savedTrips.value.filter((item) => selected.value.includes(item.id)),
)
const canCompare = computed(() => selectedTrips.value.length >= 2)
const previewTrip = computed<Trip | null>(
  () => selectedTrips.value[0] ?? trip.value ?? savedTrips.value[0] ?? null,
)

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

function toggle(id: string): void {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((item) => item !== id)
    : [...selected.value, id]
}

function selectAll(): void {
  selected.value =
    selected.value.length === savedTrips.value.length ? [] : savedTrips.value.map((item) => item.id)
}

function onLoad(id: string): void {
  if (loadSavedTrip(id)) emit('close')
}

function onDelete(id: string): void {
  if (window.confirm('Удалить сохранённую поездку?')) {
    deleteSavedTrip(id)
    selected.value = selected.value.filter((item) => item !== id)
  }
}

function onDuplicate(): void {
  if (duplicateCurrentTrip()) emit('close')
}

function onPreset(id: string): void {
  if (loadPreset(id)) emit('close')
}

function onCompare(): void {
  if (!canCompare.value) return
  emit('compare', selectedTrips.value)
}

function onDownloadPreview(): void {
  if (previewTrip.value) downloadSharePreview(previewTrip.value)
}

async function copyShortLink(): Promise<void> {
  shortState.value = 'copying'
  shortMessage.value = ''
  try {
    const trips = selectedTrips.value.length ? selectedTrips.value : savedTrips.value
    if (!trips.length) {
      shortState.value = 'error'
      shortMessage.value = 'Нет поездок для короткой ссылки'
      return
    }
    const url = await createShortLink(trips)
    await navigator.clipboard.writeText(url)
    shortState.value = 'copied'
    shortMessage.value = `Короткая ссылка скопирована: ${url}`
  } catch {
    shortState.value = 'error'
    shortMessage.value = 'Не удалось создать короткую ссылку — проверьте API'
  }
}

async function copyLink(): Promise<void> {
  shareState.value = 'copying'
  shareMessage.value = ''
  try {
    const trips = selectedTrips.value.length ? selectedTrips.value : savedTrips.value
    if (!trips.length) {
      shareState.value = 'error'
      shareMessage.value = 'Нет поездок для ссылки'
      return
    }
    const code = await encodeTrips(trips)
    const url = buildShareUrl(location.origin, location.pathname, code)
    await navigator.clipboard.writeText(url)
    shareState.value = 'copied'
    shareMessage.value = `Ссылка на ${trips.length} поезд. скопирована (${url.length} симв.)`
    window.setTimeout(() => {
      if (shareState.value === 'copied') shareState.value = 'idle'
    }, 2500)
  } catch {
    shareState.value = 'error'
    shareMessage.value = 'Не удалось скопировать — разрешите доступ к буферу'
  }
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
    if (!open) {
      shareState.value = 'idle'
      shareMessage.value = ''
      return
    }
    selected.value = props.initialSelection ?? []
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

      <div v-if="presetList.length" class="preset-block">
        <div class="preset-title">Готовые маршруты</div>
        <button
          v-for="preset in presetList"
          :key="preset.id"
          type="button"
          class="preset-item"
          @click="onPreset(preset.id)"
        >
          <b>{{ preset.title }}</b>
          <span>{{ preset.subtitle }}</span>
        </button>
      </div>

      <div v-if="savedTrips.length" class="trips-toolbar">
        <button type="button" class="mini-btn" @click="selectAll">
          {{ selected.length === savedTrips.length ? 'Снять выбор' : 'Выбрать все' }}
        </button>
        <span class="trips-selected">выбрано {{ selected.length }} из {{ savedTrips.length }}</span>
      </div>

      <div v-if="savedTrips.length" class="trips-list">
        <div
          v-for="saved in savedTrips"
          :key="saved.id"
          class="trip-item"
          :class="{ current: saved.id === trip?.id, picked: selected.includes(saved.id) }"
        >
          <label class="trip-check">
            <input type="checkbox" :checked="selected.includes(saved.id)" @change="toggle(saved.id)" />
          </label>
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

      <SharePreviewCard v-if="previewTrip && showPreview" :trip="previewTrip" />

      <p v-if="shortMessage" class="trips-share-note" :class="shortState">{{ shortMessage }}</p>
      <p v-if="shareMessage" class="trips-share-note" :class="shareState">{{ shareMessage }}</p>

      <div class="modal-actions">
        <button v-if="hasCurrent" type="button" class="ghost-btn" @click="onDuplicate">Дублировать текущую</button>
        <button
          v-if="savedTrips.length"
          type="button"
          class="ghost-btn"
          :disabled="shareState === 'copying'"
          @click="copyLink"
        >
          {{ shareState === 'copied' ? 'Ссылка скопирована' : 'Ссылка' }}
        </button>
        <button v-if="previewTrip" type="button" class="ghost-btn" @click="showPreview = !showPreview">
          {{ showPreview ? 'Скрыть превью' : 'Превью поездки' }}
        </button>
        <button v-if="previewTrip" type="button" class="ghost-btn" @click="onDownloadPreview">Скачать превью</button>
        <button
          v-if="savedTrips.length"
          type="button"
          class="ghost-btn"
          :disabled="shortState === 'copying'"
          @click="copyShortLink"
        >
          {{ shortState === 'copied' ? 'Короткая ссылка скопирована' : 'Короткая ссылка' }}
        </button>
        <button type="button" class="ghost-btn" :disabled="!canCompare" @click="onCompare">
          Сравнить<template v-if="selected.length"> ({{ selected.length }})</template>
        </button>
        <button type="button" class="primary-btn" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>