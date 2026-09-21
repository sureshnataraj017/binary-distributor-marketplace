import type { ISODateString } from './common'

export type RetailerStatus = 'ACTIVE' | 'DEACTIVATED' | 'CANCELLED'

export interface Retailer {
  id: string
  name: string
  distributorId: string
  state: string
  city: string
  /** Used together with `distributorId` to detect duplicate onboardings. */
  phone?: string
  onboardedAt: ISODateString
  status: RetailerStatus
}
