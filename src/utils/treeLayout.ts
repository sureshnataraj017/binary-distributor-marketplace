import { hierarchy, tree } from 'd3-hierarchy'
import { collectDownlineIds, type TreeNode } from '@/domain/treeBuilder'
import type { Position } from '@/types'

export const NODE_WIDTH = 248
export const NODE_HEIGHT = 148
const H_GAP = 28
const V_GAP = 76

export const COMPANY_ID = 'COMPANY'

export interface LayoutItem {
  id: string
  kind: 'company' | 'distributor'
  position: Position | null
  hiddenCount: number
  hasChildren: boolean
  depth: number
  x: number
  y: number
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
}

interface Draft {
  id: string
  kind: 'company' | 'distributor' | 'placeholder'
  position: Position | null
  hiddenCount: number
  hasChildren: boolean
  children: Draft[]
}

function toDraft(node: TreeNode, collapsed: ReadonlySet<string>): Draft {
  const id = node.distributor.id
  const hasChildren = !!(node.left || node.right)
  const isCollapsed = collapsed.has(id)

  // A lone child keeps its LEFT/RIGHT side by reserving the empty slot with an invisible placeholder.
  const slots = isCollapsed || !hasChildren ? [] : [node.left, node.right]
  const children = slots.map<Draft>((child, index) =>
    child
      ? toDraft(child, collapsed)
      : {
          id: `${id}:empty-${index}`,
          kind: 'placeholder',
          position: null,
          hiddenCount: 0,
          hasChildren: false,
          children: [],
        },
  )

  return {
    id,
    kind: 'distributor',
    position: node.distributor.position,
    hiddenCount: isCollapsed ? collectDownlineIds(node).length - 1 : 0,
    hasChildren,
    children,
  }
}

/**
 * Compute node coordinates for the network canvas.
 * The company sits at the top; top-level distributors hang beneath it.
 */
export function layoutForest(roots: readonly TreeNode[], collapsed: ReadonlySet<string>) {
  const root: Draft = {
    id: COMPANY_ID,
    kind: 'company',
    position: null,
    hiddenCount: 0,
    hasChildren: roots.length > 0,
    children: roots.map((r) => toDraft(r, collapsed)),
  }

  const laidOut = tree<Draft>()
    .nodeSize([NODE_WIDTH + H_GAP, NODE_HEIGHT + V_GAP])
    .separation(() => 1)(hierarchy(root, (d) => d.children))

  const items: LayoutItem[] = []
  const edges: LayoutEdge[] = []

  laidOut.each((n) => {
    if (n.data.kind === 'placeholder') return
    items.push({
      id: n.data.id,
      kind: n.data.kind,
      position: n.data.position,
      hiddenCount: n.data.hiddenCount,
      hasChildren: n.data.hasChildren,
      depth: n.depth,
      x: n.x - NODE_WIDTH / 2,
      y: n.y,
    })
    if (n.parent) {
      edges.push({
        id: `${n.parent.data.id}->${n.data.id}`,
        source: n.parent.data.id,
        target: n.data.id,
      })
    }
  })

  return { items, edges }
}
