<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Activity, ActivityKind, StayStop } from '@/types'
import { activityIdeasFor } from '@/data/activity-ideas'
import { llmActivityIdeas, localActivityIdeas, type ActivityIdeasResult } from '@/lib/ai/activity-ideas'
import { deepseekAvailable } from '@/lib/ai/settings'
import { adminSettings } from '@/lib/admin'
import { activitySearchLinks, activityKindLabels } from '@/lib/activity-links'
import { convertGuideAmount } from '@/lib/currency'
import { formatMoney } from '@/lib/format'
import { trip } from '@/stores/trip'

const props = defineProps<{
  stop: StayStop
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  add: [activity: Activity]
}>()

const result = ref<ActivityIdeasResult | null>(null)
const loading = ref(false)
const kind = ref<ActivityKind | 'all'>('all')

const currency = computed(() => trip.value?.currency ?? 'RUB')
const place = computed(() => (props.stop.placeKind === 'city' ? props.stop.city : props.stop.resort) || '')
const ideas = computed(() =>
  activityIdeasFor(props.stop.resortId).filter(
    (item) => !adminSettings.value.hiddenIdeaIds.includes(item.id),
  ),
)
const filtered = computed(() => {
  const list = result.value?.ideas ?? []
  return kind.value === 'all' ? list : list.filter((item) => item.kind === kind.value)
})
const kinds = computed(() => {
  const set = new Set<ActivityKind>()
  for (const idea of ideas.value) set.add(idea.kind)
  return [...set]
})

async function run(): Promise<void> {
  loading.value = true
  kind.value = 'all'
  const local = localActivityIdeas(ideas.value)
  result.value = local
  if (deepseekAvailable.value && ideas.value.length) {
    result.value = await llmActivityIdeas(ideas.value, {
      place: place.value,
      country: props.stop.country,
      checkIn: props.stop.checkIn,
      pax: Math.max(1, trip.value?.pax ?? 1),
      currency: currency.value,
    })
  }
  loading.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) void run()
  },
)

function priceOf(value: number, from: 'RUB' | 'EUR' | 'GEL' | 'JPY'): number {
  return convertGuideAmount(value, from, currency.value)
}

function addIdea(id: string): void {
  const idea = ideas.value.find((item) => item.id === id)
  if (!idea) return
  emit('add', {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: idea.title,
    kind: idea.kind,
    price: priceOf(idea.priceFrom, idea.currency),
    placeName: idea.placeName,
    address: idea.address,
    durationHours: idea.durationHours,
    date: props.stop.checkIn,
    source: 'ai',
  })
  emit('close')
}

function linksFor(title: string) {
  return activitySearchLinks(title, place.value, props.stop.country).slice(0, 3)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal ideas-modal" role="dialog" aria-modal="true" aria-label="Идеи мероприятий">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Идеи для {{ place || 'поездки' }}</div>
          <h3>Что посмотреть и попробовать</h3>
          <p class="modal-note">
            Курируемая подборка; цены ориентировочные. Бронирование и оплата — у поставщика.
          </p>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="emit('close')">×</button>
      </div>

      <div class="ideas-top">
        <div class="ideas-kinds">
          <button
            type="button"
            class="mini-btn"
            :class="{ active: kind === 'all' }"
            @click="kind = 'all'"
          >
            все
          </button>
          <button
            v-for="item in kinds"
            :key="item"
            type="button"
            class="mini-btn"
            :class="{ active: kind === item }"
            @click="kind = item"
          >
            {{ activityKindLabels[item] }}
          </button>
        </div>
        <span class="ideas-provider">{{ result?.provider === 'deepseek' ? 'DeepSeek' : 'подборка' }}</span>
      </div>

      <div v-if="loading" class="audit-loading">Подбираю идеи…</div>
      <p v-else-if="result" class="ideas-summary">{{ result.summary }}</p>

      <div v-if="!loading && filtered.length" class="ideas-list">
        <article v-for="idea in filtered" :key="idea.id" class="idea-card">
          <div class="idea-head">
            <span class="audit-kind">{{ activityKindLabels[idea.kind] }}</span>
            <b>{{ idea.title }}</b>
            <span class="idea-price">
              от {{ formatMoney(priceOf(idea.priceFrom, idea.currency), currency) }}
            </span>
          </div>
          <p>{{ idea.description }}</p>
          <div class="idea-meta">
            <span>{{ idea.placeName }}</span>
            <span v-if="idea.address">{{ idea.address }}</span>
            <span>{{ idea.durationHours }} ч</span>
            <span class="idea-estimate">цена — ориентир</span>
          </div>
          <div class="idea-foot">
            <div class="idea-links">
              <a
                v-for="link in linksFor(idea.title)"
                :key="link.id"
                :href="link.href"
                target="_blank"
                rel="noopener sponsored"
                class="idea-link"
              >
                {{ link.label }} ↗
              </a>
            </div>
            <button type="button" class="primary-btn" @click="addIdea(idea.id)">Добавить в поездку</button>
          </div>
        </article>
      </div>
      <p v-else-if="!loading" class="modal-note ideas-empty">
        Для этого места курируемых идей пока нет — добавьте мероприятие вручную.
      </p>

      <div class="audit-actions">
        <span v-if="!deepseekAvailable" class="modal-note">DeepSeek не подключён · подборка локальная</span>
        <span v-else class="modal-note">DeepSeek подключён · идеи только из подборки</span>
        <button type="button" class="primary-btn" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>
