import { create } from 'zustand'

interface NetworkState {
  collapsedIds: ReadonlySet<string>
  selectedId: string | null
  toggleCollapsed: (id: string) => void
  collapseAll: (ids: readonly string[]) => void
  expandAll: () => void
  select: (id: string | null) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  collapsedIds: new Set(),
  selectedId: null,
  toggleCollapsed: (id) =>
    set((state) => {
      const next = new Set(state.collapsedIds)
      if (!next.delete(id)) next.add(id)
      return { collapsedIds: next }
    }),
  collapseAll: (ids) => set({ collapsedIds: new Set(ids) }),
  expandAll: () => set({ collapsedIds: new Set() }),
  select: (selectedId) => set({ selectedId }),
}))
