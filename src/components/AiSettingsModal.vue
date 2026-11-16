<script setup lang="ts">
import { computed } from 'vue'
import {
  acceptanceRate,
  aiMetrics,
  aiSettings,
  aiSettingsOpen,
  closeAiSettings,
  resetAiMetrics,
  saveAiSettings,
  type AiSettings,
} from '@/lib/ai/settings'
import { clearAiCache } from '@/lib/ai/agent'

const rate = computed(() => acceptanceRate())
const cost = computed(() => aiMetrics.costUsd.toFixed(4))

function update(key: 'apiKey' | 'cheapModel' | 'midModel' | 'strongModel', event: Event): void {
  saveAiSettings({ [key]: (event.target as HTMLInputElement).value } as Partial<AiSettings>)
}

function toggle(event: Event): void {
  saveAiSettings({ enabled: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <div v-if="aiSettingsOpen" class="modal-backdrop" @click.self="closeAiSettings">
    <div class="modal ai-modal" role="dialog" aria-modal="true" aria-label="Настройки AI">
      <div class="modal-head">
        <div>
          <div class="node-kicker">AI-подсказки цен</div>
          <h3>OpenRouter и инструменты</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeAiSettings">×</button>
      </div>

      <div class="ai-body">
        <p class="guide-text">
          Ключ хранится только в этом браузере. Запросы идут напрямую в OpenRouter; цифры берутся из tools справочника.
        </p>

        <label class="prep-check">
          <input type="checkbox" :checked="aiSettings.enabled" @change="toggle" />
          <span><b>Включить LLM</b><small>без ключа работает локальная оценка</small></span>
        </label>

        <label class="select-field">
          <span>OpenRouter API key</span>
          <input
            class="text-input"
            type="password"
            placeholder="sk-or-v1-…"
            :value="aiSettings.apiKey"
            autocomplete="off"
            @input="update('apiKey', $event)"
          />
        </label>

        <div class="modal-grid">
          <label class="select-field">
            <span>Cheap · парсинг</span>
            <input class="text-input" :value="aiSettings.cheapModel" @input="update('cheapModel', $event)" />
          </label>
          <label class="select-field">
            <span>Mid · синтез</span>
            <input class="text-input" :value="aiSettings.midModel" @input="update('midModel', $event)" />
          </label>
          <label class="select-field">
            <span>Strong · сравнение</span>
            <input class="text-input" :value="aiSettings.strongModel" @input="update('strongModel', $event)" />
          </label>
        </div>

        <div class="ai-metrics">
          <div><span>Показано</span><b>{{ aiMetrics.shown }}</b></div>
          <div><span>Принято</span><b>{{ aiMetrics.accepted }}</b></div>
          <div><span>Acceptance</span><b>{{ rate }}%</b></div>
          <div><span>Запросы</span><b>{{ aiMetrics.requests }}</b></div>
          <div><span>Стоимость</span><b>${{ cost }}</b></div>
        </div>

        <div class="ai-actions">
          <button type="button" class="mini-btn" @click="clearAiCache">Очистить кэш 24 ч</button>
          <button type="button" class="mini-btn" @click="resetAiMetrics">Сбросить метрики</button>
          <button type="button" class="primary-btn" @click="closeAiSettings">Готово</button>
        </div>
      </div>
    </div>
  </div>
</template>
