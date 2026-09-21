import type { FastifyInstance } from 'fastify'
import { notFound } from '../errors'
import type { Store } from '../store'

export function retailerRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/retailers', async () => store.retailers.list())

  app.get<{ Params: { id: string } }>('/api/retailers/:id', async (request) => {
    const retailer = store.retailers.get(request.params.id)
    if (!retailer) throw notFound('Retailer', request.params.id)
    return retailer
  })

  app.get<{ Params: { id: string } }>('/api/retailers/:id/sales', async (request) => {
    if (!store.retailers.get(request.params.id)) throw notFound('Retailer', request.params.id)
    return store.sales.listByRetailer(request.params.id)
  })
}
