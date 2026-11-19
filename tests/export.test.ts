import { describe, expect, it } from 'vitest'
import type { StayStop, Trip } from '@/types'
import { buildTripIcs, tripIcsEvents, tripPrintHtml } from '@/lib/export'

const stay: StayStop = {
  id: 's1',
  kind: 'stay',
  placeKind: 'resort',
  resortId: 'hakuba',
  resort: 'Хакуба',
  country: 'Япония',
  hotel: 'Hakuba Tokyu Hotel',
  lat: 36.697,
  lng: 137.841,
  nights: 3,
  rooms: 1,
  maxGuests: 2,
  checkIn: '2027-02-01',
  hotelPerNight: 20000,
  hotelSource: null,
  hotelStars: 4,
  skipassDays: 2,
  skipassPerDay: 8000,
  meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
  foodPerDayOverride: null,
  activities: [
    {
      id: 'a1',
      title: 'Снежные обезьяны, тур',
      kind: 'excursion',
      price: 800,
      date: '2027-02-02',
      time: '09:30',
      durationHours: 4,
      placeName: 'Jigokudani',
      booked: true,
    },
  ],
}

const trip: Trip = {
  id: 't1',
  name: 'Хакуба, тест',
  pax: 2,
  currency: 'RUB',
  budget: 200000,
  returnFlight: 0,
  returnHours: 0,
  stops: [stay],
  links: [
    {
      kind: 'flight',
      price: 60000,
      hours: 9,
      date: '2027-02-01',
      time: '08:10',
      note: 'LED → NRT',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('экспорт поездки', () => {
  it('собирает отель, мероприятие и перелёт', () => {
    const events = tripIcsEvents(trip)
    expect(events.length).toBe(3)
    expect(events[0]?.allDay).toBe(true)
    expect(events.some((event) => event.summary.includes('Снежные обезьяны'))).toBe(true)
    expect(events.some((event) => event.summary.includes('Перелёт'))).toBe(true)
  })

  it('отдаёт валидный ICS с CRLF и экранированием', () => {
    const ics = buildTripIcs(trip)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20270201')
    expect(ics).toContain('DTEND;VALUE=DATE:20270204')
    expect(ics).toContain('SUMMARY:Отель: Hakuba Tokyu Hotel')
    expect(ics).toContain('Снежные обезьяны')
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(3)
  })

  it('печатная версия содержит смету и маршрут', () => {
    const html = tripPrintHtml(trip)
    expect(html).toContain('Хакуба, тест')
    expect(html).toContain('Итого')
    expect(html).toContain('Hakuba Tokyu Hotel')
    expect(html).toContain('Снежные обезьяны')
  })
})
