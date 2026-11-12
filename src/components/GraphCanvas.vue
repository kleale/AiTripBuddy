<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { VueFlow, type Edge, type Node, type VueFlowStore } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { trip } from '@/stores/trip'
import OriginNode from '@/components/nodes/OriginNode.vue'
import AirportNode from '@/components/nodes/AirportNode.vue'
import StayNode from '@/components/nodes/StayNode.vue'
import RouteEdge from '@/components/RouteEdge.vue'

const flow = ref<VueFlowStore | null>(null)

const nodes = computed<Node[]>(() => {
  const current = trip.value
  if (!current) return []
  return current.stops.map((stop, index) => ({
    id: stop.id,
    type: stop.kind,
    position: { x: index * 480, y: 70 },
    data: { stop, isLast: index === current.stops.length - 1 },
    draggable: false,
    selectable: false,
  }))
})

const edges = computed<Edge[]>(() => {
  const current = trip.value
  if (!current) return []
  const result: Edge[] = []
  current.links.forEach((link, index) => {
    const source = current.stops[index]
    const target = current.stops[index + 1]
    if (!source || !target) return
    result.push({
      id: `link-${index}`,
      source: source.id,
      target: target.id,
      type: 'route',
      data: { link, index },
      selectable: false,
    })
  })
  return result
})

function fitGraph(): void {
  void flow.value?.fitView({ padding: 0.22, maxZoom: 0.9, duration: 250 })
}

function onInit(instance: VueFlowStore): void {
  flow.value = instance
  window.setTimeout(fitGraph, 80)
}

watch(
  () => trip.value?.stops.length,
  () => {
    void nextTick(() => window.setTimeout(fitGraph, 80))
  },
)
</script>

<template>
  <div class="graph-wrap">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :min-zoom="0.2"
      :max-zoom="1.5"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :fit-view-on-init="true"
      :default-viewport="{ zoom: 0.8 }"
      class="graph"
      @init="onInit"
    >
      <Background :gap="26" :size="1.2" pattern-color="#1c2940" />
      <Controls :show-interactive="false" position="bottom-right" />

      <template #node-origin="{ data }">
        <OriginNode :stop="data.stop" :is-last="data.isLast" />
      </template>
      <template #node-airport="{ data }">
        <AirportNode :stop="data.stop" :is-last="data.isLast" />
      </template>
      <template #node-stay="{ data }">
        <StayNode :stop="data.stop" :is-last="data.isLast" />
      </template>
      <template #edge-route="edgeProps">
        <RouteEdge v-bind="edgeProps" />
      </template>
    </VueFlow>

    <div class="graph-legend">
      <span class="legend-item"><i class="legend-line flight" />перелёт</span>
      <span class="legend-item"><i class="legend-line transfer" />трансфер</span>
      <span class="legend-item"><i class="legend-line move" />переезд</span>
    </div>
  </div>
</template>
