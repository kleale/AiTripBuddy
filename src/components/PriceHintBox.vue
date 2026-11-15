<script setup lang="ts">
import type { PriceHint } from '@/lib/price-hints'
import { formatMoney } from '@/lib/format'

defineProps<{ hint: PriceHint | null; loading: boolean; error?: string }>()
defineEmits<{ apply: []; close: [] }>()
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
    <button type="button" class="mini-btn" @click="$emit('apply')">Подставить {{ formatMoney(hint.typical, hint.currency) }}</button>
  </div>
</template>
