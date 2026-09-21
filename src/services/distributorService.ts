import type { Distributor, Position } from '@/types'
import { apiGet, apiPost } from './apiClient'

export interface CreateDistributorInput {
  name: string
  state: string
  city: string
  /** Omit for a top-level distributor (directly under the company). */
  parentId?: string
  position?: Position
  referredBy?: string
  dailyTarget?: number
  /** ISO timestamp. Omit for "now". */
  joinedAt?: string
}

export interface DistributorService {
  list(): Promise<Distributor[]>
  getById(id: string): Promise<Distributor>
  create(input: CreateDistributorInput): Promise<Distributor>
}

export const distributorService: DistributorService = {
  list: () => apiGet('/distributors'),
  getById: (id) => apiGet(`/distributors/${encodeURIComponent(id)}`),
  create: (input) => apiPost('/distributors', input),
}
