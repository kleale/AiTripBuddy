<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { Activity, ActivityKind, MealKey, Meals, PlaceOption, StayStop } from '@/types'
import { findResort, resorts } from '@/data/resorts'
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
import { seasonLabels, seasonRange } from '@/lib/season'
import { liftWalkLabel } from '@/lib/hotel-search'
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
import { askPriceHint, hotelPriceHint, skipassPriceHint, type PriceHint } from '@/lib/price-hints'
import PriceHintBox from '@/components/PriceHintBox.vue'
import HotelPickerModal from '@/components/HotelPickerModal.vue'
import ActivityIdeasModal from '@/components/ActivityIdeasModal.vue'
import { openTripAudit } from '@/lib/audit-store'
import { adminSettings } from '@/lib/admin'
import { activityKindLabels, activityMapUrl, activitySearchLinks } from '@/lib/activity-links'
import { recordHintAccepted, recordHintShown } from '@/lib/ai/settings'
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
const guestsPerRoom = computed(() => Math.max(1, props.stop.maxGuests ?? 2))
const capacityWarning = computed(() => props.stop.rooms * guestsPerRoom.value < pax.value)
const expanded = ref(false)
const activitiesOpen = ref(false)
const activityIdeasOpen = ref(false)
const mealsOpen = ref(false)
const nearbyOpen = ref(false)
const activities = computed(() => props.stop.activities ?? [])
const activitiesTotal = computed(() => activities.value.reduce((sum, item) => sum + item.price, 0) * pax.value)
const activityPresets: { label: string; kind: ActivityKind }[] = [
  { label: 'Своё', kind: 'custom' },
  { label: 'Спа', kind: 'spa' },
  { label: 'Экскурсия', kind: 'excursion' },
  { label: 'Концерт', kind: 'concert' },
  { label: 'Катание', kind: 'ride' },
]
const activityKindOptions = Object.keys(activityKindLabels) as ActivityKind[]

function saveActivities(next: Activity[]): void {
  patch({ activities: next })
}

function addActivity(title = '', kind: ActivityKind = 'custom'): void {
  saveActivities([
    ...activities.value,
    {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      kind,
      price: 0,
      source: 'manual',
    },
  ])
  activitiesOpen.value = true
}

function addPreset(preset: { label: string; kind: ActivityKind }): void {
  addActivity(preset.kind === 'custom' ? '' : preset.label, preset.kind)
}

function addIdea(activity: Activity): void {
  saveActivities([...activities.value, activity])
  activitiesOpen.value = true
}

function activityLinks(item: Activity) {
  return activitySearchLinks(item.title || item.placeName || '', placeName.value, placeCountry.value)
}

function activityMap(item: Activity): string | null {
  return activityMapUrl(item)
}

function updateActivity(id: string, patchValue: Partial<Activity>): void {
  saveActivities(activities.value.map((item) => (item.id === id ? { ...item, ...patchValue } : item)))
}

function removeActivity(id: string): void {
  saveActivities(activities.value.filter((item) => item.id !== id))
}

function activityMoment(item: Activity): string {
  if (!item.date) return ''
  return `${item.date}T${item.time || '00:00'}`
}

function setActivityMoment(id: string, value: string): void {
  const [date, time] = value.split('T')
  updateActivity(id, {
    date: date || undefined,
    time: time ? time.slice(0, 5) : undefined,
  })
}
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

const mealsSummary = computed(() =>
  [
    props.stop.meals.breakfast,
    props.stop.meals.lunch,
    props.stop.meals.dinner,
  ]
    .map((key) => mealOptions.find((option) => option.key === key)?.label ?? '')
    .filter(Boolean)
    .join(' · '),
)

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

const nearestSummary = computed(() => nearest.value.map((item) => item.code).join(' · '))

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

const resort = computed(() => findResort(props.stop.resortId))
const season = computed(() =>
  resort.value ? seasonRange(props.stop.checkIn, props.stop.nights, resort.value) : null,
)

/** Ближайшая нижняя станция из гида — по координатам отеля или зоны. */
const nearestLift = computed(() => {
  const zones = guide.value?.zones
  if (!zones?.length) return null
  const point = hotelPoint.value ?? placePoint.value
  if (!point) return null
  let best: { name: string; km: number } | null = null
  for (const zone of zones) {
    const km = distanceKm(point, zone.base)
    if (!best || km < best.km) best = { name: zone.name, km }
  }
  return best
})

const hotelPickerOpen = ref(false)

function applyHotel(payload: {
  offer: { name: string; stars: number }
  nightly: number
  lat: number
  lng: number
}): void {
  patch({
    hotel: payload.offer.name,
    hotelLat: payload.lat,
    hotelLng: payload.lng,
    hotelStars: payload.offer.stars,
    hotelPerNight: payload.nightly,
    hotelSource: null,
    hotelPriceAt: todayIso(),
  })
  hotelPickerOpen.value = false
  geocodeMessage.value = ''
}

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
const hotelHint = ref<PriceHint | null>(null)
const hotelHintLoading = ref(false)
const hotelHintError = ref('')
const skipassHint = ref<PriceHint | null>(null)
const skipassHintLoading = ref(false)
const skipassHintError = ref('')

async function loadHotelHint(): Promise<void> {
  hotelHintLoading.value = true
  hotelHintError.value = ''
  hotelHint.value = null
  const local = hotelPriceHint(props.stop, currency.value)
  hotelHint.value = await askPriceHint(local, {
    kind: 'hotel',
    place: placeName.value,
    query: `отель ${placeName.value}`,

    resort: props.stop.resort,
    country: props.stop.country,
    stars: props.stop.hotelStars,
    checkIn: props.stop.checkIn,
    nights: props.stop.nights,
    currency: currency.value,
  })
  hotelHintLoading.value = false
  if (hotelHint.value) recordHintShown()
}

function applyHotelHint(): void {
  if (!hotelHint.value) return
  recordHintAccepted()
  onHotelPrice(hotelHint.value.typical)
  hotelHint.value = null
}

async function loadSkipassHint(): Promise<void> {
  skipassHintLoading.value = true
  skipassHintError.value = ''
  skipassHint.value = null
  const local = skipassPriceHint(props.stop, currency.value)
  if (!local) {
    skipassHintError.value = 'Нет данных для этого места'
    skipassHintLoading.value = false
    return
  }
  skipassHint.value = await askPriceHint(local, {
    kind: 'skipass',
    place: placeName.value,
    query: `скипасс ${placeName.value}`,

    resort: props.stop.resort,
    country: props.stop.country,
    resortId: props.stop.resortId,
    currency: currency.value,
  })
  skipassHintLoading.value = false
  if (skipassHint.value) recordHintShown()
}

function applySkipassHint(): void {
  if (!skipassHint.value) return
  recordHintAccepted()
  patch({ skipassPerDay: skipassHint.value.typical })
  skipassHint.value = null
}
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
        <button
          type="button"
          class="node-expand"
          :title="expanded ? 'Свернуть детали' : 'Показать детали'"
          @click.stop="expanded = !expanded"
        >
          {{ expanded ? '−' : '+' }}
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

    <div v-if="!isCity && stop.resortId" class="hotel-pick-row">
      <button
        v-if="adminSettings.hotelPickerEnabled"
        type="button"
        class="mini-btn"
        @click="hotelPickerOpen = true"
      >
        Подобрать отель
      </button>
      <button v-if="adminSettings.auditEnabled" type="button" class="mini-btn" @click="openTripAudit">AI-аудит</button>
      <span v-if="season" class="hotel-season-chip" :class="'season-' + season.level">
        {{ seasonLabels[season.level] }}
      </span>
      <span v-if="nearestLift" class="hotel-lift-chip">
        до станции {{ formatDistance(nearestLift.km) }} · {{ liftWalkLabel(nearestLift.km) }}
        <small>{{ nearestLift.name }}</small>
      </span>
    </div>

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

    <div v-if="expanded" class="node-details">
      <div class="stay-grid">
        <NumberField
          label="Ночей"
          :model-value="stop.nights"
          hint="При изменении ночей выезд и всё дальше сдвинутся автоматически"
          @update:model-value="(v) => patch({ nights: v })"
        />
        <NumberField label="Номеров" :model-value="stop.rooms" @update:model-value="(v) => patch({ rooms: v })" />
        <NumberField label="Макс. гостей" :model-value="stop.maxGuests ?? 2" @update:model-value="(v) => patch({ maxGuests: v })" />
        <div class="hint-wrap">
          <NumberField label="За номер" :model-value="stop.hotelPerNight" :suffix="symbol" @update:model-value="onHotelPrice" />
          <button type="button" class="hint-btn" title="AI-подсказка цены" @click="loadHotelHint">AI</button>
        </div>
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
            <button type="button" class="hint-btn" title="AI-подсказка цены скипасса" @click="loadSkipassHint">
              AI
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

      <PriceHintBox
        v-if="hotelHint || hotelHintLoading || hotelHintError"
        :hint="hotelHint"
        :loading="hotelHintLoading"
        :error="hotelHintError"
        @apply="applyHotelHint"
        @close="hotelHint = null; hotelHintError = ''"
      />
      <PriceHintBox
        v-if="skipassHint || skipassHintLoading || skipassHintError"
        :hint="skipassHint"
        :loading="skipassHintLoading"
        :error="skipassHintError"
        @apply="applySkipassHint"
        @close="skipassHint = null; skipassHintError = ''"
      />

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
    </div>

    <div class="stay-totals">
      <div class="stay-total">
        <span>Проживание · {{ formatMoney(stayTotal / pax, currency) }}/чел.<template v-if="sourceLabel"> · {{ sourceLabel }}</template></span>
        <strong>{{ formatMoney(stayTotal, currency) }}</strong>
      </div>
      <p v-if="capacityWarning" class="node-meta muted">Мест в номерах меньше, чем гостей</p>
      <div class="stay-total">
        <span>Питание · {{ formatMoney(dailyFood, currency) }}/чел.</span>
        <strong>{{ formatMoney(foodTotal, currency) }}</strong>
      </div>
    </div>

    <div class="node-fold">
      <button type="button" class="node-fold-head" @click="mealsOpen = !mealsOpen">
        <span>Завтрак, обед и ужин</span>
        <b>{{ mealsSummary }}</b>
        <i>{{ mealsOpen ? '−' : '+' }}</i>
      </button>
      <div v-if="mealsOpen" class="node-fold-body">
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
      </div>
    </div>

    <div v-if="nearest.length" class="node-fold nearby-fold">
      <button type="button" class="node-fold-head" @click="nearbyOpen = !nearbyOpen">
        <span>{{ isCity ? 'Аэропорты рядом с городом' : 'Ближайшие аэропорты' }}</span>
        <b>{{ nearestSummary }}</b>
        <i>{{ nearbyOpen ? '−' : '+' }}</i>
      </button>
      <div v-if="nearbyOpen" class="node-fold-body">
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
    </div>

    <div v-if="adminSettings.activitiesEnabled" class="activities">
      <div class="activities-head">
        <button type="button" class="activities-toggle" @click="activitiesOpen = !activitiesOpen">
          <span>Мероприятия</span>
          <b>{{ activities.length }}</b>
        </button>
        <div class="activities-head-actions">
          <button type="button" class="node-expand activity-ai" title="Идеи мероприятий" @click="activityIdeasOpen = true">AI</button>
          <button type="button" class="node-expand" title="Добавить мероприятие" @click="addActivity()">+</button>
        </div>
      </div>
      <div v-if="activitiesOpen" class="activities-body">
        <div class="activity-presets">
          <button
            v-for="preset in activityPresets"
            :key="preset.kind"
            type="button"
            :class="{ 'activity-preset-custom': preset.kind === 'custom' }"
            @click="addPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
        <div v-if="!activities.length" class="node-meta muted">Своё, спа, экскурсия или концерт</div>
        <div
          v-for="item in activities"
          :key="item.id"
          class="activity-item"
          :class="{ booked: item.booked }"
        >
          <div class="activity-head-row">
            <select
              class="text-input activity-kind"
              :value="item.kind ?? 'custom'"
              @change="updateActivity(item.id, { kind: ($event.target as HTMLSelectElement).value as ActivityKind })"
            >
              <option v-for="option in activityKindOptions" :key="option" :value="option">
                {{ activityKindLabels[option] }}
              </option>
            </select>
            <button type="button" class="node-remove activity-remove" title="Удалить мероприятие" @click="removeActivity(item.id)">×</button>
          </div>
          <input
            class="text-input activity-title"
            type="text"
            placeholder="Название мероприятия"
            :value="item.title"
            @input="updateActivity(item.id, { title: ($event.target as HTMLInputElement).value })"
          />
          <div class="activity-main-row">
            <input
              class="text-input activity-price"
              type="number"
              min="0"
              :placeholder="symbol + '/чел'"
              :value="item.price || ''"
              @input="updateActivity(item.id, { price: Number(($event.target as HTMLInputElement).value) || 0 })"
            />
            <input
              class="text-input activity-moment"
              type="datetime-local"
              :value="activityMoment(item)"
              @input="setActivityMoment(item.id, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="activity-details">
            <input
              class="text-input activity-place"
              type="text"
              placeholder="Точное место"
              :value="item.placeName ?? ''"
              @input="updateActivity(item.id, { placeName: ($event.target as HTMLInputElement).value || undefined })"
            />
            <input
              class="text-input activity-address"
              type="text"
              placeholder="Адрес"
              :value="item.address ?? ''"
              @input="updateActivity(item.id, { address: ($event.target as HTMLInputElement).value || undefined })"
            />
            <input
              class="text-input activity-duration"
              type="number"
              min="0"
              max="48"
              step="0.5"
              placeholder="Длительность, ч"
              :value="item.durationHours ?? ''"
              @input="updateActivity(item.id, { durationHours: Number(($event.target as HTMLInputElement).value) || undefined })"
            />
            <input
              class="text-input activity-contact"
              type="text"
              placeholder="Контакт поставщика"
              :value="item.contact ?? ''"
              @input="updateActivity(item.id, { contact: ($event.target as HTMLInputElement).value || undefined })"
            />
          </div>
          <div class="activity-extra">
            <label class="activity-booked">
              <input
                type="checkbox"
                :checked="item.booked === true"
                @change="updateActivity(item.id, { booked: ($event.target as HTMLInputElement).checked })"
              />
              <span>{{ item.booked ? 'Забронировано' : 'Не забронировано' }}</span>
            </label>
            <input
              class="text-input activity-url"
              type="url"
              placeholder="Ссылка на поставщика"
              :value="item.url ?? ''"
              @input="updateActivity(item.id, { url: ($event.target as HTMLInputElement).value || undefined })"
            />
            <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="activity-link">↗</a>
            <a v-if="activityMap(item)" :href="activityMap(item) ?? '#'" target="_blank" rel="noopener" class="activity-link" title="На карте">⌖</a>
          </div>
          <div v-if="item.placeName || item.title" class="activity-links">
            <span class="activity-partner-note">партнёрские ссылки</span>
            <a
              v-for="link in activityLinks(item).slice(0, 3)"
              :key="link.id"
              :href="link.href"
              target="_blank"
              rel="noopener sponsored"
              class="activity-partner"
            >
              {{ link.label }}
            </a>
          </div>
        </div>
        <p v-if="activities.length" class="activity-total">
          Развлечения · {{ formatMoney(activitiesTotal, currency) }}
        </p>
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
      <HotelPickerModal
        :stop="stop"
        :open="hotelPickerOpen"
        :currency="currency"
        :pax="pax"
        @close="hotelPickerOpen = false"
        @select="applyHotel"
      />
      <ActivityIdeasModal
        :stop="stop"
        :open="activityIdeasOpen"
        @close="activityIdeasOpen = false"
        @add="addIdea"
      />
    </Teleport>
  </div>
</template>