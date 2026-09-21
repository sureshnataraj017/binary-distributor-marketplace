import type { FastifyInstance } from 'fastify'
import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { INDIA_STATES } from '@/config/indiaStates'
import { parseISO } from '@/domain/dateUtils'
import type { Position } from '@/types'
import { HttpError, notFound } from '../errors'
import type { Store } from '../store'

interface CreateDistributorBody {
  name: string
  state: string
  city: string
  parentId?: string | null
  position?: Position | null
  referredBy?: string | null
  dailyTarget?: number
  joinedAt?: string
}

const createDistributorSchema = {
  body: {
    type: 'object',
    required: ['name', 'state', 'city'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      state: { type: 'string', minLength: 1 },
      city: { type: 'string', minLength: 1, maxLength: 100 },
      parentId: { type: ['string', 'null'] },
      position: { type: ['string', 'null'], enum: ['LEFT', 'RIGHT', null] },
      referredBy: { type: ['string', 'null'] },
      dailyTarget: { type: 'integer', minimum: 0, maximum: 1000 },
      joinedAt: { type: 'string' },
    },
  },
} as const

export function distributorRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/distributors', async () => store.distributors.list())

  app.get<{ Params: { id: string } }>('/api/distributors/:id', async (request) => {
    const distributor = await store.distributors.get(request.params.id)
    if (!distributor) throw notFound('Distributor', request.params.id)
    return distributor
  })

  /**
   * Add one distributor. It is either top level (directly under the company) or placed on the LEFT or RIGHT
   * of an existing distributor. The database makes the slot unique, so two people can't take the same one.
   */
  app.post<{ Body: CreateDistributorBody }>(
    '/api/distributors',
    { schema: createDistributorSchema },
    async (request, reply) => {
      const body = request.body
      const now = new Date()
      const name = body.name.trim()
      const city = body.city.trim()
      if (!name) throw new HttpError(400, 'name must not be blank')
      if (!city) throw new HttpError(400, 'city must not be blank')
      if (!(INDIA_STATES as readonly string[]).includes(body.state)) {
        throw new HttpError(422, `"${body.state}" is not an Indian state or union territory`)
      }

      const parentId = body.parentId ?? null
      const position = body.position ?? null
      if (parentId && !position)
        throw new HttpError(422, 'Choose LEFT or RIGHT for a placed distributor')
      if (!parentId && position)
        throw new HttpError(422, 'A top-level distributor has no LEFT/RIGHT position')

      const parent = parentId ? await store.distributors.get(parentId) : undefined
      if (parentId && !parent) throw notFound('Distributor', parentId)
      // Friendly early check. The UNIQUE constraint in the database is what actually guarantees it under races.
      if (parentId && position) {
        const occupant = await store.distributors.childAt(parentId, position)
        if (occupant) {
          throw new HttpError(
            409,
            `That position is already taken by ${occupant.name} (${occupant.id}). Choose the other side or another parent.`,
          )
        }
      }
      if (body.referredBy && !(await store.distributors.get(body.referredBy))) {
        throw notFound('Distributor', body.referredBy)
      }

      const joinedAt = body.joinedAt === undefined ? now : parseISO(body.joinedAt)
      if (!joinedAt) throw new HttpError(400, 'joinedAt must be a valid ISO-8601 timestamp')
      if (joinedAt.getTime() > now.getTime())
        throw new HttpError(422, 'joinedAt cannot be in the future')
      if (parent && joinedAt.getTime() < Date.parse(parent.joinedAt)) {
        throw new HttpError(422, `A distributor cannot join before their parent (${parent.id})`)
      }

      const created = await store.distributors.create({
        name,
        state: body.state,
        city,
        parentId,
        position,
        referredBy: body.referredBy ?? null,
        dailyTarget: body.dailyTarget ?? config.onboarding.defaultDailyTarget,
        joinedAt: joinedAt.toISOString(),
      })
      return reply.status(201).header('location', `/api/distributors/${created.id}`).send(created)
    },
  )
}
