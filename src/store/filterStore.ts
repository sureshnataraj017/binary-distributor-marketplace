import { create } from 'zustand'
import { ALL_STATES } from '@/config/indiaStates'

interface FilterState {
  /** Selected Indian state, or `ALL` for the whole network. Drives every list, KPI and the tree. */
  selectedState: string
  setSelectedState: (state: string) => void
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedState: ALL_STATES,
  setSelectedState: (selectedState) => set({ selectedState }),
}))
