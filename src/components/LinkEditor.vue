<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { LinkKind } from '@/types'
import {
  closeLinkEditor,
  editingLinkIndex,
  patchLink,
  removeSection,
  trip,
} from '@/stores/trip'
import { currencySymbols } from '@/lib/format'
import NumberField from '@/components/NumberField.vue'

const kindLabels: Record<LinkKind, string> = {
  flight: 'Перелёт',
  transfer: 'Трансфер',
  move: 'Переезд между курортами',
}

const dateLabels: Record<LinkKind, string> = {
  flight: 'Дата вылета',
  transfer: 'Дата начала трансфера',
  move: 'Дата переезда',
}

const timeLabels: Record<LinkKind, string> = {
  flight: 'Время вылета',
  transfer: 'Время начала',
  move: 'Время выезда',
}

const index = computed(() => editingLinkIndex.value)
const link = computed(() => {
  const current = trip.value
  const i = index.value
  if (!current || i === null) return null
  return current.links[i] ?? null
})
const symbol = computed(() => currencySymbols[trip.value?.currency ?? 'RUB'])
const canRemove = computed(() => {
  const current = trip.value
  const i = index.value
  if (!current || i === null) return false
  return i + 1 < current.stops.length
})

function patch(patch: { price?: number; hours?: number; note?: string; date?: string; time?: string }): void {
  if (index.value === null) return
  patchLink(index.value, patch)
}

function onNote(event: Event): void {
  patch({ note: (event.target as HTMLInputElement).value })
}

function onDate(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  patch({ date: value || undefined })
}

function onTime(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  patch({ time: value || undefined })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeLinkEditor()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="link" class="modal-backdrop" @click.self="closeLinkEditor">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Участок маршрута</div>
          <h3>{{ kindLabels[link.kind] }}</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeLinkEditor">×</button>
      </div>

      <div class="modal-grid">
        <label class="date-field">
          <span>{{ dateLabels[link.kind] }}</span>
          <input type="date" :value="link.date ?? ''" @input="onDate" />
        </label>
        <label class="date-field">
          <span>{{ timeLabels[link.kind] }}</span>
          <input type="time" :value="link.time ?? ''" @input="onTime" />
        </label>
      </div>

      <div class="modal-grid">
        <NumberField
          label="Стоимость на группу"
          :model-value="link.price"
          :suffix="symbol"
          @update:model-value="(v) => patch({ price: v })"
        />
        <NumberField
          label="Время в пути, ч"
          :model-value="link.hours"
          :step="0.25"
          @update:model-value="(v) => patch({ hours: v })"
        />
      </div>

      <label class="modal-field">
        <span class="num-label">Комментарий</span>
        <input class="text-input" type="text" :value="link.note ?? ''" placeholder="Например, SVO → INN" @input="onNote" />
      </label>

      <div class="modal-note">
        Дата и время попадают в календарь поездки. Цена участка вводится целиком на группу, в валюте поездки.
      </div>

      <div class="modal-actions">
        <button v-if="canRemove" type="button" class="danger-btn" @click="index !== null && removeSection(index)">
          Удалить участок и точку
        </button>
        <button type="button" class="primary-btn" @click="closeLinkEditor">Готово</button>
      </div>
    </div>
  </div>
</template>