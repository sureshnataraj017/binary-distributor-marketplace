import type { FastifyInstance } from 'fastify'
import { defaultCommissionConfig as config } from '@/config/commissionConfig'
import { calculateCommission } from '@/domain/commissionEngine'
import { parseISO } from '@/domain/dateUtils'
import { assessOnboardings } from '@/domain/onboardingRules'
import { HttpError, notFound } from '../errors'
import type { Store } from '../store'

interface CreateSaleBody {
  retailerId: string
  product: string
  quantity: number
  /** Sale amount in cents. */
  amount: number
  date?: string
}

const createSaleSchema = {
  body: {
    type: 'object',
    required: ['retailerId', 'product', 'quantity', 'amount'],
    additionalProperties: false,
    properties: {
      retailerId: { type: 'string', minLength: 1 },
      product: { type: 'string', minLength: 1, maxLength: 100 },
      quantity: { type: 'integer', minimum: 1 },
      amount: { type: 'integer', minimum: 1, maximum: 100_000_000_00 },
      date: { type: 'string' },
    },
  },
} as const

export function saleRoutes(app: FastifyInstance, store: Store) {
  app.get('/api/sales', async () => store.sales.list())

  /**
   * Record a sale. The commission split is calculated HERE, on the server, from the configured
   * percentages: the client never sends (or gets to choose) commission amounts.
   */
  app.post<{ Body: CreateSaleBody }>(
    '/api/sales',
    { schema: createSaleSchema },
    async (request, reply) => {
      const { retailerId, product, quantity, amount } = request.body
      const now = new Date()

      const retailer = store.retailers.get(retailerId)
      if (!retailer) throw notFound('Retailer', retailerId)
      const distributor = store.distributors.get(retailer.distributorId)
      if (!distributor) throw new HttpError(422, `Retailer ${retailerId} has no valid distributor`)

      const assessment = assessOnboardings(
        store.retailers.listByDistributor(distributor.id),
        distributor,
        { now, config },
      ).find((a) => a.retailer.id === retailer.id)
      if (!assessment?.qualifies) {
        throw new HttpError(
          422,
          `Retailer ${retailerId} is not eligible for sales (${assessment?.exclusion ?? 'UNKNOWN'})`,
        )
      }

      const date = request.body.date === undefined ? now : parseISO(request.body.date)
      if (!date) throw new HttpError(400, 'date must be a valid ISO-8601 timestamp')
      if (date.getTime() > now.getTime())
        throw new HttpError(422, 'A sale cannot be dated in the future')
      if (date.getTime() < Date.parse(retailer.onboardedAt)) {
        throw new HttpError(422, 'A sale cannot predate the retailer onboarding')
      }

      const split = calculateCommission({ saleAmount: amount, ...config.sale })
      const sale = store.sales.create({
        retailerId: retailer.id,
        distributorId: distributor.id,
        date: date.toISOString(),
        product,
        quantity,
        amount,
        retailerCommission: split.retailer,
        distributorCommission: split.distributor,
        companyCommission: split.company,
        remainder: split.remainder,
      })
      return reply.status(201).send(sale)
    },
  )
}
