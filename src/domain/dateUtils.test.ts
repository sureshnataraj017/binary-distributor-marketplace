import { describe, expect, it } from 'vitest'
import { businessDayKey, dayToInstant, isWithinDayRange, startOfBusinessDay } from './dateUtils'

const IST = 'Asia/Kolkata'
const NOW = new Date('2026-09-21T08:30:00.000Z') // 14:00 IST on 21 Sep

describe('dayToInstant', () => {
  it('turns "today" into right now', () => {
    expect(dayToInstant('2026-09-21', NOW, IST)).toBe(NOW)
  })

  it('turns any other day into noon that day in the business time zone', () => {
    expect(dayToInstant('2026-09-10', NOW, IST)?.toISOString()).toBe('2026-09-10T06:30:00.000Z')
  })

  it('always lands on the day that was picked, whatever the viewer time zone', () => {
    const instant = dayToInstant('2026-01-01', NOW, IST)!
    expect(businessDayKey(instant, IST)).toBe('2026-01-01')
  })

  it.each(['', 'yesterday', '2026-9-1', '2026-02-31', '2026-13-01', '2026-09-21T10:00'])(
    'rejects %j',
    (value) => {
      expect(dayToInstant(value, NOW, IST)).toBeNull()
    },
  )
})

describe('day helpers', () => {
  it('finds the start of the business day', () => {
    expect(startOfBusinessDay(NOW, IST).toISOString()).toBe('2026-09-20T18:30:00.000Z')
  })

  it('checks inclusive day ranges in the business time zone', () => {
    // 23:59 IST on 20 Sep is still the 20th, even though it is the 20th in UTC too; 00:01 IST on the 21st is not.
    expect(isWithinDayRange(new Date('2026-09-20T18:29:00.000Z'), '2026-09-21', null, IST)).toBe(
      false,
    )
    expect(isWithinDayRange(new Date('2026-09-20T18:31:00.000Z'), '2026-09-21', null, IST)).toBe(
      true,
    )
    expect(isWithinDayRange(NOW, null, '2026-09-21', IST)).toBe(true)
    expect(isWithinDayRange(NOW, null, '2026-09-20', IST)).toBe(false)
  })
})
