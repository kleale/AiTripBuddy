<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { guideDifficulty, type GuideCurrency, type ResortGuide, type TrailDifficulty } from '@/data/resort-guides'
import ResortScene3D from '@/components/ResortScene3D.vue'

const props = defineProps<{
  guide: ResortGuide
  open: boolean
  hotelName?: string
  hotelPoint?: { lat: number; lng: number } | null
  hotelDistance?: number
  hotelExact?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const selectedZoneId = ref<string | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const selectedZone = computed(
  () => props.guide.zones.find((zone) => zone.id === selectedZoneId.value) ?? null,
)

const difficulty = computed(() => guideDifficulty(props.guide))

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

const currencySymbols: Record<GuideCurrency, string> = {
  JPY: '¥',
  RUB: '₽',
  EUR: '€',
  GEL: '₾',
}

function priceLabel(value: number, currency: GuideCurrency): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ${currencySymbols[currency]}`
}

function selectZone(id: string): void {
  selectedZoneId.value = selectedZoneId.value === id ? null : id
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.setTimeout(() => closeButton.value?.focus(), 60)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
            <span>{{ guide.totalTrailsKm }} км трасс</span>
            <span>{{ guide.lifts }} подъёмников</span>
            <span>перепад {{ guide.vertical }} м</span>
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
            @select="selectZone"
          />

          <div class="scene-legend">
            <span class="scene-legend-title">На карте</span>
            <span class="scene-legend-item"><i class="pin" />часть курорта</span>
            <span v-if="hotelPoint" class="scene-legend-item"><i class="pin hotel" />ваш отель</span>
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
              <span>{{ priceLabel(zone.passPrice, zone.passCurrency) }} / день</span>
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
            <strong>{{ priceLabel(guide.passAll.price, guide.passAll.currency) }}</strong>
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
                  <span>{{ zone.baseAltitude }}–{{ zone.topAltitude }} м · {{ zone.lifts }} подъёмн.</span>
                </span>
                <span class="zone-row-price">{{ priceLabel(zone.passPrice, zone.passCurrency) }}</span>
              </button>
            </div>
            <div v-if="selectedZone" class="zone-detail">
              <div class="zone-detail-head">
                <b>{{ selectedZone.name }}</b>
                <span>{{ priceLabel(selectedZone.passPrice, selectedZone.passCurrency) }} за день</span>
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