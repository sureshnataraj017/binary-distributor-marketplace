import type pg from 'pg'
import type { SeedData } from './seed'
import type { Store } from './store'

const CHUNK = 400

/** Multi-row INSERT in chunks, so loading a few thousand rows is a handful of round trips. */
async function insertRows(
  client: pg.PoolClient,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK)
    const params: unknown[] = []
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value)
        return `$${params.length}`
      })
      return `(${placeholders.join(', ')})`
    })
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      params,
    )
  }
}

/**
 * Loads a complete data set with explicit ids, in one transaction, then moves the id sequences past it so
 * the next record created through the API continues the numbering. Deliberately bypasses the API's
 * validation: the generated data includes invalid and duplicate records on purpose, to exercise the rules.
 * Only for tests and the optional demo command; the application itself always starts empty.
 */
export async function loadFixtures(store: Store, seed: SeedData): Promise<void> {
  const client = await store.pool.connect()
  try {
    await client.query('BEGIN')
    // Parents are always created before their children, so foreign keys hold row by row.
    await insertRows(
      client,
      'distributors',
      [
        'id',
        'name',
        'state',
        'city',
        'parent_id',
        'position',
        'referred_by',
        'daily_target',
        'joined_at',
      ],
      seed.distributors.map((d) => [
        d.id,
        d.name,
        d.state,
        d.city,
        d.parentId,
        d.position,
        d.referredBy,
        d.dailyTarget,
        d.joinedAt,
      ]),
    )
    await insertRows(
      client,
      'retailers',
      ['id', 'name', 'distributor_id', 'state', 'city', 'phone', 'onboarded_at', 'status'],
      seed.retailers.map((r) => [
        r.id,
        r.name,
        r.distributorId,
        r.state,
        r.city,
        r.phone ?? null,
        r.onboardedAt,
        r.status,
      ]),
    )
    await insertRows(
      client,
      'sales',
      [
        'invoice_no',
        'retailer_id',
        'distributor_id',
        'date',
        'product',
        'quantity',
        'amount',
        'retailer_commission',
        'distributor_commission',
        'company_commission',
        'remainder',
      ],
      seed.sales.map((s) => [
        Number(s.id.replace('INV-', '')),
        s.retailerId,
        s.distributorId,
        s.date,
        s.product,
        s.quantity,
        s.amount,
        s.retailerCommission,
        s.distributorCommission,
        s.companyCommission,
        s.remainder,
      ]),
    )
    await insertRows(
      client,
      'referrals',
      [
        'id',
        'referring_distributor_id',
        'referred_distributor_id',
        'date',
        'fee',
        'percentage',
        'commission',
        'payment_status',
      ],
      seed.referrals.map((r) => [
        r.id,
        r.referringDistributorId,
        r.referredDistributorId,
        r.date,
        r.fee,
        r.percentage,
        r.commission,
        r.paymentStatus,
      ]),
    )

    // Continue numbering after the loaded data (setval with `true` => the next value is max + 1).
    await client.query(`
      SELECT
        setval('distributor_seq',    GREATEST((SELECT COALESCE(max(substr(id, 6)::int), 0) FROM distributors), 1), (SELECT count(*) > 0 FROM distributors)),
        setval('retailer_seq',       GREATEST((SELECT COALESCE(max(substr(id, 5)::int), 0) FROM retailers), 1000), true),
        setval('sale_invoice_seq',   GREATEST((SELECT COALESCE(max(invoice_no), 0) FROM sales), 1000), true),
        setval('referral_seq',       GREATEST((SELECT COALESCE(max(substr(id, 5)::int), 0) FROM referrals), 1), (SELECT count(*) > 0 FROM referrals))
    `)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Deletes every business record and restarts the id numbering. Schema and migrations are untouched. */
export async function clearData(store: Store): Promise<void> {
  await store.pool.query('TRUNCATE sales, referrals, retailers, distributors')
  await store.pool.query(`
    SELECT setval('distributor_seq', 1, false), setval('retailer_seq', 1001, false),
           setval('sale_invoice_seq', 1001, false), setval('referral_seq', 1, false)
  `)
}
