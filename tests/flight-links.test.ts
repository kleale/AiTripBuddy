import { describe, expect, it } from 'vitest'
import {
  aviasalesUrl,
  flightLinks,
  flightQueryLabel,
  googleFlightsUrl,
  type FlightQuery,
} from '@/lib/flight-links'

const query: FlightQuery = {
  from: 'svo',
  to: 'hnd',
  departDate: '2027-01-22',
  adults: 2,
}

describe('ссылка Aviasales', () => {
  it('кодирует маршрут и дату в путь', () => {
    const url = aviasalesUrl(query)
    expect(url).toContain('/search/SVO22janHND2')
    expect(url).toMatch(/^https:\/\/www\.aviasales\.ru\/search\//)
  })

  it('добавляет обратную дату, если она есть', () => {
    const url = aviasalesUrl({ ...query, returnDate: '2027-02-04' })
    expect(url).toContain('SVO22janHND04feb2')
  })

  it('передаёт детей и младенцев в query', () => {
    const url = aviasalesUrl({ ...query, children: 1, infants: 1 })
    expect(url).toContain('children=1')
    expect(url).toContain('infants=1')
  })

  it('приводит код города к верхнему регистру', () => {
    expect(aviasalesUrl({ ...query, from: 'led', to: 'nrt' })).toContain('LED22janNRT2')
  })

  it('возвращает null без даты или кода', () => {
    expect(aviasalesUrl({ ...query, departDate: '' })).toBeNull()
    expect(aviasalesUrl({ ...query, from: '' })).toBeNull()
    expect(aviasalesUrl({ ...query, departDate: '22.01.2027' })).toBeNull()
  })

  it('подставляет минимум одного взрослого', () => {
    expect(aviasalesUrl({ ...query, adults: 0 })).toContain('SVO22janHND1')
  })

  it('не падает на невалидном месяце', () => {
    expect(aviasalesUrl({ ...query, departDate: '2027-13-01' })).toBeNull()
  })
})

describe('ссылка Google Flights', () => {
  it('собирает естественный запрос', () => {
    const url = googleFlightsUrl(query)
    expect(url).toContain('google.com/travel/flights')
    expect(url).toContain('Flights+from+SVO+to+HND')
    expect(url).toContain('2027-01-22')
    expect(url).toContain('oneway')
  })

  it('добавляет обратную дату', () => {
    const url = googleFlightsUrl({ ...query, returnDate: '2027-02-04' })
    expect(url).toContain('through+2027-02-04')
    expect(url).not.toContain('oneway')
  })

  it('возвращает null без даты', () => {
    expect(googleFlightsUrl({ ...query, departDate: 'нет' })).toBeNull()
  })
})

describe('набор ссылок', () => {
  it('содержит четыре сервиса', () => {
    const links = flightLinks(query)
    expect(links.map((link) => link.id)).toEqual(['aviasales', 'google', 'yandex', 'ozon'])
  })

  it('Aviasales и Google помечены как «с датами»', () => {
    const links = flightLinks(query)
    expect(links.find((link) => link.id === 'aviasales')?.prefilled).toBe(true)
    expect(links.find((link) => link.id === 'google')?.prefilled).toBe(true)
  })

  it('Яндекс и Ozon честно помечены без дат', () => {
    const links = flightLinks(query)
    const yandex = links.find((link) => link.id === 'yandex')
    const ozon = links.find((link) => link.id === 'ozon')
    expect(yandex?.prefilled).toBe(false)
    expect(yandex?.note).toContain('сайте')
    expect(ozon?.prefilled).toBe(false)
  })

  it('без даты остаются только сервисы без параметров', () => {
    const links = flightLinks({ ...query, departDate: '' })
    expect(links.map((link) => link.id)).toEqual(['yandex', 'ozon'])
  })

  it('все ссылки абсолютные и https', () => {
    for (const link of flightLinks(query)) {
      expect(link.url).toMatch(/^https:\/\//)
    }
  })
})

describe('подпись запроса', () => {
  it('показывает маршрут, дату и число человек', () => {
    const label = flightQueryLabel(query)
    expect(label).toContain('SVO → HND')
    expect(label).toContain('2 чел.')
    expect(label).toContain('янв')
  })

  it('переживает пустую дату', () => {
    const label = flightQueryLabel({ ...query, departDate: '' })
    expect(label).toContain('SVO → HND')
    expect(label).not.toContain('undefined')
  })
})