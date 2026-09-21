import type { Distributor } from '@/types'
import { apiGet } from './apiClient'

export interface DistributorService {
  list(): Promise<Distributor[]>
  getById(id: string): Promise<Distributor>
}

export const distributorService: DistributorService = {
  list: () => apiGet('/distributors'),
  getById: (id) => apiGet(`/distributors/${encodeURIComponent(id)}`),
}
