<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite переписывает URL воркера, иначе MapLibre ищет maplibre-gl-worker.mjs рядом с чанком
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { GuideCurrency, ResortGuide } from '@/data/resort-guides'

const props = defineProps<{
  guide: ResortGuide
  selectedZoneId: string | null
  hotelName?: string
  hotelPoint?: { lat: number; lng: number } | null
  hotelDistance?: number
  hotelExact?: boolean
}>()

const emit = defineEmits<{ select: [zoneId: string] }>()

const container = ref<HTMLDivElement | null>(null)
const failed = ref(false)
const is3D = ref(true)

const PITCH_3D = 62

setWorkerUrl(workerUrl)

let map: MapLibreMap | null = null
let markers: Marker[] = []
let hotelMarker: Marker | null = null
let cleanupObserver: (() => void) | null = null

function formatKm(value?: number): string {
  if (!value || !Number.isFinite(value) || value <= 0) return ''
  return value < 1 ? `${Math.round(value * 1000)} м` : `${value.toFixed(1)} км`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Переключение вида: объёмный 3D-рельеф или вид сверху. */
function setView(mode: '3d' | 'top'): void {
  is3D.value = mode === '3d'
  if (!map) return
  map.easeTo({ pitch: is3D.value ? PITCH_3D : 0, duration: 700 })
}

function priceLabel(value: number, currency: GuideCurrency): string {
  const symbol = currency === 'JPY' ? '¥' : '₽'
  return `${new Intl.NumberFormat('ru-RU').format(value)} ${symbol}`
}

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      },
      dem: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
      },
      hillshadeDem: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
      },
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshadeDem',
        paint: {
          'hillshade-exaggeration': 0.45,
          'hillshade-shadow-color': '#0a1322',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-illumination-direction': 315,
        },
      },
    ],
  }
}

function addMarkers(): void {
  const mapInstance = map
  if (!mapInstance) return
  for (const marker of markers) marker.remove()
  markers = []

  props.guide.zones.forEach((zone, index) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'guide-map-pin'
    element.title = `${zone.name} · ${priceLabel(zone.passPrice, zone.passCurrency)} · ${zone.baseAltitude}–${zone.topAltitude} м`
    element.innerHTML = `<span>${index + 1}</span>`
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      emit('select', zone.id)
    })
    const marker = new Marker({
      element,
      anchor: 'center',
      opacityWhenCovered: 1,
    })
      .setLngLat([zone.base.lng, zone.base.lat])
      .addTo(mapInstance)
    markers.push(marker)
  })
  applySelection()
}

function applySelection(): void {
  const selected = props.selectedZoneId
  markers.forEach((marker, index) => {
    const element = marker.getElement()
    const zone = props.guide.zones[index]
    element.classList.toggle('active', Boolean(zone && selected === zone.id))
    element.classList.toggle('dimmed', Boolean(selected) && zone?.id !== selected)
  })
}

/** Точка отеля на 3D-карте: показывает, где вы живёте относительно частей курорта. */
function updateHotelMarker(): void {
  hotelMarker?.remove()
  hotelMarker = null
  const mapInstance = map
  if (!mapInstance || !props.hotelPoint) return

  const distance = formatKm(props.hotelDistance)
  const name = props.hotelName?.trim() || 'Ваш отель'
  const element = document.createElement('div')
  element.className = 'guide-hotel-pin'
  element.innerHTML = `<span class="guide-hotel-dot">H</span><span class="guide-hotel-label">${escapeHtml(name)}${
    distance ? ` · ${distance}` : ''
  }</span>`
  element.title = `${name}${distance ? ` · ${distance} от курорта` : ''}${
    props.hotelExact ? '' : ' · координаты приблизительные'
  }`

  hotelMarker = new Marker({ element, anchor: 'left', opacityWhenCovered: 1 })
    .setLngLat([props.hotelPoint.lng, props.hotelPoint.lat])
    .addTo(mapInstance)
}

function fitToGuide(): void {
  if (!map) return
  const bounds = new LngLatBounds()
  for (const zone of props.guide.zones) {
    bounds.extend([zone.base.lng, zone.base.lat])
    bounds.extend([zone.summit.lng, zone.summit.lat])
  }
  map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 0 })
}

function init(): void {
  const host = container.value
  if (!host) return

  try {
    map = new MapLibreMap({
      container: host,
      style: buildStyle(),
      center: [props.guide.zones[0]?.base.lng ?? 0, props.guide.zones[0]?.base.lat ?? 0],
      zoom: 12,
      pitch: 62,
      bearing: -18,
      attributionControl: { compact: true },
      maxPitch: 78,
    })
  } catch {
    failed.value = true
    return
  }

  const mapInstance = map

  mapInstance.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right')
  mapInstance.dragRotate.enable()
  mapInstance.touchZoomRotate.enableRotation()
  mapInstance.scrollZoom.enable()

  mapInstance.on('error', () => {
    // тайлы могут быть недоступны без сети — не роняем гид
  })

  mapInstance.on('load', () => {
    mapInstance.setTerrain({ source: 'dem', exaggeration: 1.6 })
    try {
      mapInstance.setSky({
        'sky-color': '#070d17',
        'horizon-color': '#14243d',
        'fog-color': '#0a1322',
        'sky-horizon-blend': 0.7,
        'horizon-fog-blend': 0.4,
        'fog-ground-blend': 0.9,
      })
    } catch {
      // setSky доступен не во всех версиях — не критично
    }
    addMarkers()
    fitToGuide()
    updateHotelMarker()
  })

  const observer = new ResizeObserver(() => mapInstance.resize())
  observer.observe(host)
  cleanupObserver = () => observer.disconnect()
}

watch(
  () => props.selectedZoneId,
  () => applySelection(),
)

watch(
  () => props.hotelPoint,
  () => updateHotelMarker(),
  { deep: true },
)

watch(
  () => [props.hotelName, props.hotelDistance, props.hotelExact],
  () => updateHotelMarker(),
)

onMounted(init)

onBeforeUnmount(() => {
  cleanupObserver?.()
  cleanupObserver = null
  for (const marker of markers) marker.remove()
  markers = []
  hotelMarker?.remove()
  hotelMarker = null
  map?.remove()
  map = null
})
</script>

<template>
  <div class="scene3d-wrap">
    <div ref="container" class="scene3d" role="img" :aria-label="`3D-карта курорта ${guide.title}`" />

    <div class="scene-view-toggle" role="group" aria-label="Вид карты">
      <button
        type="button"
        :class="{ active: is3D }"
        :aria-pressed="is3D"
        title="Объёмный вид с рельефом"
        @click="setView('3d')"
      >
        3D
      </button>
      <button
        type="button"
        :class="{ active: !is3D }"
        :aria-pressed="!is3D"
        title="Вид сверху, без наклона"
        @click="setView('top')"
      >
        Сверху
      </button>
    </div>

    <div v-if="failed" class="scene3d-fallback">
      3D-карта недоступна: браузер не поддерживает WebGL.
    </div>
    <div class="scene3d-badge">3D-рельеф · OSM</div>
  </div>
</template>