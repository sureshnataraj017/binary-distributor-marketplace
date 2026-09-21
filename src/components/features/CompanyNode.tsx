import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { formatCurrency } from '@/utils/currencyFormatter'
import { NODE_WIDTH } from '@/utils/treeLayout'

export interface CompanyNodeData extends Record<string, unknown> {
  distributors: number
  retailers: number
  sales: number
}
export type CompanyFlowNode = Node<CompanyNodeData, 'company'>

export function CompanyNode({ data }: NodeProps<CompanyFlowNode>) {
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className="rounded-xl border border-brand bg-brand-soft p-3 text-center"
    >
      <div className="text-sm font-semibold text-brand">COMPANY</div>
      <div className="mt-1 text-xs text-ink-2">
        {data.distributors} distributors · {data.retailers} retailers
      </div>
      <div className="text-xs font-medium tabular-nums">{formatCurrency(data.sales)} in sales</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
    </div>
  )
}
