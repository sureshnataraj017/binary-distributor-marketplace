import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { useThemeStore } from '@/store/themeStore'
import type { FlowNode } from '@/utils/flowGraph'
import { CompanyNode } from './CompanyNode'
import { DistributorNode } from './DistributorNode'

// Defined once, outside any component, so React Flow does not re-register node types on every render.
const nodeTypes = { company: CompanyNode, distributor: DistributorNode }

interface BinaryTreeProps {
  nodes: FlowNode[]
  edges: Edge[]
  /** When this changes (e.g. the state filter), the camera re-fits to the new tree. */
  fitKey: string
}

function FitOnChange({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const id = requestAnimationFrame(
      () => void fitView({ padding: 0.15, duration: 300, maxZoom: 1 }),
    )
    return () => cancelAnimationFrame(id)
  }, [fitKey, fitView])
  return null
}

/** Zoomable, pannable canvas. Layout and data come in as props; it holds no business logic. */
export function BinaryTree({ nodes, edges, fitKey }: BinaryTreeProps) {
  const theme = useThemeStore((s) => s.theme)
  const select = useNetworkStore((s) => s.select)

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onPaneClick={() => select(null)}
        aria-label="Distributor network tree. Drag to pan, scroll to zoom."
      >
        <Background gap={24} color="var(--line)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="var(--line-strong)"
          maskColor="rgba(0,0,0,0.08)"
          className="!hidden md:!block"
        />
        <FitOnChange fitKey={fitKey} />
      </ReactFlow>
    </ReactFlowProvider>
  )
}
