<script setup lang="ts">
import { computed } from 'vue'
import type { PriceHint } from '@/lib/price-hints'
import { formatMoney } from '@/lib/format'

const props = defineProps<{ hint: PriceHint | null; loading: boolean; error?: string }>()
defineEmits<{ apply: []; close: [] }>()

const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const historyMax = computed(() => {
  const values = props.hint?.history?.map((point) => point.high) ?? []
  return Math.max(1, ...values)
})

function barHeight(value: number): string {
  return `${Math.max(3, Math.round((value / historyMax.value) * 26))}px`
}
</script>

<template>
  <div v-if="loading" class="price-hint muted">Считаем AI-оценку…</div>
  <div v-else-if="error" class="price-hint error">{{ error }}</div>
  <div v-else-if="hint" class="price-hint">
    <div class="price-hint-head">
      <b>AI-оценка</b>
      <button type="button" class="price-hint-close" aria-label="Закрыть" @click="$emit('close')">×</button>
    </div>
    <div class="price-hint-range">
      {{ formatMoney(hint.low, hint.currency) }} — {{ formatMoney(hint.high, hint.currency) }}
      <span>{{ hint.unit }}</span>
    </div>
    <div class="price-hint-typical">
      Обычно <b>{{ formatMoney(hint.typical, hint.currency) }}</b>
      <span class="price-hint-confidence">{{ hint.confidence }}</span>
    </div>
    <p>{{ hint.source }} · {{ hint.fetchedAt }}</p>
    <p class="price-hint-rationale">{{ hint.rationale }}</p>
    <p v-if="hint.pax" class="price-hint-group">
      Контекст: {{ hint.pax }} чел.<template v-if="hint.rooms"> · {{ hint.rooms }} номер(ов)</template>
    </p>
    <div v-if="hint.history?.length" class="price-history" aria-label="История цены по месяцам">
      <span
        v-for="point in hint.history"
        :key="point.month"
        class="price-history-bar"
        :style="{ height: barHeight(point.typical) }"
        :title="`${months[point.month - 1]}: ${formatMoney(point.low, hint.currency)} — ${formatMoney(point.high, hint.currency)}`"
      />
    </div>
    <a
      v-if="hint.providerUrl"
      class="price-hint-provider"
      :href="hint.providerUrl"
      target="_blank"
      rel="noopener"
    >
      {{ hint.providerLabel || 'Проверить у провайдера' }} ↗
    </a>
    <button type="button" class="mini-btn" @click="$emit('apply')">
      Подставить {{ formatMoney(hint.typical, hint.currency) }}
    </button>
  </div>
</template>
