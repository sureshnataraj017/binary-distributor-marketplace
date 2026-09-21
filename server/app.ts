import Fastify from 'fastify'
import { HttpError } from './errors'
import { commissionRoutes } from './routes/commissions'
import { distributorRoutes } from './routes/distributors'
import { retailerRoutes } from './routes/retailers'
import { saleRoutes } from './routes/sales'
import type { Store } from './store'

interface AppOptions {
  store: Store
  logger?: boolean
  /** Artificial delay per request, so loading states are visible in demos. */
  latencyMs?: number
  /** Honour the `x-simulate-error` request header (demo aid for error states). Never in production. */
  allowSimulatedErrors?: boolean
}

export function buildApp({
  store,
  logger = false,
  latencyMs = 0,
  allowSimulatedErrors = process.env.NODE_ENV !== 'production',
}: AppOptions) {
  const app = Fastify({ logger })

  app.addHook('onRequest', async (request) => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    if (allowSimulatedErrors && request.headers['x-simulate-error']) {
      throw new HttpError(503, 'The server is temporarily unavailable. Please try again.')
    }
  })

  // One error shape for every failure: { status, message }. Internals are never leaked on 5xx.
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500
    if (status >= 500 && !(error instanceof HttpError)) request.log.error(error)
    void reply.status(status).send({
      status,
      message:
        status >= 500 && !(error instanceof HttpError) ? 'Internal server error' : error.message,
    })
  })
  app.setNotFoundHandler((request, reply) => {
    void reply
      .status(404)
      .send({ status: 404, message: `Route ${request.method} ${request.url} not found` })
  })

  app.get('/api/health', async () => ({ status: 'ok' }))
  distributorRoutes(app, store)
  retailerRoutes(app, store)
  saleRoutes(app, store)
  commissionRoutes(app, store)

  return app
}
