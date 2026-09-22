import type Database from 'better-sqlite3'
import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { buildLedger } from '@/domain/ledger'
import type {
  Distributor,
  LedgerEntry,
  Position,
  Referral,
  Retailer,
  RetailerStatus,
  Sale,
} from '@/types'
import { migrate, openDatabase } from './db'

export interface NewDistributor {
  name: string
  state: string
  city: string
  parentId: string | null
  position: Position | null
  referredBy: string | null
  dailyTarget: number
  joinedAt: string
}

export interface NewRetailer {
  name: string
  distributorId: string
  state: string
  city: string
  phone: string | null
  onboardedAt: string
  status: RetailerStatus
}

export type NewSale = Omit<Sale, 'id'>
export type NewReferral = Omit<Referral, 'id'>

/**
 * Persistence boundary. Routes talk to this interface only, never to SQL, so the database can change
 * without touching the API layer. Ids are assigned by the database when a record is created.
 */
export interface Store {
  distributors: {
    list(): Promise<Distributor[]>
    get(id: string): Promise<Distributor | undefined>
    create(input: NewDistributor): Promise<Distributor>
    /** The distributor already placed in this LEFT/RIGHT slot under `parentId`, if any. */
    childAt(parentId: string, position: Position): Promise<Distributor | undefined>
  }
  retailers: {
    list(): Promise<Retailer[]>
    get(id: string): Promise<Retailer | undefined>
    listByDistributor(distributorId: string): Promise<Retailer[]>
    create(input: NewRetailer): Promise<Retailer>
    setStatus(id: string, status: RetailerStatus): Promise<Retailer | undefined>
  }
  sales: {
    list(): Promise<Sale[]>
    listByRetailer(retailerId: string): Promise<Sale[]>
    create(input: NewSale): Promise<Sale>
  }
  referrals: {
    list(): Promise<Referral[]>
    get(id: string): Promise<Referral | undefined>
    create(input: NewReferral): Promise<Referral>
    markPaid(id: string): Promise<Referral | undefined>
  }
  /** Derived from sales, onboardings and referrals, so it is always current. Nothing is stored twice. */
  ledger(now?: Date): Promise<LedgerEntry[]>
  /** The underlying connection. For migrations, fixtures and tests only. */
  readonly raw: Database.Database
  close(): Promise<void>
}

interface DistributorRow {
  id: string
  name: string
  state: string
  city: string
  parent_id: string | null
  position: Position | null
  referred_by: string | null
  daily_target: number
  joined_at: string
}
interface RetailerRow {
  id: string
  name: string
  distributor_id: string
  state: string
  city: string
  phone: string | null
  onboarded_at: string
  status: RetailerStatus
}
interface SaleRow {
  id: string
  retailer_id: string
  distributor_id: string
  date: string
  product: string
  quantity: number
  amount: number
  retailer_commission: number
  distributor_commission: number
  company_commission: number
  remainder: number
}
interface ReferralRow {
  id: string
  referring_distributor_id: string
  referred_distributor_id: string
  date: string
  fee: number
  percentage: number
  commission: number
  payment_status: Referral['paymentStatus']
}

const toDistributor = (r: DistributorRow, retailerIds: string[]): Distributor => ({
  id: r.id,
  name: r.name,
  state: r.state,
  city: r.city,
  parentId: r.parent_id,
  position: r.position,
  referredBy: r.referred_by,
  retailerIds,
  dailyTarget: r.daily_target,
  joinedAt: r.joined_at,
})

const toRetailer = (r: RetailerRow): Retailer => ({
  id: r.id,
  name: r.name,
  distributorId: r.distributor_id,
  state: r.state,
  city: r.city,
  ...(r.phone ? { phone: r.phone } : {}),
  onboardedAt: r.onboarded_at,
  status: r.status,
})

const toSale = (r: SaleRow): Sale => ({
  id: r.id,
  retailerId: r.retailer_id,
  distributorId: r.distributor_id,
  date: r.date,
  product: r.product,
  quantity: r.quantity,
  amount: r.amount,
  retailerCommission: r.retailer_commission,
  distributorCommission: r.distributor_commission,
  companyCommission: r.company_commission,
  remainder: r.remainder,
})

const toReferral = (r: ReferralRow): Referral => ({
  id: r.id,
  referringDistributorId: r.referring_distributor_id,
  referredDistributorId: r.referred_distributor_id,
  date: r.date,
  fee: r.fee,
  percentage: r.percentage,
  commission: r.commission,
  paymentStatus: r.payment_status,
})

// Ids look like DIST-001 / RET-1001 / INV-1001 / REF-0001. Sort by length first so DIST-1000 follows DIST-999.
const BY_ID = 'ORDER BY length(id), id'

export interface StoreOptions {
  /** File path, or ':memory:' for a throwaway database (tests). Defaults to server/data/marketplace.db. */
  path?: string
}

/** Opens the database and brings the schema up to date. */
export async function createStore({ path = 'server/data/marketplace.db' }: StoreOptions = {}): Promise<Store> {
  const db = openDatabase(path)
  try {
    migrate(db)
  } catch (error) {
    db.close()
    throw error
  }

  /** Claims the next raw numeric value of a named counter. */
  function claimCounter(counter: string): number {
    const row = db
      .prepare<[string], { value: number }>(
        'UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value',
      )
      .get(counter)
    if (!row) throw new Error(`Unknown counter: ${counter}`)
    return row.value
  }

  /** Claims the next value of a named counter, formatted as a readable, (optionally) zero-padded id. */
  function nextId(counter: string, prefix: string, pad = 0): string {
    return `${prefix}-${String(claimCounter(counter)).padStart(pad, '0')}`
  }

  /** Every retailer id owned by each distributor, in id order — attached to the Distributor read model. */
  function retailerIdsByDistributor(): Map<string, string[]> {
    const rows = db
      .prepare<[], { id: string; distributor_id: string }>(`SELECT id, distributor_id FROM retailers ${BY_ID}`)
      .all()
    const map = new Map<string, string[]>()
    for (const row of rows) {
      const list = map.get(row.distributor_id)
      if (list) list.push(row.id)
      else map.set(row.distributor_id, [row.id])
    }
    return map
  }

  const store: Store = {
    distributors: {
      async list() {
        const rows = db
          .prepare<[], DistributorRow>(`SELECT * FROM distributors ${BY_ID}`)
          .all()
        const byDistributor = retailerIdsByDistributor()
        return rows.map((row) => toDistributor(row, byDistributor.get(row.id) ?? []))
      },
      async get(id) {
        const row = db
          .prepare<[string], DistributorRow>('SELECT * FROM distributors WHERE id = ?')
          .get(id)
        if (!row) return undefined
        const retailerIds = db
          .prepare<[string], { id: string }>(`SELECT id FROM retailers WHERE distributor_id = ? ${BY_ID}`)
          .all(id)
          .map((r) => r.id)
        return toDistributor(row, retailerIds)
      },
      async childAt(parentId, position) {
        const row = db
          .prepare<
            [string, Position],
            DistributorRow
          >('SELECT * FROM distributors WHERE parent_id = ? AND position = ?')
          .get(parentId, position)
        if (!row) return undefined
        const retailerIds = db
          .prepare<[string], { id: string }>(`SELECT id FROM retailers WHERE distributor_id = ? ${BY_ID}`)
          .all(row.id)
          .map((r) => r.id)
        return toDistributor(row, retailerIds)
      },
      async create(input) {
        const insert = db.transaction((): DistributorRow => {
          const id = nextId('distributor', 'DIST', 3)
          db.prepare(
            `INSERT INTO distributors (id, name, state, city, parent_id, position, referred_by, daily_target, joined_at)
             VALUES (@id, @name, @state, @city, @parentId, @position, @referredBy, @dailyTarget, @joinedAt)`,
          ).run({ id, ...input })
          return db.prepare<[string], DistributorRow>('SELECT * FROM distributors WHERE id = ?').get(id)!
        })
        return toDistributor(insert(), [])
      },
    },

    retailers: {
      async list() {
        return db.prepare<[], RetailerRow>(`SELECT * FROM retailers ${BY_ID}`).all().map(toRetailer)
      },
      async get(id) {
        const row = db.prepare<[string], RetailerRow>('SELECT * FROM retailers WHERE id = ?').get(id)
        return row && toRetailer(row)
      },
      async listByDistributor(distributorId) {
        return db
          .prepare<[string], RetailerRow>(`SELECT * FROM retailers WHERE distributor_id = ? ${BY_ID}`)
          .all(distributorId)
          .map(toRetailer)
      },
      async create(input) {
        const insert = db.transaction((): RetailerRow => {
          const id = nextId('retailer', 'RET')
          db.prepare(
            `INSERT INTO retailers (id, name, distributor_id, state, city, phone, onboarded_at, status)
             VALUES (@id, @name, @distributorId, @state, @city, @phone, @onboardedAt, @status)`,
          ).run({ id, ...input })
          return db.prepare<[string], RetailerRow>('SELECT * FROM retailers WHERE id = ?').get(id)!
        })
        return toRetailer(insert())
      },
      async setStatus(id, status) {
        db.prepare('UPDATE retailers SET status = ? WHERE id = ?').run(status, id)
        const row = db.prepare<[string], RetailerRow>('SELECT * FROM retailers WHERE id = ?').get(id)
        return row && toRetailer(row)
      },
    },

    sales: {
      async list() {
        return db.prepare<[], SaleRow>('SELECT * FROM sales ORDER BY invoice_no').all().map(toSale)
      },
      async listByRetailer(retailerId) {
        return db
          .prepare<[string], SaleRow>('SELECT * FROM sales WHERE retailer_id = ? ORDER BY invoice_no')
          .all(retailerId)
          .map(toSale)
      },
      async create(input) {
        // The invoice number comes from a counter claimed inside the same transaction as the insert:
        // unique and increasing, and — because better-sqlite3 calls are synchronous — safe even when
        // several requests race, since no other JavaScript runs between the claim and the insert.
        const insert = db.transaction((): SaleRow => {
          const invoiceNo = claimCounter('sale_invoice')
          const id = `INV-${invoiceNo}`
          db.prepare(
            `INSERT INTO sales (id, invoice_no, retailer_id, distributor_id, date, product, quantity, amount,
               retailer_commission, distributor_commission, company_commission, remainder)
             VALUES (@id, @invoiceNo, @retailerId, @distributorId, @date, @product, @quantity, @amount,
               @retailerCommission, @distributorCommission, @companyCommission, @remainder)`,
          ).run({ id, invoiceNo, ...input })
          return db.prepare<[string], SaleRow>('SELECT * FROM sales WHERE id = ?').get(id)!
        })
        return toSale(insert())
      },
    },

    referrals: {
      async list() {
        return db
          .prepare<[], ReferralRow>('SELECT * FROM referrals ORDER BY date DESC, length(id), id')
          .all()
          .map(toReferral)
      },
      async get(id) {
        const row = db.prepare<[string], ReferralRow>('SELECT * FROM referrals WHERE id = ?').get(id)
        return row && toReferral(row)
      },
      async create(input) {
        const insert = db.transaction((): ReferralRow => {
          const id = nextId('referral', 'REF', 4)
          db.prepare(
            `INSERT INTO referrals (id, referring_distributor_id, referred_distributor_id, date, fee,
               percentage, commission, payment_status)
             VALUES (@id, @referringDistributorId, @referredDistributorId, @date, @fee, @percentage,
               @commission, @paymentStatus)`,
          ).run({ id, ...input })
          return db.prepare<[string], ReferralRow>('SELECT * FROM referrals WHERE id = ?').get(id)!
        })
        return toReferral(insert())
      },
      async markPaid(id) {
        db.prepare(`UPDATE referrals SET payment_status = 'PAID' WHERE id = ?`).run(id)
        const row = db.prepare<[string], ReferralRow>('SELECT * FROM referrals WHERE id = ?').get(id)
        return row && toReferral(row)
      },
    },

    async ledger(at = new Date()) {
      const [distributors, retailers, sales, referrals] = await Promise.all([
        store.distributors.list(),
        store.retailers.list(),
        store.sales.list(),
        store.referrals.list(),
      ])
      return buildLedger({ distributors, retailers, sales, referrals, now: at, config })
    },

    raw: db,
    async close() {
      if (db.open) db.close()
    },
  }
  return store
}
