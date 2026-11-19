<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { account, isAdmin, lastSync, syncStatus, adminEmail } from '@/lib/account'
import {
  adminOpen,
  adminLog,
  adminSettings,
  closeAdmin,
  logAdminAction,
  updateAdminSettings,
} from '@/lib/admin'
import { activityIdeas } from '@/data/activity-ideas'
import { aiMetrics, aiSettings, deepseekAvailable, openAiSettings, acceptanceRate } from '@/lib/ai/settings'
import { partnerOffers, partnerRegions } from '@/data/partners'
import { loadStats, getStatsUrl, setStatsUrl, statsSummary, type StatsDay } from '@/lib/stats'
import { savedTrips } from '@/stores/trips'
import { shareApiUrl } from '@/lib/short-links'

type AdminTab = 'overview' | 'ai' | 'partners' | 'stats' | 'ugc' | 'flags' | 'users' | 'system'
const tab = ref<AdminTab>('overview')
const appVersion = __APP_VERSION__
const buildDate = __BUILD_DATE__
const tabs: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'ai', label: 'AI' },
  { key: 'partners', label: 'Партнёрки' },
  { key: 'stats', label: 'Статистика' },
  { key: 'ugc', label: 'UGC' },
  { key: 'flags', label: 'Флаги' },
  { key: 'users', label: 'Пользователи' },
  { key: 'system', label: 'Система' },
]

const days = ref<StatsDay[]>([])
const statsRemote = ref(false)
const statsLoading = ref(false)
const statsUrlValue = ref(getStatsUrl() ?? '')
const serverAdmin = ref<'unknown' | 'ok' | 'denied' | 'offline' | 'demo'>('unknown')

const stats = computed(() => statsSummary(days.value))
const activities = computed(() =>
  savedTrips.value.flatMap((trip) =>
    trip.stops.flatMap((stop) =>
      stop.kind === 'stay'
        ? (stop.activities ?? []).map((activity) => ({
          ...activity,
          trip: trip.name,
          place: stop.resort || stop.city || '',
        }))
        : [],
    ),
  ),
)
const bookedActivities = computed(() => activities.value.filter((item) => item.booked).length)

async function loadAdminStats(): Promise<void> {
  if (statsLoading.value) return
  statsLoading.value = true
  const result = await loadStats()
  days.value = result.days
  statsRemote.value = result.remote
  statsLoading.value = false
}

function saveStatsUrl(): void {
  setStatsUrl(statsUrlValue.value.trim() || null)
  void loadAdminStats()
}

async function checkServerAdmin(): Promise<void> {
  if (account.value?.demo) {
    serverAdmin.value = 'demo'
    return
  }
  if (!account.value?.session) {
    serverAdmin.value = 'denied'
    return
  }
  try {
    const response = await fetch(`${shareApiUrl()}/api/admin/me`, {
      headers: { authorization: `Bearer ${account.value.session}` },
    })
    serverAdmin.value = response.ok ? 'ok' : response.status === 403 ? 'denied' : 'offline'
  } catch {
    serverAdmin.value = 'offline'
  }
}

function toggleIdea(id: string): void {
  const hidden = new Set(adminSettings.value.hiddenIdeaIds)
  if (hidden.has(id)) hidden.delete(id)
  else hidden.add(id)
  updateAdminSettings({ hiddenIdeaIds: [...hidden] })
  logAdminAction(hidden.has(id) ? `скрыта идея ${id}` : `возвращена идея ${id}`)
}

watch(adminOpen, (open) => {
  if (!open) return
  statsUrlValue.value = getStatsUrl() ?? ''
  if (!days.value.length) void loadAdminStats()
  void checkServerAdmin()
})
</script>

<template>
  <div v-if="adminOpen" class="modal-backdrop" @click.self="closeAdmin">
    <div class="modal admin-modal" role="dialog" aria-modal="true" aria-label="Админ-панель">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Только для {{ adminEmail }}</div>
          <h3>Админ-панель проекта</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeAdmin">×</button>
      </div>

      <div v-if="!isAdmin" class="node-warn">
        Нет доступа: войдите по e-mail из allowlist.
      </div>

      <template v-else>
        <div class="admin-tabs" role="tablist">
          <button
            v-for="item in tabs"
            :key="item.key"
            type="button"
            class="mini-btn"
            :class="{ active: tab === item.key }"
            role="tab"
            :aria-selected="tab === item.key"
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="admin-body">
          <div v-if="tab === 'overview'" class="admin-grid">
            <div class="admin-card"><span>Версия</span><b>v{{ appVersion }}</b></div>
            <div class="admin-card"><span>Сборка</span><b>{{ buildDate }}</b></div>
            <div class="admin-card"><span>Аккаунт</span><b>{{ account?.email }}</b></div>
            <div class="admin-card"><span>Поездок в библиотеке</span><b>{{ savedTrips.length }}</b></div>
            <div class="admin-card"><span>Мероприятий</span><b>{{ activities.length }}</b></div>
            <div class="admin-card"><span>Синхронизация</span><b>{{ syncStatus }}</b></div>
            <div class="admin-card"><span>Последний sync</span><b>{{ lastSync ? new Date(lastSync).toLocaleString('ru-RU') : '—' }}</b></div>
            <div class="admin-card"><span>AI-запросы</span><b>{{ aiMetrics.requests }}</b></div>
          </div>

          <div v-else-if="tab === 'ai'" class="admin-list">
            <div class="admin-row"><span>OpenRouter</span><b>{{ aiSettings.apiKey ? 'ключ задан' : 'без ключа' }}</b></div>
            <div class="admin-row"><span>DeepSeek</span><b>{{ deepseekAvailable ? 'ключ задан' : 'без ключа' }}</b></div>
            <div class="admin-row"><span>Модели</span><b>{{ aiSettings.cheapModel }} / {{ aiSettings.midModel }} / {{ aiSettings.strongModel }}</b></div>
            <div class="admin-row"><span>DeepSeek model</span><b>{{ aiSettings.deepseekModel }}</b></div>
            <div class="admin-row"><span>Показы / принято</span><b>{{ aiMetrics.shown }} / {{ aiMetrics.accepted }} · {{ acceptanceRate() }}%</b></div>
            <div class="admin-row"><span>Стоимость</span><b>${{ aiMetrics.costUsd.toFixed(4) }}</b></div>
            <button type="button" class="primary-btn" @click="openAiSettings">Открыть настройки AI</button>
          </div>

          <div v-else-if="tab === 'partners'" class="admin-list">
            <div v-for="region in partnerRegions" :key="region.id" class="admin-block">
              <h4>{{ region.label }}</h4>
              <div v-for="offer in partnerOffers.filter((item) => item.region === region.id)" :key="offer.id" class="admin-row">
                <a :href="offer.url" target="_blank" rel="noopener sponsored">{{ offer.name }}</a>
                <b>{{ offer.note }}</b>
              </div>
            </div>
          </div>

          <div v-else-if="tab === 'stats'" class="admin-list">
            <div class="admin-grid">
              <div class="admin-card"><span>Уникальные</span><b>{{ stats.unique }}</b></div>
              <div class="admin-card"><span>Вернувшиеся</span><b>{{ stats.returning }}</b></div>
              <div class="admin-card"><span>Всего</span><b>{{ stats.visits }}</b></div>
              <div class="admin-card"><span>Источник</span><b>{{ statsRemote ? 'коллектор' : 'локально' }}</b></div>
            </div>
            <div class="admin-row">
              <span>URL коллектора</span>
              <input v-model="statsUrlValue" class="text-input" placeholder="https://stats.example.com" />
              <button type="button" class="mini-btn" @click="saveStatsUrl">Сохранить</button>
            </div>
            <p v-if="statsLoading" class="modal-note">Загружаю статистику…</p>
          </div>

          <div v-else-if="tab === 'ugc'" class="admin-list">
            <div class="admin-row"><span>Курируемые идеи</span><b>{{ activityIdeas.length }} · скрыто {{ adminSettings.hiddenIdeaIds.length }}</b></div>
            <div v-for="idea in activityIdeas.slice(0, 24)" :key="idea.id" class="admin-row admin-ugc">
              <span>{{ idea.resortId }} · {{ idea.kind }}</span>
              <b>{{ idea.title }}</b>
              <em>{{ adminSettings.hiddenIdeaIds.includes(idea.id) ? 'скрыто' : 'видно' }}</em>
              <button type="button" class="mini-btn" @click="toggleIdea(idea.id)">
                {{ adminSettings.hiddenIdeaIds.includes(idea.id) ? 'Вернуть' : 'Скрыть' }}
              </button>
            </div>
            <div class="admin-row"><span>Мероприятия пользователей</span><b>{{ activities.length }} · забронировано {{ bookedActivities }}</b></div>
            <div v-for="item in activities.slice(0, 20)" :key="item.trip + item.id" class="admin-row admin-ugc">
              <span>{{ item.trip }} · {{ item.place }}</span>
              <b>{{ item.title || item.placeName || 'Без названия' }}</b>
              <em>{{ item.kind || 'custom' }} · {{ item.booked ? 'бронь' : 'без брони' }}</em>
            </div>
            <p class="modal-note">Модерация UGC появится после общего бэкенда; сейчас список локальный.</p>
          </div>

          <div v-else-if="tab === 'flags'" class="admin-list">
            <label class="prep-check">
              <input
                type="checkbox"
                :checked="adminSettings.auditEnabled"
                @change="updateAdminSettings({ auditEnabled: ($event.target as HTMLInputElement).checked })"
              />
              <span><b>AI-аудит поездки</b><small>кнопка «Оценить через AI»</small></span>
            </label>
            <label class="prep-check">
              <input
                type="checkbox"
                :checked="adminSettings.hotelPickerEnabled"
                @change="updateAdminSettings({ hotelPickerEnabled: ($event.target as HTMLInputElement).checked })"
              />
              <span><b>Подбор отеля</b><small>карточки, расстояние и сезонность</small></span>
            </label>
            <label class="prep-check">
              <input
                type="checkbox"
                :checked="adminSettings.activitiesEnabled"
                @change="updateAdminSettings({ activitiesEnabled: ($event.target as HTMLInputElement).checked })"
              />
              <span><b>Мероприятия и идеи</b><small>аккордеон, партнёрские ссылки</small></span>
            </label>
            <label class="prep-check">
              <input
                type="checkbox"
                :checked="adminSettings.partnerBadges"
                @change="updateAdminSettings({ partnerBadges: ($event.target as HTMLInputElement).checked })"
              />
              <span><b>Пометка партнёрских ссылок</b><small>раскрытие комиссии</small></span>
            </label>
            <label class="prep-check">
              <input
                type="checkbox"
                :checked="adminSettings.maintenance"
                @change="updateAdminSettings({ maintenance: ($event.target as HTMLInputElement).checked })"
              />
              <span><b>Режим обслуживания</b><small>показывает предупреждение в шапке</small></span>
            </label>
            <label class="select-field">
              <span>Объявление в шапке</span>
              <input
                class="text-input"
                :value="adminSettings.announcement"
                maxlength="180"
                placeholder="Короткий текст или пусто"
                @input="updateAdminSettings({ announcement: ($event.target as HTMLInputElement).value })"
              />
            </label>
          </div>

          <div v-else-if="tab === 'users'" class="admin-list">
            <div class="admin-row"><span>Текущий</span><b>{{ account?.email }}</b></div>
            <div class="admin-row"><span>Allowlist</span><b>{{ adminEmail }}</b></div>
            <div class="admin-row"><span>Сессия</span><b>{{ account?.demo ? 'demo' : account?.session ? 'worker' : 'нет' }}</b></div>
            <p class="modal-note">Управление пользователями и ролями появится после общего бэкенда.</p>
          </div>

          <div v-else class="admin-list">
            <div class="admin-row"><span>Share Worker</span><b>{{ shareApiUrl() }}</b></div>
            <div class="admin-row"><span>Серверная роль</span><b>{{ serverAdmin }}</b></div>
            <div class="admin-row"><span>Календарь</span><b>sticky + мобильный скролл</b></div>
            <div class="admin-row"><span>Кэш AI</span><b>24 ч, localStorage</b></div>
            <div class="admin-row"><span>Схема данных</span><b>v1 · normalizeTrip</b></div>
            <div class="admin-row"><span>Журнал действий</span><b>{{ adminLog.length }} записей</b></div>
            <div v-for="entry in adminLog.slice(0, 8)" :key="entry.at + entry.action" class="admin-row admin-ugc">
              <span>{{ new Date(entry.at).toLocaleString('ru-RU') }}</span>
              <b>{{ entry.action }}</b>
            </div>
            <p class="modal-note">Секреты Worker (RESEND_API_KEY, MAIL_FROM, ALLOW_DEV_LINKS) задаются через wrangler, не в браузере.</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
