import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// './' делает сборку переносимой: работает и на корне домена, и в /<repo>/ на GitHub Pages
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  // MapLibre подключает worker через new URL(...) — пре-бандлинг ломает его в dev
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})