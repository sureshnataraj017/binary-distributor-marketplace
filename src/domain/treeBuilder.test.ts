import { describe, expect, it } from 'vitest'
import type { Distributor, Position } from '@/types'
import {
  buildForest,
  collectBranchIds,
  collectDownlineIds,
  findOpenSlots,
  getUpline,
  indexById,
  traceSaleHierarchy,
} from './treeBuilder'

const dist = (
  id: string,
  parentId: string | null = null,
  position: Position | null = null,
): Distributor => ({
  id,
  name: id,
  state: 'Kerala',
  city: 'Kochi',
  parentId,
  position,
  referredBy: null,
  retailerIds: [],
  dailyTarget: 2,
  joinedAt: '2026-01-01T00:00:00.000Z',
})

const sample = [dist('A'), dist('B', 'A', 'LEFT'), dist('C', 'A', 'RIGHT'), dist('D', 'B', 'LEFT')]

describe('buildForest', () => {
  it('builds a binary tree using LEFT/RIGHT positions', () => {
    const { roots, issues } = buildForest(sample)
    expect(issues).toEqual([])
    expect(roots).toHaveLength(1)
    expect(roots[0]?.left?.distributor.id).toBe('B')
    expect(roots[0]?.right?.distributor.id).toBe('C')
    expect(roots[0]?.left?.left?.depth).toBe(2)
  })

  it('supports several top-level distributors under the company', () => {
    expect(buildForest([dist('A'), dist('Z')]).roots).toHaveLength(2)
  })

  it('reports a second child in an occupied slot instead of dropping it', () => {
    const { roots, issues } = buildForest([...sample, dist('E', 'A', 'LEFT')])
    expect(issues).toMatchObject([{ type: 'POSITION_TAKEN', distributorId: 'E' }])
    expect(roots.map((r) => r.distributor.id)).toContain('E')
  })

  it('reports missing parents and invalid positions', () => {
    const { issues } = buildForest([dist('A'), dist('X', 'GHOST', 'LEFT'), dist('Y', 'A', null)])
    expect(issues.map((i) => i.type).sort()).toEqual(['INVALID_POSITION', 'MISSING_PARENT'])
  })

  it('detects parent cycles without hanging', () => {
    const { issues } = buildForest([dist('A', 'B', 'LEFT'), dist('B', 'A', 'LEFT')])
    expect(issues.filter((i) => i.type === 'CYCLE')).toHaveLength(2)
  })

  it('treats missing parents as normal roots for a filtered SUBSET view', () => {
    const { roots, issues } = buildForest([dist('B', 'A', 'LEFT'), dist('D', 'B', 'LEFT')], {
      scope: 'SUBSET',
    })
    expect(issues).toEqual([])
    expect(roots.map((r) => r.distributor.id)).toEqual(['B'])
  })
})

describe('hierarchy tracing', () => {
  const byId = indexById(sample)

  it('returns the upline nearest-first', () => {
    expect(getUpline('D', byId).map((d) => d.id)).toEqual(['B', 'A'])
    expect(getUpline('A', byId)).toEqual([])
  })

  it('traces the hierarchy responsible for a sale, top-down', () => {
    expect(traceSaleHierarchy('D', byId).map((d) => d.id)).toEqual(['A', 'B', 'D'])
  })

  it('does not loop forever on a cyclic upline', () => {
    const cyclic = indexById([dist('A', 'B', 'LEFT'), dist('B', 'A', 'LEFT')])
    expect(getUpline('A', cyclic).map((d) => d.id)).toEqual(['B'])
  })

  it('lists the branch nodes that can be collapsed', () => {
    expect(collectBranchIds(buildForest(sample).roots).sort()).toEqual(['A', 'B'])
  })

  it('collects every downline id of a node', () => {
    const root = buildForest(sample).roots[0]!
    expect(collectDownlineIds(root).sort()).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('findOpenSlots', () => {
  it('lists parents that still have a free side, and which sides', () => {
    // A has both children; B has only LEFT; C and D have none.
    const slots = findOpenSlots(sample)
    expect(slots.map((s) => [s.parent.id, s.free])).toEqual([
      ['B', ['RIGHT']],
      ['C', ['LEFT', 'RIGHT']],
      ['D', ['LEFT', 'RIGHT']],
    ])
  })

  it('offers a lone root both sides, and nothing when the list is empty', () => {
    expect(findOpenSlots([dist('A')]).map((s) => s.free)).toEqual([['LEFT', 'RIGHT']])
    expect(findOpenSlots([])).toEqual([])
  })
})
