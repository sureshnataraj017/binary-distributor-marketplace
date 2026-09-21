/** Money is always an integer number of minor units (cents). Never a float. */
export type Money = number

/** ISO-8601 timestamp, stored in UTC (e.g. "2026-09-21T04:30:00.000Z"). */
export type ISODateString = string

export type Position = 'LEFT' | 'RIGHT'
