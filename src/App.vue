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
import { importTrips, loadSavedTrip, saveCurrentTrip, savedTrips } from '@/stores/trips'
import { currencyLabels, formatMoney } from '@/lib/format'
import { decodeTrips, shareCodeFromLocation } from '@/lib/share'
import { loadShortTrips, shortTripIdFromLocation } from '@/lib/short-links'
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
import AccountModal from '@/components/AccountModal.vue'
import AdminModal from '@/components/AdminModal.vue'
import { openAiSettings } from '@/lib/ai/settings'
import { isAdmin, openAccount, signedIn, verifyAuthFromLocation } from '@/lib/account'
import { adminSettings, openAdmin } from '@/lib/admin'
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
const DECK_VIEW_KEY = 'atb.deck.collapsed'

function readDeckCollapsed(): { timeline: boolean; map: boolean } {
  try {
    const raw = localStorage.getItem(DECK_VIEW_KEY)
    if (!raw) return { timeline: false, map: false }
    const parsed = JSON.parse(raw) as { timeline?: boolean; map?: boolean }
    return { timeline: parsed.timeline === true, map: parsed.map === true }
  } catch {
    return { timeline: false, map: false }
  }
}

const deckCollapsed = ref(readDeckCollapsed())

function toggleDeck(pane: 'timeline' | 'map'): void {
  deckCollapsed.value = { ...deckCollapsed.value, [pane]: !deckCollapsed.value[pane] }
  try {
    localStorage.setItem(DECK_VIEW_KEY, JSON.stringify(deckCollapsed.value))
  } catch {
    // ignore
  }
}
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
const summaryOpen = ref(false)
const appVersion = __APP_VERSION__
const buildDate = __BUILD_DATE__

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

async function importShortLink(): Promise<void> {
  const id = shortTripIdFromLocation()
  if (!id) return
  const decoded = await loadShortTrips(id)
  if (!decoded || decoded.length === 0) {
    shareNotice.value = 'Короткая ссылка повреждена или устарела'
    return
  }
  const added = importTrips(decoded)
  shareNotice.value = added
    ? `Импортировано поездок: ${added}`
    : 'Поездка из короткой ссылки уже в библиотеке'
  if (decoded[0]) loadSavedTrip(decoded[0].id)
}

onMounted(() => {
  loadPresetFromUrl()
  void importShortLink()
  void importFromUrl()
  void verifyAuthFromLocation()
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
  void importShortLink()
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
          <button type="button" class="ghost-btn" @click="openAccount">
            {{ signedIn ? 'Аккаунт' : 'Войти' }}
          </button>
          <button v-if="isAdmin" type="button" class="ghost-btn" @click="openAdmin">Админ</button>
          <button type="button" class="ghost-btn" @click="openAiSettings">AI</button>
          <button
            type="button"
            class="ghost-btn theme-toggle"
            :title="theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'"
            :aria-label="theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'"
            @click="toggleTheme"
          >
            <svg v-if="theme === 'dark'" class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
            <svg v-else class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
            </svg>
          </button>
          <button v-if="hasTrip" type="button" class="ghost-btn" @click="resetAndClose">Сброс</button>
        </div>
      </div>
    </header>

    <div v-if="menuOpen" class="header-scrim" @click="menuOpen = false" />

    <div v-if="adminSettings.maintenance || adminSettings.announcement" class="app-banner">
      <b v-if="adminSettings.maintenance">Технические работы</b>
      <span>{{ adminSettings.announcement || 'Часть функций может работать нестабильно.' }}</span>
    </div>

    <div class="workspace">
      <div class="main-col">
        <section class="graph-section">
          <GraphCanvas v-if="hasTrip" />

          <div v-else class="empty-state">
            <div class="empty-card">
              <span class="empty-kicker">Для сноубордистов и лыжников</span>
              <h1>Горы начинаются здесь</h1>
              <p>
                AiTripBuddy — это штаб поездки: от билета и трансфера до отеля, скипасса и подъёмника.
                Соберите маршрут, сравните курорты, подберите снаряжение и увидите полную стоимость до первого спуска.
                Без таблиц, хаоса в чатах и сюрпризов в бюджете.
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
              <ol class="empty-steps">
                <li><b>1</b><span>Выберите курорт и гиды</span></li>
                <li><b>2</b><span>Соберите маршрут и отели</span></li>
                <li><b>3</b><span>Проверьте даты и смету</span></li>
              </ol>
              <div class="empty-features">
                <article class="empty-feature">
                  <b>Гиды и 3D-карты</b>
                  <span>15 курортов, трассы, подъёмники, парки и фрирайд-зоны на реальном рельефе.</span>
                  <em class="feature-tag done">готово</em>
                </article>
                <article class="empty-feature">
                  <b>Снег и погода</b>
                  <span>Прогноз на неделю по базе, середине и вершине, снег в сантиметрах.</span>
                  <em class="feature-tag done">готово</em>
                </article>
                <article class="empty-feature">
                  <b>Подготовка</b>
                  <span>Стиль в процентах, доска/лыжи, прогибы, стойка, ботинки и чек-лист.</span>
                  <em class="feature-tag done">готово</em>
                </article>
                <article class="empty-feature">
                  <b>Смета и календарь</b>
                  <span>Цена на человека, даты, гант, сравнение поездок и общий бюджет.</span>
                  <em class="feature-tag done">готово</em>
                </article>
                <article class="empty-feature">
                  <b>AI-подсказки цен</b>
                  <span>Диапазон цены отеля, билета и скипасса с источником и датой.</span>
                  <em class="feature-tag done">готово</em>
                </article>
                <article class="empty-feature">
                  <b>Короткие ссылки</b>
                  <span>Карточка поездки с маршрутом, ценой и календарём для Telegram и Threads.</span>
                  <em class="feature-tag done">готово</em>
                </article>
              </div>

              <div class="empty-future">
                <span class="empty-future-title">Что уже в разработке</span>
                <div class="empty-future-list">
                  <span>Группы и свободные места <em class="feature-tag progress">in progress</em></span>
                  <span>Telegram-бот и напоминания <em class="feature-tag progress">in progress</em></span>
                  <span>Вход по ссылке из почты и облако <em class="feature-tag progress">in progress</em></span>
                  <span>Партнёрские скидки на отели и снаряжение <em class="feature-tag progress">in progress</em></span>
                  <span>Подбор отеля с расстоянием до подъёмника <em class="feature-tag progress">in progress</em></span>
                  <span>AI-аудит поездки на DeepSeek <em class="feature-tag progress">in progress</em></span>
                  <span>Отзывы, фото и проверенные гиды <em class="feature-tag progress">in progress</em></span>
                  <span>Реальные API цен и история <em class="feature-tag progress">in progress</em></span>
                </div>
              </div>

              <p class="app-version">v{{ appVersion }} · {{ buildDate }}</p>
            </div>
          </div>
        </section>

        <section
          v-if="hasTrip"
          class="bottom-deck"
          :class="{
            'timeline-collapsed': deckCollapsed.timeline,
            'map-collapsed': deckCollapsed.map,
          }"
          :style="{ height: deckCollapsed.timeline && deckCollapsed.map ? '48px' : deckHeight + 'px' }"
        >
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
          <div class="deck-pane deck-timeline" :class="{ 'is-collapsed': deckCollapsed.timeline }">
            <button
              v-if="!deckCollapsed.timeline"
              type="button"
              class="deck-collapse"
              title="Свернуть календарь"
              aria-label="Свернуть календарь"
              @click="toggleDeck('timeline')"
            >
              −
            </button>
            <TripTimeline v-if="!deckCollapsed.timeline" />
            <button
              v-else
              type="button"
              class="deck-rail"
              title="Развернуть календарь"
              aria-label="Развернуть календарь"
              @click="toggleDeck('timeline')"
            >
              <span>Календарь</span>
              <b>+</b>
            </button>
          </div>
          <div class="deck-pane deck-map" :class="{ 'is-collapsed': deckCollapsed.map }">
            <MapView v-if="!deckCollapsed.map" />
            <button
              v-if="!deckCollapsed.map"
              type="button"
              class="deck-collapse"
              title="Свернуть карту"
              aria-label="Свернуть карту"
              @click="toggleDeck('map')"
            >
              −
            </button>
            <button
              v-else
              type="button"
              class="deck-rail"
              title="Развернуть карту"
              aria-label="Развернуть карту"
              @click="toggleDeck('map')"
            >
              <span>Карта</span>
              <b>+</b>
            </button>
          </div>
        </section>
      </div>

      <aside v-if="hasTrip" class="sidebar" :class="{ open: summaryOpen }">
        <button type="button" class="summary-close" aria-label="Закрыть смету" @click="summaryOpen = false">×</button>
        <SummaryCard />
        <div class="sidebar-actions">
          <button type="button" class="ghost-btn" @click="openCatalog">Курорты</button>
          <button type="button" class="ghost-btn" @click="openTrips">
            Поездки<template v-if="savedTrips.length"> ({{ savedTrips.length }})</template>
          </button>
          <button type="button" class="ghost-btn" @click="statsOpen = true">Статистика</button>
        </div>
        <p class="app-version">v{{ appVersion }} · {{ buildDate }}</p>
      </aside>
      <button v-if="hasTrip" type="button" class="summary-fab" @click="summaryOpen = true">Смета</button>
    </div>

    <LinkEditor />
    <TripsModal :open="tripsOpen" @close="tripsOpen = false" @compare="onCompare" />
    <ResortCatalog :open="catalogOpen" @close="catalogOpen = false" />
    <CompareModal :open="compareOpen" :trips="compareTrips" @close="compareOpen = false" />
    <PrepModal />
    <AiSettingsModal />
    <StatsModal :open="statsOpen" @close="statsOpen = false" />
    <AccountModal />
    <AdminModal />

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