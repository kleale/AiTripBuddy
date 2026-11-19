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

  it('по умолчанию тёмная', async () => {
    const mod = await import('@/lib/theme')
    expect(mod.theme.value).toBe('dark')
  })

  it('переключается и сохраняется', async () => {
    const mod = await import('@/lib/theme')
    mod.toggleTheme()
    expect(mod.theme.value).toBe('light')
    expect(store.get('atd.theme.v1')).toBe('light')
    mod.toggleTheme()
    expect(mod.theme.value).toBe('dark')
  })

  it('читает сохранённую светлую', async () => {
    store.set('atd.theme.v1', 'light')
    const mod = await import('@/lib/theme')
    expect(mod.theme.value).toBe('light')
  })
})
