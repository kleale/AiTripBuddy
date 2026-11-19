<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { VueFlow, type Connection, type Edge, type Node, type VueFlowStore } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { connectStops, enablePrep, openLinkEditor, openPrepEditor, trip } from '@/stores/trip'
import { transportModes } from '@/lib/transport'
import OriginNode from '@/components/nodes/OriginNode.vue'
import AirportNode from '@/components/nodes/AirportNode.vue'
import StayNode from '@/components/nodes/StayNode.vue'
import RouteEdge from '@/components/RouteEdge.vue'
import PrepNode from '@/components/PrepNode.vue'

const flow = ref<VueFlowStore | null>(null)

const nodes = computed<Node[]>(() => {
  const current = trip.value
  if (!current) return []

  const list: Node[] = []
  if (current.prep?.enabled) {
    list.push({
      id: 'prep',
      type: 'prep',
      position: { x: -480, y: 70 },
      data: { prep: current.prep },
      draggable: false,
      selectable: true,
    })
  }

  list.push(
    ...current.stops.map((stop, index) => ({
      id: stop.id,
      type: stop.kind,
      position: { x: index * 480, y: 70 },
      data: { stop, isLast: index === current.stops.length - 1 },
      draggable: false,
      selectable: true,
    })),
  )
  return list
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

const connectHint = ref('')
let hintTimer: number | undefined

function onConnect(connection: Connection): void {
  const index = connectStops(connection.source, connection.target)
  window.clearTimeout(hintTimer)
  if (index === null) {
    connectHint.value = 'Соединять можно только соседние точки — вставьте точку между ними'
    hintTimer = window.setTimeout(() => (connectHint.value = ''), 3200)
    return
  }
  connectHint.value = ''
  openLinkEditor(index)
}

onBeforeUnmount(() => window.clearTimeout(hintTimer))

function fitGraph(): void {
  const current = trip.value
  const mobileNodes = window.innerWidth <= 760 ? current?.stops.map((stop) => stop.id) : undefined
  void flow.value?.fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.14, duration: 250, nodes: mobileNodes })
}

/** Читаемый фокус на первых точках; весь маршрут — кнопкой. */
function focusGraph(): void {
  const current = trip.value
  const mobile = window.innerWidth <= 760
  const ids = current?.stops.slice(0, mobile ? 2 : 3).map((stop) => stop.id)
  if (!ids?.length) return
  void flow.value?.fitView({ padding: 0.2, maxZoom: 1.1, minZoom: mobile ? 0.55 : 0.7, duration: 250, nodes: ids })
}

function onAddPrep(): void {
  enablePrep()
  openPrepEditor()
}

function onInit(instance: VueFlowStore): void {
  flow.value = instance
  window.setTimeout(focusGraph, 80)
}

watch(
  () => trip.value?.stops.length,
  () => {
    void nextTick(() => window.setTimeout(focusGraph, 80))
  },
)

watch(
  () => trip.value?.prep?.enabled,
  () => {
    // нода подготовки появляется сбоку и измеряется позже остальных
    window.setTimeout(focusGraph, 180)
    window.setTimeout(focusGraph, 600)
  },
  { immediate: true },
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
      :nodes-connectable="true"
      :elements-selectable="false"
      :fit-view-on-init="true"
      :default-viewport="{ zoom: 0.8 }"
      class="graph"
      @init="onInit"
      @connect="onConnect"
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
      <template #node-prep="{ data }">
        <PrepNode :prep="data.prep" />
      </template>
      <template #edge-route="edgeProps">
        <RouteEdge v-bind="edgeProps" />
      </template>
    </VueFlow>

    <div class="graph-zoom">
      <button type="button" @click="focusGraph">Фокус</button>
      <button type="button" @click="fitGraph">Весь</button>
    </div>

    <div class="graph-legend">
      <span v-for="mode in transportModes" :key="mode.id" class="legend-item">
        <i class="legend-line" :style="{ background: mode.color }" />{{ mode.label.toLowerCase() }}
      </span>
    </div>

    <button v-if="!trip?.prep?.enabled" type="button" class="prep-add" @click="onAddPrep">
      + Подготовка к поездке
    </button>

    <div v-if="connectHint" class="graph-hint">{{ connectHint }}</div>
  </div>
</template>
