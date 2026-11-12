<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { trip } from '@/stores/trip'
import type { LinkKind, StayStop, Stop } from '@/types'
import { distanceKm, formatDistance, hotelCoords } from '@/lib/geo'

const container = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let lineLayer: L.LayerGroup | null = null
let areaLayer: L.LayerGroup | null = null

const linkColors: Record<LinkKind, string> = {
  flight: '#38bdf8',
  transfer: '#fbbf24',
  move: '#34d399',
}

const stops = computed<Stop[]>(() => trip.value?.stops ?? [])

const signature = computed(() =>
  stops.value
    .map((stop) => {
      const base = `${stop.id}:${stop.lat.toFixed(3)}:${stop.lng.toFixed(3)}`
      if (stop.kind !== 'stay') return base
      return `${base}:${stop.resortId}:${stop.hotel}:${stop.hotelLat ?? ''}:${stop.hotelLng ?? ''}`
    })
    .join('|'),
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

function hotelIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-pin hotel-pin',
    html: '<span>H</span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function distanceLabelIcon(): L.DivIcon {
  return L.divIcon({
    className: 'map-distance-icon',
    html: '<span class="map-distance-dot"></span>',
    iconSize: [2, 2],
    iconAnchor: [1, 1],
  })
}

function stayHotelPoint(stay: StayStop): { lat: number; lng: number } | null {
  if (!hasCoords(stay)) return null
  return hotelCoords(
    { lat: stay.lat, lng: stay.lng },
    stay.hotel,
    { lat: stay.hotelLat, lng: stay.hotelLng },
  )
}

function render(): void {
  const mapInstance = map
  const markers = markerLayer
  const lines = lineLayer
  const areas = areaLayer
  if (!mapInstance || !markers || !lines || !areas) return

  markers.clearLayers()
  lines.clearLayers()
  areas.clearLayers()

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

    if (stop.kind !== 'stay') return

    // Схема курорта: зона катания вокруг центра курорта
    L.circle([stop.lat, stop.lng], {
      radius: 1500,
      color: '#34d399',
      weight: 1,
      opacity: 0.55,
      dashArray: '4 6',
      fillColor: '#34d399',
      fillOpacity: 0.07,
      interactive: false,
    }).addTo(areas)

    if (stop.resort) {
      L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          className: 'map-resort-label-wrap',
          html: `<span class="map-resort-label">${stop.resort}</span>`,
          iconSize: [1, 1],
          iconAnchor: [0, 26],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(areas)
    }

    const hotel = stayHotelPoint(stop)
    if (!hotel) return

    L.marker([hotel.lat, hotel.lng], { icon: hotelIcon(), keyboard: false })
      .bindTooltip(
        `${stop.hotel || 'Отель'} · ${formatDistance(distanceKm({ lat: stop.lat, lng: stop.lng }, hotel))} от курорта`,
        { direction: 'top', offset: [0, -14] },
      )
      .addTo(markers)
    points.push([hotel.lat, hotel.lng])

    L.polyline(
      [
        [stop.lat, stop.lng],
        [hotel.lat, hotel.lng],
      ],
      { color: '#a5b4fc', weight: 1.5, opacity: 0.85, dashArray: '3 5' },
    ).addTo(lines)

    if (stop.resort) {
      const mid: [number, number] = [(stop.lat + hotel.lat) / 2, (stop.lng + hotel.lng) / 2]
      L.marker(mid, { icon: distanceLabelIcon(), interactive: false, keyboard: false })
        .bindTooltip(formatDistance(distanceKm({ lat: stop.lat, lng: stop.lng }, hotel)), {
          permanent: true,
          direction: 'center',
          className: 'map-distance-label',
        })
        .addTo(markers)
    }
  })

  if (points.length === 0) return
  const [first] = points
  if (points.length === 1 && first) {
    mapInstance.setView(first, 6)
  } else {
    mapInstance.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 9 })
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
  areaLayer = L.layerGroup().addTo(map)

  render()
  window.setTimeout(() => map?.invalidateSize(), 120)
})

watch(signature, render)

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markerLayer = null
  lineLayer = null
  areaLayer = null
})
</script>

<template>
  <div class="map-wrap">
    <div class="map-title">
      <span class="node-kicker">Карта маршрута</span>
      <span class="map-hint">H — отель, зелёная зона — окрестности курорта (схема), пунктир — расстояние</span>
    </div>
    <div ref="container" class="map"></div>
    <div class="map-legend">
      <span class="map-legend-item"><i class="map-legend-dot resort" />курорт</span>
      <span class="map-legend-item"><i class="map-legend-dot hotel" />отель</span>
      <span class="map-legend-item"><i class="map-legend-line" />курорт → отель</span>
    </div>
  </div>
</template>