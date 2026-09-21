import type { FastifyInstance } from 'fastify'
import { INDIA_STATES } from '@/config/indiaStates'
import { parseISO } from '@/domain/dateUtils'
import { normalizePhone } from '@/domain/onboardingRules'
import type { RetailerStatus } from '@/types'
import { HttpError, notFound } from '../errors'
import type { Store } from '../store'

interface CreateRetailerBody {
  name: string
  distributorId: string
  city: string
  state?: string
  phone?: string | null
  onboardedAt?: string
}

const createRetailerSchema = {
  body: {
    type: 'object',
    required: ['name', 'distributorId', 'city'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      distributorId: { type: 'string', minLength: 1 },
      city: { type: 'string', minLength: 1, maxLength: 100 },
      state: { type: 'string' },
      phone: { type: ['string', 'null'], maxLength: 25 },
      onboardedAt: { type: 'string' },
    },
  },
} as const

const statusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: { status: { type: 'string', enum: ['ACTIVE', 'DEACTIVATED', 'CANCELLED'] } },
  },
} as const

export function retailerRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/retailers', async () => store.retailers.list())

  app.get<{ Params: { id: string } }>('/api/retailers/:id', async (request) => {
    const retailer = await store.retailers.get(request.params.id)
    if (!retailer) throw notFound('Retailer', request.params.id)
    return retailer
  })

  app.get<{ Params: { id: string } }>('/api/retailers/:id/sales', async (request) => {
    if (!(await store.retailers.get(request.params.id)))
      throw notFound('Retailer', request.params.id)
    return store.sales.listByRetailer(request.params.id)
  })

  /**
   * Onboard one retailer. New retailers always start ACTIVE. Rejects a retailer whose phone number is already
   * registered under the same distributor, and dates that are in the future or before the distributor joined.
   */
  app.post<{ Body: CreateRetailerBody }>(
    '/api/retailers',
    { schema: createRetailerSchema },
    async (request, reply) => {
      const body = request.body
      const now = new Date()
      const name = body.name.trim()
      const city = body.city.trim()
      if (!name) throw new HttpError(400, 'name must not be blank')
      if (!city) throw new HttpError(400, 'city must not be blank')

      const distributor = await store.distributors.get(body.distributorId)
      if (!distributor) throw notFound('Distributor', body.distributorId)

      const state = body.state ?? distributor.state
      if (!(INDIA_STATES as readonly string[]).includes(state)) {
        throw new HttpError(422, `"${state}" is not an Indian state or union territory`)
      }

      const phone = body.phone?.trim() || null
      if (phone) {
        const digits = phone.replace(/\D/g, '')
        if (digits.length < 10 || digits.length > 13 || !/^[+\d][\d\s\-()]*$/.test(phone)) {
          throw new HttpError(422, 'phone must be a valid number with 10 to 13 digits')
        }
        const existing = await store.retailers.listByDistributor(distributor.id)
        const clash = existing.find(
          (r) => r.phone && normalizePhone(r.phone) === normalizePhone(phone),
        )
        if (clash) {
          throw new HttpError(
            409,
            `${clash.name} (${clash.id}) is already registered with this phone number`,
          )
        }
      }

      const onboardedAt = body.onboardedAt === undefined ? now : parseISO(body.onboardedAt)
      if (!onboardedAt) throw new HttpError(400, 'onboardedAt must be a valid ISO-8601 timestamp')
      if (onboardedAt.getTime() > now.getTime())
        throw new HttpError(422, 'onboardedAt cannot be in the future')
      if (onboardedAt.getTime() < Date.parse(distributor.joinedAt)) {
        throw new HttpError(
          422,
          `A retailer cannot be onboarded before the distributor joined (${distributor.id})`,
        )
      }

      const created = await store.retailers.create({
        name,
        distributorId: distributor.id,
        state,
        city,
        phone,
        onboardedAt: onboardedAt.toISOString(),
        status: 'ACTIVE',
      })
      return reply.status(201).header('location', `/api/retailers/${created.id}`).send(created)
    },
  )

  /** Deactivate, cancel or reactivate a retailer. CANCELLED is final: a cancelled retailer stays cancelled. */
  app.patch<{ Params: { id: string }; Body: { status: RetailerStatus } }>(
    '/api/retailers/:id/status',
    { schema: statusSchema },
    async (request) => {
      const retailer = await store.retailers.get(request.params.id)
      if (!retailer) throw notFound('Retailer', request.params.id)
      const { status } = request.body
      if (status === retailer.status) return retailer
      if (retailer.status === 'CANCELLED') {
        throw new HttpError(
          409,
          'A cancelled retailer cannot be changed. Onboard a new retailer instead.',
        )
      }
      return (await store.retailers.setStatus(retailer.id, status))!
    },
  )
}
