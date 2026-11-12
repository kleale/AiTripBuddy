<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { GuideCurrency, ResortGuide } from '@/data/resort-guides'

const props = defineProps<{
  guide: ResortGuide
  selectedZoneId: string | null
}>()

const emit = defineEmits<{ select: [zoneId: string] }>()

const container = ref<HTMLDivElement | null>(null)
const failed = ref(false)

let map: MapLibreMap | null = null
let markers: Marker[] = []
let cleanupObserver: (() => void) | null = null

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
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem',
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

  mapInstance.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'top-right')
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
  })

  const observer = new ResizeObserver(() => mapInstance.resize())
  observer.observe(host)
  cleanupObserver = () => observer.disconnect()
}

watch(
  () => props.selectedZoneId,
  () => applySelection(),
)

onMounted(init)

onBeforeUnmount(() => {
  cleanupObserver?.()
  cleanupObserver = null
  for (const marker of markers) marker.remove()
  markers = []
  map?.remove()
  map = null
})
</script>

<template>
  <div class="scene3d-wrap">
    <div ref="container" class="scene3d" role="img" :aria-label="`3D-карта курорта ${guide.title}`" />
    <div v-if="failed" class="scene3d-fallback">
      3D-карта недоступна: браузер не поддерживает WebGL.
    </div>
    <div class="scene3d-badge">3D-рельеф · OSM</div>
  </div>
</template>