<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { guideDifficulty, type ResortGuide, type TrailDifficulty } from '@/data/resort-guides'
import ResortScene3D from '@/components/ResortScene3D.vue'
import { formatGuideDayPrice, formatGuidePrice } from '@/lib/guide-format'
import { slopePassport, slopeSummary } from '@/lib/slope'
import type { TrailDataset } from '@/data/trail-maps'
import {
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

/** Официальный итог курорта может быть больше, чем описано в зонах гида. */
const officialGap = computed(() => {
  const value = props.guide.totalTrailsKm - passport.value.trailsKm
  return value > 0.5 ? value : null
})

const showOfficial = ref(false)

const layers = ref({ trails: true, lifts: true, areas: true, backcountry: true, snow: false })

const trailData = computed(() => props.dataset ?? null)
const stats = computed(() => (trailData.value ? trailStats(trailData.value) : null))
const schedule = computed(() => (trailData.value ? scheduleLabel(trailData.value.hours) : ''))

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
          <p class="guide-summary">{{ guide.summary }}</p>

          <div class="guide-block">
            <h3>Кому подойдёт</h3>
            <div class="guide-tags">
              <span v-for="tag in guide.bestFor" :key="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="guide-block">
            <h3>Снег</h3>
            <p class="guide-text">{{ guide.snow }}</p>
          </div>

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
          </div>

          <div class="guide-block">
            <h3>Паспорт склона</h3>
            <div class="passport-grid">
              <div class="passport-cell">
                <span>Перепад</span>
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
                <span>Самая длинная зона</span>
                <b>{{ passport.longest ? `${passport.longest.name} · ${passport.longest.trailsKm} км` : '—' }}</b>
              </div>
              <div class="passport-cell">
                <span>Чёрных трасс</span>
                <b>{{ passport.shares.black }}%</b>
              </div>
            </div>
            <p class="guide-text passport-note">
              {{ passportSummary }}. Уклон — оценка средней крутизны трасс зоны с поправкой на заложение, а не уклон каждой отдельной трассы.
            </p>
            <p v-if="officialGap" class="guide-text passport-note">
              Официально на курорте {{ guide.totalTrailsKm }} км, в гиде описано {{ passport.trailsKm }} км по {{ guide.zones.length }} зонам.
              Разница — зоны, которые ещё не разобраны.
            </p>
          </div>

          <div v-if="trailData && stats" class="guide-block">
            <h3>Трассы и подъёмники</h3>
            <div class="trail-summary">
              <span>{{ stats.open }} из {{ stats.total }} трасс открыто</span>
              <span>{{ stats.lengthKm }} км</span>
              <span>{{ stats.avgWidthM ? 'ср. ширина ' + stats.avgWidthM + ' м' : 'ширина без данных' }}</span>
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
            <div class="trail-table">
              <div v-for="trail in visibleTrails" :key="trail.id" class="trail-row">
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
                  <span class="trail-badge" :class="trail.status === 'open' ? 'open' : 'closed'">
                    {{ trail.status === 'open' ? 'открыта' : 'закрыта' }}
                  </span>
                </div>
                <span class="trail-conf" :class="confidenceClass(trail.confidence.attributes)" :title="confidenceHints[trail.confidence.attributes]">
                  {{ confidenceLabels[trail.confidence.attributes] }}
                </span>
              </div>
            </div>

            <div class="lift-list">
              <div v-for="lift in visibleLifts" :key="lift.id" class="lift-row">
                <i class="lift-swatch" :style="{ background: liftColors[lift.type] }" />
                <div class="lift-main">
                  <b>{{ lift.name }}</b>
                  <span>{{ liftLabels[lift.type] }} · {{ lift.lengthM }} м · {{ lift.verticalM }} м перепада</span>
                </div>
                <span class="trail-badge" :class="lift.status === 'open' ? 'open' : lift.status === 'closed' ? 'closed' : 'sched'">
                  {{ lift.status === 'open' ? 'работает' : lift.status === 'closed' ? 'закрыт' : lift.status === 'scheduled' ? 'по расписанию' : 'нет данных' }}
                </span>
              </div>
            </div>
            <p class="guide-text passport-note">{{ schedule }}<template v-if="trailData.hours.nightNote">. {{ trailData.hours.nightNote }}</template></p>
          </div>

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
            <h3>Backcountry</h3>
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
        </aside>
      </div>
    </div>
  </div>
</template>