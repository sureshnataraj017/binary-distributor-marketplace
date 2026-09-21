import type { ISODateString, Position } from './common'

export interface Distributor {
  id: string
  name: string
  state: string
  city: string
  /** Placement parent in the binary tree. `null` for a top-level distributor under the company. */
  parentId: string | null
  /** Slot under the parent. `null` only when `parentId` is `null`. */
  position: Position | null
  /** Sponsor who recruited this distributor. Independent from placement (`parentId`). */
  referredBy: string | null
  retailerIds: string[]
  dailyTarget: number
  joinedAt: ISODateString
}
