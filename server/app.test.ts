// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createStore } from './store'
import type { LedgerEntry, Sale } from '@/types'

const store = createStore({ path: ':memory:' })
const app = buildApp({ store })
const db = {
  distributors: store.distributors.list(),
  retailers: store.retailers.list(),
  sales: store.sales.list(),
}
const json = <T>(response: { body: string }) => JSON.parse(response.body) as T

const activeRetailer = db.retailers.find(
  (r) => r.status === 'ACTIVE' && db.sales.some((s) => s.retailerId === r.id),
)!
const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/sales', payload: payload as object })

describe('read endpoints', () => {
  it('reports health', async () => {
    const res = await app.inject({ url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(json(res)).toEqual({ status: 'ok' })
  })

  it('lists distributors and retailers', async () => {
    expect(json<unknown[]>(await app.inject({ url: '/api/distributors' }))).toHaveLength(
      db.distributors.length,
    )
    expect(json<unknown[]>(await app.inject({ url: '/api/retailers' }))).toHaveLength(
      db.retailers.length,
    )
  })

  it('returns one distributor, and 404 with a JSON error for an unknown one', async () => {
    const ok = await app.inject({ url: '/api/distributors/DIST-001' })
    expect(ok.statusCode).toBe(200)
    expect(json<{ id: string }>(ok).id).toBe('DIST-001')

    const missing = await app.inject({ url: '/api/distributors/DIST-999' })
    expect(missing.statusCode).toBe(404)
    expect(json(missing)).toEqual({ status: 404, message: 'Distributor DIST-999 was not found' })
  })

  it("returns a retailer's sales, and 404 for an unknown retailer", async () => {
    const res = await app.inject({ url: `/api/retailers/${activeRetailer.id}/sales` })
    expect(json<Sale[]>(res).every((s) => s.retailerId === activeRetailer.id)).toBe(true)
    expect((await app.inject({ url: '/api/retailers/RET-0/sales' })).statusCode).toBe(404)
  })

  it('serves the ledger with the four entry types', async () => {
    const ledger = json<LedgerEntry[]>(await app.inject({ url: '/api/commissions/ledger' }))
    expect(new Set(ledger.map((e) => e.type))).toEqual(
      new Set(['ONBOARDING', 'RETAILER_SALE', 'DISTRIBUTOR_REFERRAL', 'DOWNLINE_SALE']),
    )
  })

  it('answers unknown routes with a JSON 404', async () => {
    const res = await app.inject({ url: '/api/nope' })
    expect(res.statusCode).toBe(404)
    expect(json<{ status: number }>(res).status).toBe(404)
  })
})

describe('POST /api/sales (server-side commission)', () => {
  it('calculates the split on the server: $1,000 -> $300 / $100 / $20 / $580 remainder', async () => {
    const res = await post({
      retailerId: activeRetailer.id,
      product: 'Product A',
      quantity: 5,
      amount: 100_000,
    })
    expect(res.statusCode).toBe(201)
    expect(json<Sale>(res)).toMatchObject({
      retailerId: activeRetailer.id,
      distributorId: activeRetailer.distributorId,
      amount: 100_000,
      retailerCommission: 30_000,
      distributorCommission: 10_000,
      companyCommission: 2_000,
      remainder: 58_000,
    })
  })

  it('assigns the next invoice number and adds the sale to the ledger', async () => {
    const before = store.sales.list().length
    const res = await post({
      retailerId: activeRetailer.id,
      product: 'Product B',
      quantity: 2,
      amount: 250_000,
    })
    const sale = json<Sale>(res)
    expect(store.sales.list()).toHaveLength(before + 1)

    const ledger = json<LedgerEntry[]>(await app.inject({ url: '/api/commissions/ledger' }))
    const entries = ledger.filter((e) => e.reference === sale.id)
    expect(entries.map((e) => [e.entity, e.type, e.amount]).sort()).toEqual(
      [
        [activeRetailer.distributorId, 'RETAILER_SALE', 25_000],
        ['Company', 'DOWNLINE_SALE', 5_000],
      ].sort(),
    )
  })

  it('ignores commission amounts sent by the client', async () => {
    const res = await post({
      retailerId: activeRetailer.id,
      product: 'Product A',
      quantity: 1,
      amount: 10_000,
      retailerCommission: 9_999,
    })
    // Unknown properties are stripped by the validator; the commission always comes from the engine.
    expect(res.statusCode).toBe(201)
    expect(json<Sale>(res).retailerCommission).toBe(3_000)
  })

  it.each([
    ['missing fields', { retailerId: activeRetailer.id }],
    ['zero quantity', { retailerId: activeRetailer.id, product: 'A', quantity: 0, amount: 100 }],
    [
      'fractional cents',
      { retailerId: activeRetailer.id, product: 'A', quantity: 1, amount: 10.5 },
    ],
    ['negative amount', { retailerId: activeRetailer.id, product: 'A', quantity: 1, amount: -5 }],
    [
      'unparsable date',
      {
        retailerId: activeRetailer.id,
        product: 'A',
        quantity: 1,
        amount: 100,
        date: 'yesterday-ish',
      },
    ],
  ])('rejects invalid input: %s', async (_label, body) => {
    expect((await post(body)).statusCode).toBe(400)
  })

  it('404s for an unknown retailer', async () => {
    expect(
      (await post({ retailerId: 'RET-0', product: 'A', quantity: 1, amount: 100 })).statusCode,
    ).toBe(404)
  })

  it.each(['CANCELLED', 'DEACTIVATED'] as const)(
    'refuses sales for %s retailers with 422',
    async (status) => {
      const retailer = db.retailers.find((r) => r.status === status)!
      const res = await post({ retailerId: retailer.id, product: 'A', quantity: 1, amount: 100 })
      expect(res.statusCode).toBe(422)
      expect(json<{ message: string }>(res).message).toContain(status)
    },
  )

  it('refuses future-dated sales and sales before the retailer was onboarded', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(
      (
        await post({
          retailerId: activeRetailer.id,
          product: 'A',
          quantity: 1,
          amount: 100,
          date: future,
        })
      ).statusCode,
    ).toBe(422)

    const past = new Date(Date.parse(activeRetailer.onboardedAt) - 86_400_000).toISOString()
    expect(
      (
        await post({
          retailerId: activeRetailer.id,
          product: 'A',
          quantity: 1,
          amount: 100,
          date: past,
        })
      ).statusCode,
    ).toBe(422)
  })
})

describe('error handling', () => {
  it('honours the x-simulate-error header (demo aid) with a 503', async () => {
    const res = await app.inject({ url: '/api/distributors', headers: { 'x-simulate-error': '1' } })
    expect(res.statusCode).toBe(503)
  })

  it('ignores the simulate header when disabled (production)', async () => {
    const prod = buildApp({ store, allowSimulatedErrors: false })
    const res = await prod.inject({
      url: '/api/distributors',
      headers: { 'x-simulate-error': '1' },
    })
    expect(res.statusCode).toBe(200)
  })
})
