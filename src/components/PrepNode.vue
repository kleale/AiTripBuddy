<script setup lang="ts">
import { computed } from 'vue'
import type { PrepPlan } from '@/types'
import { checklistProgress } from '@/data/gear'
import { gearKindLabels, ownershipLabels, skillLabels } from '@/lib/prep'
import { disablePrep, openPrepEditor } from '@/stores/trip'

const props = defineProps<{ prep: PrepPlan }>()

const progress = computed(() => checklistProgress(props.prep))
const mix = computed(() => [
  { id: 'trail', label: 'Трасса', value: props.prep.mix.trail, color: '#34d399' },
  { id: 'freeride', label: 'Фрирайд', value: props.prep.mix.freeride, color: '#38bdf8' },
  { id: 'park', label: 'Парк', value: props.prep.mix.park, color: '#fbbf24' },
])
</script>

<template>
  <div class="node node-prep nodrag nowheel">
    <div class="node-head">
      <span class="node-kicker">Подготовка к поездке</span>
      <button type="button" class="node-remove" title="Скрыть подготовку" @click="disablePrep">×</button>
    </div>

    <div class="prep-node-level">
      <span class="node-badge">{{ skillLabels[prep.level] }}</span>
      <span class="prep-node-gear">{{ gearKindLabels[prep.equipment] }}</span>
    </div>

    <div class="prep-mix">
      <div v-for="item in mix" :key="item.id" class="prep-mix-row">
        <span>{{ item.label }}</span>
        <i><b :style="{ width: item.value + '%', background: item.color }" /></i>
        <em>{{ item.value }}%</em>
      </div>
    </div>

    <div class="prep-node-meta">
      <span>{{ ownershipLabels[prep.ownership] }}</span>
      <span>{{ prep.heightCm }} см · {{ prep.weightKg }} кг</span>
    </div>

    <div class="prep-node-progress">
      <span>Чек-лист</span>
      <b>{{ progress.done }}/{{ progress.total }}</b>
    </div>
    <div class="prep-progress"><i :style="{ width: progress.percent + '%' }" /></div>

    <button type="button" class="node-add prep-open" @click="openPrepEditor">Открыть подготовку</button>
  </div>
</template>
