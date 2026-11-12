<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { OriginStop, PlaceOption } from '@/types'
import { cities, findCity } from '@/data/cities'
import { addFlight, selectCity } from '@/stores/trip'
import PlacePicker from '@/components/PlacePicker.vue'

const props = defineProps<{
  stop: OriginStop
  isLast: boolean
}>()

const options = computed<PlaceOption[]>(() =>
  cities.map((city) => ({
    id: city.id,
    label: `${city.city} (${city.code})`,
    sublabel: `${city.airport} · ${city.country}`,
  })),
)

const airport = computed(() => findCity(props.stop.cityId)?.airport ?? '')
const label = computed(() => (props.stop.code ? `${props.stop.city} (${props.stop.code})` : ''))
</script>

<template>
  <div class="node node-origin nodrag nowheel">
    <div class="node-head">
      <span class="node-kicker">Откуда летим</span>
      <span class="node-badge">старт</span>
    </div>

    <PlacePicker
      :options="options"
      :model-label="label"
      placeholder="Город и аэропорт вылета"
      @select="(id) => selectCity(stop.id, id)"
    />

    <div v-if="stop.code" class="node-meta">{{ airport }}</div>
    <div v-else class="node-meta muted">Выберите город вылета</div>

    <div class="node-foot">
      <span class="node-hint">Точка старта маршрута</span>
      <button v-if="isLast" type="button" class="node-add" @click="addFlight()">+ Перелёт</button>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>
