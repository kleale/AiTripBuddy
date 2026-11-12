<script setup lang="ts">
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { MealKey, Meals, PlaceOption, StayStop } from '@/types'
import { resorts } from '@/data/resorts'
import { findCity } from '@/data/cities'
import { airportSuggestions, resortsForAirport } from '@/data/resort-airports'
import { mealOptions, foodPerDay, mealsIncluded } from '@/data/meals'
import {
  addFlight,
  addMove,
  arrivalAirportFor,
  geocodeHotel,
  patchMeals,
  patchStay,
  removeStop,
  selectResort,
  trip,
} from '@/stores/trip'
import { distanceKm, formatDistance, hotelCoords } from '@/lib/geo'
import { stayCheckOut } from '@/lib/schedule'
import { formatHours, formatMoney, currencySymbols } from '@/lib/format'
import PlacePicker from '@/components/PlacePicker.vue'
import NumberField from '@/components/NumberField.vue'

const props = defineProps<{
  stop: StayStop
  isLast: boolean
}>()

const airport = computed(() => arrivalAirportFor(props.stop.id))
const airportCity = computed(() => (airport.value ? findCity(airport.value.cityId) : undefined))

const available = computed(() => {
  if (!airport.value) return []
  return resortsForAirport(airport.value.cityId)
})

const options = computed<PlaceOption[]>(() => {
  if (!airport.value) {
    return resorts.map((resort) => ({
      id: resort.id,
      label: resort.name,
      sublabel: `${resort.country} · ${resort.region}`,
    }))
  }

  const code = airport.value.code
  const list: PlaceOption[] = []
  for (const item of available.value) {
    const resort = resorts.find((r) => r.id === item.resortId)
    if (!resort) continue
    const parts = [`${resort.country}`, resort.region, `${item.km} км от ${code}`]
    if (item.access === 'hub') parts.push('хаб')
    if (!item.exact) parts.push('оценка')
    list.push({ id: resort.id, label: resort.name, sublabel: parts.join(' · ') })
  }
  return list
})

const emptyLabel = computed(() => {
  if (!airportCity.value) return 'Сначала выберите аэропорт прилёта'
  return `Нет курортов рядом с ${airportCity.value.city} (${airportCity.value.country})`
})

const mismatched = computed(() => {
  if (!props.stop.resortId || !airport.value) return false
  return !available.value.some((item) => item.resortId === props.stop.resortId)
})

const currency = computed(() => trip.value?.currency ?? 'RUB')
const symbol = computed(() => currencySymbols[currency.value])
const pax = computed(() => Math.max(1, trip.value?.pax ?? 1))

const stayTotal = computed(() => props.stop.nights * props.stop.rooms * props.stop.hotelPerNight)
const dailyFood = computed(() => foodPerDay(props.stop.resortId, props.stop.meals, currency.value))
const foodTotal = computed(() => props.stop.nights * dailyFood.value * pax.value)
const subtitle = computed(() => (props.stop.hotel ? props.stop.hotel : 'Отель не указан'))

const nearest = computed(() => airportSuggestions(props.stop.resortId).slice(0, 3))

const arrivalDistance = computed(() => {
  if (!airport.value) return null
  return available.value.find((item) => item.resortId === props.stop.resortId) ?? null
})

const resortPoint = computed(() =>
  props.stop.lat || props.stop.lng ? { lat: props.stop.lat, lng: props.stop.lng } : null,
)

const hotelPoint = computed(() => {
  if (!resortPoint.value) return null
  return hotelCoords(resortPoint.value, props.stop.hotel, {
    lat: props.stop.hotelLat,
    lng: props.stop.hotelLng,
  })
})

const hotelDistance = computed(() => {
  if (!resortPoint.value || !hotelPoint.value) return 0
  return distanceKm(resortPoint.value, hotelPoint.value)
})

const hasExactHotel = computed(() => Boolean(props.stop.hotelLat && props.stop.hotelLng))
const locating = ref(false)
const geocodeMessage = ref('')

const checkOut = computed(() => stayCheckOut(props.stop))
const checkInLabel = computed(() => formatShortDate(props.stop.checkIn))
const checkOutLabel = computed(() => formatShortDate(checkOut.value))

function formatShortDate(value?: string): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function patch(patch: Partial<Omit<StayStop, 'id' | 'kind'>>): void {
  patchStay(props.stop.id, patch)
}

function onHotel(event: Event): void {
  const hotel = (event.target as HTMLInputElement).value
  patch({ hotel, hotelLat: undefined, hotelLng: undefined })
  geocodeMessage.value = ''
}

function onMeal(meal: keyof Meals, event: Event): void {
  patchMeals(props.stop.id, meal, (event.target as HTMLSelectElement).value as MealKey)
}

function onCheckIn(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  patch({ checkIn: value || undefined })
}

function onStars(event: Event): void {
  patch({ hotelStars: Number((event.target as HTMLSelectElement).value) })
}

async function locateHotel(): Promise<void> {
  if (locating.value) return
  locating.value = true
  geocodeMessage.value = ''
  try {
    const status = await geocodeHotel(props.stop.id)
    geocodeMessage.value =
      status === 'ok'
        ? 'Координаты найдены'
        : status === 'notfound'
          ? 'Отель не найден — показываем зону курорта'
          : 'Геокодер недоступен, попробуйте позже'
  } finally {
    locating.value = false
  }
}

const starOptions = [0, 1, 2, 3, 4, 5]
</script>

<template>
  <div class="node node-stay nodrag nowheel">
    <Handle type="target" :position="Position.Left" :connectable="false" />

    <div class="node-head">
      <span class="node-kicker">Отель и курорт</span>
      <button type="button" class="node-remove" title="Удалить точку" @click="removeStop(stop.id)">×</button>
    </div>

    <PlacePicker
      :options="options"
      :model-label="stop.resort"
      placeholder="Курорт"
      :empty-label="emptyLabel"
      @select="(id) => selectResort(stop.id, id)"
    />

    <div v-if="airport" class="node-meta">
      {{ airport.code }} · {{ airportCity?.country }}
      <template v-if="arrivalDistance">
        · {{ arrivalDistance.km }} км до курорта{{ arrivalDistance.exact ? '' : ' (оценка)' }}
      </template>
    </div>
    <div v-else class="node-meta muted">Курорты фильтруются по стране аэропорта прилёта</div>

    <div v-if="mismatched" class="node-warn">
      Курорт не относится к стране аэропорта {{ airport?.code }} — выберите из списка
    </div>
    <div v-else-if="arrivalDistance?.access === 'hub'" class="node-warn">
      {{ airport?.code }} → {{ arrivalDistance.km }} км: это хаб, нужен дополнительный перелёт или поезд
    </div>

    <div class="date-row">
      <label class="date-field">
        <span>Заезд</span>
        <input
          type="date"
          :value="stop.checkIn ?? ''"
          @input="onCheckIn"
        />
      </label>
      <div class="date-summary">
        <template v-if="stop.checkIn">
          <b>{{ checkInLabel }} — {{ checkOutLabel }}</b>
          <span>{{ stop.nights }} ноч.</span>
        </template>
        <span v-else class="muted">дата не задана</span>
      </div>
    </div>

    <input
      class="text-input"
      type="text"
      :value="stop.hotel"
      placeholder="Название отеля"
      autocomplete="off"
      @input="onHotel"
    />

    <div v-if="stop.hotel" class="hotel-row">
      <span class="hotel-distance">
        <b>{{ hasExactHotel ? 'Отель' : 'Отель ≈' }}</b>
        {{ formatDistance(hotelDistance) }} от курорта
      </span>
      <button
        type="button"
        class="mini-btn"
        :disabled="locating || !stop.resortId"
        :title="hasExactHotel ? 'Обновить координаты отеля' : 'Найти отель на карте'"
        @click="locateHotel"
      >
        {{ locating ? 'Поиск…' : hasExactHotel ? 'Обновить' : 'На карте' }}
      </button>
    </div>
    <div v-if="geocodeMessage" class="node-meta muted">{{ geocodeMessage }}</div>

    <div class="stay-grid">
      <NumberField label="Ночей" :model-value="stop.nights" @update:model-value="(v) => patch({ nights: v })" />
      <NumberField label="Номеров" :model-value="stop.rooms" @update:model-value="(v) => patch({ rooms: v })" />
      <NumberField label="За номер" :model-value="stop.hotelPerNight" :suffix="symbol" @update:model-value="(v) => patch({ hotelPerNight: v })" />
      <label class="select-field">
        <span>Уровень</span>
        <select :value="stop.hotelStars" @change="onStars">
          <option v-for="stars in starOptions" :key="stars" :value="stars">
            {{ stars === 0 ? 'не указан' : '★'.repeat(stars) }}
          </option>
        </select>
      </label>
      <NumberField label="Дней катания" :model-value="stop.skipassDays" @update:model-value="(v) => patch({ skipassDays: v })" />
      <NumberField label="Скипасс/день" :model-value="stop.skipassPerDay" :suffix="symbol" @update:model-value="(v) => patch({ skipassPerDay: v })" />
      <div class="stay-total">
        <span>Проживание</span>
        <strong>{{ formatMoney(stayTotal, currency) }}</strong>
      </div>
      <div class="stay-total">
        <span>Питание · {{ formatMoney(dailyFood, currency) }}/чел.</span>
        <strong>{{ formatMoney(foodTotal, currency) }}</strong>
      </div>
    </div>

    <div class="meals">
      <label class="select-field">
        <span>Завтрак</span>
        <select :value="stop.meals.breakfast" @change="onMeal('breakfast', $event)">
          <option v-for="option in mealOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>Обед</span>
        <select :value="stop.meals.lunch" @change="onMeal('lunch', $event)">
          <option v-for="option in mealOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>Ужин</span>
        <select :value="stop.meals.dinner" @change="onMeal('dinner', $event)">
          <option v-for="option in mealOptions" :key="option.key" :value="option.key">{{ option.label }}</option>
        </select>
      </label>
    </div>
    <div v-if="!mealsIncluded(stop.meals)" class="node-meta muted">Питание не заложено в смету</div>

    <div v-if="nearest.length" class="nearby">
      <span class="nearby-title">Ближайшие аэропорты</span>
      <div class="nearby-list">
        <span
          v-for="item in nearest"
          :key="item.city.id"
          class="nearby-chip static"
          :title="`${item.city.airport} · ${item.km} км · ~${formatHours(item.hours)}`"
        >
          <b>{{ item.city.code }}</b>
          <span>{{ item.km }} км · {{ formatHours(item.hours) }}</span>
        </span>
      </div>
    </div>

    <div class="node-foot">
      <span v-if="!isLast" class="node-hint">{{ subtitle }}</span>
      <div v-if="isLast" class="node-actions">
        <button type="button" class="node-add node-add-flight" title="Перелёт в другую страну или домой" @click="addFlight(3)">
          + Перелёт
        </button>
        <button type="button" class="node-add node-add-move" title="Переезд в другой отель или на другой курорт" @click="addMove">
          + Переезд
        </button>
      </div>
    </div>

    <Handle type="source" :position="Position.Right" :connectable="false" />
  </div>
</template>