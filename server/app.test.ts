// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Distributor, LedgerEntry, Referral, Retailer, Sale } from '@/types'
import { buildApp } from './app'
import { loadFixtures } from './fixtures'
import { generateSeed } from './seed'
import { createTestStore, type TestStore } from './testing'

const DAY = 86_400_000
const json = <T>(response: { body: string }) => JSON.parse(response.body) as T

function setup() {
  const state: { ctx: TestStore; app: ReturnType<typeof buildApp> } = {} as never
  const get = (url: string) => state.app.inject({ url })
  const send = (method: 'POST' | 'PATCH', url: string, payload: unknown) =>
    state.app.inject({ method, url, payload: payload as object })
  return { state, get, send }
}

describe('building the network one record at a time', () => {
  const { state, get, send } = setup()
  beforeAll(async () => {
    state.ctx = await createTestStore()
    state.app = buildApp({ store: state.ctx.store })
  })
  afterAll(() => state.ctx.dispose())

  const top = { name: 'Asha', state: 'Tamil Nadu', city: 'Chennai' }
  const past = (days: number) => new Date(Date.now() - days * DAY).toISOString()

  it('starts empty and reports healthy only while the database answers', async () => {
    expect((await get('/api/health')).statusCode).toBe(200)
    for (const path of ['distributors', 'retailers', 'sales', 'referrals', 'commissions/ledger']) {
      expect(json(await get(`/api/${path}`))).toEqual([])
    }
  })

  describe('distributors', () => {
    it('creates a top-level distributor, with defaults, an id and a Location header', async () => {
      const res = await send('POST', '/api/distributors', { ...top, joinedAt: past(60) })
      expect(res.statusCode).toBe(201)
      expect(res.headers.location).toBe('/api/distributors/DIST-001')
      expect(json<Distributor>(res)).toMatchObject({
        id: 'DIST-001',
        name: 'Asha',
        parentId: null,
        position: null,
        referredBy: null,
        dailyTarget: 2,
        retailerIds: [],
      })
    })

    it('places a distributor on the LEFT or RIGHT of a parent', async () => {
      const left = await send('POST', '/api/distributors', {
        ...top,
        name: 'Bala',
        parentId: 'DIST-001',
        position: 'LEFT',
        referredBy: 'DIST-001',
        joinedAt: past(50),
      })
      expect(left.statusCode).toBe(201)
      expect(json<Distributor>(left)).toMatchObject({
        id: 'DIST-002',
        parentId: 'DIST-001',
        position: 'LEFT',
        referredBy: 'DIST-001',
      })
      const right = await send('POST', '/api/distributors', {
        ...top,
        name: 'Chitra',
        state: 'Kerala',
        city: 'Kochi',
        parentId: 'DIST-001',
        position: 'RIGHT',
        joinedAt: past(40),
      })
      expect(right.statusCode).toBe(201)
    })

    it('refuses to fill a slot twice (409), including two requests racing for it', async () => {
      const taken = await send('POST', '/api/distributors', {
        ...top,
        name: 'Rival',
        parentId: 'DIST-001',
        position: 'LEFT',
      })
      expect(taken.statusCode).toBe(409)
      expect(json<{ message: string }>(taken).message).toMatch(/position is already taken/i)

      // DIST-002 has two free slots: two simultaneous requests want the same one. Exactly one wins.
      const race = await Promise.all([
        send('POST', '/api/distributors', {
          ...top,
          name: 'R1',
          parentId: 'DIST-002',
          position: 'LEFT',
        }),
        send('POST', '/api/distributors', {
          ...top,
          name: 'R2',
          parentId: 'DIST-002',
          position: 'LEFT',
        }),
      ])
      expect(race.map((r) => r.statusCode).sort()).toEqual([201, 409])
    })

    it.each([
      ['a missing name', { state: 'Tamil Nadu', city: 'X' }, 400],
      ['a blank name', { name: '   ', state: 'Tamil Nadu', city: 'X' }, 400],
      ['an unknown state', { name: 'A', state: 'Atlantis', city: 'X' }, 422],
      [
        'a parent without a side',
        { name: 'A', state: 'Kerala', city: 'X', parentId: 'DIST-001' },
        422,
      ],
      ['a side without a parent', { name: 'A', state: 'Kerala', city: 'X', position: 'LEFT' }, 422],
      [
        'a side that is not LEFT/RIGHT',
        { name: 'A', state: 'Kerala', city: 'X', parentId: 'DIST-001', position: 'UP' },
        400,
      ],
      [
        'an unknown parent',
        { name: 'A', state: 'Kerala', city: 'X', parentId: 'DIST-999', position: 'LEFT' },
        404,
      ],
      [
        'an unknown referrer',
        { name: 'A', state: 'Kerala', city: 'X', referredBy: 'DIST-999' },
        404,
      ],
      [
        'a future joining date',
        {
          name: 'A',
          state: 'Kerala',
          city: 'X',
          joinedAt: new Date(Date.now() + DAY).toISOString(),
        },
        422,
      ],
      [
        'an unparsable joining date',
        { name: 'A', state: 'Kerala', city: 'X', joinedAt: 'soon' },
        400,
      ],
      [
        'a joining date before the parent joined',
        {
          name: 'A',
          state: 'Kerala',
          city: 'X',
          parentId: 'DIST-003',
          position: 'LEFT',
          joinedAt: past(500),
        },
        422,
      ],
      ['an unexpected field', { name: 'A', state: 'Kerala', city: 'X', dailyTarget: -1 }, 400],
    ])('rejects %s', async (_label, body, status) => {
      const before = json<unknown[]>(await get('/api/distributors')).length
      expect((await send('POST', '/api/distributors', body)).statusCode).toBe(status)
      expect(json<unknown[]>(await get('/api/distributors'))).toHaveLength(before)
    })
  })

  describe('retailers', () => {
    it("onboards a retailer under a distributor; it starts ACTIVE and takes the distributor's state", async () => {
      const res = await send('POST', '/api/retailers', {
        name: 'Sri Traders',
        distributorId: 'DIST-001',
        city: 'Chennai',
        phone: '+91 98765 43210',
        onboardedAt: past(10),
      })
      expect(res.statusCode).toBe(201)
      expect(json<Retailer>(res)).toMatchObject({
        id: 'RET-1001',
        distributorId: 'DIST-001',
        state: 'Tamil Nadu',
        status: 'ACTIVE',
      })
      expect(json<Distributor>(await get('/api/distributors/DIST-001')).retailerIds).toEqual([
        'RET-1001',
      ])
    })

    it('onboards "just now" when no date is given', async () => {
      const res = await send('POST', '/api/retailers', {
        name: 'Now Mart',
        distributorId: 'DIST-001',
        city: 'Chennai',
      })
      expect(Math.abs(Date.now() - Date.parse(json<Retailer>(res).onboardedAt))).toBeLessThan(5_000)
    })

    it('refuses the same phone number twice under one distributor, however it is written (409)', async () => {
      const dup = await send('POST', '/api/retailers', {
        name: 'Copy',
        distributorId: 'DIST-001',
        city: 'Chennai',
        phone: '9876543210',
      })
      expect(dup.statusCode).toBe(409)
      expect(json<{ message: string }>(dup).message).toContain('RET-1001')
      // A different distributor may register that number.
      expect(
        (
          await send('POST', '/api/retailers', {
            name: 'Elsewhere',
            distributorId: 'DIST-002',
            city: 'Chennai',
            phone: '9876543210',
          })
        ).statusCode,
      ).toBe(201)
    })

    it.each([
      ['an unknown distributor', { name: 'A', distributorId: 'DIST-999', city: 'X' }, 404],
      ['a blank name', { name: ' ', distributorId: 'DIST-001', city: 'X' }, 400],
      [
        'a short phone number',
        { name: 'A', distributorId: 'DIST-001', city: 'X', phone: '12345' },
        422,
      ],
      [
        'a phone with letters',
        { name: 'A', distributorId: 'DIST-001', city: 'X', phone: 'call-me-maybe' },
        422,
      ],
      [
        'an unknown state',
        { name: 'A', distributorId: 'DIST-001', city: 'X', state: 'Narnia' },
        422,
      ],
      [
        'a future onboarding date',
        {
          name: 'A',
          distributorId: 'DIST-001',
          city: 'X',
          onboardedAt: new Date(Date.now() + DAY).toISOString(),
        },
        422,
      ],
      [
        'onboarding before the distributor joined',
        { name: 'A', distributorId: 'DIST-001', city: 'X', onboardedAt: past(400) },
        422,
      ],
    ])('rejects %s', async (_label, body, status) => {
      expect((await send('POST', '/api/retailers', body)).statusCode).toBe(status)
    })

    it('ignores a status sent by the client: new retailers are always ACTIVE', async () => {
      const res = await send('POST', '/api/retailers', {
        name: 'Sneaky',
        distributorId: 'DIST-001',
        city: 'Chennai',
        status: 'CANCELLED',
      })
      expect(res.statusCode).toBe(201)
      expect(json<Retailer>(res).status).toBe('ACTIVE')
    })

    it('deactivates, reactivates and cancels; a cancelled retailer stays cancelled', async () => {
      const patch = (status: string) => send('PATCH', '/api/retailers/RET-1001/status', { status })
      expect(json<Retailer>(await patch('DEACTIVATED')).status).toBe('DEACTIVATED')
      expect(json<Retailer>(await patch('ACTIVE')).status).toBe('ACTIVE')
      expect((await patch('ACTIVE')).statusCode).toBe(200) // idempotent
      expect(json<Retailer>(await patch('CANCELLED')).status).toBe('CANCELLED')
      const revive = await patch('ACTIVE')
      expect(revive.statusCode).toBe(409)
      expect(json<Retailer>(await get('/api/retailers/RET-1001')).status).toBe('CANCELLED')
      expect((await patch('CANCELLED')).statusCode).toBe(200)
    })

    it('rejects a bad status and an unknown retailer', async () => {
      expect(
        (await send('PATCH', '/api/retailers/RET-1002/status', { status: 'FROZEN' })).statusCode,
      ).toBe(400)
      expect(
        (await send('PATCH', '/api/retailers/RET-0/status', { status: 'ACTIVE' })).statusCode,
      ).toBe(404)
    })
  })

  describe('sales', () => {
    it('records a sale for an active retailer and splits it on the server', async () => {
      const res = await send('POST', '/api/sales', {
        retailerId: 'RET-1002',
        product: 'Product A',
        quantity: 5,
        amount: 100_000,
      })
      expect(res.statusCode).toBe(201)
      expect(json<Sale>(res)).toMatchObject({
        id: 'INV-1001',
        retailerCommission: 30_000,
        distributorCommission: 10_000,
        companyCommission: 2_000,
        remainder: 58_000,
      })
    })

    it('ignores commission amounts sent by the client', async () => {
      const res = await send('POST', '/api/sales', {
        retailerId: 'RET-1002',
        product: 'A',
        quantity: 1,
        amount: 10_000,
        retailerCommission: 9_999,
      })
      expect(json<Sale>(res).retailerCommission).toBe(3_000)
    })

    it('refuses sales for a cancelled retailer (422)', async () => {
      const res = await send('POST', '/api/sales', {
        retailerId: 'RET-1001',
        product: 'A',
        quantity: 1,
        amount: 100,
      })
      expect(res.statusCode).toBe(422)
      expect(json<{ message: string }>(res).message).toContain('CANCELLED')
    })

    it.each([
      ['missing fields', { retailerId: 'RET-1002' }, 400],
      ['zero quantity', { retailerId: 'RET-1002', product: 'A', quantity: 0, amount: 100 }, 400],
      [
        'fractional cents',
        { retailerId: 'RET-1002', product: 'A', quantity: 1, amount: 10.5 },
        400,
      ],
      ['a blank product', { retailerId: 'RET-1002', product: '  ', quantity: 1, amount: 100 }, 400],
      ['an unknown retailer', { retailerId: 'RET-0', product: 'A', quantity: 1, amount: 100 }, 404],
      [
        'a future date',
        {
          retailerId: 'RET-1002',
          product: 'A',
          quantity: 1,
          amount: 100,
          date: new Date(Date.now() + DAY).toISOString(),
        },
        422,
      ],
      [
        'a date before onboarding',
        { retailerId: 'RET-1002', product: 'A', quantity: 1, amount: 100, date: past(900) },
        422,
      ],
    ])('rejects %s', async (_label, body, status) => {
      expect((await send('POST', '/api/sales', body)).statusCode).toBe(status)
    })

    it('only lists the sales of the retailer asked about', async () => {
      const sales = json<Sale[]>(await get('/api/retailers/RET-1002/sales'))
      expect(sales.length).toBeGreaterThan(0)
      expect(sales.every((s) => s.retailerId === 'RET-1002')).toBe(true)
      expect((await get('/api/retailers/RET-0/sales')).statusCode).toBe(404)
    })
  })

  describe('referrals', () => {
    it('records a fee for a referred distributor; the commission is 10% and calculated by the server', async () => {
      const res = await send('POST', '/api/referrals', {
        referredDistributorId: 'DIST-002',
        fee: 50_000,
        date: past(5),
      })
      expect(res.statusCode).toBe(201)
      expect(json<Referral>(res)).toMatchObject({
        id: 'REF-0001',
        referringDistributorId: 'DIST-001', // taken from who referred DIST-002, never from the client
        referredDistributorId: 'DIST-002',
        fee: 50_000,
        percentage: 10,
        commission: 5_000,
        paymentStatus: 'PENDING',
      })
    })

    it.each([
      ['a distributor nobody referred', { referredDistributorId: 'DIST-003', fee: 100 }, 422],
      ['an unknown distributor', { referredDistributorId: 'DIST-999', fee: 100 }, 404],
      ['a non-positive fee', { referredDistributorId: 'DIST-002', fee: 0 }, 400],
      [
        'a future date',
        {
          referredDistributorId: 'DIST-002',
          fee: 100,
          date: new Date(Date.now() + DAY).toISOString(),
        },
        422,
      ],
      [
        'a date before they joined',
        { referredDistributorId: 'DIST-002', fee: 100, date: past(900) },
        422,
      ],
    ])('rejects %s', async (_label, body, status) => {
      expect((await send('POST', '/api/referrals', body)).statusCode).toBe(status)
    })

    it('ignores a referrer sent by the client: it always comes from who referred the distributor', async () => {
      // Dated before REF-0001 so it does not change which entry the ledger test below looks at.
      const res = await send('POST', '/api/referrals', {
        referredDistributorId: 'DIST-002',
        fee: 100,
        referringDistributorId: 'DIST-003',
        date: past(6),
      })
      expect(res.statusCode).toBe(201)
      expect(json<Referral>(res).referringDistributorId).toBe('DIST-001')
    })

    it('marks a referral paid, idempotently; refuses anything else', async () => {
      expect(
        json<Referral>(await send('PATCH', '/api/referrals/REF-0001', { paymentStatus: 'PAID' }))
          .paymentStatus,
      ).toBe('PAID')
      expect(
        (await send('PATCH', '/api/referrals/REF-0001', { paymentStatus: 'PAID' })).statusCode,
      ).toBe(200)
      expect(
        (await send('PATCH', '/api/referrals/REF-0001', { paymentStatus: 'PENDING' })).statusCode,
      ).toBe(400)
      expect(
        (await send('PATCH', '/api/referrals/REF-9999', { paymentStatus: 'PAID' })).statusCode,
      ).toBe(404)
    })
  })

  it('derives the ledger from everything entered, all four entry types', async () => {
    const ledger = json<LedgerEntry[]>(await get('/api/commissions/ledger'))
    expect(new Set(ledger.map((e) => e.type))).toEqual(
      new Set(['ONBOARDING', 'RETAILER_SALE', 'DOWNLINE_SALE', 'DISTRIBUTOR_REFERRAL']),
    )
    // RET-1001 was cancelled, so it earns no onboarding bonus; the referral was paid, so it is EARNED.
    expect(
      ledger.filter((e) => e.type === 'ONBOARDING').every((e) => e.reference !== 'RET-1001'),
    ).toBe(true)
    expect(ledger.find((e) => e.type === 'DISTRIBUTOR_REFERRAL')).toMatchObject({
      entity: 'DIST-001',
      status: 'EARNED',
      amount: 5_000,
    })
  })
})

describe('error handling', () => {
  const { state, get } = setup()
  beforeAll(async () => {
    state.ctx = await createTestStore()
    state.app = buildApp({ store: state.ctx.store })
  })
  afterAll(() => state.ctx.dispose())

  it('answers unknown routes with a JSON 404', async () => {
    const res = await get('/api/nope')
    expect(res.statusCode).toBe(404)
    expect(json<{ status: number }>(res).status).toBe(404)
  })

  it('uses one error shape, and 404s for unknown ids', async () => {
    const res = await get('/api/distributors/DIST-999')
    expect(json(res)).toEqual({ status: 404, message: 'Distributor DIST-999 was not found' })
  })

  it('honours the x-simulate-error header (demo aid) with a 503', async () => {
    const res = await state.app.inject({
      url: '/api/distributors',
      headers: { 'x-simulate-error': '1' },
    })
    expect(res.statusCode).toBe(503)
  })

  it('ignores the simulate header when disabled (production)', async () => {
    const prod = buildApp({ store: state.ctx.store, allowSimulatedErrors: false })
    const res = await prod.inject({
      url: '/api/distributors',
      headers: { 'x-simulate-error': '1' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('reports 500 without leaking internals when the database fails', async () => {
    const broken = buildApp({
      store: {
        ...state.ctx.store,
        distributors: {
          ...state.ctx.store.distributors,
          list: () => Promise.reject(new Error('password=hunter2 at db.internal:5432')),
        },
      },
    })
    const res = await broken.inject({ url: '/api/distributors' })
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain('hunter2')
    expect(json(res)).toEqual({ status: 500, message: 'Internal server error' })
  })
})

describe('legacy and imported data (the API itself refuses to create these)', () => {
  const { state, get, send } = setup()
  let ctx: TestStore
  beforeAll(async () => {
    ctx = await createTestStore()
    await loadFixtures(ctx.store, generateSeed(new Date()))
    state.app = buildApp({ store: ctx.store })
  })
  afterAll(() => ctx.dispose())

  it('refuses sales for an active retailer whose onboarding date is invalid (future-dated)', async () => {
    const retailers = json<Retailer[]>(await get('/api/retailers'))
    const invalid = retailers.find(
      (r) => r.status === 'ACTIVE' && Date.parse(r.onboardedAt) > Date.now(),
    )!
    const res = await send('POST', '/api/sales', {
      retailerId: invalid.id,
      product: 'A',
      quantity: 1,
      amount: 100,
    })
    expect(res.statusCode).toBe(422)
    expect(json<{ message: string }>(res).message).toContain('FUTURE_DATE')
  })

  it('refuses sales for deactivated retailers', async () => {
    const retailers = json<Retailer[]>(await get('/api/retailers'))
    const retailer = retailers.find((r) => r.status === 'DEACTIVATED')!
    expect(
      (
        await send('POST', '/api/sales', {
          retailerId: retailer.id,
          product: 'A',
          quantity: 1,
          amount: 100,
        })
      ).statusCode,
    ).toBe(422)
  })

  it('continues the id numbering after the loaded data', async () => {
    const res = await send('POST', '/api/distributors', {
      name: 'New',
      state: 'Kerala',
      city: 'Kochi',
    })
    expect(json<Distributor>(res).id).toBe('DIST-033')
  })
})
