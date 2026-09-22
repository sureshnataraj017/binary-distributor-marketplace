import type { Edge } from '@xyflow/react'
import type { CompanyFlowNode } from '@/components/organisms/CompanyNode'
import type { DistributorFlowNode } from '@/components/organisms/DistributorNode'
import type { DashboardMetrics, DistributorSummary } from '@/domain/metrics'
import type { Distributor, Retailer } from '@/types'
import { COMPANY_ID, type LayoutEdge, type LayoutItem } from './treeLayout'

export type FlowNode = CompanyFlowNode | DistributorFlowNode

interface Inputs {
  items: readonly LayoutItem[]
  edges: readonly LayoutEdge[]
  distributors: readonly Distributor[]
  summaries: ReadonlyMap<string, DistributorSummary> | null
  retailersByDistributor: ReadonlyMap<string, Retailer[]>
  metrics: DashboardMetrics | null
}

/** Convert the pure layout result into React Flow nodes and edges. */
export function toFlowGraph({
  items,
  edges,
  distributors,
  summaries,
  retailersByDistributor,
  metrics,
}: Inputs) {
  const byId = new Map(distributors.map((d) => [d.id, d]))

  const nodes: FlowNode[] = items.flatMap<FlowNode>((item) => {
    const position = { x: item.x, y: item.y }
    if (item.kind === 'company') {
      return [
        {
          id: COMPANY_ID,
          type: 'company',
          position,
          draggable: false,
          selectable: false,
          data: {
            distributors: metrics?.totalDistributors ?? 0,
            retailers: metrics?.totalRetailers ?? 0,
            sales: [...(summaries?.values() ?? [])].reduce((sum, s) => sum + s.totalSales, 0),
          },
        },
      ]
    }
    const distributor = byId.get(item.id)
    if (!distributor) return []
    return [
      {
        id: item.id,
        type: 'distributor',
        position,
        draggable: false,
        selectable: false,
        data: {
          distributor,
          summary: summaries?.get(item.id),
          retailers: retailersByDistributor.get(item.id) ?? [],
          side: item.position,
          hiddenCount: item.hiddenCount,
          hasChildren: item.hasChildren,
        },
      },
    ]
  })

  const flowEdges: Edge[] = edges.map((edge) => ({
    ...edge,
    type: 'smoothstep',
    style: { stroke: 'var(--line-strong)', strokeWidth: 1.5 },
  }))

  return { nodes, edges: flowEdges }
}
