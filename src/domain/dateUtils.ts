import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { ISODateString } from '@/types'

/** Parse an ISO string. Returns `null` for anything that is not a real date. */
export function parseISO(value: ISODateString | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Calendar day (yyyy-MM-dd) of an instant as seen in `timeZone`. */
export function businessDayKey(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'yyyy-MM-dd')
}

/** The instant a business day starts (00:00 in `timeZone`) for the day containing `instant`. */
export function startOfBusinessDay(instant: Date, timeZone: string): Date {
  return fromZonedTime(`${businessDayKey(instant, timeZone)}T00:00:00`, timeZone)
}

/** True when `instant` falls within [from, to] (yyyy-MM-dd, inclusive, either optional) in `timeZone`. */
export function isWithinDayRange(
  instant: Date,
  from: string | null | undefined,
  to: string | null | undefined,
  timeZone: string,
): boolean {
  const key = businessDayKey(instant, timeZone)
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

/** True when both instants fall on the same calendar day in `timeZone`. */
export function isSameBusinessDay(a: Date, b: Date, timeZone: string): boolean {
  return businessDayKey(a, timeZone) === businessDayKey(b, timeZone)
}

/**
 * Turn a calendar day picked in a form (yyyy-MM-dd) into an instant, in `timeZone`.
 * "Today" means right now; any other day means noon that day, so it can never spill into a neighbouring
 * day when converted between time zones. Returns `null` when the text is not a real date.
 */
export function dayToInstant(day: string, now: Date, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  if (day === businessDayKey(now, timeZone)) return now
  const noon = fromZonedTime(`${day}T12:00:00`, timeZone)
  // Reject impossible dates such as 2026-02-31, which some parsers silently roll over.
  return Number.isNaN(noon.getTime()) || businessDayKey(noon, timeZone) !== day ? null : noon
}
