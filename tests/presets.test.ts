import { describe, expect, it } from 'vitest'
import { buildPreset, presetList, isPresetId } from '@/data/presets'
import { computeCosts } from '@/lib/costs'
import { buildSchedule } from '@/lib/schedule'

const PRESET = 'led-hakuba'

describe('готовый маршрут LED → Токио → Хакуба → LED', () => {
  const preset = buildPreset(PRESET)
  if (!preset) throw new Error('маршрут не собран')
  const trip = preset

  it('существует и описан в списке', () => {
    expect(isPresetId(PRESET)).toBe(true)
    expect(presetList.some((item) => item.id === PRESET)).toBe(true)
  })

  it('строится кольцевая цепочка LED → HND → Хакуба → Токио → HND', () => {
    expect(trip?.stops.map((stop) => stop.kind)).toEqual([
      'origin',
      'airport',
      'stay',
      'stay',
      'airport',
    ])
    expect(trip?.stops[0]?.kind === 'origin' ? trip.stops[0].code : null).toBe('LED')
    expect(trip?.stops[1]?.kind === 'airport' ? trip.stops[1].code : null).toBe('HND')
    const hakuba = trip?.stops[2]
    expect(hakuba?.kind === 'stay' ? hakuba.resortId : null).toBe('hakuba')
    const tokyo = trip?.stops[3]
    expect(tokyo?.kind === 'stay' ? tokyo.placeKind : null).toBe('city')
    expect(tokyo?.kind === 'stay' ? tokyo.city : null).toBe('Токио')
    expect(trip?.stops[4]?.kind === 'airport' ? trip.stops[4].code : null).toBe('HND')
  })

  it('10 ночей на курорте и 2 в Токио, заезд 23 января 2027', () => {
    const hakuba = trip?.stops[2]
    const tokyo = trip?.stops[3]
    if (hakuba?.kind !== 'stay' || tokyo?.kind !== 'stay') throw new Error('нет отелей')
    expect(hakuba.nights).toBe(10)
    expect(hakuba.skipassDays).toBe(10)
    expect(hakuba.checkIn).toBe('2027-01-23')
    expect(tokyo.nights).toBe(2)
    expect(tokyo.checkIn).toBe('2027-02-02')
  })

  it('отель 3 звезды и недорогой (до 12 000 ₽ за ночь)', () => {
    const stay = trip?.stops[2]
    if (stay?.kind !== 'stay') throw new Error('нет отеля')
    expect(stay.hotelStars).toBe(3)
    expect(stay.hotelPerNight).toBeGreaterThan(0)
    expect(stay.hotelPerNight).toBeLessThanOrEqual(12000)
  })

  it('билеты не дороже 70 000 ₽ на человека в обе стороны', () => {
    const pax = trip?.pax ?? 1
    const flights = trip?.links.filter((link) => link.kind === 'flight') ?? []
    expect(flights).toHaveLength(2)
    const outbound = flights[0]?.price ?? 0
    const back = flights[1]?.price ?? 0
    expect(outbound / pax).toBeLessThanOrEqual(70000)
    expect(back / pax).toBeLessThanOrEqual(70000)
    expect((outbound + back) / pax).toBeLessThanOrEqual(70000)
  })

  it('у всех четырёх участков есть дата и время', () => {
    const links = trip?.links ?? []
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link.date).toMatch(/^2027-\d{2}-\d{2}$/)
      expect(link.time).toMatch(/^\d{2}:\d{2}$/)
      expect(link.price).toBeGreaterThan(0)
    }
    expect(links[0]?.date).toBe('2027-01-22')
    expect(links[1]?.kind).toBe('transfer')
    expect(links[1]?.time).toBe('12:15')
    expect(links[2]?.kind).toBe('move')
    expect(links[2]?.date).toBe('2027-02-02')
    expect(links[3]?.kind).toBe('flight')
    expect(links[3]?.note).toContain('домой')
  })

  it('обратный перелёт учтён один раз — в участке, а не в ручном поле', () => {
    expect(trip?.returnFlight).toBe(0)
    expect(trip?.returnHours).toBe(0)
  })

  it('отель в Токио 3★ и недорогой', () => {
    const tokyo = trip?.stops[3]
    if (tokyo?.kind !== 'stay') throw new Error('нет отеля в Токио')
    expect(tokyo.hotelStars).toBe(3)
    expect(tokyo.hotelPerNight).toBeLessThanOrEqual(10000)
    expect(tokyo.hotel).toContain('Ueno')
  })

  it('скипасс Hakuba Valley посчитан по 10 дням', () => {
    const costs = computeCosts(trip)
    expect(costs.rideDays).toBe(10)
    expect(costs.skipass).toBe(10 * 6400 * 2)
  })

  it('расписание привязано к датам и покрывает поездку', () => {
    const schedule = buildSchedule(trip)
    expect(schedule.anchored).toBe(true)
    expect(schedule.days.length).toBeGreaterThanOrEqual(12)
    expect(schedule.days[0]?.date).toBe('2027-01-22')
  })

  it('смета положительная и укладывается в бюджет', () => {
    const costs = computeCosts(trip)
    expect(costs.total).toBeGreaterThan(0)
    expect(costs.total).toBeLessThanOrEqual(trip.budget ?? 0)
    expect(costs.perPerson).toBeGreaterThan(0)
    expect(costs.flightCount).toBe(2)
    expect(costs.nights).toBe(12)
  })

  it('возвращает null для неизвестного id', () => {
    expect(buildPreset('nope')).toBeNull()
  })
})