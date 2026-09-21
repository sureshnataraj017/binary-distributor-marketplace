import { describe, expect, it } from 'vitest'
import {
  EMPTY_DISTRIBUTOR_FORM,
  EMPTY_REFERRAL_FORM,
  EMPTY_RETAILER_FORM,
  validateDistributorForm,
  validateReferralForm,
  validateRetailerForm,
} from './entryForms'

const NOW = new Date('2026-09-21T08:30:00.000Z') // 14:00 IST on 21 Sep

describe('validateDistributorForm', () => {
  const top = { ...EMPTY_DISTRIBUTOR_FORM, name: ' Asha ', state: 'Tamil Nadu', city: 'Chennai' }

  it('builds a minimal top-level distributor', () => {
    expect(validateDistributorForm(top, NOW)).toEqual({
      errors: {},
      input: { name: 'Asha', state: 'Tamil Nadu', city: 'Chennai', dailyTarget: 2 },
    })
  })

  it('builds a placed distributor with a referrer and a past joining date', () => {
    const result = validateDistributorForm(
      {
        ...top,
        placement: 'UNDER',
        parentId: 'DIST-001',
        position: 'LEFT',
        referredBy: 'DIST-002',
        joinedOn: '2026-09-01',
      },
      NOW,
    )
    expect(result.input).toMatchObject({
      parentId: 'DIST-001',
      position: 'LEFT',
      referredBy: 'DIST-002',
      joinedAt: '2026-09-01T06:30:00.000Z',
    })
  })

  it('does not send a parent or side for a top-level distributor, even if the fields still hold values', () => {
    const result = validateDistributorForm(
      { ...top, placement: 'TOP', parentId: 'DIST-001', position: 'RIGHT' },
      NOW,
    )
    expect(result.input).not.toHaveProperty('parentId')
    expect(result.input).not.toHaveProperty('position')
  })

  it('reports every problem at once', () => {
    const { errors, input } = validateDistributorForm(
      { ...EMPTY_DISTRIBUTOR_FORM, placement: 'UNDER' },
      NOW,
    )
    expect(input).toBeNull()
    expect(Object.keys(errors).sort()).toEqual(['city', 'name', 'parentId', 'state'])
  })

  it.each([
    ['position', { placement: 'UNDER', parentId: 'DIST-001', position: '' }],
    ['joinedOn', { joinedOn: '2026-09-22' }],
    ['joinedOn', { joinedOn: '2026-02-31' }],
    ['dailyTarget', { dailyTarget: '-1' }],
    ['dailyTarget', { dailyTarget: '2.5' }],
    ['dailyTarget', { dailyTarget: '5000' }],
    ['state', { state: 'Atlantis' }],
  ] as const)('flags an invalid %s (%j)', (field, override) => {
    const result = validateDistributorForm({ ...top, ...override } as never, NOW)
    expect(result.input).toBeNull()
    expect(result.errors).toHaveProperty(field)
  })
})

describe('validateRetailerForm', () => {
  const valid = {
    ...EMPTY_RETAILER_FORM,
    name: 'Sri Traders',
    distributorId: 'DIST-001',
    city: 'Chennai',
    state: 'Tamil Nadu',
  }

  it('accepts the minimum, and optional phone and date', () => {
    expect(validateRetailerForm(valid, NOW).input).toEqual({
      name: 'Sri Traders',
      distributorId: 'DIST-001',
      city: 'Chennai',
      state: 'Tamil Nadu',
    })
    expect(
      validateRetailerForm({ ...valid, phone: '+91 98765 43210', onboardedOn: '2026-09-10' }, NOW)
        .input,
    ).toMatchObject({ phone: '+91 98765 43210', onboardedAt: '2026-09-10T06:30:00.000Z' })
  })

  it.each([
    ['name', { name: '  ' }],
    ['distributorId', { distributorId: '' }],
    ['city', { city: '' }],
    ['state', { state: '' }],
    ['phone', { phone: '12345' }],
    ['phone', { phone: 'call me' }],
    ['onboardedOn', { onboardedOn: '2030-01-01' }],
  ] as const)('flags an invalid %s (%j)', (field, override) => {
    const result = validateRetailerForm({ ...valid, ...override }, NOW)
    expect(result.input).toBeNull()
    expect(result.errors).toHaveProperty(field)
  })
})

describe('validateReferralForm', () => {
  it('converts the fee to cents', () => {
    expect(
      validateReferralForm({ referredDistributorId: 'DIST-002', fee: '1,250.50', date: '' }, NOW)
        .input,
    ).toEqual({ referredDistributorId: 'DIST-002', fee: 125_050 })
  })

  it.each([
    ['referredDistributorId', { referredDistributorId: '', fee: '500' }],
    ['fee', { referredDistributorId: 'DIST-002', fee: '' }],
    ['fee', { referredDistributorId: 'DIST-002', fee: '0' }],
    ['fee', { referredDistributorId: 'DIST-002', fee: '12.345' }],
    ['date', { referredDistributorId: 'DIST-002', fee: '500', date: '2027-01-01' }],
  ] as const)('flags an invalid %s (%j)', (field, override) => {
    const result = validateReferralForm({ ...EMPTY_REFERRAL_FORM, ...override }, NOW)
    expect(result.input).toBeNull()
    expect(result.errors).toHaveProperty(field)
  })
})
