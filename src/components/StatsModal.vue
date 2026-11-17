<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  aggregateStats,
  getStatsUrl,
  loadStats,
  setStatsUrl,
  statsSummary,
  type StatsDay,
  type StatsRange,
} from '@/lib/stats'
import StatsChart from '@/components/StatsChart.vue'

const props = defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const range = ref<StatsRange>('all')
const days = ref<StatsDay[]>([])
const remote = ref(false)
const loading = ref(false)
const collector = ref(getStatsUrl() ?? '')

const ranges: { id: StatsRange; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
]

const points = computed(() => aggregateStats(days.value, range.value))
const summary = computed(() => statsSummary(days.value))

function saveCollector(): void {
  setStatsUrl(collector.value || null)
  void refresh()
}

async function refresh(): Promise<void> {
  loading.value = true
  const result = await loadStats()
  days.value = result.days
  remote.value = result.remote
  loading.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) void refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal stats-modal" role="dialog" aria-modal="true" aria-label="Статистика посещений">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Статистика проекта</div>
          <h3>Заходы по дням</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="$emit('close')">×</button>
      </div>

      <div class="stats-toolbar">
        <div class="prep-brand-tabs">
          <button
            v-for="item in ranges"
            :key="item.id"
            type="button"
            :class="{ active: range === item.id }"
            @click="range = item.id"
          >
            {{ item.label }}
          </button>
        </div>
        <button type="button" class="mini-btn" :disabled="loading" @click="refresh">
          {{ loading ? 'Загрузка…' : 'Обновить' }}
        </button>
      </div>

      <div class="stats-summary">
        <div><span>Всего пользователей</span><b>{{ summary.unique }}</b></div>
        <div><span>Вернувшихся заходов</span><b>{{ summary.returning }}</b></div>
        <div><span>Всего заходов</span><b>{{ summary.visits }}</b></div>
      </div>

      <StatsChart :points="points" />

      <div class="stats-collector">
        <label>URL коллектора статистики</label>
        <div>
          <input v-model="collector" class="text-input" placeholder="https://stats.example.workers.dev" />
          <button type="button" class="mini-btn" @click="saveCollector">Подключить</button>
        </div>
      </div>

      <p class="guide-text passport-note">
        {{ remote ? 'Данные с внешнего коллектора.' : 'Локальный учёт этого браузера: один визит в день.' }}
        Для общей статистики подключите коллектор выше или задайте <code>VITE_STATS_URL</code>.
      </p>
    </div>
  </div>
</template>
