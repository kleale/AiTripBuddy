<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Currency, StayStop } from '@/types'
import { findResort } from '@/data/resorts'
import { hotelsFor, hotelOfferCoords, type HotelOffer } from '@/data/hotels'
import {
  defaultHotelFilters,
  filterHotelOffers,
  hotelNightly,
  hotelPerPerson,
  hotelStayTotal,
  isSkiIn,
  liftWalkLabel,
  type HotelFilters,
} from '@/lib/hotel-search'
import {
  cheapestNearby,
  nearbyDates,
  seasonCalendar,
  seasonLabels,
  seasonRange,
  seasonShortLabels,
} from '@/lib/season'
import { formatMoney } from '@/lib/format'
import { formatDistance } from '@/lib/geo'

const props = defineProps<{
  stop: StayStop
  open: boolean
  currency: Currency
  pax: number
}>()

const emit = defineEmits<{
  close: []
  select: [payload: { offer: HotelOffer; nightly: number; lat: number; lng: number }]
}>()

const filters = ref<HotelFilters>({ ...defaultHotelFilters })
const sort = ref<'distance' | 'price' | 'rating'>('distance')

const resort = computed(() => findResort(props.stop.resortId))
const offers = computed(() => (props.stop.resortId ? hotelsFor(props.stop.resortId) : []))
const season = computed(() =>
  resort.value ? seasonRange(props.stop.checkIn, props.stop.nights, resort.value) : null,
)
const factor = computed(() => season.value?.factor ?? 1)
const calendar = computed(() => (resort.value ? seasonCalendar(resort.value) : []))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    filters.value = {
      ...defaultHotelFilters,
      guests: Math.max(1, props.pax),
      minStars: props.stop.hotelStars || 0,
    }
    sort.value = 'distance'
  },
)

const visibleOffers = computed(() =>
  filterHotelOffers(offers.value, filters.value, props.currency, factor.value),
)

const sortedOffers = computed(() => {
  const list = [...visibleOffers.value]
  if (sort.value === 'price') {
    return list.sort((a, b) => hotelNightly(a, props.currency, factor.value) - hotelNightly(b, props.currency, factor.value))
  }
  if (sort.value === 'rating') {
    return list.sort((a, b) => b.rating - a.rating || a.liftKm - b.liftKm)
  }
  return list.sort((a, b) => a.liftKm - b.liftKm || b.rating - a.rating)
})

const nights = computed(() => Math.max(1, props.stop.nights))
const rooms = computed(() => Math.max(1, props.stop.rooms))
const basePrice = computed(() => {
  const current = offers.value[0]
  if (!current) return 0
  return hotelNightly(current, props.currency, 1)
})
const alternatives = computed(() => {
  if (!resort.value) return []
  return nearbyDates(props.stop.checkIn, nights.value, resort.value, basePrice.value)
})
const cheaper = computed(() => cheapestNearby(alternatives.value))
const seasonLegend = ['peak', 'high', 'mid', 'low'] as const

const maxPriceValue = computed({
  get: () => filters.value.maxPrice ?? '',
  set: (value: string | number) => {
    const number = Number(value)
    filters.value.maxPrice = Number.isFinite(number) && number > 0 ? number : null
  },
})

const maxDistanceValue = computed({
  get: () => filters.value.maxDistanceKm ?? '',
  set: (value: string | number) => {
    filters.value.maxDistanceKm = Number(value) || null
  },
})

function priceFor(offer: HotelOffer): number {
  return hotelNightly(offer, props.currency, factor.value)
}

function totalFor(offer: HotelOffer): number {
  return hotelStayTotal(offer, props.currency, nights.value, rooms.value, factor.value)
}

function perPersonFor(offer: HotelOffer): number {
  return hotelPerPerson(
    offer,
    props.currency,
    nights.value,
    rooms.value,
    Math.max(1, props.pax),
    factor.value,
  )
}

function choose(offer: HotelOffer): void {
  const coords = hotelOfferCoords(offer)
  if (!coords) return
  emit('select', {
    offer,
    nightly: priceFor(offer),
    lat: coords.lat,
    lng: coords.lng,
  })
}

function seasonFactorLabel(value: number): string {
  if (!value) return '—'
  const percent = Math.round((value - 1) * 100)
  if (percent === 0) return 'базовая'
  return percent > 0 ? `+${percent}%` : `${percent}%`
}

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal hotel-picker" role="dialog" aria-modal="true" aria-label="Подбор отеля">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Подбор отеля</div>
          <h3>{{ stop.resort || stop.city || 'Курорт' }} · {{ nights }} ноч.</h3>
          <p class="modal-note">
            Цены — ориентиры среднего сезона, не оффер партнёра. Проверяйте на сайте перед бронированием.
          </p>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
      </div>

      <div v-if="!offers.length" class="hotel-empty">
        <b>Каталог для этого места пока не собран</b>
        <p class="modal-note">
          Выберите отель вручную в узле или откройте партнёрские ссылки Booking, Trip.com, Ozon и Яндекс.
        </p>
      </div>

      <template v-else>
        <div class="hotel-season">
          <div class="hotel-season-head">
            <span>Сезон поездки</span>
            <b :class="'season-' + (season?.level ?? 'mid')">
              {{ seasonLabels[season?.level ?? 'mid'] }} · {{ seasonFactorLabel(season?.factor ?? 1) }}
            </b>
          </div>
          <div class="season-months">
            <div
              v-for="month in calendar"
              :key="month.month"
              class="season-month"
              :class="['level-' + month.level, { current: month.month === Number((stop.checkIn ?? '').slice(5, 7)) }]"
              :title="seasonLabels[month.level]"
            >
              <span>{{ month.label }}</span>
              <i />
            </div>
          </div>
          <p v-if="cheaper" class="season-advice">
            Дешевле на {{ shortDate(cheaper.date) }}: ориентир
            <b>{{ cheaper.deltaTotal < 0 ? '−' : '+' }}{{ formatMoney(Math.abs(cheaper.deltaTotal), currency) }}</b>
            за {{ nights }} ноч. по текущему сезонному коэффициенту.
          </p>
          <p v-else class="season-advice muted">
            Сдвиг ±3–7 дней не даёт заметной разницы по сезону.
          </p>
        </div>

        <div class="hotel-filters">
          <label class="select-field">
            <span>До подъёмника</span>
            <select v-model="maxDistanceValue">
              <option value="">любое</option>
              <option value="0.5">до 500 м</option>
              <option value="1">до 1 км</option>
              <option value="3">до 3 км</option>
            </select>
          </label>
          <label class="select-field">
            <span>Цена до, за ночь</span>
            <input v-model="maxPriceValue" class="text-input" type="number" min="0" placeholder="без лимита" />
          </label>
          <label class="select-field">
            <span>Звёзды</span>
            <select v-model.number="filters.minStars">
              <option :value="0">любые</option>
              <option v-for="star in [3, 4, 5]" :key="star" :value="star">{{ star }}+</option>
            </select>
          </label>
          <label class="select-field">
            <span>Гостей</span>
            <input v-model.number="filters.guests" class="text-input" type="number" min="1" max="8" />
          </label>
          <label class="prep-check hotel-ski">
            <input v-model="filters.skiInOnly" type="checkbox" />
            <span><b>Только ski-in/ski-out</b><small>до 400 м до станции</small></span>
          </label>
          <label class="select-field">
            <span>Сортировка</span>
            <select v-model="sort">
              <option value="distance">ближе к подъёмнику</option>
              <option value="price">дешевле</option>
              <option value="rating">выше рейтинг</option>
            </select>
          </label>
        </div>

        <div class="hotel-results">
          <article v-for="offer in sortedOffers" :key="offer.id" class="hotel-card">
            <div class="hotel-card-head">
              <div>
                <b>{{ offer.name }}</b>
                <span class="hotel-stars">{{ '★'.repeat(offer.stars) }}</span>
                <span v-if="offer.rating" class="hotel-rating">{{ offer.rating.toFixed(1) }}</span>
              </div>
              <span v-if="isSkiIn(offer)" class="hotel-ski-badge">ski-in</span>
            </div>
            <div class="hotel-card-meta">
              <span>{{ formatDistance(offer.liftKm) }} до станции</span>
              <span>{{ liftWalkLabel(offer.liftKm) }}</span>
              <span>до {{ offer.maxGuests }} гостей</span>
              <span v-if="offer.note">{{ offer.note }}</span>
            </div>
            <div class="hotel-card-foot">
              <div class="hotel-price">
                <b>{{ formatMoney(priceFor(offer), currency) }}</b>
                <span>за номер / ночь</span>
                <em>{{ formatMoney(totalFor(offer), currency) }} за {{ nights }} ноч. · {{ formatMoney(perPersonFor(offer), currency) }}/чел.</em>
              </div>
              <button type="button" class="primary-btn" @click="choose(offer)">Выбрать</button>
            </div>
          </article>
          <p v-if="!sortedOffers.length" class="modal-note hotel-no-results">
            Под фильтры ничего не подошло — ослабьте цену, звёзды или расстояние.
          </p>
        </div>

        <div class="hotel-legend">
          <span v-for="level in seasonLegend" :key="level" class="legend-season">
            <i :class="'level-' + level" />{{ seasonShortLabels[level] }}
          </span>
          <span>сезонный коэффициент — ориентир, не гарантия цены</span>
        </div>
      </template>
    </div>
  </div>
</template>
