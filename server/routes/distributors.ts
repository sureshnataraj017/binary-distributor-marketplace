import type { FastifyInstance } from 'fastify'
import { notFound } from '../errors'
import type { Store } from '../store'

export function distributorRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/distributors', async () => store.distributors.list())

  app.get<{ Params: { id: string } }>('/api/distributors/:id', async (request) => {
    const distributor = store.distributors.get(request.params.id)
    if (!distributor) throw notFound('Distributor', request.params.id)
    return distributor
  })
}
