import type { FastifyInstance } from 'fastify'
import type { Store } from '../store'

export function commissionRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/commissions/ledger', async () => store.ledger())

  app.get('/api/referrals', async () => store.referrals.list())
}
