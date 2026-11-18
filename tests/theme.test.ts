import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
})

describe('тема', () => {
  beforeEach(() => {
    store.clear()
    vi.resetModules()
  })

  it('по умолчанию светлая', async () => {
    const mod = await import('@/lib/theme')
    expect(mod.theme.value).toBe('light')
  })

  it('переключается и сохраняется', async () => {
    const mod = await import('@/lib/theme')
    mod.toggleTheme()
    expect(mod.theme.value).toBe('dark')
    expect(store.get('atd.theme.v1')).toBe('dark')
    mod.toggleTheme()
    expect(mod.theme.value).toBe('light')
  })

  it('читает сохранённую тёмную', async () => {
    store.set('atd.theme.v1', 'dark')
    const mod = await import('@/lib/theme')
    expect(mod.theme.value).toBe('dark')
  })
})
