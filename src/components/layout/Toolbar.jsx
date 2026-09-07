import React, { useState } from 'react'
import { ZOOM_FACTOR } from '../../domain/constants/editor.js'
import { zoomAtPoint } from '../../domain/models/viewport.js'
import { requestDeleteSelected } from '../../features/editor/deleteSelected.js'
import { loadSavedLayout, resetCurrentLayout, saveCurrentLayout } from '../../services/layoutService.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useLayoutStore } from '../../stores/layoutStore.js'

// Edit-mode toolbar (04 §8.3): Phase 1 tools + Phase 2 Save/Load/Reset.
// No Undo/Redo (out of scope). All actions commit to Zustand; Konva only
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
  const objectCount = useLayoutStore((state) => state.layout.objects.length)
  const [saving, setSaving] = useState(false)

  const handleDelete = () => {
    requestDeleteSelected()
  }

  const handleSave = () => {
    setSaving(true)
    try {
      const result = saveCurrentLayout()
      if (result.ok) {
        useEditorStore.getState().showToast('success', 'Layout saved')
      } else {
        useEditorStore.getState().showToast('error', 'Could not save layout')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = () => {
    const result = loadSavedLayout()
    if (result.ok) {
      return
    }
    // Canvas shows the reconstruction on success (04 §15); feedback below
    // covers the failure paths (07 §15.3, §17.4).
    if (result.reason === 'missing') {
      useEditorStore.getState().showToast('info', 'No saved layout found')
    } else if (result.reason === 'malformed' || result.reason === 'invalid') {
      useEditorStore.getState().showToast('error', 'Layout data tidak valid')
    } else {
      useEditorStore.getState().showToast('error', 'Could not load layout')
    }
  }

  const handleReset = () => {
    // Destructive action requires confirmation (04 §8.3, §13).
    if (window.confirm('Reset the layout? All objects will be removed.')) {
      resetCurrentLayout()
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
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button
        type="button"
        disabled={objectCount === 0 || saving}
        title={objectCount === 0 ? 'Add an object before saving (UC-LD-001 A1)' : 'Save layout'}
        onClick={handleSave}
        className={
          objectCount === 0 || saving
            ? 'cursor-not-allowed rounded bg-cyan-400/40 px-2 py-1 text-xs text-neutral-950/60'
            : 'rounded bg-cyan-400 px-2 py-1 text-xs font-medium text-neutral-950 hover:bg-cyan-300'
        }
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={handleLoad} className={buttonClass(false, false)}>
        Load
      </button>
      <button
        type="button"
        disabled={objectCount === 0}
        title={objectCount === 0 ? 'Canvas is already empty' : 'Reset layout'}
        onClick={handleReset}
        className={
          objectCount === 0
            ? 'cursor-not-allowed rounded border border-red-900 px-2 py-1 text-xs text-neutral-600'
            : 'rounded border border-red-500 px-2 py-1 text-xs text-red-400 hover:bg-red-950'
        }
      >
        Reset Layout
      </button>
    </div>
  )
}
