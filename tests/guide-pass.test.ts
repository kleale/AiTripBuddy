import { describe, expect, it } from 'vitest'
import { convertGuideAmount, guideRubRate, rubRate } from '@/lib/currency'
import { guideFor, guidePassPerDay, resortGuides } from '@/data/resort-guides'

describe('конвертация валют гидов', () => {
  it('рубль в рубль не меняется', () => {
    expect(convertGuideAmount(1000, 'RUB', 'RUB')).toBe(1000)
  })

  it('евро дороже рубля', () => {
    const rub = convertGuideAmount(100, 'EUR', 'RUB')
    expect(rub).toBeGreaterThan(100)
    expect(rub).toBeCloseTo(100 * rubRate.EUR, -1)
  })

  it('иена дешевле рубля', () => {
    const rub = convertGuideAmount(1000, 'JPY', 'RUB')
    expect(rub).toBeGreaterThan(0)
    expect(rub).toBeLessThan(1000)
    expect(guideRubRate.JPY).toBeGreaterThan(0.3)
    expect(guideRubRate.JPY).toBeLessThan(1)
  })

  it('лари дороже рубля, но дешевле евро', () => {
    expect(guideRubRate.GEL).toBeGreaterThan(1)
    expect(guideRubRate.GEL).toBeLessThan(guideRubRate.EUR)
  })

  it('возвращает 0 на неположительных суммах', () => {
    expect(convertGuideAmount(0, 'EUR', 'RUB')).toBe(0)
    expect(convertGuideAmount(-50, 'EUR', 'RUB')).toBe(0)
    expect(convertGuideAmount(Number.NaN, 'EUR', 'RUB')).toBe(0)
  })

  it('конвертация в евро даёт меньше единиц, чем в рубли', () => {
    const rub = convertGuideAmount(10000, 'JPY', 'RUB')
    const eur = convertGuideAmount(10000, 'JPY', 'EUR')
    expect(eur).toBeLessThan(rub)
    expect(eur).toBeGreaterThan(0)
  })
})

describe('цена скипасса из гида', () => {
  it('дневной пасс возвращает ту же цену', () => {
    const pass = guidePassPerDay(
      guideFor('hakuba') ?? { zones: [], passAll: undefined } as never,
    )
    expect(pass).not.toBeNull()
    expect(pass?.amount).toBe(8500)
    expect(pass?.currency).toBe('JPY')
  })

  it('многодневный пасс делится на дни', () => {
    const mayrhofen = guideFor('mayrhofen')
    if (!mayrhofen) throw new Error('нет гида')
    const pass = guidePassPerDay(mayrhofen)
    // 163.5 € за 2 дня
    expect(pass?.amount).toBeCloseTo(81.8, 1)
  })

  it('семидневный MultiSki делится на семь', () => {
    const gudauri = guideFor('gudauri')
    if (!gudauri) throw new Error('нет гида')
    const pass = guidePassPerDay(gudauri)
    expect(pass?.amount).toBeCloseTo(52.9, 1)
    expect(pass?.currency).toBe('GEL')
  })

  it('курорт без единого пасса даёт null', () => {
    const krasnaya = guideFor('krasnaya-polyana')
    if (!krasnaya) throw new Error('нет гида')
    expect(guidePassPerDay(krasnaya)).toBeNull()
  })

  it('у всех гидов с пассом цена на день положительная', () => {
    for (const guide of Object.values(resortGuides)) {
      if (!guide.passAll) continue
      const pass = guidePassPerDay(guide)
      expect(pass).not.toBeNull()
      expect(pass?.amount ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('итоговая подстановка в валюту поездки', () => {
  it('иены Хакубы превращаются в рубли по курсу приложения', () => {
    const guide = guideFor('hakuba')
    if (!guide) throw new Error('нет гида')
    const pass = guidePassPerDay(guide)
    if (!pass) throw new Error('нет пасса')
    const rub = convertGuideAmount(pass.amount, pass.currency, 'RUB')
    // 8500 ¥ ≈ 4–6 тысяч рублей по внутреннему курсу
    expect(rub).toBeGreaterThan(3000)
    expect(rub).toBeLessThan(8000)
  })

  it('евро Майрхофена даёт правдоподобные рубли', () => {
    const guide = guideFor('mayrhofen')
    if (!guide) throw new Error('нет гида')
    const pass = guidePassPerDay(guide)
    if (!pass) throw new Error('нет пасса')
    const rub = convertGuideAmount(pass.amount, pass.currency, 'RUB')
    expect(rub).toBeGreaterThan(6000)
    expect(rub).toBeLessThan(12000)
  })
})