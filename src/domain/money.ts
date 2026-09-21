import type { Money } from '@/types'

/** Convert a decimal currency amount (e.g. 12.34) to integer cents, avoiding float drift. */
export function toCents(amount: number): Money {
  return Math.round((amount + Number.EPSILON) * 100)
}

/**
 * Parse a user-typed dollar amount ("1250", "$1,250.50") into integer cents.
 * Returns `null` for anything that is not a plain amount with at most 2 decimals.
 * Done on the string, never through a float, so "0.29" is exactly 29 cents.
 */
export function parseDollars(input: string): Money | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '')
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const [, whole = '0', fraction = ''] = match
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function fromCents(cents: Money): number {
  return cents / 100
}

/**
 * Take `percentage` of `amount` (both in their natural units), rounded to the nearest cent.
 * The percentage is scaled to basis points first so values like 2.5% stay exact.
 */
export function percentOf(amount: Money, percentage: number): Money {
  const basisPoints = Math.round(percentage * 100)
  return Math.round((amount * basisPoints) / 10_000)
}

export function sumMoney(values: readonly Money[]): Money {
  return values.reduce((total, value) => total + value, 0)
}
