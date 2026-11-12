import { toIsoDate } from './schedule'
import type { Trip } from '@/types'
import { normalizeTrip } from '@/stores/trip'

/**
 * Упаковка набора поездок в URL.
 * Формат: <префикс><base64url>, где префикс z — deflate, j — чистый JSON.
 */
const VERSION = 1

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/** Сериализует поездки в компактный код для ссылки. */
export async function encodeTrips(trips: Trip[]): Promise<string> {
  const payload = JSON.stringify({ v: VERSION, trips })
  const raw = encoder.encode(payload)
  const packed = await deflate(raw)
  if (packed && packed.length < raw.length) return `z${bytesToBase64Url(packed)}`
  return `j${bytesToBase64Url(raw)}`
}

/** Читает набор поездок из кода ссылки. Возвращает null при повреждённых данных. */
export async function decodeTrips(code: string): Promise<Trip[] | null> {
  if (!code) return null
  const prefix = code[0]
  const body = code.slice(1)
  try {
    const bytes = base64UrlToBytes(body)
    const raw = prefix === 'z' ? await inflate(bytes) : bytes
    if (!raw) return null
    const parsed = JSON.parse(decoder.decode(raw)) as { v?: number; trips?: unknown }
    if (!parsed || !Array.isArray(parsed.trips)) return null
    return parsed.trips
      .filter((item): item is Trip => Boolean(item) && Array.isArray((item as Trip).stops))
      .map((item) => normalizeTrip(item))
  } catch {
    return null
  }
}

export function shareCodeFromLocation(): string | null {
  if (typeof location === 'undefined') return null
  const hash = location.hash
  const match = /(?:^#|&)trips=([A-Za-z0-9_-]+)/.exec(hash)
  if (match?.[1]) return match[1]
  const query = new URLSearchParams(location.search).get('trips')
  return query && /^[A-Za-z0-9_-]+$/.test(query) ? query : null
}

/** Ссылка на приложение с набором поездок в хэше. */
export function buildShareUrl(origin: string, pathname: string, code: string): string {
  return `${origin}${pathname}#trips=${code}`
}

/** Дата сборки ссылки — для пометки в интерфейсе. */
export function shareStamp(): string {
  return toIsoDate(new Date())
}