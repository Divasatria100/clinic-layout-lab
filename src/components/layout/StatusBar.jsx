import React from 'react'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'
import { useMovementStore } from '../../stores/movementStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'
import { useSimulationStore } from '../../stores/simulationStore.js'

// Status bar (04 §5.1, §8.5): zoom · grid/snap · object/path count ·
// simulation status/records in Simulation mode · contextual hint.
const HINTS = {
  path: 'Click objects for source/destination · Double-click a segment to add a point',
  simulation: 'Simulation follows the navigation path · Scroll to zoom',
  edit: 'Scroll to zoom · Drag empty canvas to pan',
}

export default function StatusBar() {
  const scale = useEditorStore((state) => state.scale)
  const gridVisible = useEditorStore((state) => state.gridVisible)
  const snapEnabled = useEditorStore((state) => state.snapEnabled)
  const mode = useEditorStore((state) => state.mode)
  const count = useLayoutStore((state) => state.layout.objects.length)
  const pathCount = useNavigationStore((state) => state.paths.length)
  const simStatus = useSimulationStore((state) => state.session?.status ?? null)
  const recordCount = useMovementStore((state) => state.records.length)

  return (
    <footer className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-4 py-1.5 text-[11px] text-neutral-400">
      <span>{`Zoom: ${Math.round(scale * 100)}%`}</span>
      <span className={gridVisible ? 'text-cyan-400' : undefined}>{`Grid: ${gridVisible ? 'ON' : 'OFF'}`}</span>
      <span className={gridVisible && snapEnabled ? 'text-cyan-400' : undefined}>
        {`Snap: ${gridVisible && snapEnabled ? 'ON' : 'OFF'}`}
      </span>
      <span>{`${count} object${count === 1 ? '' : 's'}`}</span>
      <span>{`${pathCount} path${pathCount === 1 ? '' : 's'}`}</span>
      {mode === 'simulation' && (
        <span>{simStatus ? `Sim: ${simStatus} · ${recordCount} records` : 'Sim: Ready'}</span>
      )}
      <span className="ml-auto">{HINTS[mode] ?? HINTS.edit}</span>
    </footer>
  )
}
