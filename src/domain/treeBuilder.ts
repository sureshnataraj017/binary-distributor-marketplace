import type { Distributor } from '@/types'

export interface TreeNode {
  distributor: Distributor
  left: TreeNode | null
  right: TreeNode | null
  depth: number
}

export type TreeIssueType = 'MISSING_PARENT' | 'POSITION_TAKEN' | 'INVALID_POSITION' | 'CYCLE'

export interface TreeIssue {
  type: TreeIssueType
  distributorId: string
  message: string
}

export interface Forest {
  roots: TreeNode[]
  issues: TreeIssue[]
}

interface BuildOptions {
  /**
   * `SUBSET` is used for filtered views (e.g. one state): a missing parent is expected and the
   * distributor simply becomes a root. `FULL` reports it as a data issue.
   */
  scope?: 'FULL' | 'SUBSET'
}

/**
 * Build the binary forest from flat distributor records.
 * Bad data never crashes or silently disappears: it is reported through `issues`.
 */
export function buildForest(
  distributors: readonly Distributor[],
  options: BuildOptions = {},
): Forest {
  const scope = options.scope ?? 'FULL'
  const issues: TreeIssue[] = []
  const nodes = new Map<string, TreeNode>()
  for (const distributor of distributors) {
    nodes.set(distributor.id, { distributor, left: null, right: null, depth: 0 })
  }

  const roots: TreeNode[] = []

  for (const node of nodes.values()) {
    const { id, parentId, position } = node.distributor

    if (parentId === null) {
      roots.push(node)
      continue
    }

    const parent = nodes.get(parentId)
    if (!parent) {
      if (scope === 'FULL') {
        issues.push({
          type: 'MISSING_PARENT',
          distributorId: id,
          message: `Parent ${parentId} of ${id} does not exist`,
        })
      }
      roots.push(node)
      continue
    }

    if (position !== 'LEFT' && position !== 'RIGHT') {
      issues.push({
        type: 'INVALID_POSITION',
        distributorId: id,
        message: `${id} has a parent but no LEFT/RIGHT position`,
      })
      roots.push(node)
      continue
    }

    const slot = position === 'LEFT' ? 'left' : 'right'
    if (parent[slot]) {
      issues.push({
        type: 'POSITION_TAKEN',
        distributorId: id,
        message: `${parentId} already has a ${position} child`,
      })
      roots.push(node)
      continue
    }
    parent[slot] = node
  }

  // Assign depths and find nodes unreachable from any root (i.e. parent cycles).
  const visited = new Set<string>()
  const walk = (node: TreeNode, depth: number) => {
    node.depth = depth
    visited.add(node.distributor.id)
    if (node.left) walk(node.left, depth + 1)
    if (node.right) walk(node.right, depth + 1)
  }
  roots.forEach((root) => walk(root, 0))

  for (const node of nodes.values()) {
    if (!visited.has(node.distributor.id)) {
      issues.push({
        type: 'CYCLE',
        distributorId: node.distributor.id,
        message: `${node.distributor.id} is part of a parent cycle`,
      })
    }
  }

  return { roots, issues }
}

/** Ancestors of a distributor, nearest first. Guards against cycles in bad data. */
export function getUpline(id: string, byId: ReadonlyMap<string, Distributor>): Distributor[] {
  const chain: Distributor[] = []
  const seen = new Set<string>([id])
  let current = byId.get(id)?.parentId ?? null
  while (current && !seen.has(current)) {
    const parent = byId.get(current)
    if (!parent) break
    chain.push(parent)
    seen.add(current)
    current = parent.parentId
  }
  return chain
}

/** The full hierarchy responsible for a sale: top-most ancestor first, selling distributor last. */
export function traceSaleHierarchy(
  distributorId: string,
  byId: ReadonlyMap<string, Distributor>,
): Distributor[] {
  const self = byId.get(distributorId)
  if (!self) return []
  return [...getUpline(distributorId, byId).reverse(), self]
}

/** Every distributor id at or below `node` (used for downline totals). */
export function collectDownlineIds(node: TreeNode): string[] {
  const ids = [node.distributor.id]
  if (node.left) ids.push(...collectDownlineIds(node.left))
  if (node.right) ids.push(...collectDownlineIds(node.right))
  return ids
}

/** Ids of every node that has at least one child (the ones that can be collapsed). */
export function collectBranchIds(roots: readonly TreeNode[]): string[] {
  const ids: string[] = []
  const stack = [...roots]
  while (stack.length) {
    const node = stack.pop()!
    if (node.left || node.right) ids.push(node.distributor.id)
    if (node.left) stack.push(node.left)
    if (node.right) stack.push(node.right)
  }
  return ids
}

export function indexById(distributors: readonly Distributor[]): Map<string, Distributor> {
  return new Map(distributors.map((d) => [d.id, d]))
}
