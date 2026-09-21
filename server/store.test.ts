// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createStore } from './store'
import type { Sale } from '@/types'

const NOW = new Date('2026-09-21T08:30:00.000Z') // 14:00 IST
const NEXT_DAY = new Date('2026-09-22T08:30:00.000Z')

const workDir = mkdtempSync(join(tmpdir(), 'marketplace-'))
afterAll(() => rmSync(workDir, { recursive: true, force: true }))

const newSale = (retailerId: string, distributorId: string): Omit<Sale, 'id'> => ({
  retailerId,
  distributorId,
  date: NOW.toISOString(),
  product: 'Product A',
  quantity: 1,
  amount: 10_000,
  retailerCommission: 3_000,
  distributorCommission: 1_000,
  companyCommission: 200,
  remainder: 5_800,
})

describe('seeding and reads', () => {
  const store = createStore({ path: ':memory:', now: NOW })

  it('loads the seeded network', () => {
    expect(store.distributors.list()).toHaveLength(32)
    expect(store.retailers.list().length).toBeGreaterThan(100)
    expect(store.sales.list().length).toBeGreaterThan(500)
    expect(store.referrals.list().length).toBeGreaterThan(0)
  })

  it("rebuilds each distributor's retailerIds from the retailers table", () => {
    const d = store.distributors.get('DIST-001')!
    const owned = store.retailers.listByDistributor('DIST-001').map((r) => r.id)
    expect(d.retailerIds).toEqual(owned)
    expect(d.retailerIds.length).toBeGreaterThan(0)
  })

  it('returns undefined for unknown ids instead of throwing', () => {
    expect(store.distributors.get('DIST-999')).toBeUndefined()
    expect(store.retailers.get('RET-0')).toBeUndefined()
  })

  it('orders sales by invoice number and referrals newest first', () => {
    const invoices = store.sales.list().map((s) => Number(s.id.replace('INV-', '')))
    expect(invoices).toEqual([...invoices].sort((a, b) => a - b))
    const dates = store.referrals.list().map((r) => r.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('derives a ledger that includes every sale', () => {
    const ledger = store.ledger(NOW)
    const saleIds = new Set(
      ledger.filter((e) => e.type === 'RETAILER_SALE').map((e) => e.reference),
    )
    expect(saleIds.size).toBe(store.sales.list().length)
  })
})

describe('database-enforced integrity', () => {
  const store = createStore({ path: ':memory:', now: NOW })
  const retailer = store.retailers.list().find((r) => r.status === 'ACTIVE')!

  it('assigns sequential invoice numbers', () => {
    const last = Number(store.sales.list().at(-1)!.id.replace('INV-', ''))
    const a = store.sales.create(newSale(retailer.id, retailer.distributorId))
    const b = store.sales.create(newSale(retailer.id, retailer.distributorId))
    expect(a.id).toBe(`INV-${last + 1}`)
    expect(b.id).toBe(`INV-${last + 2}`)
  })

  it('rejects a sale for a retailer that does not exist (foreign key)', () => {
    expect(() => store.sales.create(newSale('RET-0', retailer.distributorId))).toThrow(
      /FOREIGN KEY/,
    )
  })

  it('rejects a sale whose shares do not add up to the amount', () => {
    expect(() =>
      store.sales.create({ ...newSale(retailer.id, retailer.distributorId), remainder: 5_799 }),
    ).toThrow(/CHECK/)
  })

  it('rejects a non-positive amount or quantity', () => {
    const base = newSale(retailer.id, retailer.distributorId)
    expect(() => store.sales.create({ ...base, quantity: 0 })).toThrow(/CHECK/)
    expect(() =>
      store.sales.create({
        ...base,
        amount: 0,
        retailerCommission: 0,
        distributorCommission: 0,
        companyCommission: 0,
        remainder: 0,
      }),
    ).toThrow(/CHECK/)
  })

  it('a failed insert leaves nothing behind and does not burn an invoice number', () => {
    const before = store.sales.list().length
    expect(() => store.sales.create(newSale('RET-0', retailer.distributorId))).toThrow()
    expect(store.sales.list()).toHaveLength(before)
    const next = store.sales.create(newSale(retailer.id, retailer.distributorId))
    expect(Number(next.id.replace('INV-', ''))).toBe(
      Number(store.sales.list().at(-2)!.id.replace('INV-', '')) + 1,
    )
  })
})

describe('persistence', () => {
  it('keeps data across restarts on the same business day', () => {
    const path = join(workDir, 'same-day.db')
    const first = createStore({ path, now: NOW })
    const retailer = first.retailers.list().find((r) => r.status === 'ACTIVE')!
    const created = first.sales.create(newSale(retailer.id, retailer.distributorId))
    const count = first.sales.list().length
    first.close()

    const second = createStore({ path, now: new Date(NOW.getTime() + 3_600_000) })
    expect(second.sales.list()).toHaveLength(count)
    expect(second.sales.listByRetailer(retailer.id).some((s) => s.id === created.id)).toBe(true)
    second.close()
  })

  it('rebuilds the demo data when the business day has changed (it is relative to "today")', () => {
    const path = join(workDir, 'next-day.db')
    const first = createStore({ path, now: NOW })
    const retailer = first.retailers.list().find((r) => r.status === 'ACTIVE')!
    const created = first.sales.create(newSale(retailer.id, retailer.distributorId))
    first.close()

    const second = createStore({ path, now: NEXT_DAY })
    expect(
      second.sales
        .list()
        .some(
          (s) => s.id === created.id && s.product === 'Product A' && s.date === NOW.toISOString(),
        ),
    ).toBe(false)
    expect(second.distributors.list()).toHaveLength(32)
    second.close()
  })

  it('reset rebuilds even on the same day', () => {
    const path = join(workDir, 'reset.db')
    const first = createStore({ path, now: NOW })
    const before = first.sales.list().length
    const retailer = first.retailers.list().find((r) => r.status === 'ACTIVE')!
    first.sales.create(newSale(retailer.id, retailer.distributorId))
    first.close()

    const second = createStore({ path, now: NOW, reset: true })
    expect(second.sales.list()).toHaveLength(before)
    second.close()
  })
})
