import type { CommissionConfig } from '@/config/commissionConfig'
import type { Distributor, Money, Retailer } from '@/types'
import { businessDayKey, parseISO } from './dateUtils'

export type OnboardingExclusion =
  | 'WRONG_DISTRIBUTOR'
  | 'INVALID_DATE'
  | 'FUTURE_DATE'
  | 'BEFORE_JOINING'
  | 'DUPLICATE'
  | 'CANCELLED'
  | 'DEACTIVATED'

export interface OnboardingAssessment {
  retailer: Retailer
  qualifies: boolean
  exclusion: OnboardingExclusion | null
}

export interface DailyProgress {
  /** Business day (yyyy-MM-dd) the figures refer to. */
  day: string
  target: number
  completed: number
  /** May exceed 100 when the distributor over-achieves. */
  achievementPct: number
  remaining: number
  bonus: Money
  excluded: OnboardingAssessment[]
}

interface Context {
  now: Date
  config: CommissionConfig
}

/** Indian mobile numbers: compare the last 10 digits so "+91 98765 43210" equals "9876543210". */
export const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10)

const duplicateKeys = (r: Retailer) => [
  `id:${r.id}`,
  ...(r.phone ? [`phone:${r.distributorId}:${normalizePhone(r.phone)}`] : []),
]

/**
 * Classify every onboarding record of a distributor.
 *
 * Validity checks run first (distributor, date sanity). Duplicates are then detected only among
 * valid records, keeping the earliest one. Finally cancelled/deactivated retailers are excluded.
 */
export function assessOnboardings(
  retailers: readonly Retailer[],
  distributor: Distributor,
  { now }: Context,
): OnboardingAssessment[] {
  const joinedAt = parseISO(distributor.joinedAt)
  const seen = new Set<string>()
  const chronological = [...retailers].sort(
    (a, b) => (parseISO(a.onboardedAt)?.getTime() ?? 0) - (parseISO(b.onboardedAt)?.getTime() ?? 0),
  )

  const verdicts = new Map<Retailer, OnboardingExclusion | null>()

  for (const retailer of chronological) {
    const onboardedAt = parseISO(retailer.onboardedAt)
    let exclusion: OnboardingExclusion | null = null

    if (retailer.distributorId !== distributor.id) exclusion = 'WRONG_DISTRIBUTOR'
    else if (!onboardedAt) exclusion = 'INVALID_DATE'
    else if (onboardedAt.getTime() > now.getTime()) exclusion = 'FUTURE_DATE'
    else if (joinedAt && onboardedAt.getTime() < joinedAt.getTime()) exclusion = 'BEFORE_JOINING'

    if (!exclusion) {
      const keys = duplicateKeys(retailer)
      if (keys.some((key) => seen.has(key))) exclusion = 'DUPLICATE'
      else keys.forEach((key) => seen.add(key))
    }

    if (!exclusion && retailer.status === 'CANCELLED') exclusion = 'CANCELLED'
    if (!exclusion && retailer.status === 'DEACTIVATED') exclusion = 'DEACTIVATED'

    verdicts.set(retailer, exclusion)
  }

  // Preserve the caller's ordering.
  return retailers.map((retailer) => {
    const exclusion = verdicts.get(retailer) ?? null
    return { retailer, qualifies: exclusion === null, exclusion }
  })
}

/** Today's onboarding target, achievement and bonus, evaluated in the business time zone. */
export function getDailyProgress(
  retailers: readonly Retailer[],
  distributor: Distributor,
  context: Context,
): DailyProgress {
  const { now, config } = context
  const zone = config.businessTimeZone
  const day = businessDayKey(now, zone)
  const assessments = assessOnboardings(retailers, distributor, context)

  const completed = assessments.filter((a) => {
    if (!a.qualifies) return false
    const onboardedAt = parseISO(a.retailer.onboardedAt)
    return onboardedAt !== null && businessDayKey(onboardedAt, zone) === day
  }).length

  const target = distributor.dailyTarget
  const paidCount = config.onboarding.capBonusAtTarget ? Math.min(completed, target) : completed

  return {
    day,
    target,
    completed,
    achievementPct: target > 0 ? Math.round((completed / target) * 100) : 0,
    remaining: Math.max(0, target - completed),
    bonus: paidCount * config.onboarding.bonusPerRetailer,
    excluded: assessments.filter((a) => !a.qualifies),
  }
}
