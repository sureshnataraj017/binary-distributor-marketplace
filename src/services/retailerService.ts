import type { Retailer } from '@/types'
import { apiGet } from './apiClient'

export interface RetailerService {
  list(): Promise<Retailer[]>
  getById(id: string): Promise<Retailer>
}

export const retailerService: RetailerService = {
  list: () => apiGet('/retailers'),
  getById: (id) => apiGet(`/retailers/${encodeURIComponent(id)}`),
}
