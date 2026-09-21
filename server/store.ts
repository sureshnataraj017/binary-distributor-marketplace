import type pg from 'pg'
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
import { createPool, migrate, type ConnectionOptions } from './db'

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
  /** The underlying pool. For migrations, fixtures and tests only. */
  readonly pool: pg.Pool
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
  retailer_ids: string[]
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

const toDistributor = (r: DistributorRow): Distributor => ({
  id: r.id,
  name: r.name,
  state: r.state,
  city: r.city,
  parentId: r.parent_id,
  position: r.position,
  referredBy: r.referred_by,
  retailerIds: r.retailer_ids,
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
const DISTRIBUTOR_SELECT = `
  SELECT d.*, COALESCE(array_agg(r.id ORDER BY length(r.id), r.id) FILTER (WHERE r.id IS NOT NULL), '{}') AS retailer_ids
  FROM distributors d
  LEFT JOIN retailers r ON r.distributor_id = d.id`

/** Opens the connection pool and brings the schema up to date. */
export async function createStore(options: ConnectionOptions = {}): Promise<Store> {
  const pool = createPool(options)
  try {
    await migrate(pool)
  } catch (error) {
    await pool.end()
    throw error
  }

  const store: Store = {
    distributors: {
      async list() {
        const { rows } = await pool.query<DistributorRow>(
          `${DISTRIBUTOR_SELECT} GROUP BY d.id ORDER BY length(d.id), d.id`,
        )
        return rows.map(toDistributor)
      },
      async get(id) {
        const { rows } = await pool.query<DistributorRow>(
          `${DISTRIBUTOR_SELECT} WHERE d.id = $1 GROUP BY d.id`,
          [id],
        )
        return rows[0] && toDistributor(rows[0])
      },
      async childAt(parentId, position) {
        const { rows } = await pool.query<DistributorRow>(
          `${DISTRIBUTOR_SELECT} WHERE d.parent_id = $1 AND d.position = $2 GROUP BY d.id`,
          [parentId, position],
        )
        return rows[0] && toDistributor(rows[0])
      },
      async create(input) {
        const { rows } = await pool.query<DistributorRow>(
          `INSERT INTO distributors (name, state, city, parent_id, position, referred_by, daily_target, joined_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *, '{}'::text[] AS retailer_ids`,
          [
            input.name,
            input.state,
            input.city,
            input.parentId,
            input.position,
            input.referredBy,
            input.dailyTarget,
            input.joinedAt,
          ],
        )
        return toDistributor(rows[0]!)
      },
    },

    retailers: {
      async list() {
        const { rows } = await pool.query<RetailerRow>(`SELECT * FROM retailers ${BY_ID}`)
        return rows.map(toRetailer)
      },
      async get(id) {
        const { rows } = await pool.query<RetailerRow>('SELECT * FROM retailers WHERE id = $1', [
          id,
        ])
        return rows[0] && toRetailer(rows[0])
      },
      async listByDistributor(distributorId) {
        const { rows } = await pool.query<RetailerRow>(
          `SELECT * FROM retailers WHERE distributor_id = $1 ${BY_ID}`,
          [distributorId],
        )
        return rows.map(toRetailer)
      },
      async create(input) {
        const { rows } = await pool.query<RetailerRow>(
          `INSERT INTO retailers (name, distributor_id, state, city, phone, onboarded_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.name,
            input.distributorId,
            input.state,
            input.city,
            input.phone,
            input.onboardedAt,
            input.status,
          ],
        )
        return toRetailer(rows[0]!)
      },
      async setStatus(id, status) {
        const { rows } = await pool.query<RetailerRow>(
          'UPDATE retailers SET status = $2 WHERE id = $1 RETURNING *',
          [id, status],
        )
        return rows[0] && toRetailer(rows[0])
      },
    },

    sales: {
      async list() {
        const { rows } = await pool.query<SaleRow>('SELECT * FROM sales ORDER BY invoice_no')
        return rows.map(toSale)
      },
      async listByRetailer(retailerId) {
        const { rows } = await pool.query<SaleRow>(
          'SELECT * FROM sales WHERE retailer_id = $1 ORDER BY invoice_no',
          [retailerId],
        )
        return rows.map(toSale)
      },
      async create(input) {
        // The invoice number comes from a sequence: unique and increasing, even under concurrent requests.
        // (A failed insert can leave a gap in the numbering; that is normal for sequences.)
        const { rows } = await pool.query<SaleRow>(
          `INSERT INTO sales (retailer_id, distributor_id, date, product, quantity, amount,
             retailer_commission, distributor_commission, company_commission, remainder)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            input.retailerId,
            input.distributorId,
            input.date,
            input.product,
            input.quantity,
            input.amount,
            input.retailerCommission,
            input.distributorCommission,
            input.companyCommission,
            input.remainder,
          ],
        )
        return toSale(rows[0]!)
      },
    },

    referrals: {
      async list() {
        const { rows } = await pool.query<ReferralRow>(
          'SELECT * FROM referrals ORDER BY date DESC, length(id), id',
        )
        return rows.map(toReferral)
      },
      async get(id) {
        const { rows } = await pool.query<ReferralRow>('SELECT * FROM referrals WHERE id = $1', [
          id,
        ])
        return rows[0] && toReferral(rows[0])
      },
      async create(input) {
        const { rows } = await pool.query<ReferralRow>(
          `INSERT INTO referrals (referring_distributor_id, referred_distributor_id, date, fee, percentage,
             commission, payment_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.referringDistributorId,
            input.referredDistributorId,
            input.date,
            input.fee,
            input.percentage,
            input.commission,
            input.paymentStatus,
          ],
        )
        return toReferral(rows[0]!)
      },
      async markPaid(id) {
        const { rows } = await pool.query<ReferralRow>(
          `UPDATE referrals SET payment_status = 'PAID' WHERE id = $1 RETURNING *`,
          [id],
        )
        return rows[0] && toReferral(rows[0])
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

    pool,
    close: () => pool.end(),
  }
  return store
}
