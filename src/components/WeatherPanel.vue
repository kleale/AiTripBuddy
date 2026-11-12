<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GuidePoint, ResortGuide } from '@/data/resort-guides'
import {
  forecastLinks,
  forecastUrl,
  osmPoiQuery,
  parseWeather,
  pickTripDays,
  weatherIcon,
  weatherLabel,
  type WeatherReport,
} from '@/lib/weather'

const props = defineProps<{
  guide: ResortGuide
  /** даты поездки, если известны */
  checkIn?: string
  checkOut?: string
}>()

const report = ref<WeatherReport | null>(null)
let controller: AbortController | null = null
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errorText = ref('')

/** Точка для прогноза: координаты первой части курорта. */
const point = computed<GuidePoint | null>(() => {
  const zone = props.guide.zones[0]
  if (!zone) return null
  return { lat: (zone.base.lat + zone.summit.lat) / 2, lng: (zone.base.lng + zone.summit.lng) / 2 }
})

const links = computed(() => (point.value ? forecastLinks(point.value, props.guide.resortId) : null))

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

async function load(): Promise<void> {
  const target = point.value
  if (!target) return

  // новый запрос отменяет предыдущий: пользователь может быстро менять курорт
  controller?.abort()
  controller = new AbortController()

  state.value = 'loading'
  errorText.value = ''

  try {
    const response = await fetch(forecastUrl(target), { signal: controller.signal })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const payload = await response.json()
    report.value = parseWeather(payload, props.guide.resortId)
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
      <h3>Погода</h3>
      <button
        type="button"
        class="mini-btn"
        :disabled="state === 'loading'"
        @click="load"
      >
        {{ state === 'loading' ? 'Загрузка…' : 'Обновить' }}
      </button>
    </div>

    <p v-if="state === 'error'" class="guide-text weather-empty">
      {{ errorText }}. <a :href="links?.windy" target="_blank" rel="noopener">Открыть Windy</a>
    </p>

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

    <div v-if="today" class="weather-today">
      <span>Сегодня: {{ today.tempMin > 0 ? '+' : '' }}{{ today.tempMin }}…{{ today.tempMax > 0 ? '+' : '' }}{{ today.tempMax }}°C</span>
      <span v-if="today.snowfallCm > 0">· {{ today.snowfallCm }} см снега</span>
      <span v-if="today.windGustKmh > 40" class="weather-warn">· порывы до {{ today.windGustKmh }} км/ч</span>
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
      Прогноз: Open-Meteo, без бэкенда и ключей. Ссылки открываются на сторонних сервисах.
    </p>
  </div>
</template>