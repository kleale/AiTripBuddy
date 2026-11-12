<script setup lang="ts">
import { computed } from 'vue'
import type { Currency } from '@/types'
import { costs, createTrip, loadExample, patchMeta, resetTrip, trip } from '@/stores/trip'
import { currencyLabels, formatMoney } from '@/lib/format'
import GraphCanvas from '@/components/GraphCanvas.vue'
import MapView from '@/components/MapView.vue'
import SummaryCard from '@/components/SummaryCard.vue'
import LinkEditor from '@/components/LinkEditor.vue'

const currencies: Currency[] = ['RUB', 'EUR', 'USD', 'GEL', 'KZT']

const total = computed(() => costs.value?.total ?? 0)
const hasTrip = computed(() => trip.value !== null)

function onName(event: Event): void {
  patchMeta({ name: (event.target as HTMLInputElement).value })
}

function onBudget(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  patchMeta({ budget: raw === '' ? null : Number(raw) })
}

function onCurrency(event: Event): void {
  patchMeta({ currency: (event.target as HTMLSelectElement).value as Currency })
}

function changePax(delta: number): void {
  patchMeta({ pax: (trip.value?.pax ?? 1) + delta })
}

function onReset(): void {
  if (window.confirm('Удалить текущую поездку?')) resetTrip()
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">ATD</div>
        <div class="brand-text">
          <div class="brand-title">AiTripDesision</div>
          <div class="brand-sub">MVP 0 · конструктор поездки</div>
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
            <option v-for="currency in currencies" :key="currency" :value="currency">
              {{ currencyLabels[currency] }}
            </option>
          </select>
        </div>

        <div class="top-total">
          <span>Итого</span>
          <strong>{{ formatMoney(total, trip?.currency ?? 'RUB') }}</strong>
        </div>

        <button type="button" class="ghost-btn" @click="onReset">Сброс</button>
      </template>

      <div v-else class="top-empty">Поездка ещё не создана</div>
    </header>

    <div class="workspace">
      <div class="main-col">
        <section class="graph-section">
          <GraphCanvas v-if="hasTrip" />

          <div v-else class="empty-state">
            <div class="empty-card">
              <span class="empty-kicker">MVP 0 · ручной режим</span>
              <h1>Соберите поездку как маршрут</h1>
              <p>
                Город вылета → аэропорт прилёта → трансфер → отель и курорт. На каждом шаге вы вводите
                цену, а сервис сразу считает полную стоимость, время в дороге и цену дня катания.
              </p>
              <div class="empty-actions">
                <button type="button" class="primary-btn" @click="createTrip">Создать поездку</button>
                <button type="button" class="ghost-btn" @click="loadExample">Загрузить пример</button>
              </div>
              <ul class="empty-hints">
                <li>Добавляйте второй отель — появится переезд между курортами</li>
                <li>Клик по цене на линии открывает редактор участка</li>
                <li>Маршрут и смета сохраняются в браузере</li>
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
  </div>
</template>
