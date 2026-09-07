import React from 'react'
import { ZOOM_FACTOR } from '../../domain/constants/editor.js'
import { zoomAtPoint } from '../../domain/models/viewport.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Edit-mode toolbar (04 §8.3, Phase 1 subset): no Save/Load/Reset (Phase 2),
// no Undo/Redo (out of scope). All actions commit to Zustand; Konva only
// re-renders.
function zoomBy(factor) {
  const editor = useEditorStore.getState()
  const { width, height } = editor.stageSize
  const next = zoomAtPoint(
    { scale: editor.scale, x: editor.stageX, y: editor.stageY },
    { x: width / 2, y: height / 2 },
    factor,
  )
  editor.setViewport(next)
}

const buttonClass = (active, disabled) =>
  `rounded px-2 py-1 text-xs ${
    disabled
      ? 'cursor-not-allowed text-neutral-600'
      : active
        ? 'bg-cyan-400 text-neutral-950'
        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
  }`

export default function Toolbar() {
  const activeTool = useEditorStore((state) => state.activeTool)
  const gridVisible = useEditorStore((state) => state.gridVisible)
  const snapEnabled = useEditorStore((state) => state.snapEnabled)
  const selectedId = useEditorStore((state) => state.selectedId)
  const scale = useEditorStore((state) => state.scale)

  const handleDelete = () => {
    const id = useEditorStore.getState().selectedId
    if (!id) {
      return
    }
    // Destructive action requires confirmation (04 §8.3, §13, §14).
    if (window.confirm('Delete the selected object?')) {
      useLayoutStore.getState().deleteObject(id)
    }
  }

  const handleDuplicate = () => {
    const id = useEditorStore.getState().selectedId
    if (id) {
      useLayoutStore.getState().duplicateObject(id)
    }
  }

  return (
    <div role="toolbar" aria-label="Editor tools" className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <button type="button" aria-pressed={activeTool === 'select'} onClick={() => useEditorStore.getState().setActiveTool('select')} className={buttonClass(activeTool === 'select', false)}>
        Select
      </button>
      <button type="button" aria-pressed={activeTool === 'pan'} onClick={() => useEditorStore.getState().setActiveTool('pan')} className={buttonClass(activeTool === 'pan', false)}>
        Pan
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button type="button" onClick={() => zoomBy(ZOOM_FACTOR)} className={buttonClass(false, false)}>
        Zoom In
      </button>
      <span className="px-1 text-xs text-neutral-400">{Math.round(scale * 100)}%</span>
      <button type="button" onClick={() => zoomBy(1 / ZOOM_FACTOR)} className={buttonClass(false, false)}>
        Zoom Out
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button type="button" aria-pressed={gridVisible} onClick={() => useEditorStore.getState().toggleGrid()} className={buttonClass(gridVisible, false)}>
        Grid
      </button>
      <button
        type="button"
        aria-pressed={snapEnabled && gridVisible}
        disabled={!gridVisible}
        title={gridVisible ? 'Toggle snap to grid' : 'Enable grid to use snap'}
        onClick={() => useEditorStore.getState().toggleSnap()}
        className={buttonClass(snapEnabled && gridVisible, !gridVisible)}
      >
        {`Snap: ${snapEnabled && gridVisible ? 'ON' : 'OFF'}`}
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button type="button" disabled={!selectedId} onClick={handleDuplicate} className={buttonClass(false, !selectedId)}>
        Duplicate
      </button>
      <button type="button" disabled={!selectedId} onClick={handleDelete} className={buttonClass(false, !selectedId)}>
        Delete
      </button>
    </div>
  )
}
