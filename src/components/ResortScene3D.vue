<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite переписывает URL воркера, иначе MapLibre ищет maplibre-gl-worker.mjs рядом с чанком
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature, FeatureCollection } from 'geojson'
import type { GuideCurrency, ResortGuide } from '@/data/resort-guides'
import { distanceKm, formatDistance } from '@/lib/geo'

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
const measuring = ref(false)
const measureTotal = ref(0)
const measureCount = ref(0)

const PITCH_3D = 62

setWorkerUrl(workerUrl)

let map: MapLibreMap | null = null
let markers: Marker[] = []
let hotelMarker: Marker | null = null
let measurePoints: [number, number][] = []

const MEASURE_SOURCE = 'guide-measure'
const MEASURE_LINE = 'guide-measure-line'
const MEASURE_POINTS = 'guide-measure-points'
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

function measureData(): FeatureCollection {
  const features: Feature[] = measurePoints.map(([lng, lat]) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lng, lat] },
  }))
  if (measurePoints.length > 1) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: measurePoints },
    })
  }
  return { type: 'FeatureCollection', features }
}

function ensureMeasureLayers(): void {
  const mapInstance = map
  if (!mapInstance || mapInstance.getSource(MEASURE_SOURCE)) return
  mapInstance.addSource(MEASURE_SOURCE, { type: 'geojson', data: measureData() })
  mapInstance.addLayer({
    id: MEASURE_LINE,
    type: 'line',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#f8fafc',
      'line-width': 2,
      'line-dasharray': [2, 1.5],
      'line-opacity': 0.95,
    },
  })
  mapInstance.addLayer({
    id: MEASURE_POINTS,
    type: 'circle',
    source: MEASURE_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': '#38bdf8',
      'circle-stroke-color': '#0b1220',
      'circle-stroke-width': 2,
    },
  })
}

function recalcMeasure(): void {
  let total = 0
  for (let i = 1; i < measurePoints.length; i += 1) {
    const [lng1, lat1] = measurePoints[i - 1] as [number, number]
    const [lng2, lat2] = measurePoints[i] as [number, number]
    total += distanceKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
  }
  measureTotal.value = total
  measureCount.value = measurePoints.length

  const source = map?.getSource(MEASURE_SOURCE) as GeoJSONSource | undefined
  if (source) void source.setData(measureData())
}

function onMeasureClick(event: MapMouseEvent): void {
  if (!measuring.value) return
  measurePoints.push([event.lngLat.lng, event.lngLat.lat])
  recalcMeasure()
}

function toggleMeasure(): void {
  measuring.value = !measuring.value
  container.value?.classList.toggle('measuring', measuring.value)
  if (measuring.value) {
    ensureMeasureLayers()
  } else {
    clearMeasure()
  }
}

function clearMeasure(): void {
  measurePoints = []
  measureTotal.value = 0
  measureCount.value = 0
  const source = map?.getSource(MEASURE_SOURCE) as GeoJSONSource | undefined
  if (source) void source.setData(measureData())
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

  mapInstance.on('click', onMeasureClick)

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
    if (measuring.value) ensureMeasureLayers()
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
  measurePoints = []
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
      <button
        type="button"
        :class="{ active: measuring }"
        :aria-pressed="measuring"
        title="Линейка: измерять расстояние по карте"
        @click="toggleMeasure"
      >
        Линейка
      </button>
    </div>

    <div v-if="measuring" class="scene-measure">
      <span class="scene-measure-label">
        {{ measureCount > 1 ? formatDistance(measureTotal) : 'кликните по карте' }}
      </span>
      <span v-if="measureCount > 1" class="scene-measure-points">точек: {{ measureCount }}</span>
      <button
        v-if="measureCount > 0"
        type="button"
        class="scene-measure-clear"
        @click="clearMeasure"
      >
        Сбросить
      </button>
    </div>

    <div v-if="failed" class="scene3d-fallback">
      3D-карта недоступна: браузер не поддерживает WebGL.
    </div>
    <div class="scene3d-badge">3D-рельеф · OSM</div>
  </div>
</template>