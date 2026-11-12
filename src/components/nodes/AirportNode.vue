<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { AirportStop, PlaceOption } from '@/types'
import { cities } from '@/data/cities'
import { addTransfer, removeStop, selectCity } from '@/stores/trip'
import PlacePicker from '@/components/PlacePicker.vue'

const props = defineProps<{
  stop: AirportStop
  isLast: boolean
}>()

const options = computed<PlaceOption[]>(() =>
  cities.map((city) => ({
    id: city.id,
    label: `${city.city} (${city.code})`,
    sublabel: `${city.airport} · ${city.country}`,
  })),
)

const label = computed(() => (props.stop.code ? `${props.stop.city} (${props.stop.code})` : ''))
</script>

<template>
  <div class="node node-airport">
    <Handle type="target" :position="Position.Left" :connectable="false" />

    <div class="node-head">
      <span class="node-kicker">Аэропорт прилёта</span>
      <button type="button" class="node-remove" title="Удалить точку" @click="removeStop(stop.id)">×</button>
    </div>

    <PlacePicker
      :options="options"
      :model-label="label"
      placeholder="Куда летим"
      @select="(id) => selectCity(stop.id, id)"
    />

    <div v-if="stop.code" class="node-meta">Прилёт в {{ stop.city }}</div>
    <div v-else class="node-meta muted">Выберите аэропорт прилёта</div>

    <div class="node-foot">
      <button v-if="isLast" type="button" class="node-add" @click="addTransfer">+ Трансфер</button>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>
