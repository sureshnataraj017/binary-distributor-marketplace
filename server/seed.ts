import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { calculateCommission, calculateReferralCommission } from '@/domain/commissionEngine'
import { startOfBusinessDay } from '@/domain/dateUtils'
import { assessOnboardings } from '@/domain/onboardingRules'
import type { Distributor, Position, Referral, Retailer, RetailerStatus, Sale } from '@/types'

export interface SeedData {
  distributors: Distributor[]
  retailers: Retailer[]
  sales: Sale[]
  referrals: Referral[]
}

const DAY = 86_400_000
const MINUTE = 60_000
const DISTRIBUTOR_COUNT = 32

const ROOT_STATES = ['Tamil Nadu', 'Karnataka', 'Maharashtra']
const CITIES: Record<string, string[]> = {
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara'],
  Telangana: ['Hyderabad', 'Warangal'],
  'West Bengal': ['Kolkata', 'Siliguri'],
  Delhi: ['New Delhi'],
}
const STATES = Object.keys(CITIES)

const DISTRIBUTOR_NAMES = [
  'Arjun',
  'Meera',
  'Karthik',
  'Divya',
  'Rahul',
  'Priya',
  'Vikram',
  'Ananya',
  'Suresh',
  'Lakshmi',
  'Imran',
  'Neha',
  'Rohan',
  'Kavya',
  'Sanjay',
  'Pooja',
  'Manoj',
  'Sneha',
  'Deepak',
  'Ritu',
  'Harish',
  'Nisha',
  'Gopal',
  'Swati',
  'Naveen',
  'Tanvi',
  'Ashok',
  'Bhavna',
  'Faisal',
  'Geeta',
  'Hemant',
  'Isha',
]
const SHOP_PREFIX = [
  'Sri',
  'Anand',
  'Lakshmi',
  'Royal',
  'Metro',
  'City',
  'Green',
  'Modern',
  'Star',
  'Prime',
]
const SHOP_SUFFIX = ['Traders', 'Stores', 'Mart', 'Enterprises', 'Agencies', 'Bazaar']

const PRODUCTS = [
  { name: 'Product A', unitPrice: 20_000 },
  { name: 'Product B', unitPrice: 125_000 },
  { name: 'Product C', unitPrice: 7_500 },
  { name: 'Product D', unitPrice: 48_000 },
]

/** Small deterministic PRNG so the demo data is identical on every load. */
function createRng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Builds a realistic network relative to `now`, so "today" always has data.
 * Edge cases are planted on purpose so every business rule is visible in the UI:
 *  DIST-002: onboarded at 23:59 IST yesterday (must NOT count today)
 *  DIST-003: 3 today (over-achievement) + a cancelled + a duplicate (both excluded)
 *  DIST-004: onboarded at 00:01 IST today (must count)
 *  DIST-005: deactivated retailer   DIST-006: future-dated record   DIST-007: pre-joining record
 */
export function generateSeed(now: Date, seed = 20260921): SeedData {
  const rng = createRng(seed)
  const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!
  const nowMs = now.getTime()
  const iso = (ms: number) => new Date(ms).toISOString()
  const todayStart = startOfBusinessDay(now, config.businessTimeZone).getTime()

  // ---- Distributors: three top-level roots, the rest placed into open LEFT/RIGHT slots.
  const distributors: Distributor[] = []
  const openSlots: { parentIndex: number; position: Position }[] = []

  for (let i = 0; i < DISTRIBUTOR_COUNT; i++) {
    let parent: Distributor | null = null
    let position: Position | null = null
    if (i >= ROOT_STATES.length) {
      const slot = openSlots.splice(Math.floor(rng() ** 1.6 * openSlots.length), 1)[0]!
      parent = distributors[slot.parentIndex]!
      position = slot.position
    }

    const state = parent ? (rng() < 0.65 ? parent.state : pick(STATES)) : ROOT_STATES[i]!
    const joinedMs = parent
      ? Math.min(Date.parse(parent.joinedAt) + int(7, 30) * DAY, nowMs - 2 * DAY)
      : nowMs - int(300, 420) * DAY

    distributors.push({
      id: `DIST-${String(i + 1).padStart(3, '0')}`,
      name: DISTRIBUTOR_NAMES[i]!,
      state,
      city: pick(CITIES[state]!),
      parentId: parent?.id ?? null,
      position,
      referredBy: parent
        ? rng() < 0.55
          ? parent.id
          : rng() < 0.8
            ? pick(distributors).id
            : null
        : null,
      retailerIds: [],
      dailyTarget: config.onboarding.defaultDailyTarget,
      joinedAt: iso(joinedMs),
    })
    openSlots.push({ parentIndex: i, position: 'LEFT' }, { parentIndex: i, position: 'RIGHT' })
  }
  const byId = new Map(distributors.map((d) => [d.id, d]))
  const dist = (id: string) => byId.get(id)!

  // ---- Retailers
  const retailers: Retailer[] = []
  let retailerSeq = 1000
  const addRetailer = (
    d: Distributor,
    onboardedMs: number,
    status: RetailerStatus = 'ACTIVE',
    extra: Partial<Retailer> = {},
  ): Retailer => {
    const retailer: Retailer = {
      id: `RET-${++retailerSeq}`,
      name: `${pick(SHOP_PREFIX)} ${pick(SHOP_SUFFIX)}`,
      distributorId: d.id,
      state: d.state,
      city: pick(CITIES[d.state]!),
      phone: `9${int(100_000_000, 999_999_999)}`,
      onboardedAt: iso(onboardedMs),
      status,
      ...extra,
    }
    retailers.push(retailer)
    d.retailerIds.push(retailer.id)
    return retailer
  }
  const todayTime = () => todayStart + MINUTE + rng() * Math.max(nowMs - todayStart - 2 * MINUTE, 0)
  const rollStatus = (): RetailerStatus => {
    const roll = rng()
    return roll < 0.06 ? 'DEACTIVATED' : roll < 0.1 ? 'CANCELLED' : 'ACTIVE'
  }

  const todayTargets: Record<string, number> = { 'DIST-001': 2, 'DIST-002': 1, 'DIST-003': 3 }
  const todayRetailers = new Map<string, Retailer[]>()

  for (const d of distributors) {
    const joined = Date.parse(d.joinedAt)
    const historical = int(2, 6)
    for (let i = 0; i < historical; i++) {
      addRetailer(d, joined + rng() * (todayStart - MINUTE - joined), rollStatus())
    }
    const todayCount = todayTargets[d.id] ?? (rng() < 0.3 ? 1 : 0)
    const created: Retailer[] = []
    for (let i = 0; i < todayCount; i++) created.push(addRetailer(d, todayTime()))
    todayRetailers.set(d.id, created)
  }

  addRetailer(dist('DIST-002'), todayStart - MINUTE) // 23:59 IST yesterday
  addRetailer(dist('DIST-003'), todayTime(), 'CANCELLED')
  addRetailer(dist('DIST-003'), todayTime(), 'ACTIVE', {
    phone: todayRetailers.get('DIST-003')![0]!.phone,
  })
  addRetailer(dist('DIST-004'), todayStart + MINUTE) // 00:01 IST today
  addRetailer(dist('DIST-005'), todayTime(), 'DEACTIVATED')
  addRetailer(dist('DIST-006'), nowMs + DAY) // future-dated => invalid
  addRetailer(dist('DIST-007'), Date.parse(dist('DIST-007').joinedAt) - 5 * DAY) // before joining => invalid

  // ---- Sales: only for retailers whose onboarding is valid (deactivated ones keep their history).
  const sellers = new Set<string>()
  for (const d of distributors) {
    const own = retailers.filter((r) => r.distributorId === d.id)
    for (const a of assessOnboardings(own, d, { now, config })) {
      if (a.qualifies || a.exclusion === 'DEACTIVATED') sellers.add(a.retailer.id)
    }
  }

  const drafts: Omit<Sale, 'id'>[] = []
  const draftSale = (retailer: Retailer, ms: number) => {
    const product = pick(PRODUCTS)
    const quantity = int(1, 8)
    const saleAmount = product.unitPrice * quantity
    const split = calculateCommission({ saleAmount, ...config.sale })
    drafts.push({
      retailerId: retailer.id,
      distributorId: retailer.distributorId,
      date: iso(ms),
      product: product.name,
      quantity,
      amount: saleAmount,
      retailerCommission: split.retailer,
      distributorCommission: split.distributor,
      companyCommission: split.company,
      remainder: split.remainder,
    })
  }

  for (const retailer of retailers) {
    if (!sellers.has(retailer.id)) continue
    const onboarded = Date.parse(retailer.onboardedAt)
    const count = int(3, 9)
    for (let i = 0; i < count; i++)
      draftSale(retailer, onboarded + rng() * Math.max(nowMs - onboarded, 0))
    if (retailer.status === 'ACTIVE' && rng() < 0.5) {
      draftSale(retailer, Math.max(todayTime(), onboarded))
    }
  }

  const sales: Sale[] = drafts
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((sale, index) => ({ id: `INV-${1001 + index}`, ...sale }))

  // ---- Referrals: each referred distributor generates a fee at joining and again 30 days later.
  const referrals: Referral[] = []
  for (const d of distributors) {
    if (!d.referredBy) continue
    const dates = [Date.parse(d.joinedAt), Date.parse(d.joinedAt) + 30 * DAY].filter(
      (ms) => ms <= nowMs - DAY,
    )
    for (const ms of dates) {
      const fee = int(200, 800) * 100
      referrals.push({
        id: `REF-${String(referrals.length + 1).padStart(4, '0')}`,
        referringDistributorId: d.referredBy,
        referredDistributorId: d.id,
        date: iso(ms),
        fee,
        percentage: config.referralPercentage,
        commission: calculateReferralCommission(fee, config.referralPercentage),
        paymentStatus: ms < nowMs - 20 * DAY ? 'PAID' : 'PENDING',
      })
    }
  }

  return { distributors, retailers, sales, referrals }
}
