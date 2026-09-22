import { formatInTimeZone } from 'date-fns-tz'
import { defaultCommissionConfig } from '@/config/commissionConfig'
import { parseISO } from '@/domain/dateUtils'
import type { ISODateString } from '@/types'

const zone = defaultCommissionConfig.businessTimeZone

function format(value: ISODateString, pattern: string): string {
  const date = parseISO(value)
  return date ? formatInTimeZone(date, zone, pattern) : '—'
}

/** e.g. "21 Sep" (business time zone). */
export const formatShortDate = (value: ISODateString) => format(value, 'dd MMM')

/** e.g. "21-09-2026". */
export const formatDate = (value: ISODateString) => format(value, 'dd-MM-yyyy')

/** e.g. "21 Sep 2026, 14:05". */
export const formatDateTime = (value: ISODateString) => format(value, 'dd MMM yyyy, HH:mm')

/** "LEFT" -> "Left", "DISTRIBUTOR_REFERRAL" -> "Distributor referral". */
export const humanize = (value: string) => {
  const text = value.replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
