<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { MealKey, Meals, PlaceOption, StayStop } from '@/types'
import { resorts } from '@/data/resorts'
import { cities, findCity } from '@/data/cities'
import {
  airportSuggestions,
  airportsNearCity,
  resortsForAirport,
} from '@/data/resort-airports'
import { mealOptions, foodPerDay, mealsIncluded } from '@/data/meals'
import {
  addFlight,
  addMove,
  arrivalAirportFor,
  focusStopOnMap,
  geocodeHotel,
  patchMeals,
  patchStay,
  removeStop,
  selectResort,
  selectStayCity,
  setStayPlaceKind,
  trip,
} from '@/stores/trip'
import { distanceKm, formatDistance, hotelCoords } from '@/lib/geo'
import { stayCheckOut } from '@/lib/schedule'
import { formatHours, formatMoney, currencySymbols } from '@/lib/format'
import { convertGuideAmount } from '@/lib/currency'
import {
  hotelButtons,
  hotelQueryLabel,
  hotelSourceLabel,
  hotelSourceOrder,
  isHotelSource,
  type HotelQuery,
} from '@/lib/hotel-links'
import { guideFor, guidePassPerDay } from '@/data/resort-guides'
import { trailsFor } from '@/data/trail-maps'
import PlacePicker from '@/components/PlacePicker.vue'
import NumberField from '@/components/NumberField.vue'

const props = defineProps<{
  stop: StayStop
  isLast: boolean
}>()

const ResortGuideModal = defineAsyncComponent(() => import('@/components/ResortGuideModal.vue'))

const isCity = computed(() => props.stop.placeKind === 'city')
const guide = computed(() => (isCity.value ? undefined : guideFor(props.stop.resortId)))
const trailMap = computed(() => (isCity.value ? undefined : trailsFor(props.stop.resortId)))
const guideOpen = ref(false)

function openGuide(): void {
  if (guide.value) guideOpen.value = true
}

const airport = computed(() => arrivalAirportFor(props.stop.id))
const airportCity = computed(() => (airport.value ? findCity(airport.value.cityId) : undefined))

const available = computed(() => {
  if (!airport.value) return []
  return isCity.value ? [] : resortsForAirport(airport.value.cityId)
})

const resortOptions = computed<PlaceOption[]>(() => {
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

const cityOptions = computed<PlaceOption[]>(() => {
  const near = airportCity.value
  return cities
    .map((city) => {
      const km = near
        ? Math.round(distanceKm({ lat: near.lat, lng: near.lng }, { lat: city.lat, lng: city.lng }))
        : 0
      return {
        id: city.id,
        label: `${city.city} (${city.code})`,
        sublabel: `${city.airport} · ${city.country}${near && city.id !== near.id ? ` · ${km} км от ${near.code}` : ''}`,
        km,
        sameCountry: near ? city.country === near.country : false,
      }
    })
    .sort((a, b) => {
      if (a.sameCountry !== b.sameCountry) return a.sameCountry ? -1 : 1
      return a.km - b.km
    })
    .map(({ id, label, sublabel }) => ({ id, label, sublabel }))
})

const emptyLabel = computed(() => {
  if (isCity.value) return 'Начните вводить город'
  if (!airportCity.value) return 'Сначала выберите аэропорт прилёта'
  return `Нет курортов рядом с ${airportCity.value.city} (${airportCity.value.country})`
})

const pickerOptions = computed(() => (isCity.value ? cityOptions.value : resortOptions.value))
const pickerLabel = computed(() => (isCity.value ? props.stop.city ?? '' : props.stop.resort))
const pickerPlaceholder = computed(() => (isCity.value ? 'Город' : 'Курорт'))

const mismatched = computed(() => {
  if (isCity.value || !props.stop.resortId || !airport.value) return false
  return !available.value.some((item) => item.resortId === props.stop.resortId)
})

const currency = computed(() => trip.value?.currency ?? 'RUB')
const symbol = computed(() => currencySymbols[currency.value])
const pax = computed(() => Math.max(1, trip.value?.pax ?? 1))

/** Цена скипасса на день из гида, приведённая к валюте поездки. */
const guidePassDay = computed(() => {
  const current = guide.value
  if (!current) return null
  const perDay = guidePassPerDay(current)
  if (!perDay) return null
  return {
    amount: convertGuideAmount(perDay.amount, perDay.currency, currency.value),
    label: perDay.label,
  }
})

const canApplyGuidePass = computed(
  () => Boolean(guidePassDay.value) && guidePassDay.value?.amount !== props.stop.skipassPerDay,
)

function applyGuidePass(): void {
  const value = guidePassDay.value
  if (!value) return
  patch({ skipassPerDay: value.amount })
}

const stayTotal = computed(() => props.stop.nights * props.stop.rooms * props.stop.hotelPerNight)
/** Цена питания по пресетам приёмов пищи — базовая, если пользователь не задал свою. */
const presetFood = computed(() =>
  foodPerDay(props.stop.resortId, props.stop.meals, currency.value, props.stop.country),
)

const foodOverridden = computed(
  () => props.stop.foodPerDayOverride !== null && props.stop.foodPerDayOverride !== undefined,
)

const dailyFood = computed(() =>
  foodOverridden.value ? Math.max(0, props.stop.foodPerDayOverride ?? 0) : presetFood.value,
)

const foodTotal = computed(() => props.stop.nights * dailyFood.value * pax.value)

function setFoodPerDay(value: number): void {
  patch({ foodPerDayOverride: value })
}

/** Сброс к расчёту по составу приёмов пищи и стране курорта. */
function resetFoodPerDay(): void {
  patch({ foodPerDayOverride: null })
}
const subtitle = computed(() => (props.stop.hotel ? props.stop.hotel : 'Отель не указан'))

const nearest = computed(() => {
  if (isCity.value) {
    return props.stop.cityId
      ? airportsNearCity(props.stop.cityId, 3).map((item) => ({
          cityId: item.city.id,
          code: item.city.code,
          city: item.city.city,
          airport: item.city.airport,
          km: item.km,
          hours: item.hours,
          access: 'transfer' as const,
        }))
      : []
  }
  return airportSuggestions(props.stop.resortId).slice(0, 3).map((item) => ({
    cityId: item.city.id,
    code: item.city.code,
    city: item.city.city,
    airport: item.city.airport,
    km: item.km,
    hours: item.hours,
    access: item.access ?? ('transfer' as const),
  }))
})

const arrivalDistance = computed(() => {
  if (isCity.value || !airport.value) return null
  return available.value.find((item) => item.resortId === props.stop.resortId) ?? null
})

const placePoint = computed(() =>
  props.stop.lat || props.stop.lng ? { lat: props.stop.lat, lng: props.stop.lng } : null,
)

const hotelPoint = computed(() => {
  if (!placePoint.value) return null
  return hotelCoords(placePoint.value, props.stop.hotel, {
    lat: props.stop.hotelLat,
    lng: props.stop.hotelLng,
  })
})

const hotelDistance = computed(() => {
  if (!placePoint.value || !hotelPoint.value) return 0
  return distanceKm(placePoint.value, hotelPoint.value)
})

const hasExactHotel = computed(() => Boolean(props.stop.hotelLat && props.stop.hotelLng))
const geocodeBusy = ref(false)
const geocodeMessage = ref('')

const checkOut = computed(() => stayCheckOut(props.stop))
const checkInLabel = computed(() => formatShortDate(props.stop.checkIn))
const checkOutLabel = computed(() => formatShortDate(checkOut.value))

/** Место поиска отелей: курорт или город. */
/**
 * Место поиска отелей: курорт/город узла, а если он ещё не выбран —
 * город аэропорта прилёта, чтобы можно было искать отель по билету/трансферу.
 */
const placeName = computed(
  () => (isCity.value ? props.stop.city ?? '' : props.stop.resort) || airportCity.value?.city || '',
)
const placeCountry = computed(() => props.stop.country || airportCity.value?.country || '')
const hasPlace = computed(() => Boolean(placeName.value))
const fromArrivalAirport = computed(
  () => !(isCity.value ? props.stop.city : props.stop.resort) && Boolean(airportCity.value?.city),
)
/** Точка для Booking: отель, курорт/город или аэропорт прилёта. */
const searchPoint = computed(() => {
  if (hotelPoint.value) return hotelPoint.value
  if (airportCity.value) return { lat: airportCity.value.lat, lng: airportCity.value.lng }
  return null
})
const hasStayDates = computed(() => Boolean(props.stop.checkIn) && props.stop.nights > 0)

/** Запрос к сервисам бронирования: место, даты, гости и валюта. */
const hotelQuery = computed<HotelQuery | null>(() => {
  if (!hasPlace.value || !hasStayDates.value) return null
  const end = checkOut.value
  if (!end) return null
  return {
    hotel: props.stop.hotel,
    place: placeName.value,
    country: placeCountry.value,
    checkIn: props.stop.checkIn ?? '',
    checkOut: end,
    adults: pax.value,
    rooms: props.stop.rooms,
    currency: currency.value,
    lat: searchPoint.value?.lat,
    lng: searchPoint.value?.lng,
  }
})

const hotelLinks = computed(() => hotelButtons(hotelQuery.value))
const hotelLinksLabel = computed(() => (hotelQuery.value ? hotelQueryLabel(hotelQuery.value) : ''))
const missingStayDates = computed(() => hasPlace.value && !hasStayDates.value)
const sourceLabel = computed(() => hotelSourceLabel(props.stop.hotelSource))

function todayIso(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

/** Селект фиксирует цену за номер за выбранным сайтом. */
function onSource(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const source = isHotelSource(value) ? value : null
  patch({ hotelSource: source, hotelPriceAt: source ? todayIso() : undefined })
}

/** Правка цены при выбранном сайте обновляет дату фиксации. */
function onHotelPrice(value: number): void {
  patch({
    hotelPerNight: value,
    ...(props.stop.hotelSource ? { hotelPriceAt: todayIso() } : {}),
  })
}

function formatShortDate(value?: string): string {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function patch(patch: Partial<Omit<StayStop, 'id' | 'kind'>>): void {
  patchStay(props.stop.id, patch)
}

function onPlaceKind(kind: StayStop['placeKind']): void {
  setStayPlaceKind(props.stop.id, kind)
  geocodeMessage.value = ''
}

function onPlace(id: string): void {
  if (isCity.value) selectStayCity(props.stop.id, id)
  else selectResort(props.stop.id, id)
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
  if (geocodeBusy.value) return
  geocodeBusy.value = true
  geocodeMessage.value = ''
  try {
    const status = await geocodeHotel(props.stop.id)
    geocodeMessage.value =
      status === 'ok'
        ? 'Координаты найдены'
        : status === 'notfound'
          ? 'Отель не найден — показываем зону'
          : 'Геокодер недоступен, попробуйте позже'
  } finally {
    geocodeBusy.value = false
  }
}

const starOptions = [0, 1, 2, 3, 4, 5]
</script>

<template>
  <div class="node node-stay nodrag nowheel" :class="{ city: isCity }">
    <Handle type="target" :position="Position.Left" />

    <div
      class="node-head"
      :class="{ 'has-guide': guide }"
      :title="guide ? 'Открыть гид по курорту' : undefined"
      @click="guide && openGuide()"
    >
      <span class="node-kicker">{{ isCity ? 'Город и отель' : 'Отель и курорт' }}</span>
      <div class="node-head-actions">
        <button
          v-if="guide"
          type="button"
          class="node-guide"
          title="Рекомендации и 3D-карта курорта"
          @click.stop="openGuide"
        >
          Гид
        </button>
        <button type="button" class="node-remove" title="Удалить точку" @click.stop="removeStop(stop.id)">×</button>
      </div>
    </div>

    <div class="place-switch" role="tablist" aria-label="Тип места">
      <button
        type="button"
        role="tab"
        :aria-selected="!isCity"
        :class="{ active: !isCity }"
        @click="onPlaceKind('resort')"
      >
        Курорт
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="isCity"
        :class="{ active: isCity }"
        @click="onPlaceKind('city')"
      >
        Город
      </button>
    </div>

    <PlacePicker
      :options="pickerOptions"
      :model-label="pickerLabel"
      :placeholder="pickerPlaceholder"
      :empty-label="emptyLabel"
      :initial-count="20"
      @select="onPlace"
    />

    <div v-if="!isCity && airport" class="node-meta">
      {{ airport.code }} · {{ airportCity?.country }}
      <template v-if="arrivalDistance">
        · {{ arrivalDistance.km }} км до курорта{{ arrivalDistance.exact ? '' : ' (оценка)' }}
      </template>
    </div>
    <div v-else-if="isCity && stop.city" class="node-meta">
      {{ stop.city }} · {{ stop.country }}
    </div>
    <div v-else-if="!isCity" class="node-meta muted">Курорты фильтруются по стране аэропорта прилёта</div>
    <div v-else class="node-meta muted">Город нужен, чтобы вернуться с курорта перед вылетом</div>

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
          title="Сдвинутся только следующие отели и участки — предыдущие останутся на месте"
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
      placeholder="Название отеля (необязательно)"
      autocomplete="off"
      @input="onHotel"
    />

    <div v-if="stop.hotel" class="hotel-row">
      <span class="hotel-distance">
        <b>{{ hasExactHotel ? 'Отель' : 'Отель ≈' }}</b>
        {{ formatDistance(hotelDistance) }} от {{ isCity ? 'центра' : 'курорта' }}
      </span>
      <div class="hotel-actions">
        <button
          type="button"
          class="mini-btn"
          :disabled="!(stop.lat || stop.lng)"
          title="Центрировать карту на этой точке"
          @click="focusStopOnMap(stop.id)"
        >
          Центр
        </button>
        <button
          type="button"
          class="mini-btn"
          :disabled="geocodeBusy || !(stop.resortId || stop.cityId)"
          :title="hasExactHotel ? 'Обновить координаты отеля' : 'Найти отель на карте'"
          @click="locateHotel"
        >
          {{ geocodeBusy ? 'Поиск…' : hasExactHotel ? 'Обновить' : 'Найти' }}
        </button>
      </div>
    </div>
    <div v-if="geocodeMessage" class="node-meta muted">{{ geocodeMessage }}</div>

    <div v-if="hasPlace" class="flight-bar stay-bar">
      <span
        class="flight-bar-label"
        :title="
          missingStayDates
            ? 'Заезд или ночи не заданы — откроется обычный поиск'
            : fromArrivalAirport
              ? `Поиск отелей в ${placeName} по аэропорту прилёта — название можно не вводить`
              : 'Поиск отелей по месту и датам — название можно не вводить'
        "
      >
        Отели<template v-if="hotelLinksLabel && !missingStayDates"> · {{ hotelLinksLabel }}</template>
      </span>
      <div class="flight-bar-buttons">
        <a
          v-for="button in hotelLinks"
          :key="button.id"
          class="flight-btn stay-btn"
          :class="{ prefilled: button.prefilled, chosen: button.id === stop.hotelSource }"
          :href="button.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="button.id === stop.hotelSource ? `${button.title} · выбранный сайт` : button.title"
        >
          {{ button.label }}
        </a>
      </div>
    </div>

    <div class="stay-grid">
      <NumberField
        label="Ночей"
        :model-value="stop.nights"
        hint="При изменении ночей выезд и всё дальше сдвинутся автоматически"
        @update:model-value="(v) => patch({ nights: v })"
      />
      <NumberField label="Номеров" :model-value="stop.rooms" @update:model-value="(v) => patch({ rooms: v })" />
      <NumberField label="За номер" :model-value="stop.hotelPerNight" :suffix="symbol" @update:model-value="onHotelPrice" />
      <label class="select-field">
        <span>Уровень</span>
        <select :value="stop.hotelStars" @change="onStars">
          <option v-for="stars in starOptions" :key="stars" :value="stars">
            {{ stars === 0 ? 'не указан' : '★'.repeat(stars) }}
          </option>
        </select>
      </label>
      <template v-if="!isCity">
        <NumberField label="Дней катания" :model-value="stop.skipassDays" @update:model-value="(v) => patch({ skipassDays: v })" />
        <div class="skipass-field">
          <NumberField label="Скипасс/день" :model-value="stop.skipassPerDay" :suffix="symbol" @update:model-value="(v) => patch({ skipassPerDay: v })" />
          <button
            v-if="canApplyGuidePass"
            type="button"
            class="mini-btn skipass-from-guide"
            :title="'Взять из гида: ' + guidePassDay?.label"
            @click="applyGuidePass"
          >
            Из гида
          </button>
        </div>
      </template>
      <div v-else class="stay-total city-note">
        <span>Скипасс</span>
        <strong>в городе не нужен</strong>
      </div>
      <div class="food-field">
        <NumberField
          label="Питание/день на чел."
          :model-value="dailyFood"
          :suffix="symbol"
          @update:model-value="setFoodPerDay"
        />
        <button
          v-if="foodOverridden"
          type="button"
          class="food-reset"
          :title="'Вернуть расчёт по приёмам пищи: ' + formatMoney(presetFood, currency)"
          @click="resetFoodPerDay"
        >
          сбросить
        </button>
      </div>
    </div>

    <div class="book-source">
      <label class="select-field">
        <span>Где бронирую</span>
        <select :value="stop.hotelSource ?? ''" @change="onSource">
          <option value="">не указано</option>
          <option v-for="source in hotelSourceOrder" :key="source" :value="source">
            {{ hotelSourceLabel(source) }}
          </option>
        </select>
      </label>
      <p v-if="stop.hotelSource" class="book-quote">
        <b>{{ formatMoney(stop.hotelPerNight, currency) }}</b> за номер · {{ sourceLabel }}
        <template v-if="stop.hotelPriceAt"> · зафиксировано {{ formatShortDate(stop.hotelPriceAt) }}</template>
      </p>
      <p v-else class="book-quote muted">
        {{ stop.hotelPerNight > 0 ? 'Выберите сайт — цена будет привязана к нему' : 'Укажите цену за номер и выберите сайт' }}
      </p>
    </div>

    <div class="stay-totals">
      <div class="stay-total">
        <span>Проживание<template v-if="sourceLabel"> · {{ sourceLabel }}</template></span>
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
    <div v-if="foodOverridden" class="node-meta food-hint">
      Своя цена питания — пресеты приёмов пищи на смету не влияют.
    </div>
    <div v-else-if="!mealsIncluded(stop.meals)" class="node-meta muted">Питание не заложено в смету</div>

    <div v-if="nearest.length" class="nearby">
      <span class="nearby-title">{{ isCity ? 'Аэропорты рядом с городом' : 'Ближайшие аэропорты' }}</span>
      <div class="nearby-list">
        <span
          v-for="item in nearest"
          :key="item.cityId"
          class="nearby-chip static"
          :title="`${item.airport} · ${item.km} км · ~${formatHours(item.hours)}`"
        >
          <b>{{ item.code }}</b>
          <span v-if="item.km === 0">здесь</span>
          <span v-else>{{ item.km }} км · {{ formatHours(item.hours) }}</span>
        </span>
      </div>
    </div>

    <div class="node-foot">
      <span v-if="!isLast" class="node-hint">{{ subtitle }}</span>
      <div v-if="isLast" class="node-actions">
        <button type="button" class="node-add node-add-flight" title="Перелёт в другую страну или домой" @click="addFlight(3)">
          + Перелёт
        </button>
        <button type="button" class="node-add node-add-move" title="Переезд в другой отель, город или курорт" @click="addMove">
          + Переезд
        </button>
      </div>
    </div>

    <Handle type="source" :position="Position.Right" />

    <Teleport to="body">
      <ResortGuideModal
        v-if="guideOpen && guide"
        :guide="guide"
        :open="guideOpen"
        :hotel-name="stop.hotel"
        :hotel-point="hotelPoint"
        :hotel-distance="hotelDistance"
        :hotel-exact="hasExactHotel"
        :dataset="trailMap"
        :check-in="stop.checkIn"
        :check-out="checkOut"
        @close="guideOpen = false"
      />
    </Teleport>
  </div>
</template>