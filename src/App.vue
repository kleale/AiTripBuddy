<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Currency, Trip } from '@/types'
import {
  changeCurrency,
  costs,
  createTrip,
  enablePrep,
  loadExample,
  loadPreset,
  openPrepEditor,
  patchMeta,
  resetTrip,
  trip,
} from '@/stores/trip'
import { importTrips, saveCurrentTrip, savedTrips } from '@/stores/trips'
import { currencyLabels, formatMoney } from '@/lib/format'
import { decodeTrips, shareCodeFromLocation } from '@/lib/share'
import { presetList } from '@/data/presets'
import GraphCanvas from '@/components/GraphCanvas.vue'
import TripTimeline from '@/components/TripTimeline.vue'
import SummaryCard from '@/components/SummaryCard.vue'
import LinkEditor from '@/components/LinkEditor.vue'
import TripsModal from '@/components/TripsModal.vue'
import ResortCatalog from '@/components/ResortCatalog.vue'
import CompareModal from '@/components/CompareModal.vue'
import PrepModal from '@/components/PrepModal.vue'
import AiSettingsModal from '@/components/AiSettingsModal.vue'
import StatsModal from '@/components/StatsModal.vue'
import { openAiSettings } from '@/lib/ai/settings'
import { recordVisit } from '@/lib/stats'
import { theme, toggleTheme } from '@/lib/theme'
import MapSkeleton from '@/components/MapSkeleton.vue'

const MapView = defineAsyncComponent({
  loader: () => import('@/components/MapView.vue'),
  loadingComponent: MapSkeleton,
  delay: 120,
})

const total = computed(() => costs.value?.total ?? 0)
const hasTrip = computed(() => trip.value !== null)
const tripsOpen = ref(false)

/* ---------- высота нижнего блока ---------- */

const DECK_MIN = 160
const DECK_MAX = 620
const DECK_KEY = 'atb.deck.height'

function readDeckHeight(): number {
  try {
    const saved = Number(localStorage.getItem(DECK_KEY))
    if (Number.isFinite(saved) && saved >= DECK_MIN) return Math.min(DECK_MAX, saved)
  } catch {
    // localStorage может быть недоступен
  }
  return 300
}

const deckHeight = ref(readDeckHeight())
let resizeStartY = 0
let resizeStartHeight = 0

function clampDeck(value: number): number {
  const maxByViewport = Math.max(DECK_MIN, Math.round(window.innerHeight * 0.6))
  return Math.min(Math.min(DECK_MAX, maxByViewport), Math.max(DECK_MIN, Math.round(value)))
}

function onResizeMove(event: PointerEvent): void {
  deckHeight.value = clampDeck(resizeStartHeight - (event.clientY - resizeStartY))
}

function stopResize(): void {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  try {
    localStorage.setItem(DECK_KEY, String(deckHeight.value))
  } catch {
    // игнорируем
  }
}

function startResize(event: PointerEvent): void {
  event.preventDefault()
  resizeStartY = event.clientY
  resizeStartHeight = deckHeight.value
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
}

function onResizerKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 60 : 20
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    deckHeight.value = clampDeck(deckHeight.value + step)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    deckHeight.value = clampDeck(deckHeight.value - step)
  } else {
    return
  }
  try {
    localStorage.setItem(DECK_KEY, String(deckHeight.value))
  } catch {
    // игнорируем
  }
}
const catalogOpen = ref(false)
const compareOpen = ref(false)
const compareTrips = ref<Trip[]>([])
const savedFlash = ref(false)
/** мобильное меню шапки */
const menuOpen = ref(false)
const statsOpen = ref(false)

function openCatalog(): void {
  menuOpen.value = false
  catalogOpen.value = true
}

function openPrep(): void {
  enablePrep()
  openPrepEditor()
  menuOpen.value = false
}

function openTrips(): void {
  menuOpen.value = false
  tripsOpen.value = true
}

function saveAndClose(): void {
  onSave()
  menuOpen.value = false
}

function resetAndClose(): void {
  onReset()
  menuOpen.value = false
}

function onHeaderKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') menuOpen.value = false
}
const shareNotice = ref('')
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

function onCompare(trips: Trip[]): void {
  if (trips.length < 2) return
  compareTrips.value = trips
  compareOpen.value = true
}

function presetFromLocation(): string | null {
  const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('route')
  if (hash) return hash
  return new URLSearchParams(location.search).get('route')
}

/** Загрузка готового маршрута: #route=led-hakuba */
function loadPresetFromUrl(): void {
  const id = presetFromLocation()
  if (!id) return
  if (loadPreset(id)) {
    const preset = presetList.find((item) => item.id === id)
    shareNotice.value = preset ? `Загружен маршрут: ${preset.title}` : 'Маршрут загружен'
  }
}

/** Импорт набора поездок из ссылки: #trips=… */
async function importFromUrl(): Promise<void> {
  const code = shareCodeFromLocation()
  if (!code) return
  const decoded = await decodeTrips(code)
  if (!decoded || decoded.length === 0) {
    shareNotice.value = 'Ссылка повреждена или устарела'
    return
  }
  const added = importTrips(decoded)
  shareNotice.value = added
    ? `Импортировано поездок: ${added}`
    : `Набор из ссылки уже в библиотеке (${decoded.length})`
  tripsOpen.value = true
}

onMounted(() => {
  loadPresetFromUrl()
  void importFromUrl()
  recordVisit()
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('keydown', onHeaderKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('keydown', onHeaderKey)
})

function onHashChange(): void {
  loadPresetFromUrl()
  void importFromUrl()
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">ATB</div>
        <div class="brand-text">
          <div class="brand-title">AiTripBuddy</div>
          <div class="brand-sub">MVP 2 · конструктор поездки</div>
        </div>
      </div>

      <div v-if="hasTrip" class="top-total compact-total">
        <span>Итого</span>
        <strong>{{ formatMoney(total, trip?.currency ?? 'RUB') }}</strong>
      </div>

      <button
        type="button"
        class="menu-toggle"
        :class="{ open: menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="header-menu"
        :aria-label="menuOpen ? 'Закрыть меню' : 'Открыть меню'"
        @click="menuOpen = !menuOpen"
      >
        <span />
        <span />
        <span />
      </button>

      <div id="header-menu" class="header-menu" :class="{ open: menuOpen }">
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

          <div class="top-total">
            <span>Итого</span>
            <strong>{{ formatMoney(total, trip?.currency ?? 'RUB') }}</strong>
          </div>
        </template>

        <div class="top-actions">
          <button
            v-if="hasTrip"
            type="button"
            class="ghost-btn"
            :class="{ saved: savedFlash }"
            @click="saveAndClose"
          >
            {{ savedFlash ? 'Сохранено' : 'Сохранить' }}
          </button>
          <button type="button" class="ghost-btn" @click="openPrep">Подготовка</button>
          <button type="button" class="ghost-btn" @click="openAiSettings">AI</button>
          <button type="button" class="ghost-btn" @click="statsOpen = true">Статистика</button>
          <button
            type="button"
            class="ghost-btn theme-toggle"
            :title="theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'"
            @click="toggleTheme"
          >
            {{ theme === 'light' ? 'Тема: светлая' : 'Тема: тёмная' }}
          </button>
          <button type="button" class="ghost-btn" @click="openCatalog">Курорты</button>
          <button type="button" class="ghost-btn" @click="openTrips">
            Поездки<template v-if="savedTrips.length"> ({{ savedTrips.length }})</template>
          </button>
          <button v-if="hasTrip" type="button" class="ghost-btn" @click="resetAndClose">Сброс</button>
        </div>
      </div>
    </header>

    <div v-if="menuOpen" class="header-scrim" @click="menuOpen = false" />

    <div class="workspace">
      <div class="main-col">
        <section class="graph-section">
          <GraphCanvas v-if="hasTrip" />

          <div v-else class="empty-state">
            <div class="empty-card">
              <span class="empty-kicker">MVP 2 · ручной режим</span>
              <h1>Соберите поездку как маршрут</h1>
              <p>
                Город вылета → аэропорт прилёта → трансфер → отель и курорт. У каждого отеля — дата заезда,
                цены и питание, а сервис сразу считает полную стоимость, календарь и цену дня катания.
              </p>
              <div class="empty-actions">
                <button type="button" class="primary-btn" @click="createTrip">Создать поездку</button>
                <button type="button" class="ghost-btn" @click="loadExample">Загрузить пример</button>
                <button
                  v-for="preset in presetList"
                  :key="preset.id"
                  type="button"
                  class="ghost-btn"
                  :title="preset.subtitle"
                  @click="loadPreset(preset.id)"
                >
                  {{ preset.title }}
                </button>
                <button type="button" class="ghost-btn" @click="catalogOpen = true">Курорты и гиды</button>
                <button v-if="savedTrips.length" type="button" class="ghost-btn" @click="tripsOpen = true">
                  Мои поездки ({{ savedTrips.length }})
                </button>
              </div>
              <ul class="empty-hints">
                <li>Гант под графом показывает даты и дни недели</li>
                <li>Поездки сохраняются локально и шарятся ссылкой из библиотеки</li>
                <li>Выберите 2+ поездки — и сравните их в отдельном окне</li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="hasTrip" class="bottom-deck" :style="{ height: deckHeight + 'px' }">
          <div
            class="deck-resizer"
            role="separator"
            aria-orientation="horizontal"
            :aria-valuenow="deckHeight"
            aria-label="Высота календаря и карты"
            tabindex="0"
            @pointerdown="startResize"
            @keydown="onResizerKey"
          />
          <div class="deck-pane deck-timeline">
            <TripTimeline />
          </div>
          <div class="deck-pane deck-map">
            <MapView />
          </div>
        </section>
      </div>

      <aside v-if="hasTrip" class="sidebar">
        <SummaryCard />
      </aside>
    </div>

    <LinkEditor />
    <TripsModal :open="tripsOpen" @close="tripsOpen = false" @compare="onCompare" />
    <ResortCatalog :open="catalogOpen" @close="catalogOpen = false" />
    <CompareModal :open="compareOpen" :trips="compareTrips" @close="compareOpen = false" />
    <PrepModal />
    <AiSettingsModal />
    <StatsModal :open="statsOpen" @close="statsOpen = false" />

    <button
      v-if="shareNotice"
      type="button"
      class="share-toast"
      @click="shareNotice = ''"
    >
      {{ shareNotice }}
    </button>
  </div>
</template>