<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ResortGuide } from '@/data/resort-guides'
import {
  altitudePoints,
  forecastLinks,
  forecastUrl,
  osmPoiQuery,
  parseWeather,
  pickTripDays,
  weekDays,
  weatherIcon,
  weatherLabel,
  type AltitudeBand,
  type WeatherReport,
} from '@/lib/weather'

const props = defineProps<{
  guide: ResortGuide
  /** даты поездки, если известны */
  checkIn?: string
  checkOut?: string
}>()

const reports = ref<Partial<Record<AltitudeBand, WeatherReport>>>({})
const selected = ref<AltitudeBand>('base')
let controller: AbortController | null = null
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errorText = ref('')

/** Три высоты первой части курорта: база, середина, вершина. */
const variants = computed(() => {
  const zone = props.guide.zones[0]
  return zone ? altitudePoints(zone) : []
})

const selectedVariant = computed(
  () => variants.value.find((variant) => variant.id === selected.value) ?? variants.value[0] ?? null,
)

/** Точка для ссылок и POI: выбранная высота, иначе середина склона. */
const point = computed(() => {
  if (selectedVariant.value) return selectedVariant.value.point
  const zone = props.guide.zones[0]
  if (!zone) return null
  return { lat: (zone.base.lat + zone.summit.lat) / 2, lng: (zone.base.lng + zone.summit.lng) / 2 }
})

const links = computed(() => (point.value ? forecastLinks(point.value, props.guide.resortId) : null))

const report = computed<WeatherReport | null>(() => reports.value[selected.value] ?? null)
const week = computed(() => (report.value ? weekDays(report.value) : []))

const tripDays = computed(() => {
  if (!report.value) return []
  return pickTripDays(report.value, props.checkIn, props.checkOut)
})

const tripInForecast = computed(() => {
  if (!props.checkIn) return false
  return tripDays.value.length > 0
})

const today = computed(() => report.value?.days[0] ?? null)

function dateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', weekday: 'short' })
}

function chipTemp(band: AltitudeBand): string {
  const now = reports.value[band]?.now
  if (!now) return '—'
  return `${now.temperature > 0 ? '+' : ''}${now.temperature}°`
}

/** Снег на высоте — виден сразу на всех кнопках. */
function chipSnow(band: AltitudeBand): string {
  const now = reports.value[band]?.now
  if (!now || now.snowDepthCm === null) return '—'
  return `${now.snowDepthCm} см`
}

async function load(): Promise<void> {
  const targets = variants.value
  if (!targets.length) return

  // новый запрос отменяет предыдущий: пользователь может быстро менять курорт
  controller?.abort()
  controller = new AbortController()

  state.value = 'loading'
  errorText.value = ''

  try {
    const entries = await Promise.all(
      targets.map(async (variant) => {
        const response = await fetch(forecastUrl(variant.point, variant.altitude), {
          signal: controller?.signal,
        })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const payload = await response.json()
        return [variant.id, parseWeather(payload, props.guide.resortId)] as const
      }),
    )
    reports.value = Object.fromEntries(entries) as Partial<Record<AltitudeBand, WeatherReport>>
    state.value = 'ready'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    state.value = 'error'
    errorText.value = 'Прогноз недоступен без сети'
  }
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => controller?.abort())

watch(
  () => props.guide.resortId,
  () => {
    selected.value = 'base'
    reports.value = {}
    void load()
  },
)

const poiLinks = computed(() => {
  if (!point.value) return []
  return [
    { label: 'Кафе', url: osmPoiQuery(point.value, 'cafe') },
    { label: 'Прокат', url: osmPoiQuery(point.value, 'sports_shop') },
    { label: 'Парковка', url: osmPoiQuery(point.value, 'parking') },
    { label: 'Медпункт', url: osmPoiQuery(point.value, 'clinic') },
  ]
})
</script>

<template>
  <div class="guide-block">
    <div class="weather-head">
      <h3>Погода и снег</h3>
      <button
        type="button"
        class="mini-btn"
        :disabled="state === 'loading'"
        @click="load"
      >
        {{ state === 'loading' ? 'Загрузка…' : 'Обновить' }}
      </button>
    </div>

    <div v-if="variants.length" class="weather-altitudes">
      <button
        v-for="variant in variants"
        :key="variant.id"
        type="button"
        class="weather-alt"
        :class="{ active: selected === variant.id }"
        @click="selected = variant.id"
      >
        <span class="weather-alt-label">
          <b>{{ variant.label }}</b>
          <span>{{ variant.altitude }} м</span>
        </span>
        <span class="weather-alt-temp">{{ chipTemp(variant.id) }}</span>
        <span class="weather-alt-snow">❄ {{ chipSnow(variant.id) }}</span>
      </button>
    </div>

    <p v-if="state === 'error'" class="guide-text weather-empty">
      {{ errorText }}. <a :href="links?.windy" target="_blank" rel="noopener">Открыть Windy</a>
    </p>

    <p v-else-if="state === 'loading' && !report" class="guide-text muted">Загружаем прогноз по высотам…</p>

    <div v-else-if="report?.now" class="weather-now">
      <span class="weather-icon">{{ weatherIcon(report.now.weatherCode) }}</span>
      <div class="weather-main">
        <b>{{ report.now.temperature > 0 ? '+' : '' }}{{ report.now.temperature }}°C</b>
        <span>{{ weatherLabel(report.now.weatherCode) }} · ветер {{ report.now.windKmh }} км/ч</span>
      </div>
      <div v-if="report.now.snowDepthCm !== null" class="weather-snow">
        <span>снег</span>
        <b>{{ report.now.snowDepthCm }} см</b>
      </div>
    </div>

    <div v-if="selectedVariant" class="weather-alt-note">
      {{ selectedVariant.label }} · {{ selectedVariant.altitude }} м
    </div>

    <div v-if="today" class="weather-today">
      <span>Сегодня: {{ today.tempMin > 0 ? '+' : '' }}{{ today.tempMin }}…{{ today.tempMax > 0 ? '+' : '' }}{{ today.tempMax }}°C</span>
      <span v-if="today.snowfallCm > 0">· {{ today.snowfallCm }} см снега</span>
      <span v-if="today.windGustKmh > 40" class="weather-warn">· порывы до {{ today.windGustKmh }} км/ч</span>
    </div>

    <div v-if="week.length" class="weather-week">
      <h4>На неделю{{ selectedVariant ? ' · ' + selectedVariant.altitude + ' м' : '' }}</h4>
      <div class="weather-days">
        <div v-for="day in week" :key="day.date" class="weather-day">
          <span class="weather-day-date">{{ dateLabel(day.date) }}</span>
          <span class="weather-day-icon">{{ weatherIcon(day.weatherCode) }}</span>
          <span class="weather-day-temp">{{ day.tempMin > 0 ? '+' : '' }}{{ day.tempMin }}…{{ day.tempMax > 0 ? '+' : '' }}{{ day.tempMax }}°</span>
          <span v-if="day.snowfallCm > 0" class="weather-day-snow">❄ {{ day.snowfallCm }} см</span>
          <span v-if="day.windGustKmh > 40" class="weather-day-wind">до {{ day.windGustKmh }} км/ч</span>
        </div>
      </div>
    </div>

    <div v-if="tripDays.length" class="weather-trip">
      <h4>На даты поездки</h4>
      <div class="weather-days">
        <div v-for="day in tripDays" :key="day.date" class="weather-day">
          <span class="weather-day-date">{{ dateLabel(day.date) }}</span>
          <span class="weather-day-icon">{{ weatherIcon(day.weatherCode) }}</span>
          <span class="weather-day-temp">{{ day.tempMin > 0 ? '+' : '' }}{{ day.tempMin }}…{{ day.tempMax > 0 ? '+' : '' }}{{ day.tempMax }}°</span>
          <span v-if="day.snowfallCm > 0" class="weather-day-snow">❄ {{ day.snowfallCm }} см</span>
        </div>
      </div>
    </div>

    <p v-else-if="checkIn && !tripInForecast && state === 'ready'" class="guide-text passport-note">
      Даты поездки ({{ checkIn }}) дальше 16 дней — прогноз появится ближе к выезду.
    </p>

    <div v-if="links" class="weather-links">
      <a :href="links.windy" target="_blank" rel="noopener">Windy</a>
      <a :href="links.snowForecast" target="_blank" rel="noopener">Snow-forecast</a>
      <a :href="links.osmSki" target="_blank" rel="noopener">OpenSkiMap</a>
    </div>

    <div v-if="poiLinks.length" class="weather-links poi">
      <span class="poi-title">Рядом на OSM:</span>
      <a v-for="item in poiLinks" :key="item.label" :href="item.url" target="_blank" rel="noopener">
        {{ item.label }}
      </a>
    </div>

    <p class="guide-text passport-note source-note weather-source">
      Прогноз: Open-Meteo, без бэкенда и ключей. Три высоты считаются отдельно — база, середина и вершина.
    </p>
  </div>
</template>
