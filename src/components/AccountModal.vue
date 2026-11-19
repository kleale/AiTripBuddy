<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  account,
  accountOpen,
  authBusy,
  authError,
  authMessage,
  closeAccount,
  deleteAccount,
  devLink,
  isAdmin,
  lastSync,
  requestMagicLink,
  signOut,
  signedIn,
  syncLibrary,
  syncStatus,
} from '@/lib/account'
import { openAdmin } from '@/lib/admin'

const email = ref('')
const syncLabel = computed(() => {
  if (syncStatus.value === 'syncing') return 'Синхронизация…'
  if (syncStatus.value === 'error') return 'Ошибка синхронизации'
  if (syncStatus.value === 'synced') return 'Синхронизировано'
  return 'Локальный режим'
})

async function submit(): Promise<void> {
  await requestMagicLink(email.value)
}

async function doSync(): Promise<void> {
  await syncLibrary()
}

async function leave(): Promise<void> {
  await signOut()
}

async function removeAccount(): Promise<void> {
  if (!confirm('Удалить аккаунт и облачную библиотеку? Локальные поездки останутся на этом устройстве.')) {
    return
  }
  const ok = await deleteAccount()
  if (!ok) authError.value = 'Не удалось удалить аккаунт. Проверьте сеть.'
}

function openAdminPanel(): void {
  closeAccount()
  openAdmin()
}
</script>

<template>
  <div v-if="accountOpen" class="modal-backdrop" @click.self="closeAccount">
    <div class="modal account-modal" role="dialog" aria-modal="true" aria-label="Аккаунт">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Аккаунт</div>
          <h3>{{ signedIn ? account?.email : 'Вход по ссылке из почты' }}</h3>
          <p class="modal-note">
            Без входа всё работает локально. После входа поездки сливаются с облачной библиотекой.
          </p>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closeAccount">×</button>
      </div>

      <template v-if="!signedIn">
        <label class="select-field">
          <span>E-mail</span>
          <input
            v-model="email"
            class="text-input"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            @keydown.enter="submit"
          />
        </label>
        <button type="button" class="primary-btn" :disabled="authBusy" @click="submit">
          {{ authBusy ? 'Отправляю…' : 'Отправить ссылку для входа' }}
        </button>
        <p v-if="authMessage" class="account-message">{{ authMessage }}</p>
        <a v-if="devLink" class="account-dev-link" :href="devLink">Открыть ссылку входа</a>
        <p v-if="authError" class="node-warn">{{ authError }}</p>
        <p class="modal-note">
          Пароля нет. Ссылка действует 15 минут; сессия — 30 дней. Данные поездок хранятся в Cloudflare KV.
        </p>
      </template>

      <template v-else>
        <div class="account-card">
          <div>
            <span>Статус</span>
            <b>{{ syncLabel }}</b>
          </div>
          <div>
            <span>Вход</span>
            <b>{{ account?.demo ? 'локальный (dev)' : 'по e-mail' }}</b>
          </div>
          <div>
            <span>Последняя синхронизация</span>
            <b>{{ lastSync ? new Date(lastSync).toLocaleString('ru-RU') : '—' }}</b>
          </div>
        </div>
        <div class="account-actions">
          <button
            v-if="isAdmin"
            type="button"
            class="mini-btn"
            @click="openAdminPanel"
          >
            Админка
          </button>
          <button
            type="button"
            class="mini-btn"
            :disabled="syncStatus === 'syncing' || account?.demo"
            @click="doSync"
          >
            Синхронизировать
          </button>
          <button type="button" class="mini-btn" @click="leave">Выйти</button>
          <button type="button" class="mini-btn account-danger" @click="removeAccount">Удалить аккаунт</button>
          <button type="button" class="primary-btn" @click="closeAccount">Готово</button>
        </div>
        <p v-if="account?.demo" class="node-warn">
          Локальная демонстрация: облачная библиотека недоступна без настроенного Worker и почты.
        </p>
      </template>
    </div>
  </div>
</template>
