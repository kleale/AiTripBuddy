<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resorts } from '@/data/resorts'
import { guideFor, hasGuide } from '@/data/resort-guides'
import { resortSeason, seasonFilterMonths } from '@/data/resort-season'
import { catalogCountries, emptyFilters, filterResorts, type CatalogFilters } from '@/lib/catalog'
import ResortGuideModal from '@/components/ResortGuideModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const filters = ref<CatalogFilters>({ ...emptyFilters })
const closeButton = ref<HTMLButtonElement | null>(null)
const activeGuideId = ref<string | null>(null)

const countries = catalogCountries()
const visible = computed(() => filterResorts(filters.value))
const activeGuide = computed(() => (activeGuideId.value ? guideFor(activeGuideId.value) : undefined))

function onQuery(event: Event): void {
  filters.value.query = (event.target as HTMLInputElement).value
}

function onCountry(event: Event): void {
  filters.value.country = (event.target as HTMLSelectElement).value
}

function onMonth(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  filters.value.month = value === '' ? null : Number(value)
}

function toggleGuidesOnly(): void {
  filters.value.guideOnly = !filters.value.guideOnly
}

function resetFilters(): void {
  filters.value = { ...emptyFilters }
}

function openGuide(id: string): void {
  if (hasGuide(id)) activeGuideId.value = id
}

function closeGuide(): void {
  activeGuideId.value = null
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !activeGuide.value) emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      activeGuideId.value = null
      return
    }
    await nextTick()
    closeButton.value?.focus()
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="props.open" class="modal-backdrop catalog-backdrop" @click.self="!activeGuide && emit('close')">
    <div class="modal catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
      <header class="catalog-head">
        <div>
          <div class="node-kicker">Справочник</div>
          <h2 id="catalog-title">Курорты</h2>
          <div class="catalog-sub">
            {{ resorts.length }} курортов · {{ visible.length }} в подборке ·
            {{ resorts.filter((resort) => hasGuide(resort.id)).length }} с гидом
          </div>
        </div>
        <button ref="closeButton" type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>

      <div class="catalog-filters">
        <input
          class="text-input catalog-search"
          type="search"
          placeholder="Поиск по названию, региону или стране"
          :value="filters.query"
          @input="onQuery"
        />

        <select class="currency-select" :value="filters.country" @change="onCountry">
          <option value="">Все страны</option>
          <option v-for="country in countries" :key="country" :value="country">{{ country }}</option>
        </select>

        <select class="currency-select" :value="filters.month ?? ''" @change="onMonth">
          <option value="">Любой месяц сезона</option>
          <option v-for="month in seasonFilterMonths" :key="month.value" :value="month.value">
            {{ month.label }}
          </option>
        </select>

        <button
          type="button"
          class="mini-btn"
          :class="{ active: filters.guideOnly }"
          @click="toggleGuidesOnly"
        >
          Только с гидом
        </button>

        <button type="button" class="mini-btn" @click="resetFilters">Сбросить</button>
      </div>

      <div v-if="visible.length" class="catalog-grid">
        <article v-for="resort in visible" :key="resort.id" class="catalog-card">
          <div class="catalog-card-main">
            <div class="catalog-card-title">
              <h3>{{ resort.name }}</h3>
              <span v-if="hasGuide(resort.id)" class="catalog-guide-badge">гид</span>
            </div>
            <div class="catalog-card-meta">{{ resort.country }} · {{ resort.region }}</div>
            <div class="catalog-card-season">Сезон: {{ resortSeason(resort).label }}</div>
          </div>
          <button
            v-if="hasGuide(resort.id)"
            type="button"
            class="mini-btn catalog-guide-btn"
            @click="openGuide(resort.id)"
          >
            Посмотреть гид
          </button>
          <span v-else class="catalog-no-guide">Гид готовится</span>
        </article>
      </div>

      <div v-else class="trips-empty">
        Ничего не найдено. Попробуйте другой месяц, страну или запрос.
      </div>
    </div>

    <ResortGuideModal
      v-if="activeGuide"
      :guide="activeGuide"
      :open="true"
      @close="closeGuide"
    />
  </div>
</template>