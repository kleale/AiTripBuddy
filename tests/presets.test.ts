import { describe, expect, it } from 'vitest'
import { buildPreset, presetList, isPresetId } from '@/data/presets'
import { computeCosts } from '@/lib/costs'
import { buildSchedule } from '@/lib/schedule'

const PRESET = 'led-hakuba'

describe('готовый маршрут LED → Токио → Хакуба', () => {
  const trip = buildPreset(PRESET)

  it('существует и описан в списке', () => {
    expect(trip).not.toBeNull()
    expect(isPresetId(PRESET)).toBe(true)
    expect(presetList.some((item) => item.id === PRESET)).toBe(true)
  })

  it('строится цепочка LED → HND → Хакуба', () => {
    expect(trip?.stops.map((stop) => stop.kind)).toEqual(['origin', 'airport', 'stay'])
    expect(trip?.stops[0]?.kind === 'origin' ? trip.stops[0].code : null).toBe('LED')
    expect(trip?.stops[1]?.kind === 'airport' ? trip.stops[1].code : null).toBe('HND')
    const stay = trip?.stops[2]
    expect(stay?.kind === 'stay' ? stay.resortId : null).toBe('hakuba')
  })

  it('10 ночей и 10 дней катания, заезд 23 января 2027', () => {
    const stay = trip?.stops[2]
    if (stay?.kind !== 'stay') throw new Error('нет отеля')
    expect(stay.nights).toBe(10)
    expect(stay.skipassDays).toBe(10)
    expect(stay.checkIn).toBe('2027-01-23')
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
    const outbound = trip?.links.find((link) => link.kind === 'flight')?.price ?? 0
    const back = trip?.returnFlight ?? 0
    expect(outbound / pax).toBeLessThanOrEqual(70000)
    expect(back / pax).toBeLessThanOrEqual(70000)
    expect((outbound + back) / pax).toBeLessThanOrEqual(70000)
  })

  it('у перелёта и трансфера есть дата и время', () => {
    const flight = trip?.links[0]
    const transfer = trip?.links[1]
    expect(flight?.date).toBe('2027-01-22')
    expect(flight?.time).toMatch(/^\d{2}:\d{2}$/)
    expect(transfer?.kind).toBe('transfer')
    expect(transfer?.date).toBe('2027-01-23')
    expect(transfer?.time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('скипасс Hakuba Valley посчитан по 10 дням', () => {
    const costs = computeCosts(trip!)
    expect(costs.rideDays).toBe(10)
    expect(costs.skipass).toBe(10 * 6400 * 2)
  })

  it('расписание привязано к датам и покрывает поездку', () => {
    const schedule = buildSchedule(trip!)
    expect(schedule.anchored).toBe(true)
    expect(schedule.days.length).toBeGreaterThanOrEqual(10)
    expect(schedule.days[0]?.date).toBe('2027-01-22')
  })

  it('смета положительная и укладывается в бюджет', () => {
    const costs = computeCosts(trip!)
    expect(costs.total).toBeGreaterThan(0)
    expect(costs.total).toBeLessThanOrEqual(trip!.budget ?? 0)
    expect(costs.perPerson).toBeGreaterThan(0)
  })

  it('возвращает null для неизвестного id', () => {
    expect(buildPreset('nope')).toBeNull()
  })
})