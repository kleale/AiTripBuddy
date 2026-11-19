<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { guideDifficulty, type ResortGuide, type TrailDifficulty } from '@/data/resort-guides'
import ResortScene3D from '@/components/ResortScene3D.vue'
import WeatherPanel from '@/components/WeatherPanel.vue'
import { formatGuideDayPrice, formatGuidePrice } from '@/lib/guide-format'
import { slopePassport, slopeSummary } from '@/lib/slope'
import type { TrailDataset } from '@/data/trail-maps'
import { trailListFor, type TrailList } from '@/data/trail-lists'
import { freerideFor, type FreerideInfo } from '@/data/freeride'
import { findResort } from '@/data/resorts'
import { seasonCalendar, seasonLabels } from '@/lib/season'
import {
  areaLabels,
  areaColors,
  confidenceHints,
  confidenceLabels,
  hazardColors,
  hazardLabels,
  liftColors,
  liftLabels,
  scheduleLabel,
  snowAgeHours,
  snowColors,
  snowLabels,
  trailColors,
  trailStats,
} from '@/lib/trail-map'

const props = defineProps<{
  guide: ResortGuide
  open: boolean
  hotelName?: string
  hotelPoint?: { lat: number; lng: number } | null
  hotelDistance?: number
  hotelExact?: boolean
  dataset?: TrailDataset | null
  /** даты поездки для прогноза погоды */
  checkIn?: string
  checkOut?: string
}>()

const emit = defineEmits<{ close: [] }>()

const selectedZoneId = ref<string | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const selectedZone = computed(
  () => props.guide.zones.find((zone) => zone.id === selectedZoneId.value) ?? null,
)

const difficulty = computed(() => guideDifficulty(props.guide))
const passport = computed(() => slopePassport(props.guide))
const passportSummary = computed(() => slopeSummary(passport.value))

/** Паспорт можно смотреть по всему курорту или только по выбранной части. */
const passportScope = ref<'resort' | 'zone'>('resort')

/** Метрики выбранной части курорта — из общего паспорта. */
const zonePassport = computed(() => {
  const zoneId = selectedZoneId.value
  if (!zoneId) return null
  return passport.value.zones.find((zone) => zone.zoneId === zoneId) ?? null
})

const zoneName = computed(() => zonePassport.value?.name ?? '')

/** Автопереключение: выбрали часть — показываем её паспорт. */
watch(selectedZoneId, (zoneId) => {
  passportScope.value = zoneId ? 'zone' : 'resort'
})

function setPassportScope(scope: 'resort' | 'zone'): void {
  passportScope.value = scope
}

/** Официальный итог курорта может быть больше, чем описано в зонах гида. */
const officialGap = computed(() => {
  const value = props.guide.totalTrailsKm - passport.value.trailsKm
  return value > 0.5 ? value : null
})

const showOfficial = ref(false)

type GuideTab = 'overview' | 'passes' | 'slopes' | 'freeride' | 'snow'
const activeTab = ref<GuideTab>('overview')

const trailData = computed(() => props.dataset ?? null)
/** Курируемый список трасс для курортов без геометрии на карте. */
const trailList = computed<TrailList | null>(() => trailListFor(props.guide.resortId) ?? null)
const freerideData = computed<FreerideInfo | null>(() => freerideFor(props.guide.resortId) ?? null)
const seasonMonths = computed(() => {
  const resort = findResort(props.guide.resortId)
  return resort ? seasonCalendar(resort) : []
})

const tabs = computed(() => {
  const list: { key: GuideTab; label: string; badge?: string }[] = [
    { key: 'overview', label: 'Обзор' },
    { key: 'passes', label: 'Скипасс', badge: String(props.guide.zones.length) },
  ]

  const trailCount = trailData.value?.trails.length ?? trailList.value?.trails.length ?? 0
  if (trailCount > 0) {
    list.push({ key: 'slopes', label: 'Трассы', badge: String(trailCount) })
  }

  const zones = freerideData.value?.zones.length ?? 0
  if (zones > 0) {
    list.push({ key: 'freeride', label: 'Фрирайд', badge: String(zones) })
  }

  // прогноз Open-Meteo работает по координатам любого гида, не только Хакубы
  if (props.guide.zones.length > 0) {
    list.push({ key: 'snow', label: 'Снег' })
  }

  return list
})

function setTab(key: GuideTab): void {
  activeTab.value = key
}

const layers = ref({ trails: true, lifts: true, areas: true, backcountry: true, snow: false })

const stats = computed(() => (trailData.value ? trailStats(trailData.value) : null))
const schedule = computed(() => {
  if (trailData.value) return scheduleLabel(trailData.value.hours)
  const list = trailList.value
  if (!list) return ''
  const parts = [`дневное ${list.hours.day}`]
  if (list.hours.evening) parts.push(`вечернее ${list.hours.evening}`)
  return parts.join(' · ')
})

/** Трассы курируемого списка: сортировка по сложности, затем по длине. */
const listTrails = computed(() => {
  const list = trailList.value
  if (!list) return []
  const order = ['green', 'blue', 'red', 'black']
  return [...list.trails].sort((a, b) => {
    const diff = order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
    return diff !== 0 ? diff : b.lengthKm - a.lengthKm
  })
})

const listStats = computed(() => {
  const rows = listTrails.value
  if (!rows.length) return null
  const km = Math.round(rows.reduce((sum, row) => sum + row.lengthKm, 0) * 10) / 10
  const byDifficulty = { green: 0, blue: 0, red: 0, black: 0 }
  for (const row of rows) byDifficulty[row.difficulty] += 1
  return { total: rows.length, km, byDifficulty, lit: rows.filter((r) => r.lit).length }
})

/** Подпись зоны для строки списка. */
function zoneLabel(zoneId: string): string {
  return props.guide.zones.find((zone) => zone.id === zoneId)?.name ?? zoneId
}

const visibleTrails = computed(() => {
  const dataset = trailData.value
  if (!dataset) return []
  return dataset.trails
    .filter((trail) => !selectedZoneId.value || trail.zoneId === selectedZoneId.value)
    .sort((a, b) => {
      const order = ['green', 'blue', 'red', 'black']
      const diff = order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
      return diff !== 0 ? diff : b.lengthKm - a.lengthKm
    })
})

/** В OSM у Хакубы 80 трасс — в панель кладём самые длинные, остальное на карте. */
const trailLimit = 12
const liftLimit = 10

/** Фильтр по сложности и режим «топ / все». */
const trailFilter = ref<TrailDifficulty | 'all'>('all')
const showAllTrails = ref(false)

const filteredTrails = computed(() => {
  const list =
    trailFilter.value === 'all'
      ? visibleTrails.value
      : visibleTrails.value.filter((trail) => trail.difficulty === trailFilter.value)
  return list
})

const shownTrails = computed(() =>
  showAllTrails.value ? filteredTrails.value : filteredTrails.value.slice(0, trailLimit),
)
const hiddenTrails = computed(() => Math.max(0, filteredTrails.value.length - trailLimit))

const shownLifts = computed(() =>
  [...visibleLifts.value].sort((a, b) => b.lengthM - a.lengthM).slice(0, liftLimit),
)
const hiddenLifts = computed(() => Math.max(0, visibleLifts.value.length - liftLimit))

const visibleLifts = computed(() => {
  const dataset = trailData.value
  if (!dataset) return []
  return dataset.lifts.filter((lift) => !selectedZoneId.value || lift.zoneId === selectedZoneId.value)
})

const snowState = computed(() => {
  const dataset = trailData.value
  if (!dataset) return null
  const zone = selectedZoneId.value
  return zone
    ? (dataset.snow.find((item) => item.zoneId === zone) ?? null)
    : (dataset.snow[0] ?? null)
})

const snowAge = computed(() => {
  const state = snowState.value
  if (!state) return null
  return snowAgeHours(state.updatedAt)
})

const backcountryTop = computed(() => {
  const dataset = trailData.value
  if (!dataset || dataset.backcountry.length === 0) return null
  const order = ['low', 'moderate', 'considerable', 'high']
  return [...dataset.backcountry].sort(
    (a, b) => order.indexOf(b.hazard) - order.indexOf(a.hazard),
  )[0]
})

function toggleLayer(key: keyof typeof layers.value): void {
  layers.value = { ...layers.value, [key]: !layers.value[key] }
}

function confidenceClass(value: 'verified' | 'curated' | 'estimate'): string {
  return 'conf conf-' + value
}

function toggleOfficial(): void {
  showOfficial.value = !showOfficial.value
}

function zoneGradient(zoneId: string): string {
  const zone = passport.value.zones.find((item) => item.zoneId === zoneId)
  return zone && zone.avgGradientPercent > 0 ? `${zone.avgGradientDegrees}° · ${zone.avgGradientPercent}%` : '—'
}

function zoneRunLength(zoneId: string): number | string {
  const zone = passport.value.zones.find((item) => item.zoneId === zoneId)
  return zone && zone.runLengthKm > 0 ? zone.runLengthKm : '—'
}

function zoneKmPerLift(zoneId: string): string {
  const zone = passport.value.zones.find((item) => item.zoneId === zoneId)
  return zone && zone.kmPerLift > 0 ? `${zone.kmPerLift} км/подъёмник` : '—'
}

const totalDifficulty = computed(() => {
  const value = difficulty.value
  return value.green + value.blue + value.red + value.black
})

const difficultyMeta: { key: TrailDifficulty; label: string; color: string }[] = [
  { key: 'green', label: 'Зелёные', color: '#34d399' },
  { key: 'blue', label: 'Синие', color: '#38bdf8' },
  { key: 'red', label: 'Красные', color: '#f87171' },
  { key: 'black', label: 'Чёрные', color: '#64748b' },
]


function selectZone(id: string): void {
  selectedZoneId.value = selectedZoneId.value === id ? null : id
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

let previousOverflow = ''
let scrollLocked = false

function lockScroll(lock: boolean): void {
  if (typeof document === 'undefined') return
  if (lock && !scrollLocked) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    scrollLocked = true
  } else if (!lock && scrollLocked) {
    document.body.style.overflow = previousOverflow
    scrollLocked = false
  }
}

watch(
  () => props.open,
  (open) => lockScroll(open),
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  lockScroll(props.open)
  window.setTimeout(() => closeButton.value?.focus(), 60)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  lockScroll(false)
})
</script>

<template>
  <div v-if="props.open" class="guide-backdrop" @click.self="emit('close')">
    <div class="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <header class="guide-head">
        <div>
          <div class="node-kicker">Гид по курорту</div>
          <h2 id="guide-title">{{ guide.title }}</h2>
          <div class="guide-sub">{{ guide.region }} · сезон {{ guide.season }}</div>
        </div>
        <div class="guide-head-right">
          <div class="guide-facts">
            <button
              type="button"
              class="guide-fact"
              :class="{ active: showOfficial }"
              :title="officialGap ? 'Официальный итог курорта и данные гида' : 'Данные гида'"
              @click="toggleOfficial"
            >
              {{ passport.trailsKm }} км в гиде<template v-if="showOfficial && officialGap"> · {{ guide.totalTrailsKm }} официально</template>
            </button>
            <span>{{ passport.lifts }} подъёмников</span>
            <span>перепад {{ passport.vertical }} м</span>
          </div>
          <button ref="closeButton" type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
        </div>
      </header>

      <div class="guide-body">
        <section class="guide-scene-wrap">
          <ResortScene3D
            :guide="guide"
            :selected-zone-id="selectedZoneId"
            :hotel-name="hotelName"
            :hotel-point="hotelPoint"
            :hotel-distance="hotelDistance"
            :hotel-exact="hotelExact"
            :dataset="trailData"
            :freeride="freerideData"
            :layers="layers"
            @select="selectZone"
          />

          <div class="scene-legend">
            <span class="scene-legend-title">На карте</span>
            <span class="scene-legend-item"><i class="pin" />часть курорта</span>
            <span v-if="hotelPoint" class="scene-legend-item"><i class="pin hotel" />ваш отель</span>
          </div>

          <div v-if="trailData" class="layer-toggles" role="group" aria-label="Слои карты">
            <button
              v-for="item in [
                { key: 'trails', label: 'Трассы' },
                { key: 'lifts', label: 'Подъёмники' },
                { key: 'areas', label: 'Парки и зоны' },
                { key: 'backcountry', label: 'Backcountry' },
                { key: 'snow', label: 'Снег' },
              ]"
              :key="item.key"
              type="button"
              class="layer-toggle"
              :class="{ active: layers[item.key as keyof typeof layers] }"
              :aria-pressed="layers[item.key as keyof typeof layers]"
              @click="toggleLayer(item.key as keyof typeof layers)"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="scene-hint">Потяните, чтобы повернуть · колесо — масштаб · клик по номеру — часть курорта</div>

          <div class="zone-chips">
            <button
              v-for="(zone, index) in guide.zones"
              :key="zone.id"
              type="button"
              class="zone-chip"
              :class="{ active: selectedZoneId === zone.id }"
              @click="selectZone(zone.id)"
            >
              <b><i class="zone-num">{{ index + 1 }}</i>{{ zone.name }}</b>
              <span>{{ formatGuideDayPrice(zone.passPrice, zone.passCurrency) }}</span>
            </button>
          </div>
        </section>

        <aside class="guide-side">
          <nav class="guide-tabs" role="tablist" aria-label="Разделы гида">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              role="tab"
              class="guide-tab"
              :class="{ active: activeTab === tab.key }"
              :aria-selected="activeTab === tab.key"
              @click="setTab(tab.key)"
            >
              {{ tab.label }}
              <span v-if="tab.badge" class="guide-tab-badge">{{ tab.badge }}</span>
            </button>
          </nav>

          <div class="guide-tab-body">
            <!-- ОБЗОР -->
            <div v-if="activeTab === 'overview'" class="guide-pane">
              <p class="guide-summary">{{ guide.summary }}</p>

              <div class="guide-block">
                <h3>Кому подойдёт</h3>
                <div class="guide-tags">
                  <span v-for="tag in guide.bestFor" :key="tag">{{ tag }}</span>
                </div>
              </div>

              <div class="guide-block">
                <h3>Снег и сезон</h3>
                <p class="guide-text">{{ guide.snow }}</p>
                <p class="guide-text">{{ guide.season }}</p>
                <div v-if="seasonMonths.length" class="season-months guide-season">
                  <div
                    v-for="month in seasonMonths"
                    :key="month.month"
                    class="season-month"
                    :class="'level-' + month.level"
                    :title="seasonLabels[month.level]"
                  >
                    <span>{{ month.label }}</span>
                    <i />
                  </div>
                </div>
                <p class="guide-text passport-note">
                  Цвет: пик, высокий, средний и низкий сезон. Даты и цены проверяйте у курорта.
                </p>
              </div>

              <div class="guide-block">
                <h3>Сложность трасс</h3>
                <div class="difficulty-bar">
                  <span
                    v-for="item in difficultyMeta"
                    :key="item.key"
                    :style="{
                      width: `${totalDifficulty > 0 ? (difficulty[item.key] / totalDifficulty) * 100 : 0}%`,
                      background: item.color,
                    }"
                  />
                </div>
                <div class="difficulty-labels">
                  <span v-for="item in difficultyMeta" :key="item.key">
                    {{ item.label }} · {{ difficulty[item.key] }} км
                  </span>
                </div>
              </div>

              <div class="guide-block">
                <h3>Советы</h3>
                <ul class="guide-tips">
                  <li v-for="tip in guide.tips" :key="tip">{{ tip }}</li>
                </ul>
              </div>

              <p class="guide-disclaimer">
                Цены на скипасс ориентировочные, высокий сезон 2025/26. Проверяйте на сайте курорта перед поездкой.
              </p>
            </div>

            <!-- СКИПАСС -->
            <div v-else-if="activeTab === 'passes'" class="guide-pane">
              <div v-if="guide.passAll" class="guide-pass">
                <div>
                  <span class="guide-pass-label">{{ guide.passAll.label }}</span>
                  <span v-if="guide.passAll.note" class="guide-pass-note">{{ guide.passAll.note }}</span>
                </div>
                <strong>{{ formatGuidePrice(guide.passAll.price, guide.passAll.currency) }}</strong>
              </div>

              <div class="guide-block">
                <h3>Скипасс по частям курорта</h3>
                <div class="zone-table">
                  <button
                    v-for="(zone, index) in guide.zones"
                    :key="zone.id"
                    type="button"
                    class="zone-row"
                    :class="{ active: selectedZoneId === zone.id }"
                    @click="selectZone(zone.id)"
                  >
                    <span class="zone-row-main">
                      <b><i class="zone-num">{{ index + 1 }}</i>{{ zone.name }}</b>
                      <span>{{ zone.baseAltitude }}–{{ zone.topAltitude }} м · {{ zone.lifts }} подъёмн. · {{ zoneGradient(zone.id) }}</span>
                    </span>
                    <span class="zone-row-price">{{ formatGuidePrice(zone.passPrice, zone.passCurrency) }}</span>
                  </button>
                </div>

                <div v-if="selectedZone" class="zone-detail">
                  <div class="zone-detail-head">
                    <b>{{ selectedZone.name }}</b>
                    <span>{{ formatGuideDayPrice(selectedZone.passPrice, selectedZone.passCurrency) }}</span>
                  </div>
                  <div class="zone-slope">
                    <div>
                      <span>Средний уклон</span>
                      <b>{{ zoneGradient(selectedZone.id) }}</b>
                    </div>
                    <div>
                      <span>Длина спуска</span>
                      <b>{{ zoneRunLength(selectedZone.id) }} км</b>
                    </div>
                    <div>
                      <span>Эффективность</span>
                      <b>{{ zoneKmPerLift(selectedZone.id) }}</b>
                    </div>
                  </div>
                  <div class="zone-detail-grid">
                    <div v-for="item in difficultyMeta" :key="item.key">
                      <span><i :style="{ background: item.color }" />{{ item.label }}</span>
                      <b>{{ selectedZone.trailsKm[item.key] }} км</b>
                    </div>
                  </div>
                  <p v-if="selectedZone.note" class="guide-text">{{ selectedZone.note }}</p>
                </div>
                <p v-else class="guide-text passport-note">Выберите часть курорта, чтобы увидеть детали и цену дня.</p>
              </div>

              <div class="guide-block">
                <div class="passport-head">
                  <h3>Паспорт склона</h3>
                  <div class="passport-scope" role="group" aria-label="Область паспорта">
                    <button
                      type="button"
                      :class="{ active: passportScope === 'resort' }"
                      :aria-pressed="passportScope === 'resort'"
                      @click="setPassportScope('resort')"
                    >
                      Весь курорт
                    </button>
                    <button
                      type="button"
                      :class="{ active: passportScope === 'zone' }"
                      :aria-pressed="passportScope === 'zone'"
                      :disabled="!selectedZoneId"
                      :title="selectedZoneId ? 'Паспорт выбранной части' : 'Сначала выберите часть курорта'"
                      @click="setPassportScope('zone')"
                    >
                      Часть{{ zoneName ? ' · ' + zoneName : '' }}
                    </button>
                  </div>
                </div>

                <p class="passport-scope-note">
                  <template v-if="passportScope === 'resort'">
                    Сводка по всем {{ guide.zones.length }} частям курорта из гида.
                  </template>
                  <template v-else-if="zonePassport">
                    Только часть «{{ zoneName }}»: {{ zonePassport.vertical }} м перепада.
                  </template>
                  <template v-else>
                    Часть курорта не выбрана — показан весь курорт.
                  </template>
                </p>

                <div v-if="passportScope === 'resort' || !zonePassport" class="passport-grid">
                  <div class="passport-cell">
                    <span>Перепад курорта</span>
                    <b>{{ passport.vertical }} м</b>
                  </div>
                  <div class="passport-cell">
                    <span>Самый крутой склон</span>
                    <b>{{ passport.steepest ? `${passport.steepest.name} · ${passport.steepest.avgGradientDegrees}°` : '—' }}</b>
                  </div>
                  <div class="passport-cell">
                    <span>Трасс на подъёмник</span>
                    <b>{{ passport.kmPerLift }} км</b>
                  </div>
                  <div class="passport-cell">
                    <span>Перепад на подъёмник</span>
                    <b>{{ passport.verticalPerLift }} м</b>
                  </div>
                  <div class="passport-cell">
                    <span>Самая длинная часть</span>
                    <b>{{ passport.longest ? `${passport.longest.name} · ${passport.longest.trailsKm} км` : '—' }}</b>
                  </div>
                  <div class="passport-cell">
                    <span>Чёрных трасс</span>
                    <b>{{ passport.shares.black }}%</b>
                  </div>
                </div>

                <div v-else class="passport-grid">
                  <div class="passport-cell">
                    <span>Перепад части</span>
                    <b>{{ zonePassport.vertical }} м</b>
                  </div>
                  <div class="passport-cell">
                    <span>Средний уклон</span>
                    <b>{{ zonePassport.avgGradientDegrees }}° · {{ zonePassport.avgGradientPercent }}%</b>
                  </div>
                  <div class="passport-cell">
                    <span>Трасс на подъёмник</span>
                    <b>{{ zonePassport.kmPerLift }} км</b>
                  </div>
                  <div class="passport-cell">
                    <span>Перепад на подъёмник</span>
                    <b>{{ zonePassport.verticalPerLift }} м</b>
                  </div>
                  <div class="passport-cell">
                    <span>Длина спуска</span>
                    <b>{{ zonePassport.runLengthKm }} км</b>
                  </div>
                  <div class="passport-cell">
                    <span>Чёрных трасс</span>
                    <b>{{ zonePassport.shares.black }}%</b>
                  </div>
                </div>

                <p class="guide-text passport-note">
                  <template v-if="passportScope === 'resort' || !zonePassport">
                    {{ passportSummary }}. Уклон — оценка средней крутизны трасс зоны с поправкой на заложение, а не уклон каждой отдельной трассы.
                  </template>
                  <template v-else>
                    {{ zonePassport.trailsKm }} км трасс в этой части, {{ zonePassport.shares.green }}% зелёных и {{ zonePassport.shares.black }}% чёрных.
                  </template>
                </p>
                <p v-if="officialGap" class="guide-text passport-note">
                  Официально на курорте {{ guide.totalTrailsKm }} км, в гиде описано {{ passport.trailsKm }} км по {{ guide.zones.length }} зонам.
                </p>
              </div>
            </div>

            <!-- ТРАССЫ: курируемый список без геометрии на карте -->
            <div v-else-if="activeTab === 'slopes' && trailList && listStats" class="guide-pane">
              <div class="guide-block">
                <h3>Сводка</h3>
                <p class="guide-text">{{ trailList.summary }}</p>
                <div class="trail-summary">
                  <span>{{ listStats.total }} трасс · {{ listStats.km }} км</span>
                  <span>{{ listStats.lit }} с освещением</span>
                  <span>зелёных {{ listStats.byDifficulty.green }} · синих {{ listStats.byDifficulty.blue }} · красных {{ listStats.byDifficulty.red }} · чёрных {{ listStats.byDifficulty.black }}</span>
                </div>
                <p class="guide-text passport-note">
                  Список собран по описаниям курорта: длины и уклоны ориентировочные, на карте геометрия пока не размечается.
                </p>
              </div>

              <div class="guide-block">
                <h3>Трассы</h3>
                <div class="trail-table">
                  <div v-for="item in listTrails" :key="item.id" class="trail-row">
                    <i class="trail-swatch" :style="{ background: trailColors[item.difficulty] }" />
                    <div class="trail-main">
                      <b>{{ item.name }}</b>
                      <span>
                        {{ zoneLabel(item.zoneId) }} · {{ item.lengthKm }} км · {{ item.verticalM }} м
                        <template v-if="item.widthM"> · {{ item.widthM }} м шир.</template>
                        <template v-if="item.gradientPercent"> · {{ item.gradientPercent }}%</template>
                      </span>
                    </div>
                    <div class="trail-badges">
                      <span v-if="item.lit" class="trail-badge lit">вечер</span>
                      <span v-if="!item.groomed" class="trail-badge raw">целина</span>
                    </div>
                    <span class="trail-conf" :class="confidenceClass(trailList.confidence)" :title="confidenceHints[trailList.confidence]">
                      {{ confidenceLabels[trailList.confidence] }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="guide-block">
                <h3>Подъёмники</h3>
                <div class="lift-list">
                  <div v-for="lift in trailList.lifts" :key="lift.id" class="lift-row">
                    <i class="lift-swatch" :style="{ background: liftColors[lift.type] }" />
                    <div class="lift-main">
                      <b>{{ lift.name }}</b>
                      <span>{{ liftLabels[lift.type] }} · {{ lift.lengthM }} м<template v-if="lift.verticalM"> · {{ lift.verticalM }} м</template></span>
                      <span class="lift-hours">
                        {{ lift.hours.day }}<template v-if="lift.hours.evening"> · вечер {{ lift.hours.evening }}</template>
                        <template v-if="lift.note"> · {{ lift.note }}</template>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="guide-block">
                <h3>Расписание</h3>
                <p class="guide-text">{{ schedule }}</p>
                <p v-if="trailList.hours.nightNote" class="guide-text">{{ trailList.hours.nightNote }}</p>
                <p class="guide-text passport-note source-note">
                  Источник: {{ trailList.source }}. Часы работы и длины проверяйте на сайте курорта.
                </p>
              </div>
            </div>

            <!-- ФРИРАЙД -->
            <div v-else-if="activeTab === 'freeride' && freerideData" class="guide-pane">
              <div class="guide-block">
                <h3>Фрирайд</h3>
                <p class="guide-text">{{ freerideData.summary }}</p>
                <div class="fr-meta">
                  <span class="fr-hazard" :style="{ borderColor: hazardColors[freerideData.hazard], color: hazardColors[freerideData.hazard] }">
                    риск: {{ hazardLabels[freerideData.hazard] }}
                  </span>
                  <span>{{ freerideData.season }}</span>
                  <span v-if="!freerideData.hasGates" class="fr-nogates">официальных ворот нет</span>
                  <span v-else class="fr-gates">вороты открывает курорт</span>
                </div>
                <div class="guide-tags">
                  <span v-for="tag in freerideData.bestFor" :key="tag">{{ tag }}</span>
                </div>
              </div>

              <div v-if="freerideData.zones.length" class="guide-block">
                <h3>Где катать</h3>
                <div class="fr-zones">
                  <div v-for="zone in freerideData.zones" :key="zone.id" class="fr-zone">
                    <i class="fr-dot" :style="{ background: hazardColors[zone.hazard] }" />
                    <div class="fr-zone-main">
                      <b>{{ zone.name }}</b>
                      <span>{{ zone.aspect }} · {{ zone.verticalM }} м · риск {{ hazardLabels[zone.hazard] }}</span>
                      <span class="fr-zone-note">{{ zone.note }}</span>
                    </div>
                  </div>
                </div>
                <p class="guide-text passport-note">
                  Зоны показаны на карте слоем «Backcountry» — включите его под картой.
                </p>
              </div>

              <div v-if="freerideData.gates.length" class="guide-block">
                <h3>Вороты фрирайда</h3>
                <div class="fr-gates-list">
                  <div v-for="gate in freerideData.gates" :key="gate.id" class="fr-gate">
                    <i class="fr-dot" :style="{ background: hazardColors[gate.hazard] }" />
                    <div class="fr-gate-main">
                      <b>{{ gate.name }}</b>
                      <span>{{ gate.lat.toFixed(4) }}, {{ gate.lng.toFixed(4) }} · риск {{ hazardLabels[gate.hazard] }}<template v-if="gate.guided"> · только с гидом</template></span>
                      <span class="fr-zone-note">{{ gate.note }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="guide-block">
                <h3>Снаряжение</h3>
                <div class="guide-tags">
                  <span v-for="item in freerideData.gear" :key="item">{{ item }}</span>
                </div>
              </div>

              <div class="guide-block">
                <h3>Правила и риски</h3>
                <ul class="guide-tips">
                  <li v-for="rule in freerideData.rules" :key="rule">{{ rule }}</li>
                </ul>
                <p class="guide-text passport-note source-note">
                  Описание собрано по схемам склонов и отчётам курортов. Лавинную обстановку проверяйте в день выхода.
                </p>
              </div>
            </div>

            <!-- ТРАССЫ -->
            <div v-else-if="activeTab === 'slopes' && trailData && stats" class="guide-pane">
              <div class="guide-block">
                <h3>Сводка</h3>
                <div class="trail-summary">
                  <span>{{ stats.total }} трасс · {{ stats.lengthKm }} км</span>
                  <span>{{ stats.lit }} с освещением</span>
                  <span>{{ stats.avgWidthM ? 'ср. ширина ' + stats.avgWidthM + ' м' : 'ширина в OSM не указана' }}</span>
                </div>
                <div class="trail-legend">
                  <span
                    v-for="item in [
                      { key: 'green', label: 'Зелёные' },
                      { key: 'blue', label: 'Синие' },
                      { key: 'red', label: 'Красные' },
                      { key: 'black', label: 'Чёрные' },
                    ]" :key="item.key" class="trail-legend-item"
                  >
                    <i :style="{ background: trailColors[item.key as keyof typeof trailColors] }" />{{ item.label }}
                  </span>
                  <span class="trail-legend-item"><i class="lit" />освещено</span>
                </div>
              </div>

              <div class="guide-block">
                <h3>Трассы</h3>
                <div class="trail-controls">
                  <div class="trail-filters" role="group" aria-label="Сложность">
                    <button
                      type="button"
                      class="trail-filter"
                      :class="{ active: trailFilter === 'all' }"
                      @click="trailFilter = 'all'"
                    >
                      Все
                    </button>
                    <button
                      v-for="item in difficultyMeta"
                      :key="item.key"
                      type="button"
                      class="trail-filter"
                      :class="{ active: trailFilter === item.key }"
                      @click="trailFilter = item.key"
                    >
                      <i :style="{ background: item.color }" />{{ stats.byDifficulty[item.key].count }}
                    </button>
                  </div>
                  <button
                    type="button"
                    class="mini-btn"
                    @click="showAllTrails = !showAllTrails"
                  >
                    {{ showAllTrails ? 'Топ-12' : 'Показать все (' + filteredTrails.length + ')' }}
                  </button>
                </div>

                <div class="trail-table">
                  <div v-for="trail in shownTrails" :key="trail.id" class="trail-row">
                    <i class="trail-swatch" :style="{ background: trailColors[trail.difficulty] }" />
                    <div class="trail-main">
                      <b>{{ trail.name }}</b>
                      <span>
                        {{ trail.lengthKm }} км · {{ trail.verticalM }} м
                        <template v-if="trail.widthM"> · {{ trail.widthM }} м шир.</template>
                        <template v-if="trail.gradientPercent"> · {{ trail.gradientPercent }}%</template>
                      </span>
                    </div>
                    <div class="trail-badges">
                      <span v-if="trail.lit" class="trail-badge lit">вечер</span>
                      <span v-if="!trail.groomed" class="trail-badge raw">целина</span>
                      <span v-if="trail.status === 'unknown'" class="trail-badge unknown">нет данных</span>
                      <span v-else class="trail-badge" :class="trail.status === 'open' ? 'open' : 'closed'">
                        {{ trail.status === 'open' ? 'открыта' : 'закрыта' }}
                      </span>
                    </div>
                    <span class="trail-conf" :class="confidenceClass(trail.confidence.attributes)" :title="confidenceHints[trail.confidence.attributes]">
                      {{ confidenceLabels[trail.confidence.attributes] }}
                    </span>
                  </div>
                </div>
                <p v-if="!showAllTrails && hiddenTrails" class="guide-text passport-note trail-more">
                  В списке {{ shownTrails.length }} из {{ filteredTrails.length }}; остальные {{ hiddenTrails }} видны на карте.
                </p>
              </div>

              <div class="guide-block">
                <h3>Подъёмники</h3>
                <div class="lift-list">
                  <div v-for="lift in shownLifts" :key="lift.id" class="lift-row">
                    <i class="lift-swatch" :style="{ background: liftColors[lift.type] }" />
                    <div class="lift-main">
                      <b>{{ lift.name }}</b>
                      <span>{{ liftLabels[lift.type] }} · {{ lift.lengthM }} м</span>
                    </div>
                    <span class="trail-badge unknown">нет данных</span>
                  </div>
                </div>
                <p v-if="hiddenLifts" class="guide-text passport-note trail-more">
                  Показаны {{ shownLifts.length }} из {{ visibleLifts.length }} — остальные на карте.
                </p>
              </div>

              <div class="guide-block">
                <h3>Расписание</h3>
                <p class="guide-text">{{ schedule }}</p>
                <p v-if="trailData.hours.nightNote" class="guide-text">{{ trailData.hours.nightNote }}</p>
                <p class="guide-text passport-note source-note">
                  Геометрия: {{ trailData.source }} · {{ trailData.license }} · обновлено {{ trailData.updatedAt }}.
                  Статус работы и уклон — оценка.
                </p>
              </div>
            </div>

            <!-- СНЕГ И ФРИРАЙД -->
            <div v-else-if="activeTab === 'snow'" class="guide-pane">
              <WeatherPanel :guide="guide" :check-in="checkIn" :check-out="checkOut" />

              <div v-if="snowState" class="guide-block">
                <h3>Снег сейчас</h3>
                <div class="snow-card">
                  <span class="snow-dot" :style="{ background: snowColors[snowState.condition] }" />
                  <div class="snow-main">
                    <b>{{ snowLabels[snowState.condition] }}</b>
                    <span>{{ snowState.freshCm }} см свежего · база {{ snowState.baseCm }} см</span>
                  </div>
                  <span class="trail-conf" :class="confidenceClass(snowState.confidence)" :title="confidenceHints[snowState.confidence]">
                    {{ confidenceLabels[snowState.confidence] }}
                  </span>
                </div>
                <p class="guide-text passport-note">
                  {{ snowState.reportedBy === 'resort' ? 'Отчёт курорта' : 'Отчёт сообщества' }}<template v-if="snowAge !== null"> · обновлено {{ snowAge }} ч назад</template>
                </p>
              </div>

              <div v-if="trailData && trailData.backcountry.length" class="guide-block">
                <h3>Backcountry направления</h3>
                <div class="bc-list">
                  <div v-for="route in trailData.backcountry" :key="route.id" class="bc-row">
                    <i class="bc-swatch" :style="{ background: hazardColors[route.hazard] }" />
                    <div class="bc-main">
                      <b>{{ route.name }}</b>
                      <span>{{ route.aspect }} · {{ Math.abs(route.verticalM) }} м · риск {{ hazardLabels[route.hazard] }}</span>
                    </div>
                  </div>
                </div>
                <p v-if="backcountryTop" class="guide-text passport-note">
                  Максимальный риск: {{ hazardLabels[backcountryTop.hazard] }}. {{ backcountryTop.note }}
                </p>
              </div>

              <div v-if="trailData && trailData.areas.length" class="guide-block">
                <h3>Парки и зоны</h3>
                <div class="bc-list">
                  <div v-for="area in trailData.areas" :key="area.id" class="bc-row">
                    <i class="bc-swatch" :style="{ background: areaColors[area.kind] }" />
                    <div class="bc-main">
                      <b>{{ area.name }}</b>
                      <span>{{ area.note ?? areaLabels[area.kind] }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>