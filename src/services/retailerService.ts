import type { Retailer, RetailerStatus } from '@/types'
import { apiGet, apiPatch, apiPost } from './apiClient'

export interface CreateRetailerInput {
  name: string
  distributorId: string
  city: string
  state: string
  phone?: string
  /** ISO timestamp. Omit for "now". */
  onboardedAt?: string
}

export interface RetailerService {
  list(): Promise<Retailer[]>
  getById(id: string): Promise<Retailer>
  create(input: CreateRetailerInput): Promise<Retailer>
  setStatus(id: string, status: RetailerStatus): Promise<Retailer>
}

export const retailerService: RetailerService = {
  list: () => apiGet('/retailers'),
  getById: (id) => apiGet(`/retailers/${encodeURIComponent(id)}`),
  create: (input) => apiPost('/retailers', input),
  setStatus: (id, status) => apiPatch(`/retailers/${encodeURIComponent(id)}/status`, { status }),
}
