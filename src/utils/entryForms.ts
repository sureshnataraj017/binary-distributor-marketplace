import { defaultCommissionConfig } from '@/config/commissionConfig'
import { INDIA_STATES } from '@/config/indiaStates'
import { dayToInstant } from '@/domain/dateUtils'
import { parseDollars } from '@/domain/money'
import type { CreateReferralInput } from '@/services/commissionService'
import type { CreateDistributorInput } from '@/services/distributorService'
import type { CreateRetailerInput } from '@/services/retailerService'
import type { Position } from '@/types'

/** Client-side checks give instant feedback; the server re-validates everything and is the authority. */
const zone = defaultCommissionConfig.businessTimeZone
const MAX_FEE_CENTS = 100_000_000_00

type Errors<T> = Partial<Record<keyof T, string>>
type Result<Values, Input> = { errors: Errors<Values>; input: Input | null }

/** Empty optional date = "now". A picked day must be a real date and not in the future. */
function optionalDay(value: string, now: Date): { instant: string | null; error?: string } {
  if (!value) return { instant: null }
  const instant = dayToInstant(value, now, zone)
  if (!instant) return { instant: null, error: 'Enter a valid date.' }
  if (instant.getTime() > now.getTime())
    return { instant: null, error: 'The date cannot be in the future.' }
  return { instant: instant.toISOString() }
}

// ---------------------------------------------------------------- distributor

export interface DistributorFormValues {
  name: string
  state: string
  city: string
  placement: 'TOP' | 'UNDER'
  parentId: string
  position: Position | ''
  referredBy: string
  joinedOn: string
  dailyTarget: string
}

export const EMPTY_DISTRIBUTOR_FORM: DistributorFormValues = {
  name: '',
  state: '',
  city: '',
  placement: 'TOP',
  parentId: '',
  position: '',
  referredBy: '',
  joinedOn: '',
  dailyTarget: String(defaultCommissionConfig.onboarding.defaultDailyTarget),
}

export function validateDistributorForm(
  values: DistributorFormValues,
  now: Date,
): Result<DistributorFormValues, CreateDistributorInput> {
  const errors: Errors<DistributorFormValues> = {}

  const name = values.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (name.length > 100) errors.name = 'Keep the name under 100 characters.'

  if (!(INDIA_STATES as readonly string[]).includes(values.state)) errors.state = 'Choose a state.'

  const city = values.city.trim()
  if (!city) errors.city = 'Enter a city.'
  else if (city.length > 100) errors.city = 'Keep the city under 100 characters.'

  if (values.placement === 'UNDER') {
    if (!values.parentId) errors.parentId = 'Choose the distributor to place this one under.'
    else if (!values.position) errors.position = 'Choose the LEFT or RIGHT side.'
  }

  const joined = optionalDay(values.joinedOn, now)
  if (joined.error) errors.joinedOn = joined.error

  const target = values.dailyTarget.trim()
  let dailyTarget: number | undefined
  if (target !== '') {
    dailyTarget = /^\d+$/.test(target) ? Number(target) : Number.NaN
    if (!Number.isInteger(dailyTarget) || dailyTarget > 1000) {
      errors.dailyTarget = 'Enter a whole number from 0 to 1000.'
    }
  }

  if (Object.keys(errors).length > 0) return { errors, input: null }
  const placed = values.placement === 'UNDER'
  return {
    errors,
    input: {
      name,
      state: values.state,
      city,
      ...(placed ? { parentId: values.parentId, position: values.position as Position } : {}),
      ...(values.referredBy ? { referredBy: values.referredBy } : {}),
      ...(dailyTarget !== undefined ? { dailyTarget } : {}),
      ...(joined.instant ? { joinedAt: joined.instant } : {}),
    },
  }
}

// ------------------------------------------------------------------- retailer

export interface RetailerFormValues {
  name: string
  distributorId: string
  city: string
  state: string
  phone: string
  onboardedOn: string
}

export const EMPTY_RETAILER_FORM: RetailerFormValues = {
  name: '',
  distributorId: '',
  city: '',
  state: '',
  phone: '',
  onboardedOn: '',
}

export function validateRetailerForm(
  values: RetailerFormValues,
  now: Date,
): Result<RetailerFormValues, CreateRetailerInput> {
  const errors: Errors<RetailerFormValues> = {}

  const name = values.name.trim()
  if (!name) errors.name = 'Enter the shop name.'
  else if (name.length > 100) errors.name = 'Keep the name under 100 characters.'

  if (!values.distributorId)
    errors.distributorId = 'Choose the distributor who onboarded this retailer.'

  const city = values.city.trim()
  if (!city) errors.city = 'Enter a city.'

  if (!(INDIA_STATES as readonly string[]).includes(values.state)) errors.state = 'Choose a state.'

  const phone = values.phone.trim()
  if (phone) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13 || !/^[+\d][\d\s\-()]*$/.test(phone)) {
      errors.phone = 'Enter a phone number with 10 to 13 digits.'
    }
  }

  const onboarded = optionalDay(values.onboardedOn, now)
  if (onboarded.error) errors.onboardedOn = onboarded.error

  if (Object.keys(errors).length > 0) return { errors, input: null }
  return {
    errors,
    input: {
      name,
      distributorId: values.distributorId,
      city,
      state: values.state,
      ...(phone ? { phone } : {}),
      ...(onboarded.instant ? { onboardedAt: onboarded.instant } : {}),
    },
  }
}

// ------------------------------------------------------------------- referral

export interface ReferralFormValues {
  referredDistributorId: string
  fee: string
  date: string
}

export const EMPTY_REFERRAL_FORM: ReferralFormValues = {
  referredDistributorId: '',
  fee: '',
  date: '',
}

export function validateReferralForm(
  values: ReferralFormValues,
  now: Date,
): Result<ReferralFormValues, CreateReferralInput> {
  const errors: Errors<ReferralFormValues> = {}

  if (!values.referredDistributorId)
    errors.referredDistributorId = 'Choose the referred distributor.'

  const fee = parseDollars(values.fee)
  if (fee === null) errors.fee = 'Enter a fee like 500 or 1,250.50 (max 2 decimals).'
  else if (fee <= 0) errors.fee = 'The fee must be more than $0.'
  else if (fee > MAX_FEE_CENTS) errors.fee = "The fee can't exceed $100,000,000."

  const dated = optionalDay(values.date, now)
  if (dated.error) errors.date = dated.error

  if (Object.keys(errors).length > 0 || fee === null) return { errors, input: null }
  return {
    errors,
    input: {
      referredDistributorId: values.referredDistributorId,
      fee,
      ...(dated.instant ? { date: dated.instant } : {}),
    },
  }
}
