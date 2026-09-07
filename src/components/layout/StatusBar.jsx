import React from 'react'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Status bar (04 §8.5): zoom % · grid/snap status · object count · hint.
export default function StatusBar() {
  const scale = useEditorStore((state) => state.scale)
  const gridVisible = useEditorStore((state) => state.gridVisible)
  const snapEnabled = useEditorStore((state) => state.snapEnabled)
  const count = useLayoutStore((state) => state.layout.objects.length)

  return (
    <footer className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-4 py-1.5 text-[11px] text-neutral-400">
      <span>{`Zoom: ${Math.round(scale * 100)}%`}</span>
      <span className={gridVisible ? 'text-cyan-400' : undefined}>{`Grid: ${gridVisible ? 'ON' : 'OFF'}`}</span>
      <span className={gridVisible && snapEnabled ? 'text-cyan-400' : undefined}>
        {`Snap: ${gridVisible && snapEnabled ? 'ON' : 'OFF'}`}
      </span>
      <span>{`${count} object${count === 1 ? '' : 's'}`}</span>
      <span className="ml-auto">Scroll to zoom · Drag empty canvas to pan</span>
    </footer>
  )
}
