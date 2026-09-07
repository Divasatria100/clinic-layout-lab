import React from 'react'
import { loadSavedNavigation, saveCurrentNavigation } from '../../services/navigationService.js'
import { useEditorStore } from '../../stores/editorStore.js'
import { useNavigationStore } from '../../stores/navigationStore.js'

// Path-mode toolbar (04 §7.3 subset): drawing guidance + Delete Path +
// navigation Save/Load. Edit tools stay in the Edit toolbar; objects are
// read-only in Path mode. Paths are created by clicking two objects —
// no canvas drawing step, no Enter/dblclick needed.
const buttonClass = (disabled) =>
  `rounded px-2 py-1 text-xs ${
    disabled ? 'cursor-not-allowed text-neutral-600' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
  }`

export default function PathToolbar() {
  const pendingSourceId = useNavigationStore((state) => state.pendingSourceId)
  const selectedPathId = useNavigationStore((state) => state.selectedPathId)
  const editingPathId = useNavigationStore((state) => state.editingPathId)
  const pathCount = useNavigationStore((state) => state.paths.length)

  const hint = pendingSourceId
    ? 'Source picked — click a different object as the destination'
    : editingPathId
      ? 'Editing path — drag points or double-click a segment to add a point.'
      : 'Click an object to pick the path source'

  const handleEditToggle = () => {
    const nav = useNavigationStore.getState()
    if (nav.editingPathId) {
      nav.stopEditing()
    } else if (nav.selectedPathId) {
      nav.startEditing(nav.selectedPathId)
    }
  }

  const handleDelete = () => {
    const id = useNavigationStore.getState().selectedPathId
    if (!id) {
      return
    }
    if (window.confirm('Delete the selected path?')) {
      useNavigationStore.getState().deletePath(id)
    }
  }

  const handleSave = () => {
    const result = saveCurrentNavigation()
    useEditorStore.getState().showToast(
      result.ok ? 'success' : 'error',
      result.ok ? 'Navigation saved' : 'Could not save navigation',
    )
  }

  const handleLoad = () => {
    const result = loadSavedNavigation()
    if (result.ok) {
      return
    }
    if (result.reason === 'missing') {
      useEditorStore.getState().showToast('info', 'No saved navigation found')
    } else if (result.reason === 'malformed' || result.reason === 'invalid') {
      useEditorStore.getState().showToast('error', 'Navigation data tidak valid')
    } else {
      useEditorStore.getState().showToast('error', 'Could not load navigation')
    }
  }

  return (
    <div role="toolbar" aria-label="Path tools" className="flex flex-wrap items-center gap-1 border-b border-neutral-800 bg-neutral-950 px-4 py-2">
      <span className="pr-2 text-xs text-neutral-400">{hint}</span>
      <button
        type="button"
        disabled={!selectedPathId}
        aria-pressed={Boolean(editingPathId)}
        title="Show waypoint handles (double-click a segment to add, double-click a waypoint to remove)"
        onClick={handleEditToggle}
        className={buttonClass(!selectedPathId)}
      >
        {editingPathId ? 'Done' : 'Edit Path'}
      </button>
      <button type="button" disabled={!selectedPathId} onClick={handleDelete} className={buttonClass(!selectedPathId)}>
        Delete Path
      </button>
      <span className="mx-1 h-4 w-px bg-neutral-800" />
      <button type="button" disabled={pathCount === 0} onClick={handleSave} className={buttonClass(pathCount === 0)}>
        Save
      </button>
      <button type="button" onClick={handleLoad} className={buttonClass(false)}>
        Load
      </button>
    </div>
  )
}
