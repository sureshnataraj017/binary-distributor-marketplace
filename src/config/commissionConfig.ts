import type { Money } from '@/types'

export interface CommissionConfig {
  sale: {
    retailerPercentage: number
    distributorPercentage: number
    /** Company downline commission. */
    companyPercentage: number
  }
  /** Share of the referred distributor's fee paid to the referring distributor. */
  referralPercentage: number
  onboarding: {
    defaultDailyTarget: number
    bonusPerRetailer: Money
    /**
     * When true, the bonus is only paid for onboardings up to the daily target.
     * The brief is ambiguous here ("$50 for each qualifying retailer"), so it is configurable.
     */
    capBonusAtTarget: boolean
  }
  /** "Same day" is evaluated in this IANA time zone, never the viewer's browser zone. */
  businessTimeZone: string
}

/** Single source of truth for every rate. UI components must read from here, never hard-code. */
export const defaultCommissionConfig: CommissionConfig = {
  sale: {
    retailerPercentage: 30,
    distributorPercentage: 10,
    companyPercentage: 2,
  },
  referralPercentage: 10,
  onboarding: {
    defaultDailyTarget: 2,
    bonusPerRetailer: 5_000, // $50.00
    capBonusAtTarget: false,
  },
  businessTimeZone: 'Asia/Kolkata',
}
