import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const sha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'dev'
const buildDate = new Date().toISOString().slice(0, 10)

export default defineConfig({
  base: './',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}+${sha}`),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
