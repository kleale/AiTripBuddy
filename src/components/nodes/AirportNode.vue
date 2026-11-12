<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { AirportStop, PlaceOption } from '@/types'
import { cities } from '@/data/cities'
import { airportSuggestions } from '@/data/resort-airports'
import { addTransfer, nextStayAfter, removeStop, selectCity } from '@/stores/trip'
import { formatHours } from '@/lib/format'
import PlacePicker from '@/components/PlacePicker.vue'

const props = defineProps<{
  stop: AirportStop
  isLast: boolean
}>()

const targetStay = computed(() => nextStayAfter(props.stop.id))
const suggestions = computed(() =>
  targetStay.value ? airportSuggestions(targetStay.value.resortId) : [],
)

const options = computed<PlaceOption[]>(() => {
  const nearby = suggestions.value.map((item) => ({
    id: item.city.id,
    label: `${item.city.city} (${item.city.code})`,
    sublabel: `${item.km} км до ${item.resortName}${item.access === 'hub' ? ' · хаб' : ''} · ~${formatHours(item.hours)}`,
  }))
  const nearbyIds = new Set(nearby.map((option) => option.id))
  const rest = cities
    .filter((city) => !nearbyIds.has(city.id))
    .map((city) => ({
      id: city.id,
      label: `${city.city} (${city.code})`,
      sublabel: `${city.airport} · ${city.country}`,
    }))
  return [...nearby, ...rest]
})

const label = computed(() => (props.stop.code ? `${props.stop.city} (${props.stop.code})` : ''))

const nearest = computed(() => suggestions.value.slice(0, 3))
</script>

<template>
  <div class="node node-airport nodrag nowheel">
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

    <div v-if="nearest.length" class="nearby">
      <span class="nearby-title">Аэропорты рядом · {{ targetStay?.resort }}</span>
      <div class="nearby-list">
        <button
          v-for="item in nearest"
          :key="item.city.id"
          type="button"
          class="nearby-chip"
          :class="{ active: item.city.id === stop.cityId }"
          :title="`${item.city.airport} · ${item.km} км · ~${formatHours(item.hours)}${item.access === 'hub' ? ' · хаб' : ''}`"
          @click="selectCity(stop.id, item.city.id)"
        >
          <b>{{ item.city.code }}</b>
          <span>{{ item.km }} км{{ item.access === 'hub' ? ' · хаб' : '' }}</span>
        </button>
      </div>
    </div>

    <div class="node-foot">
      <button v-if="isLast" type="button" class="node-add" @click="addTransfer">+ Трансфер</button>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>