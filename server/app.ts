import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { HttpError } from './errors'
import { adminRoutes } from './routes/admin'
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
  /** Absolute path to the built frontend (`dist`). When set, serves it and falls back to index.html for client-side routes. */
  staticDir?: string
}

/**
 * The database is the last line of defence: if a rule slips past the API checks (or two requests race),
 * SQLite rejects the write. Translate those errors into clear client errors instead of a generic 500.
 */
function describeDatabaseError(error: unknown): { status: number; message: string } | null {
  const { code, message } = error as { code?: string; message?: string }
  switch (code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      return message?.includes('distributors.parent_id')
        ? {
            status: 409,
            message: 'That position is already taken. Choose the other side or another parent.',
          }
        : { status: 409, message: 'That record already exists.' }
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return { status: 422, message: 'This refers to a record that does not exist.' }
    case 'SQLITE_CONSTRAINT_CHECK':
    case 'SQLITE_CONSTRAINT_NOTNULL':
      return { status: 422, message: 'The data breaks a database rule and was not saved.' }
    default:
      return null
  }
}

export function buildApp({
  store,
  logger = false,
  latencyMs = 0,
  allowSimulatedErrors = process.env.NODE_ENV !== 'production',
  staticDir,
}: AppOptions) {
  const app = Fastify({ logger })

  if (staticDir) {
    void app.register(fastifyStatic, { root: staticDir })
  }

  app.addHook('onRequest', async (request) => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    if (allowSimulatedErrors && request.headers['x-simulate-error']) {
      throw new HttpError(503, 'The server is temporarily unavailable. Please try again.')
    }
  })

  // One error shape for every failure: { status, message }. Internals are never leaked on 5xx.
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const known = error instanceof HttpError || error.statusCode !== undefined
    const fromDatabase = known ? null : describeDatabaseError(error)
    const status = fromDatabase?.status ?? error.statusCode ?? 500
    const expected = known || fromDatabase !== null
    if (!expected) request.log.error(error)
    void reply.status(status).send({
      status,
      message:
        fromDatabase?.message ??
        (status >= 500 && !expected ? 'Internal server error' : error.message),
    })
  })
  app.setNotFoundHandler((request, reply) => {
    if (staticDir && request.method === 'GET' && !request.url.startsWith('/api/')) {
      void reply.sendFile('index.html')
      return
    }
    void reply
      .status(404)
      .send({ status: 404, message: `Route ${request.method} ${request.url} not found` })
  })

  // Reports healthy only if the database answers, so a monitor notices when it is unavailable.
  app.get('/api/health', async () => {
    store.raw.prepare('SELECT 1').get()
    return { status: 'ok' }
  })
  distributorRoutes(app, store)
  retailerRoutes(app, store)
  saleRoutes(app, store)
  commissionRoutes(app, store)
  adminRoutes(app, store)

  return app
}
