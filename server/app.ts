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

/**
 * The database is the last line of defence: if a rule slips past the API checks (or two requests race),
 * PostgreSQL rejects the write. Translate those errors into clear client errors instead of a generic 500.
 */
function describeDatabaseError(error: unknown): { status: number; message: string } | null {
  const { code, constraint } = error as { code?: string; constraint?: string }
  switch (code) {
    case '23505': // unique_violation
      return constraint === 'distributors_parent_id_position_key'
        ? {
            status: 409,
            message: 'That position is already taken. Choose the other side or another parent.',
          }
        : { status: 409, message: 'That record already exists.' }
    case '23503': // foreign_key_violation
      return { status: 422, message: 'This refers to a record that does not exist.' }
    case '23514': // check_violation
    case '23502': // not_null_violation
      return { status: 422, message: 'The data breaks a database rule and was not saved.' }
    case '22P02': // invalid_text_representation
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return { status: 400, message: 'One of the values is not valid.' }
    default:
      return null
  }
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
    void reply
      .status(404)
      .send({ status: 404, message: `Route ${request.method} ${request.url} not found` })
  })

  // Reports healthy only if the database answers, so a monitor notices when PostgreSQL is down.
  app.get('/api/health', async () => {
    await store.pool.query('SELECT 1')
    return { status: 'ok' }
  })
  distributorRoutes(app, store)
  retailerRoutes(app, store)
  saleRoutes(app, store)
  commissionRoutes(app, store)

  return app
}
