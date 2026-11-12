<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { PlaceOption, StayStop } from '@/types'
import { resorts } from '@/data/resorts'
import { addMove, patchStop, removeStop, selectResort, trip } from '@/stores/trip'
import { formatMoney, currencySymbols } from '@/lib/format'
import PlacePicker from '@/components/PlacePicker.vue'
import NumberField from '@/components/NumberField.vue'

const props = defineProps<{
  stop: StayStop
  isLast: boolean
}>()

const options = computed<PlaceOption[]>(() =>
  resorts.map((resort) => ({
    id: resort.id,
    label: resort.name,
    sublabel: `${resort.country} · ${resort.region}`,
  })),
)

const currency = computed(() => trip.value?.currency ?? 'RUB')
const symbol = computed(() => currencySymbols[currency.value])
const stayTotal = computed(() => props.stop.nights * props.stop.hotelPerNight)
const subtitle = computed(() => (props.stop.hotel ? props.stop.hotel : 'Отель не указан'))

function patch(patch: Partial<StayStop>): void {
  patchStop(props.stop.id, patch)
}

function onHotel(event: Event): void {
  patch({ hotel: (event.target as HTMLInputElement).value })
}
</script>

<template>
  <div class="node node-stay">
    <Handle type="target" :position="Position.Left" :connectable="false" />

    <div class="node-head">
      <span class="node-kicker">Отель и курорт</span>
      <button type="button" class="node-remove" title="Удалить точку" @click="removeStop(stop.id)">×</button>
    </div>

    <PlacePicker
      :options="options"
      :model-label="stop.resort"
      placeholder="Курорт"
      @select="(id) => selectResort(stop.id, id)"
    />

    <input
      class="text-input"
      type="text"
      :value="stop.hotel"
      placeholder="Название отеля"
      autocomplete="off"
      @input="onHotel"
    />

    <div class="stay-grid">
      <NumberField label="Ночей" :model-value="stop.nights" @update:model-value="(v) => patch({ nights: v })" />
      <NumberField label="За ночь" :model-value="stop.hotelPerNight" :suffix="symbol" @update:model-value="(v) => patch({ hotelPerNight: v })" />
      <NumberField label="Дней катания" :model-value="stop.skipassDays" @update:model-value="(v) => patch({ skipassDays: v })" />
      <NumberField label="Скипасс/день" :model-value="stop.skipassPerDay" :suffix="symbol" @update:model-value="(v) => patch({ skipassPerDay: v })" />
      <NumberField label="Еда/день" :model-value="stop.foodPerDay" :suffix="symbol" @update:model-value="(v) => patch({ foodPerDay: v })" />
      <div class="stay-total">
        <span>Проживание</span>
        <strong>{{ formatMoney(stayTotal, currency) }}</strong>
      </div>
    </div>

    <div class="node-foot">
      <span class="node-hint">{{ subtitle }}</span>
      <button v-if="isLast" type="button" class="node-add" @click="addMove">+ Переезд</button>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>
