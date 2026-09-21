import type { Sale } from '@/types'
import { apiGet, apiPost } from './apiClient'

export interface CreateSaleInput {
  retailerId: string
  product: string
  quantity: number
  /** Sale amount in cents. Commissions are calculated by the server. */
  amount: number
  date?: string
}

export interface SalesService {
  list(): Promise<Sale[]>
  listByRetailer(retailerId: string): Promise<Sale[]>
  create(input: CreateSaleInput): Promise<Sale>
}

export const salesService: SalesService = {
  list: () => apiGet('/sales'),
  listByRetailer: (retailerId) => apiGet(`/retailers/${encodeURIComponent(retailerId)}/sales`),
  create: (input) => apiPost('/sales', input),
}
