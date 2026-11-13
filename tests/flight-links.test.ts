import { describe, expect, it } from 'vitest'
import {
  aviasalesUrl,
  flightButtons,
  flightQueryLabel,
  googleFlightsUrl,
  ozonUrl,
  yandexUrl,
  type FlightQuery,
} from '@/lib/flight-links'

const roundTrip: FlightQuery = {
  from: 'led',
  to: 'hnd',
  departDate: '2026-11-18',
  returnDate: '2026-11-28',
  adults: 2,
  baggage: true,
}

const oneWay: FlightQuery = {
  from: 'led',
  to: 'hnd',
  departDate: '2026-11-18',
  adults: 2,
}

describe('Aviasales: формат params', () => {
  it('повторяет рабочий формат из примера', () => {
    const url = aviasalesUrl(roundTrip)
    expect(url).toBe(
      'https://www.aviasales.ru/?destination_airports=0&departure_offset=12&params=LED1811HND2811c2&origin_airports=1&return_offset=11',
    )
  })

  it('без обратной даты params короче', () => {
    const url = aviasalesUrl(oneWay)
    expect(url).toContain('params=LED1811HNDc2')
  })

  it('число взрослых в конце', () => {
    expect(aviasalesUrl({ ...roundTrip, adults: 4 })).toContain('c4')
  })

  it('возвращает null без даты или кода', () => {
    expect(aviasalesUrl({ ...oneWay, departDate: '' })).toBeNull()
    expect(aviasalesUrl({ ...oneWay, from: '' })).toBeNull()
    expect(aviasalesUrl({ ...oneWay, departDate: '18.11.2026' })).toBeNull()
  })

  it('приводит код к верхнему регистру', () => {
    expect(aviasalesUrl(oneWay)).toContain('LED1811HND')
  })
})

describe('Ozon: route и dates', () => {
  it('повторяет рабочий формат из примера', () => {
    const url = ozonUrl({ from: 'led', to: 'aer', departDate: '2026-11-13', returnDate: '2026-11-27', adults: 2, baggage: true })
    expect(url).toContain('route=ledaeraerled')
    expect(url).toContain('dates=d2026-11-13d2026-11-27')
    expect(url).toContain('Dlts=2')
    expect(url).toContain('luggage=true')
    expect(url).toContain('ServiceClass=ECONOMY')
  })

  it('туда-обратно дублирует пару аэропортов', () => {
    expect(ozonUrl(roundTrip)).toContain('route=ledhndhndled')
  })

  it('one-way содержит только одну пару', () => {
    expect(ozonUrl(oneWay)).toContain('route=ledhnd')
  })

  it('дата одна без обратной', () => {
    expect(ozonUrl(oneWay)).toContain('dates=d2026-11-18')
    expect(ozonUrl(oneWay)).not.toContain('d2026-11-18d')
  })

  it('багаж управляется флагом', () => {
    expect(ozonUrl({ ...oneWay, baggage: false })).toContain('luggage=false')
  })

  it('дети и младенцы попадают в query', () => {
    const url = ozonUrl({ ...oneWay, children: 1, infants: 1 })
    expect(url).toContain('Children=1')
    expect(url).toContain('Infants=1')
  })

  it('возвращает null без даты', () => {
    expect(ozonUrl({ ...oneWay, departDate: '' })).toBeNull()
  })
})

describe('Яндекс: search/result', () => {
  it('строит путь и параметры', () => {
    const url = yandexUrl(roundTrip)
    expect(url).toContain('travel.yandex.ru/avia/search/result/')
    expect(url).toContain('fromId=LED')
    expect(url).toContain('toId=HND')
    expect(url).toContain('when=2026-11-18')
    expect(url).toContain('return_date=2026-11-28')
    expect(url).toContain('adult_seats=2')
    expect(url).toContain('oneway=2')
    expect(url).toContain('salesChannel=B2C')
  })

  it('one-way помечается oneway=1 и без return_date', () => {
    const url = yandexUrl(oneWay)
    expect(url).toContain('oneway=1')
    expect(url).not.toContain('return_date')
  })

  it('возвращает null без кода', () => {
    expect(yandexUrl({ ...oneWay, to: '' })).toBeNull()
  })
})

describe('Google Flights', () => {
  it('собирает запрос с датами', () => {
    const url = googleFlightsUrl(roundTrip)
    expect(url).toContain('Flights+from+LED+to+HND')
    expect(url).toContain('2026-11-18')
    expect(url).toContain('through+2026-11-28')
  })

  it('one-way', () => {
    const url = googleFlightsUrl(oneWay)
    expect(url).toContain('oneway')
    expect(url).not.toContain('through')
  })

  it('возвращает null без даты', () => {
    expect(googleFlightsUrl({ ...oneWay, departDate: 'x' })).toBeNull()
  })
})

describe('кнопки поиска', () => {
  it('порядок: Aviasales, Ozon, Яндекс, Google', () => {
    expect(flightButtons(roundTrip).map((b) => b.id)).toEqual(['aviasales', 'ozon', 'yandex', 'google'])
  })

  it('все четыре предзаполнены при наличии даты', () => {
    const buttons = flightButtons(roundTrip)
    expect(buttons.every((b) => b.prefilled)).toBe(true)
    expect(buttons.every((b) => b.url.startsWith('https://'))).toBe(true)
  })

  it('без запроса открывают обычный поиск и помечены', () => {
    const buttons = flightButtons(null)
    expect(buttons).toHaveLength(4)
    expect(buttons.every((b) => !b.prefilled)).toBe(true)
    expect(buttons.find((b) => b.id === 'aviasales')?.url).toBe('https://www.aviasales.ru/')
  })

  it('подписи короткие и читаемые', () => {
    expect(flightButtons(null).map((b) => b.label)).toEqual([
      'Aviasales',
      'Ozon',
      'Яндекс',
      'Google',
    ])
  })

  it('title объясняет состояние', () => {
    const filled = flightButtons(roundTrip)[0]
    const plain = flightButtons(null)[0]
    expect(filled?.title).toContain('маршрут и даты')
    expect(plain?.title).toContain('выберите даты')
  })
})

describe('подпись запроса', () => {
  it('маршрут, дата и пассажиры', () => {
    const label = flightQueryLabel(roundTrip)
    expect(label).toContain('LED → HND')
    expect(label).toContain('2 чел.')
    expect(label).toContain('ноя')
  })

  it('пустая дата не ломает подпись', () => {
    expect(flightQueryLabel({ ...oneWay, departDate: '' })).toBe('LED → HND · 2 чел.')
  })
})