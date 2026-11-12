<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Currency } from '@/types'
import {
  changeCurrency,
  costs,
  createTrip,
  loadExample,
  patchMeta,
  resetTrip,
  trip,
} from '@/stores/trip'
import { saveCurrentTrip, savedTrips } from '@/stores/trips'
import { currencyLabels, formatMoney } from '@/lib/format'
import GraphCanvas from '@/components/GraphCanvas.vue'
import SummaryCard from '@/components/SummaryCard.vue'
import LinkEditor from '@/components/LinkEditor.vue'
import TripsModal from '@/components/TripsModal.vue'
import MapSkeleton from '@/components/MapSkeleton.vue'

const MapView = defineAsyncComponent({
  loader: () => import('@/components/MapView.vue'),
  loadingComponent: MapSkeleton,
  delay: 120,
})

const total = computed(() => costs.value?.total ?? 0)
const hasTrip = computed(() => trip.value !== null)
const tripsOpen = ref(false)
const savedFlash = ref(false)
let flashTimer: number | null = null

function onName(event: Event): void {
  patchMeta({ name: (event.target as HTMLInputElement).value })
}

function onBudget(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  patchMeta({ budget: raw === '' ? null : Number(raw) })
}

function onCurrency(event: Event): void {
  changeCurrency((event.target as HTMLSelectElement).value as Currency)
}

function changePax(delta: number): void {
  patchMeta({ pax: (trip.value?.pax ?? 1) + delta })
}

function onReset(): void {
  if (window.confirm('Удалить текущую поездку?')) resetTrip()
}

function onSave(): void {
  if (!saveCurrentTrip()) return
  savedFlash.value = true
  if (flashTimer) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    savedFlash.value = false
  }, 1800)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">ATB</div>
        <div class="brand-text">
          <div class="brand-title">AiTripBuddy</div>
          <div class="brand-sub">MVP 1 · конструктор поездки</div>
        </div>
      </div>

      <template v-if="hasTrip">
        <input
          class="trip-name"
          type="text"
          placeholder="Название поездки"
          :value="trip?.name"
          @input="onName"
        />

        <div class="top-controls">
          <div class="stepper">
            <button type="button" aria-label="Меньше человек" @click="changePax(-1)">−</button>
            <span>{{ trip?.pax ?? 1 }} чел.</span>
            <button type="button" aria-label="Больше человек" @click="changePax(1)">+</button>
          </div>

          <label class="budget-field">
            <span>Бюджет</span>
            <input type="number" min="0" placeholder="—" :value="trip?.budget ?? ''" @input="onBudget" />
          </label>

          <select class="currency-select" :value="trip?.currency" @change="onCurrency">
            <option v-for="(label, code) in currencyLabels" :key="code" :value="code">
              {{ label }}
            </option>
          </select>
        </div>
      </template>

      <div v-if="hasTrip" class="top-total">
        <span>Итого</span>
        <strong>{{ formatMoney(total, trip?.currency ?? 'RUB') }}</strong>
      </div>

      <div class="top-actions">
        <button v-if="hasTrip" type="button" class="ghost-btn" :class="{ saved: savedFlash }" @click="onSave">
          {{ savedFlash ? 'Сохранено' : 'Сохранить' }}
        </button>
        <button type="button" class="ghost-btn" @click="tripsOpen = true">
          Поездки<template v-if="savedTrips.length"> ({{ savedTrips.length }})</template>
        </button>
        <button v-if="hasTrip" type="button" class="ghost-btn" @click="onReset">Сброс</button>
      </div>
    </header>

    <div class="workspace">
      <div class="main-col">
        <section class="graph-section">
          <GraphCanvas v-if="hasTrip" />

          <div v-else class="empty-state">
            <div class="empty-card">
              <span class="empty-kicker">MVP 1 · ручной режим</span>
              <h1>Соберите поездку как маршрут</h1>
              <p>
                Город вылета → аэропорт прилёта → трансфер → отель и курорт. На каждом шаге вы вводите
                цену, а сервис сразу считает полную стоимость, время в дороге и цену дня катания.
              </p>
              <div class="empty-actions">
                <button type="button" class="primary-btn" @click="createTrip">Создать поездку</button>
                <button type="button" class="ghost-btn" @click="loadExample">Загрузить пример</button>
                <button v-if="savedTrips.length" type="button" class="ghost-btn" @click="tripsOpen = true">
                  Мои поездки ({{ savedTrips.length }})
                </button>
              </div>
              <ul class="empty-hints">
                <li>Курорты подбираются по стране аэропорта прилёта и расстоянию до него</li>
                <li>Питание настраивается отдельно: завтрак, обед и ужин</li>
                <li>Поездки сохраняются в браузере и открываются из библиотеки</li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="hasTrip" class="map-section">
          <MapView />
        </section>
      </div>

      <aside v-if="hasTrip" class="sidebar">
        <SummaryCard />
      </aside>
    </div>

    <LinkEditor />
    <TripsModal :open="tripsOpen" @close="tripsOpen = false" />
  </div>
</template>