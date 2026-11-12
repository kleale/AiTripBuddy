<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { trip } from '@/stores/trip'
import type { LinkKind, Stop } from '@/types'

const container = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let lineLayer: L.LayerGroup | null = null

const linkColors: Record<LinkKind, string> = {
  flight: '#38bdf8',
  transfer: '#fbbf24',
  move: '#34d399',
}

const stops = computed<Stop[]>(() => trip.value?.stops ?? [])

const signature = computed(() =>
  stops.value.map((stop) => `${stop.id}:${stop.lat.toFixed(3)}:${stop.lng.toFixed(3)}`).join('|'),
)

function hasCoords(stop: Stop): boolean {
  return Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && !(stop.lat === 0 && stop.lng === 0)
}

function stopTitle(stop: Stop): string {
  if (stop.kind === 'stay') return stop.hotel || stop.resort || 'Отель'
  return stop.city || 'Точка маршрута'
}

function stopSubtitle(stop: Stop): string {
  if (stop.kind === 'stay') return stop.resort ? `Курорт: ${stop.resort}` : 'Курорт не выбран'
  if (stop.kind === 'airport') return `Аэропорт прилёта${stop.code ? ` · ${stop.code}` : ''}`
  return `Вылет${stop.code ? ` · ${stop.code}` : ''}`
}

function markerIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: 'map-pin',
    html: `<span>${index + 1}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function render(): void {
  const mapInstance = map
  const markers = markerLayer
  const lines = lineLayer
  if (!mapInstance || !markers || !lines) return

  markers.clearLayers()
  lines.clearLayers()

  const current = trip.value
  if (!current) return

  current.links.forEach((link, index) => {
    const source = current.stops[index]
    const target = current.stops[index + 1]
    if (!source || !target || !hasCoords(source) || !hasCoords(target)) return
    L.polyline(
      [
        [source.lat, source.lng],
        [target.lat, target.lng],
      ],
      {
        color: linkColors[link.kind],
        weight: 2.5,
        opacity: 0.9,
        dashArray: link.kind === 'flight' ? '7 7' : undefined,
      },
    ).addTo(lines)
  })

  const points: L.LatLngExpression[] = []

  current.stops.forEach((stop, index) => {
    if (!hasCoords(stop)) return
    L.marker([stop.lat, stop.lng], { icon: markerIcon(index), keyboard: false })
      .bindTooltip(`${index + 1}. ${stopTitle(stop)} — ${stopSubtitle(stop)}`, {
        direction: 'top',
        offset: [0, -14],
      })
      .addTo(markers)
    points.push([stop.lat, stop.lng])
  })

  if (points.length === 0) return
  if (points.length === 1) {
    mapInstance.setView(points[0]!, 6)
  } else {
    mapInstance.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 8 })
  }
}

onMounted(() => {
  if (!container.value) return

  map = L.map(container.value, { worldCopyJump: true, zoomControl: false })
  map.setView([48, 10], 4)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  L.control.zoom({ position: 'bottomleft' }).addTo(map)

  markerLayer = L.layerGroup().addTo(map)
  lineLayer = L.layerGroup().addTo(map)

  render()
  window.setTimeout(() => map?.invalidateSize(), 120)
})

watch(signature, render)

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markerLayer = null
  lineLayer = null
})
</script>

<template>
  <div class="map-wrap">
    <div class="map-title">
      <span class="node-kicker">Карта маршрута</span>
      <span class="map-hint">точки появляются после выбора города и курорта</span>
    </div>
    <div ref="container" class="map"></div>
  </div>
</template>