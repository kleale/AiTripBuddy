<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { AirportStop, PlaceOption } from '@/types'
import { cities } from '@/data/cities'
import { airportSuggestions, airportsNearCity } from '@/data/resort-airports'
import { addTransfer, nextStayAfter, previousStayBefore, removeStop, selectCity } from '@/stores/trip'
import { formatHours } from '@/lib/format'
import PlacePicker from '@/components/PlacePicker.vue'

const props = defineProps<{
  stop: AirportStop
  isLast: boolean
}>()

const targetStay = computed(() => nextStayAfter(props.stop.id))
/** Аэропорт вылета домой: последняя точка маршрута, до неё уже были отели. */
const isDeparture = computed(() => props.isLast && !targetStay.value && Boolean(previousStayBefore(props.stop.id)))
const kicker = computed(() => (isDeparture.value ? 'Аэропорт вылета' : 'Аэропорт прилёта'))
const suggestions = computed(() => {
  const stay = targetStay.value
  if (!stay) return []
  if (stay.placeKind === 'city' && stay.cityId) {
    return airportsNearCity(stay.cityId, 4).map((item) => ({
      cityId: item.city.id,
      code: item.city.code,
      city: item.city.city,
      airport: item.city.airport,
      km: item.km,
      hours: item.hours,
      resortName: stay.city ?? 'город',
      access: 'transfer' as const,
    }))
  }
  return airportSuggestions(stay.resortId).map((item) => ({
    cityId: item.city.id,
    code: item.city.code,
    city: item.city.city,
    airport: item.city.airport,
    km: item.km,
    hours: item.hours,
    resortName: item.resortName,
    access: item.access ?? ('transfer' as const),
  }))
})

const options = computed<PlaceOption[]>(() => {
  const nearby = suggestions.value.map((item) => ({
    id: item.cityId,
    label: `${item.city} (${item.code})`,
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
      <span class="node-kicker">{{ kicker }}</span>
      <button type="button" class="node-remove" title="Удалить точку" @click="removeStop(stop.id)">×</button>
    </div>

    <PlacePicker
      :options="options"
      :model-label="label"
      :placeholder="isDeparture ? 'Откуда летим домой' : 'Куда летим'"
      @select="(id) => selectCity(stop.id, id)"
    />

    <div v-if="stop.code" class="node-meta">
      {{ isDeparture ? 'Вылет домой из ' : 'Прилёт в ' }}{{ stop.city }}
    </div>
    <div v-else class="node-meta muted">
      {{ isDeparture ? 'Выберите аэропорт вылета' : 'Выберите аэропорт прилёта' }}
    </div>

    <div v-if="nearest.length" class="nearby">
      <span class="nearby-title">Аэропорты рядом · {{ targetStay?.placeKind === 'city' ? targetStay.city : targetStay?.resort }}</span>
      <div class="nearby-list">
        <button
          v-for="item in nearest"
          :key="item.cityId"
          type="button"
          class="nearby-chip"
          :class="{ active: item.cityId === stop.cityId }"
          :title="`${item.airport} · ${item.km} км · ~${formatHours(item.hours)}${item.access === 'hub' ? ' · хаб' : ''}`"
          @click="selectCity(stop.id, item.cityId)"
        >
          <b>{{ item.code }}</b>
          <span>{{ item.km }} км{{ item.access === 'hub' ? ' · хаб' : '' }}</span>
        </button>
      </div>
    </div>

    <div class="node-foot">
      <span v-if="isDeparture" class="node-hint">Финальная точка — вылет домой</span>
      <button v-else-if="isLast" type="button" class="node-add" @click="addTransfer">+ Трансфер</button>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>