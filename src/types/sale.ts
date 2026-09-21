import type { ISODateString, Money } from './common'

export interface Sale {
  /** Invoice number, e.g. "INV-1022". */
  id: string
  retailerId: string
  distributorId: string
  date: ISODateString
  product: string
  quantity: number
  amount: Money
  retailerCommission: Money
  distributorCommission: Money
  /** Company downline commission. */
  companyCommission: Money
  /** The part of the sale not allocated to any of the three parties above. */
  remainder: Money
}
