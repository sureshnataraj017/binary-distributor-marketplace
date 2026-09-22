// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestStore, type TestStore } from './testing'
import { loadFixtures } from './fixtures'
import { migrate } from './db'
import { generateSeed } from './seed'
import {
  createStore,
  type NewDistributor,
  type NewRetailer,
  type NewSale,
  type Store,
} from './store'

const NOW = new Date()
const iso = (offsetMs = 0) => new Date(NOW.getTime() + offsetMs).toISOString()

const distributor = (overrides: Partial<NewDistributor> = {}): NewDistributor => ({
  name: 'Asha',
  state: 'Tamil Nadu',
  city: 'Chennai',
  parentId: null,
  position: null,
  referredBy: null,
  dailyTarget: 2,
  joinedAt: iso(-30 * 86_400_000),
  ...overrides,
})
const retailer = (distributorId: string, overrides: Partial<NewRetailer> = {}): NewRetailer => ({
  name: 'Sri Traders',
  distributorId,
  state: 'Tamil Nadu',
  city: 'Chennai',
  phone: null,
  onboardedAt: iso(-86_400_000),
  status: 'ACTIVE',
  ...overrides,
})
const sale = (
  retailerId: string,
  distributorId: string,
  overrides: Partial<NewSale> = {},
): NewSale => ({
  retailerId,
  distributorId,
  date: iso(-1000),
  product: 'Product A',
  quantity: 1,
  amount: 10_000,
  retailerCommission: 3_000,
  distributorCommission: 1_000,
  companyCommission: 200,
  remainder: 5_800,
  ...overrides,
})

describe('an empty database', () => {
  let ctx: TestStore
  beforeAll(async () => void (ctx = await createTestStore()))
  afterAll(() => ctx.dispose())

  it('starts with no data at all: nothing is generated for you', async () => {
    const { store } = ctx
    expect(await store.distributors.list()).toEqual([])
    expect(await store.retailers.list()).toEqual([])
    expect(await store.sales.list()).toEqual([])
    expect(await store.referrals.list()).toEqual([])
    expect(await store.ledger()).toEqual([])
  })

  it('returns undefined for unknown ids instead of throwing', async () => {
    expect(await ctx.store.distributors.get('DIST-999')).toBeUndefined()
    expect(await ctx.store.retailers.get('RET-0')).toBeUndefined()
    expect(await ctx.store.referrals.get('REF-0000')).toBeUndefined()
  })

  it('is at the latest schema, and re-running migrations changes nothing', () => {
    expect(migrate(ctx.store.raw)).toEqual([])
    const rows = ctx.store.raw.prepare('SELECT name FROM schema_migrations').all() as {
      name: string
    }[]
    expect(rows.map((r) => r.name)).toEqual(['001_init.sql'])
  })
})

describe('storing records one by one', () => {
  let ctx: TestStore
  let store: Store
  beforeAll(async () => {
    ctx = await createTestStore()
    store = ctx.store
  })
  afterAll(() => ctx.dispose())

  it('assigns sequential, readable ids to each record as it is created', async () => {
    const a = await store.distributors.create(distributor({ name: 'Asha' }))
    const b = await store.distributors.create(
      distributor({ name: 'Bala', parentId: a.id, position: 'LEFT', referredBy: a.id }),
    )
    expect([a.id, b.id]).toEqual(['DIST-001', 'DIST-002'])

    const r1 = await store.retailers.create(retailer(a.id, { name: 'One' }))
    const r2 = await store.retailers.create(retailer(a.id, { name: 'Two' }))
    expect([r1.id, r2.id]).toEqual(['RET-1001', 'RET-1002'])

    const s1 = await store.sales.create(sale(r1.id, a.id))
    const s2 = await store.sales.create(sale(r1.id, a.id))
    expect([s1.id, s2.id]).toEqual(['INV-1001', 'INV-1002'])

    const ref = await store.referrals.create({
      referringDistributorId: a.id,
      referredDistributorId: b.id,
      date: iso(-1000),
      fee: 50_000,
      percentage: 10,
      commission: 5_000,
      paymentStatus: 'PENDING',
    })
    expect(ref.id).toBe('REF-0001')
  })

  it("reads back exactly what was stored, including the distributor's retailer ids", async () => {
    const a = (await store.distributors.get('DIST-001'))!
    expect(a).toMatchObject({
      name: 'Asha',
      state: 'Tamil Nadu',
      parentId: null,
      position: null,
      dailyTarget: 2,
    })
    expect(a.retailerIds).toEqual(['RET-1001', 'RET-1002'])
    expect((await store.distributors.get('DIST-002'))!.retailerIds).toEqual([])

    const s = (await store.sales.listByRetailer('RET-1001'))[0]!
    expect(s).toMatchObject({ amount: 10_000, retailerCommission: 3_000, remainder: 5_800 })
    expect(typeof s.amount).toBe('number')
    expect(new Date(s.date).toISOString()).toBe(s.date) // stored and read back as an ISO string
  })

  it('updates a retailer status and marks a referral paid', async () => {
    expect((await store.retailers.setStatus('RET-1002', 'DEACTIVATED'))!.status).toBe('DEACTIVATED')
    expect((await store.referrals.markPaid('REF-0001'))!.paymentStatus).toBe('PAID')
    expect(await store.retailers.setStatus('RET-0', 'CANCELLED')).toBeUndefined()
    expect(await store.referrals.markPaid('REF-9999')).toBeUndefined()
  })

  it('derives the ledger from what was stored', async () => {
    const ledger = await store.ledger()
    const types = new Set(ledger.map((e) => e.type))
    expect(types).toEqual(
      new Set(['ONBOARDING', 'RETAILER_SALE', 'DOWNLINE_SALE', 'DISTRIBUTOR_REFERRAL']),
    )
    // RET-1002 was deactivated, so only RET-1001 earns an onboarding bonus.
    expect(ledger.filter((e) => e.type === 'ONBOARDING').map((e) => e.reference)).toEqual([
      'RET-1001',
    ])
  })

  it('gives 25 simultaneous sales 25 distinct invoice numbers', async () => {
    const created = await Promise.all(
      Array.from({ length: 25 }, () => store.sales.create(sale('RET-1001', 'DIST-001'))),
    )
    expect(new Set(created.map((s) => s.id)).size).toBe(25)
  })
})

describe('rules enforced by SQLite itself', () => {
  let ctx: TestStore
  let store: Store
  beforeAll(async () => {
    ctx = await createTestStore()
    store = ctx.store
    await store.distributors.create(distributor())
    await store.retailers.create(retailer('DIST-001'))
  })
  afterAll(() => ctx.dispose())

  it('refuses a second child in an occupied LEFT/RIGHT slot (binary-tree rule)', async () => {
    await store.distributors.create(distributor({ parentId: 'DIST-001', position: 'LEFT' }))
    await expect(
      store.distributors.create(
        distributor({ name: 'Rival', parentId: 'DIST-001', position: 'LEFT' }),
      ),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_UNIQUE' })
    // The other side is still free.
    await expect(
      store.distributors.create(
        distributor({ name: 'Ok', parentId: 'DIST-001', position: 'RIGHT' }),
      ),
    ).resolves.toMatchObject({ position: 'RIGHT' })
  })

  it('ties placement to a side: a parent needs LEFT/RIGHT, a top-level one must have none', async () => {
    await expect(
      store.distributors.create(distributor({ parentId: 'DIST-001', position: null })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
    await expect(
      store.distributors.create(distributor({ parentId: null, position: 'LEFT' })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
  })

  it('refuses a parent or referrer that does not exist (foreign key)', async () => {
    await expect(
      store.distributors.create(distributor({ parentId: 'DIST-999', position: 'LEFT' })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })
    await expect(
      store.distributors.create(distributor({ referredBy: 'DIST-999' })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })
    await expect(store.retailers.create(retailer('DIST-999'))).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
    })
    await expect(store.sales.create(sale('RET-0', 'DIST-001'))).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
    })
  })

  it("refuses a sale whose shares don't add up to the amount, or a non-positive amount/quantity", async () => {
    await expect(
      store.sales.create(sale('RET-1001', 'DIST-001', { remainder: 5_799 })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
    await expect(
      store.sales.create(sale('RET-1001', 'DIST-001', { quantity: 0 })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
    await expect(
      store.sales.create(
        sale('RET-1001', 'DIST-001', {
          amount: 0,
          retailerCommission: 0,
          distributorCommission: 0,
          companyCommission: 0,
          remainder: 0,
        }),
      ),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
  })

  it('refuses an invalid retailer status, a blank name, and a distributor referring themselves', async () => {
    await expect(
      store.retailers.create(retailer('DIST-001', { status: 'BOGUS' as never })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
    await expect(
      store.retailers.create(retailer('DIST-001', { name: '   ' })),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
    await expect(
      store.referrals.create({
        referringDistributorId: 'DIST-001',
        referredDistributorId: 'DIST-001',
        date: iso(),
        fee: 100,
        percentage: 10,
        commission: 10,
        paymentStatus: 'PENDING',
      }),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_CHECK' })
  })

  it('a rejected write stores nothing', async () => {
    const before = (await store.sales.list()).length
    await expect(store.sales.create(sale('RET-0', 'DIST-001'))).rejects.toThrow()
    expect(await store.sales.list()).toHaveLength(before)
  })
})

describe('persistence', () => {
  it('keeps every record after the server restarts (a fresh connection to the same file)', async () => {
    const ctx = await createTestStore()
    const d = await ctx.store.distributors.create(distributor())
    const r = await ctx.store.retailers.create(retailer(d.id))
    const s = await ctx.store.sales.create(sale(r.id, d.id))
    await ctx.store.close() // "the server stops"

    const restarted = await createStore({ path: ctx.path })
    try {
      expect((await restarted.distributors.get(d.id))!.retailerIds).toEqual([r.id])
      expect((await restarted.sales.list()).map((x) => x.id)).toEqual([s.id])
      // Numbering continues where it left off rather than starting over.
      expect((await restarted.sales.create(sale(r.id, d.id))).id).toBe('INV-1002')
    } finally {
      await restarted.close()
      await ctx.dispose() // store is already closed; this just deletes the file
    }
  })
})

describe('demo fixtures (opt-in, used by tests)', () => {
  let ctx: TestStore
  beforeAll(async () => {
    ctx = await createTestStore()
    await loadFixtures(ctx.store, generateSeed(NOW))
  })
  afterAll(() => ctx.dispose())

  it('loads the generated network with explicit ids', async () => {
    const { store } = ctx
    expect(await store.distributors.list()).toHaveLength(32)
    expect((await store.retailers.list()).length).toBeGreaterThan(100)
    expect((await store.sales.list()).length).toBeGreaterThan(500)
  })

  it('leaves the id numbering ready to continue from the loaded data', async () => {
    const { store } = ctx
    const nextDistributor = await store.distributors.create(distributor())
    expect(nextDistributor.id).toBe('DIST-033')
    const lastInvoice = (await store.sales.list()).at(-1)!.id
    const created = await store.sales.create(
      sale((await store.retailers.list())[0]!.id, 'DIST-001'),
    )
    expect(Number(created.id.replace('INV-', ''))).toBe(Number(lastInvoice.replace('INV-', '')) + 1)
  })

  it("rebuilds each distributor's retailerIds from the retailers table", async () => {
    const d = (await ctx.store.distributors.get('DIST-001'))!
    const owned = (await ctx.store.retailers.listByDistributor('DIST-001')).map((r) => r.id)
    expect(d.retailerIds).toEqual(owned)
    expect(d.retailerIds.length).toBeGreaterThan(0)
  })
})
