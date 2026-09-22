import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { HttpError } from '../errors'
import { clearData } from '../fixtures'
import type { Store } from '../store'

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * Registered only when ADMIN_TOKEN is set, so the route doesn't exist at all unless a secret has
 * been configured (set it in the Render dashboard, never commit it). Lets us wipe the live
 * database from outside, since this plan has no Render Shell access.
 */
export function adminRoutes(app: FastifyInstance, store: Store) {
  const token = process.env.ADMIN_TOKEN
  if (!token) return

  app.delete('/api/admin/data', async (request) => {
    const provided = request.headers['x-admin-token']
    if (typeof provided !== 'string' || !tokensMatch(provided, token)) {
      throw new HttpError(401, 'Invalid admin token')
    }
    await clearData(store)
    return { status: 'ok' }
  })
}
