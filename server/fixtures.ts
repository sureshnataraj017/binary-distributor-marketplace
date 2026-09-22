import type { SeedData } from './seed'
import type { Store } from './store'

/**
 * Loads a complete data set with explicit ids, in one transaction, then moves the id counters past
 * it so the next record created through the API continues the numbering. Deliberately bypasses the
 * API's validation: the generated data includes invalid and duplicate records on purpose, to
 * exercise the rules. Only for tests and the optional demo command; the application itself always
 * starts empty.
 */
export async function loadFixtures(store: Store, seed: SeedData): Promise<void> {
  const db = store.raw
  const insertAll = db.transaction(() => {
    const insertDistributor = db.prepare(
      `INSERT INTO distributors (id, name, state, city, parent_id, position, referred_by, daily_target, joined_at)
       VALUES (@id, @name, @state, @city, @parentId, @position, @referredBy, @dailyTarget, @joinedAt)`,
    )
    // Parents are always created before their children, so foreign keys hold row by row.
    for (const d of seed.distributors) insertDistributor.run(d)

    const insertRetailer = db.prepare(
      `INSERT INTO retailers (id, name, distributor_id, state, city, phone, onboarded_at, status)
       VALUES (@id, @name, @distributorId, @state, @city, @phone, @onboardedAt, @status)`,
    )
    for (const r of seed.retailers) insertRetailer.run({ ...r, phone: r.phone ?? null })

    const insertSale = db.prepare(
      `INSERT INTO sales (id, invoice_no, retailer_id, distributor_id, date, product, quantity, amount,
         retailer_commission, distributor_commission, company_commission, remainder)
       VALUES (@id, @invoiceNo, @retailerId, @distributorId, @date, @product, @quantity, @amount,
         @retailerCommission, @distributorCommission, @companyCommission, @remainder)`,
    )
    for (const s of seed.sales) {
      insertSale.run({ ...s, invoiceNo: Number(s.id.replace('INV-', '')) })
    }

    const insertReferral = db.prepare(
      `INSERT INTO referrals (id, referring_distributor_id, referred_distributor_id, date, fee,
         percentage, commission, payment_status)
       VALUES (@id, @referringDistributorId, @referredDistributorId, @date, @fee, @percentage,
         @commission, @paymentStatus)`,
    )
    for (const r of seed.referrals) insertReferral.run(r)

    // Continue numbering after the loaded data (the next claimed value is max + 1).
    const maxSuffix = (table: string, column: string, from: number): number => {
      const row = db
        .prepare<[], { max: number | null }>(`SELECT MAX(${column}) AS max FROM ${table}`)
        .get()!
      return Math.max(row.max ?? from, from)
    }
    const setCounter = db.prepare('UPDATE counters SET value = ? WHERE name = ?')
    setCounter.run(maxSuffix('distributors', "CAST(substr(id, 6) AS INTEGER)", 0), 'distributor')
    setCounter.run(maxSuffix('retailers', "CAST(substr(id, 5) AS INTEGER)", 1000), 'retailer')
    setCounter.run(maxSuffix('sales', 'invoice_no', 1000), 'sale_invoice')
    setCounter.run(maxSuffix('referrals', "CAST(substr(id, 5) AS INTEGER)", 0), 'referral')
  })
  insertAll()
}

/** Deletes every business record and restarts the id numbering. Schema and migrations are untouched. */
export async function clearData(store: Store): Promise<void> {
  const db = store.raw
  db.transaction(() => {
    db.exec('DELETE FROM sales; DELETE FROM referrals; DELETE FROM retailers; DELETE FROM distributors;')
    db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(0, 'distributor')
    db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(1000, 'retailer')
    db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(1000, 'sale_invoice')
    db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(0, 'referral')
  })()
}
