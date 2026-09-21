import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { businessDayKey } from '@/domain/dateUtils'
import { buildLedger } from '@/domain/ledger'
import type { Distributor, LedgerEntry, Referral, Retailer, Sale } from '@/types'
import { generateSeed } from './seed'

/**
 * Persistence boundary. Routes talk to this interface only, never to SQL, so the database
 * (SQLite today, Postgres tomorrow) can change without touching the API layer.
 */
export interface Store {
  distributors: {
    list(): Distributor[]
    get(id: string): Distributor | undefined
  }
  retailers: {
    list(): Retailer[]
    get(id: string): Retailer | undefined
    listByDistributor(distributorId: string): Retailer[]
  }
  sales: {
    list(): Sale[]
    listByRetailer(retailerId: string): Sale[]
    /** Inserts the sale and assigns the next invoice number atomically. */
    create(sale: Omit<Sale, 'id'>): Sale
  }
  referrals: { list(): Referral[] }
  /** Derived from sales, onboardings and referrals, so it is always current. */
  ledger(now?: Date): LedgerEntry[]
  close(): void
}

interface StoreOptions {
  /** File path, or ':memory:' for a throwaway database (tests). */
  path: string
  /** Clock used for seeding and the "stale demo data" check. */
  now?: Date
  /** Drop and re-seed even if the database is up to date. */
  reset?: boolean
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS distributors (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    state         TEXT NOT NULL,
    city          TEXT NOT NULL,
    parent_id     TEXT REFERENCES distributors(id),
    position      TEXT CHECK (position IN ('LEFT', 'RIGHT')),
    referred_by   TEXT REFERENCES distributors(id),
    daily_target  INTEGER NOT NULL CHECK (daily_target >= 0),
    joined_at     TEXT NOT NULL,
    -- a placed distributor needs a side; a top-level one must not have one
    CHECK ((parent_id IS NULL) = (position IS NULL)),
    -- a slot can hold only one child: the binary-tree invariant, enforced by the database
    UNIQUE (parent_id, position)
  );

  CREATE TABLE IF NOT EXISTS retailers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    distributor_id  TEXT NOT NULL REFERENCES distributors(id),
    state           TEXT NOT NULL,
    city            TEXT NOT NULL,
    phone           TEXT,
    onboarded_at    TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DEACTIVATED', 'CANCELLED'))
  );
  CREATE INDEX IF NOT EXISTS idx_retailers_distributor ON retailers(distributor_id);

  CREATE TABLE IF NOT EXISTS sales (
    id                      TEXT PRIMARY KEY,
    invoice_no              INTEGER NOT NULL UNIQUE,
    retailer_id             TEXT NOT NULL REFERENCES retailers(id),
    distributor_id          TEXT NOT NULL REFERENCES distributors(id),
    date                    TEXT NOT NULL,
    product                 TEXT NOT NULL,
    quantity                INTEGER NOT NULL CHECK (quantity > 0),
    amount                  INTEGER NOT NULL CHECK (amount > 0),
    retailer_commission     INTEGER NOT NULL CHECK (retailer_commission >= 0),
    distributor_commission  INTEGER NOT NULL CHECK (distributor_commission >= 0),
    company_commission      INTEGER NOT NULL CHECK (company_commission >= 0),
    remainder               INTEGER NOT NULL CHECK (remainder >= 0),
    -- nothing may be lost: the four shares always add back up to the sale, to the cent
    CHECK (retailer_commission + distributor_commission + company_commission + remainder = amount)
  );
  CREATE INDEX IF NOT EXISTS idx_sales_retailer ON sales(retailer_id);
  CREATE INDEX IF NOT EXISTS idx_sales_distributor ON sales(distributor_id);
  CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);

  CREATE TABLE IF NOT EXISTS referrals (
    id                        TEXT PRIMARY KEY,
    referring_distributor_id  TEXT NOT NULL REFERENCES distributors(id),
    referred_distributor_id   TEXT NOT NULL REFERENCES distributors(id),
    date                      TEXT NOT NULL,
    fee                       INTEGER NOT NULL CHECK (fee >= 0),
    percentage                REAL NOT NULL,
    commission                INTEGER NOT NULL CHECK (commission >= 0),
    payment_status            TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'PAID'))
  );
`

interface DistributorRow {
  id: string
  name: string
  state: string
  city: string
  parent_id: string | null
  position: 'LEFT' | 'RIGHT' | null
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
  status: Retailer['status']
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

export function createStore({ path, now = new Date(), reset = false }: StoreOptions): Store {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  seedIfNeeded(db, now, reset)

  const retailerIdsByDistributor = db.prepare<[], { distributor_id: string; id: string }>(
    'SELECT distributor_id, id FROM retailers ORDER BY id',
  )
  const retailerIdsFor = db.prepare<[string], { id: string }>(
    'SELECT id FROM retailers WHERE distributor_id = ? ORDER BY id',
  )
  const toDistributor = (row: DistributorRow, retailerIds: string[]): Distributor => ({
    id: row.id,
    name: row.name,
    state: row.state,
    city: row.city,
    parentId: row.parent_id,
    position: row.position,
    referredBy: row.referred_by,
    retailerIds,
    dailyTarget: row.daily_target,
    joinedAt: row.joined_at,
  })

  const listDistributors = db.prepare<[], DistributorRow>('SELECT * FROM distributors ORDER BY id')
  const getDistributor = db.prepare<[string], DistributorRow>(
    'SELECT * FROM distributors WHERE id = ?',
  )
  const listRetailers = db.prepare<[], RetailerRow>('SELECT * FROM retailers ORDER BY id')
  const getRetailer = db.prepare<[string], RetailerRow>('SELECT * FROM retailers WHERE id = ?')
  const retailersOf = db.prepare<[string], RetailerRow>(
    'SELECT * FROM retailers WHERE distributor_id = ? ORDER BY id',
  )
  const listSales = db.prepare<[], SaleRow>('SELECT * FROM sales ORDER BY invoice_no')
  const salesOf = db.prepare<[string], SaleRow>(
    'SELECT * FROM sales WHERE retailer_id = ? ORDER BY invoice_no',
  )
  const listReferrals = db.prepare<[], ReferralRow>(
    'SELECT * FROM referrals ORDER BY date DESC, id',
  )
  const nextInvoiceNo = db.prepare<[], { next: number }>(
    'SELECT COALESCE(MAX(invoice_no), 1000) + 1 AS next FROM sales',
  )
  const insertSale = db.prepare(
    `INSERT INTO sales (id, invoice_no, retailer_id, distributor_id, date, product, quantity, amount,
       retailer_commission, distributor_commission, company_commission, remainder)
     VALUES (@id, @invoiceNo, @retailerId, @distributorId, @date, @product, @quantity, @amount,
       @retailerCommission, @distributorCommission, @companyCommission, @remainder)`,
  )

  const createSale = db.transaction((input: Omit<Sale, 'id'>): Sale => {
    const invoiceNo = nextInvoiceNo.get()!.next
    const sale: Sale = { id: `INV-${invoiceNo}`, ...input }
    insertSale.run({ ...sale, invoiceNo })
    return sale
  })

  const store: Store = {
    distributors: {
      list() {
        const idsByDistributor = new Map<string, string[]>()
        for (const { distributor_id, id } of retailerIdsByDistributor.all()) {
          const ids = idsByDistributor.get(distributor_id) ?? []
          ids.push(id)
          idsByDistributor.set(distributor_id, ids)
        }
        return listDistributors
          .all()
          .map((row) => toDistributor(row, idsByDistributor.get(row.id) ?? []))
      },
      get(id) {
        const row = getDistributor.get(id)
        return row
          ? toDistributor(
              row,
              retailerIdsFor.all(id).map((r) => r.id),
            )
          : undefined
      },
    },
    retailers: {
      list: () => listRetailers.all().map(toRetailer),
      get(id) {
        const row = getRetailer.get(id)
        return row ? toRetailer(row) : undefined
      },
      listByDistributor: (distributorId) => retailersOf.all(distributorId).map(toRetailer),
    },
    sales: {
      list: () => listSales.all().map(toSale),
      listByRetailer: (retailerId) => salesOf.all(retailerId).map(toSale),
      create: (sale) => createSale(sale),
    },
    referrals: { list: () => listReferrals.all().map(toReferral) },
    ledger(at = new Date()) {
      return buildLedger({
        distributors: store.distributors.list(),
        retailers: store.retailers.list(),
        sales: store.sales.list(),
        referrals: store.referrals.list(),
        now: at,
        config,
      })
    },
    close: () => void db.close(),
  }
  return store
}

/**
 * The demo data is generated relative to "today" (onboardings today, yesterday at 23:59, ...).
 * So a database seeded on an earlier business day is stale and gets rebuilt; on the same day it is kept,
 * which means sales created through the API survive restarts.
 */
function seedIfNeeded(db: Database.Database, now: Date, reset: boolean) {
  const today = businessDayKey(now, config.businessTimeZone)
  const seededOn = db
    .prepare<[], { value: string }>("SELECT value FROM meta WHERE key = 'seeded_on'")
    .get()?.value
  if (!reset && seededOn === today) return

  const seed = generateSeed(now)
  const load = db.transaction(() => {
    for (const table of ['sales', 'referrals', 'retailers', 'distributors', 'meta']) {
      db.exec(`DELETE FROM ${table}`)
    }
    const addDistributor = db.prepare(
      `INSERT INTO distributors (id, name, state, city, parent_id, position, referred_by, daily_target, joined_at)
       VALUES (@id, @name, @state, @city, @parentId, @position, @referredBy, @dailyTarget, @joinedAt)`,
    )
    // Parents are always created before their children, so foreign keys hold row by row.
    for (const d of seed.distributors) addDistributor.run(d)

    const addRetailer = db.prepare(
      `INSERT INTO retailers (id, name, distributor_id, state, city, phone, onboarded_at, status)
       VALUES (@id, @name, @distributorId, @state, @city, @phone, @onboardedAt, @status)`,
    )
    for (const r of seed.retailers) addRetailer.run({ phone: null, ...r })

    const addSale = db.prepare(
      `INSERT INTO sales (id, invoice_no, retailer_id, distributor_id, date, product, quantity, amount,
         retailer_commission, distributor_commission, company_commission, remainder)
       VALUES (@id, @invoiceNo, @retailerId, @distributorId, @date, @product, @quantity, @amount,
         @retailerCommission, @distributorCommission, @companyCommission, @remainder)`,
    )
    for (const s of seed.sales) addSale.run({ ...s, invoiceNo: Number(s.id.replace('INV-', '')) })

    const addReferral = db.prepare(
      `INSERT INTO referrals (id, referring_distributor_id, referred_distributor_id, date, fee, percentage,
         commission, payment_status)
       VALUES (@id, @referringDistributorId, @referredDistributorId, @date, @fee, @percentage,
         @commission, @paymentStatus)`,
    )
    for (const r of seed.referrals) addReferral.run(r)

    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_on', ?)").run(today)
  })
  load()
}
