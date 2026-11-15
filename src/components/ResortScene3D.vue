<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite переписывает URL воркера, иначе MapLibre ищет maplibre-gl-worker.mjs рядом с чанком
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature, FeatureCollection } from 'geojson'
import type { ResortGuide } from '@/data/resort-guides'
import type { DataConfidence, TrailDataset } from '@/data/trail-maps'
import type { FreerideInfo } from '@/data/freeride'
import { liftColors, trailColors } from '@/lib/trail-map'
import { distanceKm, formatDistance } from '@/lib/geo'
import { formatGuidePrice } from '@/lib/guide-format'

export interface MapLayerState {
  trails: boolean
  lifts: boolean
  areas: boolean
  backcountry: boolean
  snow: boolean
}

const props = defineProps<{
  guide: ResortGuide
  selectedZoneId: string | null
  hotelName?: string
  hotelPoint?: { lat: number; lng: number } | null
  hotelDistance?: number
  hotelExact?: boolean
  /** Набор трасс, подъёмников и зон; есть пока только у Хакубы. */
  dataset?: TrailDataset | null
  /** Фрирайд-зоны и вороты: показываются слоем «Backcountry». */
  freeride?: FreerideInfo | null
  layers?: MapLayerState
}>()

const defaults: MapLayerState = {
  trails: true,
  lifts: true,
  areas: true,
  backcountry: true,
  snow: false,
}

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

const TRAIL_SOURCE = 'trail-source'
const TRAIL_CASING = 'trail-casing'
const TRAIL_LINE = 'trail-line'
const LIFT_SOURCE = 'lift-source'
const LIFT_LINE = 'lift-line'
const AREA_SOURCE = 'area-source'
const AREA_FILL = 'area-fill'
const AREA_OUTLINE = 'area-outline'
const BC_SOURCE = 'bc-source'
const BC_LINE = 'bc-line'
const SNOW_SOURCE = 'snow-source'
const SNOW_FILL = 'snow-fill'
const FR_SOURCE = 'freeride-source'
const FR_FILL = 'freeride-fill'
const FR_OUTLINE = 'freeride-outline'
const FR_GATE_SOURCE = 'freeride-gate-source'
const FR_GATE = 'freeride-gate'
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
    element.title = `${zone.name} · ${formatGuidePrice(zone.passPrice, zone.passCurrency)} · ${zone.baseAltitude}–${zone.topAltitude} м`
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


function layerState(): MapLayerState {
  return { ...defaults, ...(props.layers ?? {}) }
}

function isActiveZone(zoneId: string): boolean {
  return !props.selectedZoneId || props.selectedZoneId === zoneId
}

/** Трассы: цвет по сложности, приглушение невыбранных зон через opacity. */
function trailData(): FeatureCollection {
  const dataset = props.dataset
  if (!dataset) return { type: 'FeatureCollection', features: [] }

  const features: Feature[] = dataset.trails
    .filter((trail) => isActiveZone(trail.zoneId))
    .map((trail) => ({
      type: 'Feature',
      properties: {
        id: trail.id,
        name: trail.name,
        color: trailColors[trail.difficulty],
        difficulty: trail.difficulty,
        width: trail.widthM ?? 0,
        gradient: trail.gradientPercent ?? 0,
        lit: trail.lit,
        status: trail.status,
        open: trail.status === 'open',
        active: props.selectedZoneId ? trail.zoneId === props.selectedZoneId : true,
      },
      geometry: { type: 'LineString', coordinates: trail.coordinates },
    }))

  return { type: 'FeatureCollection', features }
}

function liftData(): FeatureCollection {
  const dataset = props.dataset
  if (!dataset) return { type: 'FeatureCollection', features: [] }

  const features: Feature[] = dataset.lifts
    .filter((lift) => isActiveZone(lift.zoneId))
    .map((lift) => ({
      type: 'Feature',
      properties: {
        id: lift.id,
        name: lift.name,
        color: liftColors[lift.type],
        type: lift.type,
        status: lift.status,
        open: lift.status === 'open',
      },
      geometry: { type: 'LineString', coordinates: lift.coordinates },
    }))

  return { type: 'FeatureCollection', features }
}

function areaData(): FeatureCollection {
  const dataset = props.dataset
  if (!dataset) return { type: 'FeatureCollection', features: [] }

  const palette: Record<string, string> = {
    snowpark: '#f472b6',
    halfpipe: '#c084fc',
    patrolled: '#38bdf8',
    backcountry: '#fb923c',
    night: '#facc15',
  }

  const features: Feature[] = dataset.areas.map((area) => ({
    type: 'Feature',
    properties: {
      id: area.id,
      name: area.name,
      kind: area.kind,
      color: palette[area.kind] ?? '#94a3b8',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[...area.coordinates, area.coordinates[0] ?? [0, 0]]],
    },
  }))

  return { type: 'FeatureCollection', features }
}

function backcountryData(): FeatureCollection {
  const dataset = props.dataset
  if (!dataset) return { type: 'FeatureCollection', features: [] }

  const palette: Record<string, string> = {
    low: '#34d399',
    moderate: '#fbbf24',
    considerable: '#fb923c',
    high: '#fb7185',
  }

  const features: Feature[] = dataset.backcountry.map((route) => ({
    type: 'Feature',
    properties: {
      id: route.id,
      name: route.name,
      hazard: route.hazard,
      color: palette[route.hazard] ?? '#fb923c',
      note: route.note,
    },
    geometry: { type: 'LineString', coordinates: route.coordinates },
  }))

  return { type: 'FeatureCollection', features }
}

function snowData(): FeatureCollection {
  const dataset = props.dataset
  if (!dataset) return { type: 'FeatureCollection', features: [] }

  const palette: Record<string, string> = {
    powder: '#7dd3fc',
    packed: '#a3e635',
    hard: '#fbbf24',
    wet: '#38bdf8',
    ice: '#93c5fd',
    rocks: '#a16207',
  }

  const features: Feature[] = []

  for (const state of dataset.snow) {
    const zone = props.guide.zones.find((item) => item.id === state.zoneId)
    if (!zone) continue

    // круг радиусом ~1.1 км вокруг базы зоны
    const ring: [number, number][] = []
    const steps = 24
    const rLat = 0.01
    const rLng = 0.012
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2
      ring.push([zone.base.lng + Math.cos(angle) * rLng, zone.base.lat + Math.sin(angle) * rLat])
    }
    ring.push(ring[0] as [number, number])

    features.push({
      type: 'Feature',
      properties: {
        id: 'snow-' + state.zoneId,
        condition: state.condition,
        color: palette[state.condition] ?? '#94a3b8',
        fresh: state.freshCm,
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }

  return { type: 'FeatureCollection', features }
}

/** Полигоны фрирайд-зон: цвет по уровню лавинной опасности. */
function freerideZoneData(): FeatureCollection {
  const info = props.freeride
  if (!info) return { type: 'FeatureCollection', features: [] }

  const palette: Record<string, string> = {
    low: '#34d399',
    moderate: '#fbbf24',
    considerable: '#fb923c',
    high: '#fb7185',
  }

  const features: Feature[] = info.zones.map((zone) => ({
    type: 'Feature',
    properties: {
      id: zone.id,
      name: zone.name,
      hazard: zone.hazard,
      color: palette[zone.hazard] ?? '#fb923c',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[...zone.coordinates, zone.coordinates[0] ?? [0, 0]]],
    },
  }))

  return { type: 'FeatureCollection', features }
}

/** Точки ворот фрирайда. */
function freerideGateData(): FeatureCollection {
  const info = props.freeride
  if (!info) return { type: 'FeatureCollection', features: [] }

  const palette: Record<string, string> = {
    low: '#34d399',
    moderate: '#fbbf24',
    considerable: '#fb923c',
    high: '#fb7185',
  }

  const features: Feature[] = info.gates.map((gate) => ({
    type: 'Feature',
    properties: {
      id: gate.id,
      name: gate.name,
      hazard: gate.hazard,
      guided: gate.guided,
      color: palette[gate.hazard] ?? '#fb923c',
    },
    geometry: { type: 'Point', coordinates: [gate.lng, gate.lat] },
  }))

  return { type: 'FeatureCollection', features }
}

function setDataIfReady(sourceId: string, data: FeatureCollection): void {
  const source = map?.getSource(sourceId) as GeoJSONSource | undefined
  if (source) void source.setData(data)
}

function syncLayers(): void {
  const mapInstance = map
  if (!mapInstance || !mapInstance.isStyleLoaded()) return

  setDataIfReady(TRAIL_SOURCE, trailData())
  setDataIfReady(LIFT_SOURCE, liftData())
  setDataIfReady(AREA_SOURCE, areaData())
  setDataIfReady(BC_SOURCE, backcountryData())
  setDataIfReady(SNOW_SOURCE, snowData())
  setDataIfReady(FR_SOURCE, freerideZoneData())
  setDataIfReady(FR_GATE_SOURCE, freerideGateData())

  const state = layerState()
  if (mapInstance.getLayer(TRAIL_CASING)) {
    mapInstance.setLayoutProperty(TRAIL_CASING, 'visibility', state.trails ? 'visible' : 'none')
    mapInstance.setLayoutProperty(TRAIL_LINE, 'visibility', state.trails ? 'visible' : 'none')
  }
  if (mapInstance.getLayer(LIFT_LINE)) {
    mapInstance.setLayoutProperty(LIFT_LINE, 'visibility', state.lifts ? 'visible' : 'none')
  }
  if (mapInstance.getLayer(AREA_FILL)) {
    mapInstance.setLayoutProperty(AREA_FILL, 'visibility', state.areas ? 'visible' : 'none')
    mapInstance.setLayoutProperty(AREA_OUTLINE, 'visibility', state.areas ? 'visible' : 'none')
  }
  if (mapInstance.getLayer(BC_LINE)) {
    mapInstance.setLayoutProperty(BC_LINE, 'visibility', state.backcountry ? 'visible' : 'none')
  }
  if (mapInstance.getLayer(SNOW_FILL)) {
    mapInstance.setLayoutProperty(SNOW_FILL, 'visibility', state.snow ? 'visible' : 'none')
  }
  for (const layerId of [FR_FILL, FR_OUTLINE, FR_GATE]) {
    if (!mapInstance.getLayer(layerId)) continue
    mapInstance.setLayoutProperty(layerId, 'visibility', state.backcountry ? 'visible' : 'none')
  }
}

/** Регистрирует источники и слои трасс, подъёмников, зон, backcountry и снега. */
function ensureDataLayers(): void {
  const mapInstance = map
  if (!mapInstance || !mapInstance.isStyleLoaded() || !props.dataset) return
  if (mapInstance.getSource(TRAIL_SOURCE)) return

  try {
    mapInstance.addSource(TRAIL_SOURCE, { type: 'geojson', data: trailData() })
    mapInstance.addSource(LIFT_SOURCE, { type: 'geojson', data: liftData() })
    mapInstance.addSource(AREA_SOURCE, { type: 'geojson', data: areaData() })
    mapInstance.addSource(BC_SOURCE, { type: 'geojson', data: backcountryData() })
    mapInstance.addSource(SNOW_SOURCE, { type: 'geojson', data: snowData() })
    mapInstance.addSource(FR_SOURCE, { type: 'geojson', data: freerideZoneData() })
    mapInstance.addSource(FR_GATE_SOURCE, { type: 'geojson', data: freerideGateData() })

    mapInstance.addLayer({
      id: SNOW_FILL,
      type: 'fill',
      source: SNOW_SOURCE,
      paint: {
        'fill-color': ['get', 'color'] as never,
        'fill-opacity': 0.16,
      },
    })

    mapInstance.addLayer({
      id: AREA_FILL,
      type: 'fill',
      source: AREA_SOURCE,
      paint: {
        'fill-color': ['get', 'color'] as never,
        'fill-opacity': 0.1,
      },
    })

    mapInstance.addLayer({
      id: AREA_OUTLINE,
      type: 'line',
      source: AREA_SOURCE,
      paint: {
        'line-color': ['get', 'color'] as never,
        'line-width': 1.4,
        'line-opacity': 0.65,
        'line-dasharray': [3, 2],
      },
    })

    mapInstance.addLayer({
      id: BC_LINE,
      type: 'line',
      source: BC_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'] as never,
        'line-width': 2,
        'line-opacity': 0.8,
        'line-dasharray': [1.6, 1.6],
      },
    })

    mapInstance.addLayer({
      id: LIFT_LINE,
      type: 'line',
      source: LIFT_SOURCE,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'] as never,
        'line-width': 2.2,
        'line-opacity': ['case', ['==', ['get', 'status'], 'closed'], 0.4, 0.9] as never,
        'line-dasharray': [2, 1.4],
      },
    })

    mapInstance.addLayer({
      id: FR_FILL,
      type: 'fill',
      source: FR_SOURCE,
      paint: {
        'fill-color': ['get', 'color'] as never,
        'fill-opacity': 0.12,
      },
    })

    mapInstance.addLayer({
      id: FR_OUTLINE,
      type: 'line',
      source: FR_SOURCE,
      paint: {
        'line-color': ['get', 'color'] as never,
        'line-width': 1.6,
        'line-opacity': 0.75,
        'line-dasharray': [3, 2],
      },
    })

    mapInstance.addLayer({
      id: FR_GATE,
      type: 'circle',
      source: FR_GATE_SOURCE,
      paint: {
        'circle-radius': 5,
        'circle-color': ['get', 'color'] as never,
        'circle-stroke-color': '#0b1220',
        'circle-stroke-width': 2,
      },
    })

    mapInstance.addLayer({
      id: TRAIL_CASING,
      type: 'line',
      source: TRAIL_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#0b1220',
        'line-width': ['case', ['==', ['get', 'active'], true], 7, 5] as never,
        'line-opacity': 0.75,
      },
    })

    mapInstance.addLayer({
      id: TRAIL_LINE,
      type: 'line',
      source: TRAIL_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'] as never,
        'line-width': ['case', ['==', ['get', 'active'], true], 3.4, 2.2] as never,
        'line-opacity': [
          'case',
          ['==', ['get', 'status'], 'open'],
          1,
          ['==', ['get', 'status'], 'closed'],
          0.35,
          0.85,
        ] as never,
      },
    })
  } catch {
    // стиль ещё применяется — повторим на следующем idle
  }

  syncLayers()
}

function trailPopup(event: MapMouseEvent): void {
  const mapInstance = map
  if (!mapInstance || !props.dataset) return

  const features = mapInstance.queryRenderedFeatures(event.point, {
    layers: [TRAIL_LINE, LIFT_LINE, BC_LINE],
  })
  const hit = features[0]
  if (!hit) return

  const name = String(hit.properties?.name ?? '')
  if (!name) return

  const probability: Record<DataConfidence, string> = {
    verified: 'проверено',
    curated: 'геометрия OSM',
    estimate: 'оценка',
  }
  const kind = hit.layer?.id === LIFT_LINE ? 'lifts' : hit.layer?.id === BC_LINE ? 'backcountry' : 'trails'
  const items =
    kind === 'trails'
      ? props.dataset.trails.filter((trail) => trail.name === name)
      : kind === 'lifts'
        ? props.dataset.lifts.filter((lift) => lift.name === name)
        : []
  const record = items[0]
  const confidence = record
    ? kind === 'trails' && 'confidence' in record
      ? probability[(record as { confidence: { attributes: DataConfidence } }).confidence.attributes]
      : kind === 'lifts'
        ? probability[(record as { confidence: DataConfidence }).confidence]
        : 'без оценки'
    : 'без оценки'

  new Popup({ offset: 12, closeButton: false, className: 'map-popup' })
    .setLngLat(event.lngLat)
    .setHTML('<strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(confidence) + '</span>')
    .addTo(mapInstance)
}

function ensureMeasureLayers(): void {
  const mapInstance = map
  if (!mapInstance || !mapInstance.isStyleLoaded() || mapInstance.getSource(MEASURE_SOURCE)) return

  try {
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
  } catch {
    // стиль ещё применяется — слои добавим на событии load
  }
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

function setMeasureCursor(): void {
  const canvas = map?.getCanvas()
  if (canvas) canvas.style.cursor = measuring.value ? 'crosshair' : ''
}

function toggleMeasure(): void {
  measuring.value = !measuring.value
  container.value?.classList.toggle('measuring', measuring.value)
  if (measuring.value) {
    ensureMeasureLayers()
  } else {
    clearMeasure()
  }
  setMeasureCursor()
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
  mapInstance.on('click', trailPopup)
  mapInstance.on('idle', ensureDataLayers)

  mapInstance.on('load', () => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __guideMap?: MapLibreMap }).__guideMap = mapInstance
    }
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
    ensureDataLayers()
    if (measuring.value) ensureMeasureLayers()
    setMeasureCursor()
  })

  const observer = new ResizeObserver(() => mapInstance.resize())
  observer.observe(host)
  cleanupObserver = () => observer.disconnect()
}

watch(
  () => props.selectedZoneId,
  () => {
    applySelection()
    syncLayers()
  },
)

watch(
  () => props.layers,
  () => syncLayers(),
  { deep: true },
)

watch(
  () => props.dataset,
  () => {
    ensureDataLayers()
    syncLayers()
  },
)

watch(
  () => props.freeride,
  () => {
    ensureDataLayers()
    syncLayers()
  },
  { deep: true },
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