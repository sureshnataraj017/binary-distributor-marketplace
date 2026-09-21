import type { Money } from '@/types'

const formatters = new Map<string, Intl.NumberFormat>()

function getFormatter(fractionDigits: number) {
  let formatter = formatters.get(String(fractionDigits))
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatters.set(String(fractionDigits), formatter)
  }
  return formatter
}

/** Format integer cents as currency. Whole-dollar amounts drop the ".00" unless `precise` is set. */
export function formatCurrency(
  cents: Money,
  { precise = false }: { precise?: boolean } = {},
): string {
  const digits = precise || cents % 100 !== 0 ? 2 : 0
  return getFormatter(digits).format(cents / 100)
}
