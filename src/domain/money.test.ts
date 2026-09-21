import { describe, expect, it } from 'vitest'
import { parseDollars, percentOf, toCents } from './money'

describe('parseDollars', () => {
  it.each([
    ['1000', 100_000],
    ['1,250.50', 125_050],
    ['$99', 9_900],
    ['  12.5 ', 1_250],
    ['0.29', 29], // a float would give 28.999999999999996
    ['0.07', 7],
    ['19.99', 1_999],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseDollars(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1.234', '1..2', '12,34,56.789', '$', '1e3', '1000000000', '.5'])(
    'rejects %j',
    (input) => {
      expect(parseDollars(input)).toBeNull()
    },
  )
})

describe('money helpers', () => {
  it('rounds percentages to the nearest cent using basis points', () => {
    expect(percentOf(12_345, 10)).toBe(1_235) // 1234.5 rounds up
    expect(percentOf(100_000, 2.5)).toBe(2_500)
  })

  it('converts decimal amounts to cents without float drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})
