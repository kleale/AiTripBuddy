<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { AirportStop, PlaceOption } from '@/types'
import { cities } from '@/data/cities'
import { airportSuggestions, airportsNearCity } from '@/data/resort-airports'
import { addTransfer, nextStayAfter, previousStayBefore, removeStop, selectCity, trip } from '@/stores/trip'
import { formatHours } from '@/lib/format'
import { flightButtons, flightQueryLabel, type FlightQuery } from '@/lib/flight-links'
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

/** Индекс точки и входящий участок пути: на нём лежит дата перелёта. */
const stopIndex = computed(() => trip.value?.stops.findIndex((item) => item.id === props.stop.id) ?? -1)
const incomingLink = computed(() => {
  const index = stopIndex.value
  if (index <= 0) return null
  return trip.value?.links[index - 1] ?? null
})

/** Код города вылета: первая точка маршрута, если это город или аэропорт. */
const originCode = computed(() => {
  const stop = trip.value?.stops[0]
  if (!stop) return ''
  return stop.kind === 'stay' ? '' : stop.code
})

/** Запрос для поиска билетов: направление зависит от того, прилёт это или вылет домой. */
const flightQuery = computed<FlightQuery | null>(() => {
  const date = incomingLink.value?.date
  if (!date || !props.stop.code) return null

  const pax = Math.max(1, trip.value?.pax ?? 1)

  if (isDeparture.value) {
    const home = originCode.value
    if (!home) return null
    return {
      from: props.stop.code,
      to: home,
      departDate: date,
      adults: pax,
      baggage: true,
    }
  }

  const from = originCode.value
  if (!from) return null

  return {
    from,
    to: props.stop.code,
    departDate: date,
    returnDate: returnFlightDate.value ?? undefined,
    adults: pax,
    baggage: true,
  }
})

/** Обратный перелёт — последний перелёт маршрута, если он позже текущей даты. */
const returnFlightDate = computed(() => {
  const stops = trip.value?.stops ?? []
  const links = trip.value?.links ?? []
  const currentDate = incomingLink.value?.date

  for (let i = stops.length - 1; i > 0; i -= 1) {
    const link = links[i - 1]
    if (link?.kind === 'flight' && link.date && (!currentDate || link.date > currentDate)) {
      return link.date
    }
  }
  return null
})

/** Кнопки сервисов: с маршрутом и датами, если дата задана. */
const buttons = computed(() => flightButtons(flightQuery.value))

const linksLabel = computed(() => {
  const query = flightQuery.value
  return query ? flightQueryLabel(query) : ''
})

const missingDate = computed(() => Boolean(props.stop.code) && !incomingLink.value?.date)
</script>

<template>
  <div class="node node-airport nodrag nowheel">
    <Handle type="target" :position="Position.Left" />

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

    <div v-if="stop.code" class="flight-bar">
      <span class="flight-bar-label" :title="missingDate ? 'Дата перелёта не задана — откроется обычный поиск' : linksLabel">
        Билеты<template v-if="linksLabel && !missingDate"> · {{ linksLabel }}</template>
      </span>
      <div class="flight-bar-buttons">
        <a
          v-for="button in buttons"
          :key="button.id"
          class="flight-btn"
          :class="{ prefilled: button.prefilled }"
          :href="button.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="button.title"
        >
          {{ button.label }}
        </a>
      </div>
    </div>

    <div class="node-foot">
      <span v-if="isDeparture" class="node-hint">Финальная точка — вылет домой</span>
      <button v-else-if="isLast" type="button" class="node-add" @click="addTransfer">+ Трансфер</button>
    </div>

    <Handle type="source" :position="Position.Right" />
  </div>
</template>